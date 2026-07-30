-- ─────────────────────────────────────────────────────────────────────────────
-- 197_cmp_saldo_qtd_cotacao.sql
--
-- Quantidade parcial na cotação: quando o fornecedor só tem parte da quantidade
-- pedida (ex.: 10 de 12 do mesmo item), o comprador ajusta a quantidade na
-- cotação e, ao concluir, escolhe o destino do saldo:
--
--   • Desconsiderar o restante  → itens da RC são reduzidos para a quantidade
--     cotada (com histórico antes/depois) e a compra segue só com o disponível.
--   • Gerar RC complementar     → além da redução, o saldo vira uma RC-filha
--     (numero da mãe + sufixo -B/-C…, coluna dividida_de_id) que entra DIRETO
--     na fila de cotação do mesmo comprador (status em_cotacao + cmp_cotacoes
--     em_andamento) — sem repetir triagem/validação técnica, já feitas na mãe.
--
-- A redução acontece ANTES do envio para aprovação financeira (RC ainda em
-- em_cotacao), então valor_estimado e alçada da mãe já refletem o que será de
-- fato comprado. Não confundir com o split POR ITEM da migration 190 (nunca
-- aplicada): aqui a divisão é por QUANTIDADE dentro do mesmo item.
--
-- Segurança: SECURITY DEFINER (escreve em cmp_requisicoes/_itens/_cotacoes/
-- cmp_historico_status sob RLS). Só admin ou comprador (sys_perfis.comprador).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cmp_requisicoes
  ADD COLUMN IF NOT EXISTS dividida_de_id uuid REFERENCES public.cmp_requisicoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cmp_req_dividida_de
  ON public.cmp_requisicoes(dividida_de_id);

COMMENT ON COLUMN public.cmp_requisicoes.dividida_de_id IS
  'RC-mãe de onde este saldo/lote foi destacado (RC complementar). NULL = RC original.';


