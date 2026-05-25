-- 100: histórico de alteração de itens da RC
-- Estende replace_requisicao_itens para registrar antes/depois em cmp_historico_status
-- (dados_extra.tipo = 'alteracao_itens'), identificando o autor via auth.uid().
-- Também libera leitura de cmp_historico_status para autenticados (estava com RLS
-- ligada e sem policy = ninguém lia), consistente com cmp_requisicoes.

DROP POLICY IF EXISTS hist_status_select_auth ON cmp_historico_status;
CREATE POLICY hist_status_select_auth ON cmp_historico_status
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.replace_requisicao_itens(p_requisicao_id uuid, p_itens jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item JSONB;
  v_antes JSONB;
  v_depois JSONB;
  v_autor_id UUID;
  v_autor_nome TEXT;
  v_solicitante_id UUID;
  v_status TEXT;
  v_tipo TEXT;
BEGIN
  -- Snapshot ANTES (representação compacta, ordenada para comparação estável)
  SELECT jsonb_agg(x ORDER BY x->>'descricao', x->>'quantidade')
    INTO v_antes
  FROM (
    SELECT jsonb_build_object(
      'descricao', descricao,
      'quantidade', quantidade,
      'unidade', unidade,
      'valor_unitario_estimado', valor_unitario_estimado,
      'marca', marca
    ) AS x
    FROM cmp_requisicao_itens
    WHERE requisicao_id = p_requisicao_id
  ) s;

  -- Apaga itens existentes (roda como superuser, sem RLS)
  DELETE FROM cmp_requisicao_itens WHERE requisicao_id = p_requisicao_id;

  -- Insere novos itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO cmp_requisicao_itens (
      requisicao_id, descricao, quantidade, unidade, valor_unitario_estimado,
      marca, est_item_id, est_item_codigo,
      classe_financeira_id, classe_financeira_codigo, classe_financeira_descricao,
      categoria_financeira_codigo, categoria_financeira_descricao, destino_operacional
    ) VALUES (
      p_requisicao_id,
      v_item->>'descricao',
      (v_item->>'quantidade')::numeric,
      COALESCE(v_item->>'unidade', 'un'),
      COALESCE((v_item->>'valor_unitario_estimado')::numeric, 0),
      NULLIF(v_item->>'marca', ''),
      (v_item->>'est_item_id')::uuid,
      NULLIF(v_item->>'est_item_codigo', ''),
      (v_item->>'classe_financeira_id')::uuid,
      NULLIF(v_item->>'classe_financeira_codigo', ''),
      NULLIF(v_item->>'classe_financeira_descricao', ''),
      NULLIF(v_item->>'categoria_financeira_codigo', ''),
      NULLIF(v_item->>'categoria_financeira_descricao', ''),
      COALESCE(NULLIF(v_item->>'destino_operacional', ''), 'estoque')
    );
  END LOOP;

  -- Snapshot DEPOIS
  SELECT jsonb_agg(x ORDER BY x->>'descricao', x->>'quantidade')
    INTO v_depois
  FROM (
    SELECT jsonb_build_object(
      'descricao', descricao,
      'quantidade', quantidade,
      'unidade', unidade,
      'valor_unitario_estimado', valor_unitario_estimado,
      'marca', marca
    ) AS x
    FROM cmp_requisicao_itens
    WHERE requisicao_id = p_requisicao_id
  ) s;

  -- Registra histórico apenas quando os itens realmente mudaram
  IF v_antes IS DISTINCT FROM v_depois THEN
    SELECT id, nome INTO v_autor_id, v_autor_nome
      FROM sys_perfis WHERE auth_id = auth.uid();
    SELECT solicitante_id, status::text INTO v_solicitante_id, v_status
      FROM cmp_requisicoes WHERE id = p_requisicao_id;
    v_tipo := CASE
      WHEN v_autor_id IS NOT NULL AND v_autor_id = v_solicitante_id THEN 'requisitante'
      ELSE 'aprovador'
    END;

    INSERT INTO cmp_historico_status (
      requisicao_id, status_anterior, status_novo,
      responsavel_nome, responsavel_tipo, observacao, dados_extra
    ) VALUES (
      p_requisicao_id, v_status, COALESCE(v_status, 'desconhecido'),
      COALESCE(v_autor_nome, 'Sistema'), v_tipo, 'Itens alterados',
      jsonb_build_object(
        'tipo', 'alteracao_itens',
        'antes', COALESCE(v_antes, '[]'::jsonb),
        'depois', COALESCE(v_depois, '[]'::jsonb)
      )
    );
  END IF;
END;
$function$;
