-- 238_conciliacao_match_grupo.sql
-- Conciliação 1:N — uma linha do extrato cobrindo vários títulos.
--
-- O SISPAG do Itaú paga o lote inteiro em poucas linhas, agrupadas por tipo de
-- pagamento. O lote LP-202608-0004 (R$ 11.737,86, 6 títulos) saiu como:
--   SISPAG DIVERSOS          7.900,00 = 7.500,00 + 300,00 + 100,00
--   SISPAG SALARIOS          3.655,25 = 2.276,04 + 1.379,21
--   SISPAG DIVERSOS PIX QR     182,61 = 182,61            (esse casa 1:1)
--
-- A mig 237 consertou o match 1:1; estas duas primeiras linhas continuavam sem
-- par porque a função procurava UM título por linha.
--
-- Agora, quando o 1:1 falha, procura o MENOR subconjunto de títulos que soma
-- exatamente o valor da linha (CTE recursiva com poda por soma parcial <= alvo,
-- pool limitado a 18 candidatos dentro da janela de dias). Score 90 contra 100
-- do 1:1: a soma bate, mas a combinação é inferida.
--
-- v_usados impede que um título entre em duas sugestões da mesma rodada.
--
-- cp_ids/cr_ids preservam o rastro: cp_id sozinho não representa N títulos.

ALTER TABLE public.fin_movimentacoes_tesouraria
  ADD COLUMN IF NOT EXISTS cp_ids uuid[],
  ADD COLUMN IF NOT EXISTS cr_ids uuid[];

COMMENT ON COLUMN public.fin_movimentacoes_tesouraria.cp_ids IS
  'Conciliação em grupo: títulos cobertos por esta linha do extrato. cp_id fica NULL nesse caso.';