CREATE OR REPLACE FUNCTION public.cmp_ajustar_qtd_cotacao(
  p_cotacao_id         uuid,
  p_ajustes            jsonb,     -- [{"item_id": "<uuid>", "qtd_nova": <numeric>}]
  p_gerar_complementar boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_autor_nome   text;
  v_parent_id    uuid;
  v_comprador_id uuid;
  v_parent       cmp_requisicoes%ROWTYPE;
  v_aj           jsonb;
  v_item         cmp_requisicao_itens%ROWTYPE;
  v_qtd_nova     numeric;
  v_saldo        numeric;
  v_antes        jsonb;
  v_depois       jsonb;
  v_child_id     uuid;
  v_child_numero text;
  v_child_valor  numeric := 0;
  v_parent_valor numeric;
  v_limite       numeric;
  v_nivel        int;
  v_n            int;
  v_suffix       text;
  v_count        int := 0;
BEGIN
  IF p_cotacao_id IS NULL OR p_ajustes IS NULL
     OR jsonb_typeof(p_ajustes) <> 'array' OR jsonb_array_length(p_ajustes) = 0 THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes (cotação e ajustes de quantidade)';
  END IF;

  -- Autorização: admin ou comprador (mesmo gate das demais ações de cotação)
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM sys_perfis p WHERE p.auth_id = v_uid AND coalesce(p.comprador, false) = true)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ajustar quantidades (requer admin ou comprador)';
  END IF;

  SELECT requisicao_id, comprador_id INTO v_parent_id, v_comprador_id
    FROM cmp_cotacoes WHERE id = p_cotacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação % não encontrada', p_cotacao_id;
  END IF;

  SELECT * INTO v_parent FROM cmp_requisicoes WHERE id = v_parent_id;
  IF v_parent.status::text <> 'em_cotacao' THEN
    RAISE EXCEPTION 'RC não está em cotação (status atual: %)', v_parent.status;
  END IF;

  SELECT coalesce(nome, 'Sistema') INTO v_autor_nome
    FROM sys_perfis WHERE auth_id = v_uid;
  v_autor_nome := coalesce(v_autor_nome, 'Sistema');

  -- Snapshot ANTES (mesmo formato do replace_requisicao_itens / mig 145)
  SELECT jsonb_agg(x ORDER BY x->>'descricao', x->>'quantidade') INTO v_antes
  FROM (
    SELECT jsonb_build_object(
      'descricao', descricao, 'descricao_complementar', descricao_complementar,
      'quantidade', quantidade, 'unidade', unidade,
      'valor_unitario_estimado', valor_unitario_estimado, 'marca', marca
    ) AS x
    FROM cmp_requisicao_itens WHERE requisicao_id = v_parent_id
  ) s;

  -- Número da complementar: numero da mãe + sufixo -B/-C… (sequencial por filhos)
  IF p_gerar_complementar THEN
    SELECT count(*) INTO v_n FROM cmp_requisicoes WHERE dividida_de_id = v_parent_id;
    LOOP
      IF v_n < 25 THEN
        v_suffix := chr(66 + v_n);         -- B..Z
      ELSE
        v_suffix := (v_n + 2)::text;       -- fallback além de Z
      END IF;
      v_child_numero := v_parent.numero || '-' || v_suffix;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM cmp_requisicoes WHERE numero = v_child_numero);
      v_n := v_n + 1;
    END LOOP;
  END IF;

  FOR v_aj IN SELECT * FROM jsonb_array_elements(p_ajustes)
  LOOP
    SELECT * INTO v_item FROM cmp_requisicao_itens
     WHERE id = (v_aj->>'item_id')::uuid
       AND requisicao_id = v_parent_id
       AND atendido_em_pedido_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item de ajuste inválido (não pertence à RC ou já atendido)';
    END IF;

    v_qtd_nova := (v_aj->>'qtd_nova')::numeric;
    IF v_qtd_nova IS NULL OR v_qtd_nova <= 0 OR v_qtd_nova >= v_item.quantidade THEN
      RAISE EXCEPTION 'Quantidade nova inválida para "%" (deve ser maior que zero e menor que %)',
        v_item.descricao, v_item.quantidade;
    END IF;
    v_saldo := v_item.quantidade - v_qtd_nova;
    v_count := v_count + 1;

    IF p_gerar_complementar THEN
      IF v_child_id IS NULL THEN
        INSERT INTO cmp_requisicoes (
          numero, status, dividida_de_id, valor_estimado, alcada_nivel, alcada_atual,
          solicitante_id, solicitante_nome, obra_id, obra_nome, centro_custo, centro_custo_id,
          descricao, justificativa, categoria, comprador_id, urgencia, data_necessidade,
          classe_financeira, classe_financeira_id, base_destino_id, compra_recorrente,
          projeto_id, texto_original
        ) VALUES (
          v_child_numero, 'em_cotacao', v_parent_id, 0, 1, 1,
          v_parent.solicitante_id, v_parent.solicitante_nome, v_parent.obra_id, v_parent.obra_nome,
          v_parent.centro_custo, v_parent.centro_custo_id,
          v_parent.descricao, v_parent.justificativa, v_parent.categoria, v_parent.comprador_id,
          v_parent.urgencia, v_parent.data_necessidade,
          v_parent.classe_financeira, v_parent.classe_financeira_id, v_parent.base_destino_id,
          v_parent.compra_recorrente, v_parent.projeto_id, v_parent.texto_original
        ) RETURNING id INTO v_child_id;
      END IF;

      INSERT INTO cmp_requisicao_itens (
        requisicao_id, descricao, quantidade, unidade, valor_unitario_estimado,
        observacao, est_item_id, est_item_codigo,
        classe_financeira_id, classe_financeira_codigo, classe_financeira_descricao,
        categoria_financeira_codigo, categoria_financeira_descricao,
        destino_operacional, item_estoque_id, marca, natureza, descricao_complementar
      ) VALUES (
        v_child_id, v_item.descricao, v_saldo, v_item.unidade, v_item.valor_unitario_estimado,
        v_item.observacao, v_item.est_item_id, v_item.est_item_codigo,
        v_item.classe_financeira_id, v_item.classe_financeira_codigo, v_item.classe_financeira_descricao,
        v_item.categoria_financeira_codigo, v_item.categoria_financeira_descricao,
        v_item.destino_operacional, v_item.item_estoque_id, v_item.marca, v_item.natureza,
        v_item.descricao_complementar
      );
      v_child_valor := v_child_valor + v_saldo * coalesce(v_item.valor_unitario_estimado, 0);
    END IF;

    UPDATE cmp_requisicao_itens SET quantidade = v_qtd_nova WHERE id = v_item.id;
  END LOOP;

  IF p_gerar_complementar AND v_child_id IS NOT NULL THEN
    -- Alçada da complementar pela categoria (mesma regra do useFinalizarCotacao)
    SELECT coalesce(alcada1_limite, 2000) INTO v_limite
      FROM cmp_categorias WHERE codigo = coalesce(v_parent.categoria, '');
    v_limite := coalesce(v_limite, 2000);
    v_nivel  := CASE WHEN v_child_valor <= v_limite THEN 1 ELSE 2 END;
    UPDATE cmp_requisicoes
       SET valor_estimado = v_child_valor, alcada_nivel = v_nivel
     WHERE id = v_child_id;

    -- Entra direto na fila "Em Cotação" do mesmo comprador
    INSERT INTO cmp_cotacoes (requisicao_id, comprador_id, status)
    VALUES (v_child_id, v_comprador_id, 'em_andamento');

    INSERT INTO cmp_historico_status (
      requisicao_id, status_anterior, status_novo, responsavel_nome, responsavel_tipo, observacao
    ) VALUES (
      v_child_id, NULL, 'em_cotacao', v_autor_nome, 'comprador',
      'RC complementar criada com o saldo de quantidade de ' || v_parent.numero
    );
  END IF;

  -- Snapshot DEPOIS + histórico de alteração na mãe
  SELECT jsonb_agg(x ORDER BY x->>'descricao', x->>'quantidade') INTO v_depois
  FROM (
    SELECT jsonb_build_object(
      'descricao', descricao, 'descricao_complementar', descricao_complementar,
      'quantidade', quantidade, 'unidade', unidade,
      'valor_unitario_estimado', valor_unitario_estimado, 'marca', marca
    ) AS x
    FROM cmp_requisicao_itens WHERE requisicao_id = v_parent_id
  ) s;

  INSERT INTO cmp_historico_status (
    requisicao_id, status_anterior, status_novo, responsavel_nome, responsavel_tipo,
    observacao, dados_extra
  ) VALUES (
    v_parent_id, v_parent.status::text, v_parent.status::text, v_autor_nome, 'comprador',
    CASE WHEN v_child_id IS NOT NULL
      THEN 'Quantidade ajustada na cotação — saldo destacado na RC complementar ' || v_child_numero
      ELSE 'Quantidade ajustada na cotação — restante desconsiderado' END,
    jsonb_build_object(
      'tipo', 'alteracao_itens',
      'antes', coalesce(v_antes, '[]'::jsonb),
      'depois', coalesce(v_depois, '[]'::jsonb)
    )
  );

  -- Mãe: valor estimado passa a refletir só o que será comprado
  SELECT coalesce(sum(quantidade * valor_unitario_estimado), 0) INTO v_parent_valor
    FROM cmp_requisicao_itens WHERE requisicao_id = v_parent_id;
  UPDATE cmp_requisicoes SET valor_estimado = v_parent_valor WHERE id = v_parent_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ajustados', v_count,
    'child_id', v_child_id,
    'child_numero', v_child_numero
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cmp_ajustar_qtd_cotacao(uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cmp_ajustar_qtd_cotacao(uuid, jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.cmp_ajustar_qtd_cotacao(uuid, jsonb, boolean) IS
  'Ajusta quantidades de itens da RC durante a cotação (fornecedor sem a quantidade cheia). Com p_gerar_complementar=true, o saldo vira RC complementar (numero-B) direto na fila de cotação do mesmo comprador. Só admin/comprador; RC deve estar em em_cotacao.';
