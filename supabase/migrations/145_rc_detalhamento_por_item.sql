-- ─────────────────────────────────────────────────────────────────────────────
-- 145_rc_detalhamento_por_item.sql
--
-- Detalhamento livre por linha da RC + flag no cadastro para forçar o
-- preenchimento em itens genéricos (ex.: MAO DE OBRA - MANUTENCAO DE VEICULOS).
--
--   * est_itens.exige_detalhe (boolean) — quando true, o front exige
--     descricao_complementar preenchida na RC.
--   * cmp_requisicao_itens.descricao_complementar (text) — campo livre
--     por linha (especificação, detalhe do serviço, placa do veículo etc).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.est_itens
  ADD COLUMN IF NOT EXISTS exige_detalhe boolean NOT NULL DEFAULT false;

ALTER TABLE public.cmp_requisicao_itens
  ADD COLUMN IF NOT EXISTS descricao_complementar text;

COMMENT ON COLUMN public.est_itens.exige_detalhe IS
  'Quando true, RCs com este item exigem descricao_complementar preenchida (itens genericos tipo mao de obra).';
COMMENT ON COLUMN public.cmp_requisicao_itens.descricao_complementar IS
  'Detalhamento livre por linha da RC: especificacao, descricao do servico executado, placa do veiculo etc.';

-- Estende replace_requisicao_itens (migration 100) para gravar descricao_complementar
-- no INSERT e nos snapshots de antes/depois do historico.
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
  SELECT jsonb_agg(x ORDER BY x->>'descricao', x->>'quantidade')
    INTO v_antes
  FROM (
    SELECT jsonb_build_object(
      'descricao', descricao,
      'descricao_complementar', descricao_complementar,
      'quantidade', quantidade,
      'unidade', unidade,
      'valor_unitario_estimado', valor_unitario_estimado,
      'marca', marca
    ) AS x
    FROM cmp_requisicao_itens
    WHERE requisicao_id = p_requisicao_id
  ) s;

  DELETE FROM cmp_requisicao_itens WHERE requisicao_id = p_requisicao_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO cmp_requisicao_itens (
      requisicao_id, descricao, descricao_complementar,
      quantidade, unidade, valor_unitario_estimado,
      marca, est_item_id, est_item_codigo,
      classe_financeira_id, classe_financeira_codigo, classe_financeira_descricao,
      categoria_financeira_codigo, categoria_financeira_descricao, destino_operacional
    ) VALUES (
      p_requisicao_id,
      v_item->>'descricao',
      NULLIF(v_item->>'descricao_complementar', ''),
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

  SELECT jsonb_agg(x ORDER BY x->>'descricao', x->>'quantidade')
    INTO v_depois
  FROM (
    SELECT jsonb_build_object(
      'descricao', descricao,
      'descricao_complementar', descricao_complementar,
      'quantidade', quantidade,
      'unidade', unidade,
      'valor_unitario_estimado', valor_unitario_estimado,
      'marca', marca
    ) AS x
    FROM cmp_requisicao_itens
    WHERE requisicao_id = p_requisicao_id
  ) s;

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