CREATE OR REPLACE FUNCTION public.fn_sugerir_conciliacao_tesouraria(
  p_conta_id uuid DEFAULT NULL::uuid,
  p_dias_janela integer DEFAULT 3,
  p_periodo_inicio date DEFAULT ((CURRENT_DATE - '60 days'::interval))::date,
  p_periodo_fim date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sugestoes jsonb := '[]'::jsonb;
  v_mov RECORD;
  v_cand RECORD;
  v_grupo RECORD;
  v_usados uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR v_mov IN
    SELECT id, conta_id, tipo, valor, data_movimentacao, descricao
    FROM fin_movimentacoes_tesouraria
    WHERE conciliado = false
      AND cp_id IS NULL AND cr_id IS NULL AND cp_ids IS NULL AND cr_ids IS NULL
      AND data_movimentacao BETWEEN p_periodo_inicio AND p_periodo_fim
      AND (p_conta_id IS NULL OR conta_id = p_conta_id)
    ORDER BY data_movimentacao DESC
    LIMIT 500
  LOOP
    IF v_mov.tipo IN ('saida', 'debito') THEN
      SELECT cp.id, cp.fornecedor_nome, cp.descricao,
        cp.valor_original, cp.data_vencimento, cp.status,
        100 - LEAST(15, abs(COALESCE(cp.data_pagamento, cp.data_vencimento) - v_mov.data_movimentacao) * 5) AS score
      INTO v_cand
      FROM fin_contas_pagar cp
      WHERE cp.status NOT IN ('conciliado', 'cancelado')
        AND NOT (cp.id = ANY(v_usados))
        AND abs(COALESCE(NULLIF(cp.valor_pago, 0), cp.valor_original) - abs(v_mov.valor)) < 0.01
        AND abs(COALESCE(cp.data_pagamento, cp.data_vencimento) - v_mov.data_movimentacao) <= p_dias_janela
      ORDER BY abs(COALESCE(cp.data_pagamento, cp.data_vencimento) - v_mov.data_movimentacao) ASC,
               cp.data_vencimento DESC
      LIMIT 1;

      IF FOUND THEN
        v_usados := v_usados || v_cand.id;
        v_sugestoes := v_sugestoes || jsonb_build_object(
          'mov_id', v_mov.id, 'mov_tipo', v_mov.tipo, 'mov_valor', v_mov.valor,
          'mov_data', v_mov.data_movimentacao, 'mov_descricao', v_mov.descricao,
          'mov_conta_id', v_mov.conta_id,
          'tipo_match', 'cp', 'cand_id', v_cand.id, 'cand_ids', jsonb_build_array(v_cand.id),
          'cand_nome', v_cand.fornecedor_nome, 'cand_descricao', v_cand.descricao,
          'cand_valor', v_cand.valor_original, 'cand_vencimento', v_cand.data_vencimento,
          'cand_status', v_cand.status, 'score', v_cand.score
        );
        CONTINUE;
      END IF;

      WITH RECURSIVE cand AS (
        SELECT row_number() OVER (ORDER BY cp.valor_pago DESC, cp.id) AS rn,
               cp.id, COALESCE(NULLIF(cp.valor_pago,0), cp.valor_original) AS v,
               cp.fornecedor_nome
        FROM fin_contas_pagar cp
        WHERE cp.status NOT IN ('conciliado', 'cancelado')
          AND NOT (cp.id = ANY(v_usados))
          AND COALESCE(cp.valor_pago, 0) > 0
          AND abs(COALESCE(cp.data_pagamento, cp.data_vencimento) - v_mov.data_movimentacao) <= p_dias_janela
          AND COALESCE(NULLIF(cp.valor_pago,0), cp.valor_original) <= abs(v_mov.valor) + 0.01
        LIMIT 18
      ),
      sub AS (
        SELECT ARRAY[c.id] AS ids, c.v::numeric AS total, c.rn
        FROM cand c
        UNION ALL
        SELECT s.ids || c.id, s.total + c.v, c.rn
        FROM sub s JOIN cand c ON c.rn > s.rn
        WHERE s.total + c.v <= abs(v_mov.valor) + 0.01
      )
      SELECT s.ids,
             (SELECT string_agg(c.fornecedor_nome, ' + ' ORDER BY c.v DESC)
                FROM cand c WHERE c.id = ANY(s.ids)) AS nomes,
             s.total
      INTO v_grupo
      FROM sub s
      WHERE abs(s.total - abs(v_mov.valor)) < 0.01
        AND array_length(s.ids, 1) > 1
      ORDER BY array_length(s.ids, 1) ASC
      LIMIT 1;

      IF v_grupo.ids IS NOT NULL THEN
        v_usados := v_usados || v_grupo.ids;
        v_sugestoes := v_sugestoes || jsonb_build_object(
          'mov_id', v_mov.id, 'mov_tipo', v_mov.tipo, 'mov_valor', v_mov.valor,
          'mov_data', v_mov.data_movimentacao, 'mov_descricao', v_mov.descricao,
          'mov_conta_id', v_mov.conta_id,
          'tipo_match', 'cp_grupo',
          'cand_id', v_grupo.ids[1],
          'cand_ids', to_jsonb(v_grupo.ids),
          'cand_nome', array_length(v_grupo.ids,1) || ' títulos pagos juntos',
          'cand_descricao', v_grupo.nomes,
          'cand_valor', v_grupo.total,
          'cand_vencimento', v_mov.data_movimentacao,
          'cand_status', 'pago',
          'score', 90
        );
      END IF;

    ELSIF v_mov.tipo IN ('entrada', 'credito') THEN
      SELECT cr.id, cr.cliente_nome, cr.descricao,
        cr.valor_original, cr.data_vencimento, cr.status,
        100 - LEAST(15, abs(COALESCE(cr.data_recebimento, cr.data_vencimento) - v_mov.data_movimentacao) * 5) AS score
      INTO v_cand
      FROM fin_contas_receber cr
      WHERE cr.status NOT IN ('conciliado', 'cancelado')
        AND NOT (cr.id = ANY(v_usados))
        AND abs(COALESCE(NULLIF(cr.valor_recebido, 0), cr.valor_original) - abs(v_mov.valor)) < 0.01
        AND abs(COALESCE(cr.data_recebimento, cr.data_vencimento) - v_mov.data_movimentacao) <= p_dias_janela
      ORDER BY abs(COALESCE(cr.data_recebimento, cr.data_vencimento) - v_mov.data_movimentacao) ASC,
               cr.data_vencimento DESC
      LIMIT 1;

      IF FOUND THEN
        v_usados := v_usados || v_cand.id;
        v_sugestoes := v_sugestoes || jsonb_build_object(
          'mov_id', v_mov.id, 'mov_tipo', v_mov.tipo, 'mov_valor', v_mov.valor,
          'mov_data', v_mov.data_movimentacao, 'mov_descricao', v_mov.descricao,
          'mov_conta_id', v_mov.conta_id,
          'tipo_match', 'cr', 'cand_id', v_cand.id, 'cand_ids', jsonb_build_array(v_cand.id),
          'cand_nome', v_cand.cliente_nome, 'cand_descricao', v_cand.descricao,
          'cand_valor', v_cand.valor_original, 'cand_vencimento', v_cand.data_vencimento,
          'cand_status', v_cand.status, 'score', v_cand.score
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true,
    'count', jsonb_array_length(v_sugestoes),
    'sugestoes', v_sugestoes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_aplicar_conciliacao_tesouraria(p_matches jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match jsonb;
  v_aplicadas int := 0;
  v_ids uuid[];
  v_now timestamptz := now();
BEGIN
  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'p_matches deve ser array');
  END IF;

  FOR v_match IN SELECT * FROM jsonb_array_elements(p_matches)
  LOOP
    -- cand_ids cobre 1:1 e 1:N; cand_id fica como fallback de payload antigo.
    IF v_match ? 'cand_ids' AND jsonb_typeof(v_match->'cand_ids') = 'array' THEN
      SELECT array_agg((x)::uuid) INTO v_ids
      FROM jsonb_array_elements_text(v_match->'cand_ids') x;
    ELSE
      v_ids := ARRAY[(v_match->>'cand_id')::uuid];
    END IF;

    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
      CONTINUE;
    END IF;

    IF (v_match->>'tipo_match') LIKE 'cp%' THEN
      UPDATE fin_contas_pagar SET status = 'conciliado', updated_at = v_now
      WHERE id = ANY(v_ids)
        AND status NOT IN ('conciliado', 'cancelado');

      UPDATE fin_movimentacoes_tesouraria
      SET cp_id = CASE WHEN array_length(v_ids,1) = 1 THEN v_ids[1] ELSE NULL END,
          cp_ids = CASE WHEN array_length(v_ids,1) > 1 THEN v_ids ELSE NULL END,
          conciliado = true, conciliado_em = v_now
      WHERE id = (v_match->>'mov_id')::uuid;

      v_aplicadas := v_aplicadas + 1;
    ELSIF (v_match->>'tipo_match') LIKE 'cr%' THEN
      UPDATE fin_contas_receber SET status = 'conciliado', updated_at = v_now
      WHERE id = ANY(v_ids)
        AND status NOT IN ('conciliado', 'cancelado');

      UPDATE fin_movimentacoes_tesouraria
      SET cr_id = CASE WHEN array_length(v_ids,1) = 1 THEN v_ids[1] ELSE NULL END,
          cr_ids = CASE WHEN array_length(v_ids,1) > 1 THEN v_ids ELSE NULL END,
          conciliado = true, conciliado_em = v_now
      WHERE id = (v_match->>'mov_id')::uuid;

      v_aplicadas := v_aplicadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'aplicadas', v_aplicadas);
END;
$function$;
