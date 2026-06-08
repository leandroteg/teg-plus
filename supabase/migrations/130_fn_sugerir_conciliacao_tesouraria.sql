-- ─────────────────────────────────────────────────────────────────────────────
-- 130_fn_sugerir_conciliacao_tesouraria.sql
--
-- Sugere conciliacoes automaticas entre lancamentos do extrato bancario
-- (fin_movimentacoes_tesouraria) e titulos em aberto (fin_contas_pagar /
-- fin_contas_receber) pelo casamento de valor exato + data ±3 dias.
--
-- - Movimentacao tipo='debito' (saida) -> match com CPs ja aprovadas pra pgto
--   (status in [aprovado_pgto, em_pagamento]) ou previstas (status=previsto).
-- - Movimentacao tipo='credito' (entrada) -> match com CRs em aberto.
-- - So traz movimentacoes ainda nao conciliadas (conciliado=false E cp_id/cr_id NULL).
-- - Score: 100 = valor exato + data exata. Cai 5 pontos por dia de diferenca
--   na data, ate -15. (Score >= 85 considerar bom candidato.)
--
-- Retorna array json com 1 sugestao por movimentacao (a de maior score).
-- A aplicacao da conciliacao continua via useConciliarCPBatch/useConciliarCRBatch
-- ja existentes — esta RPC so SUGERE.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sugerir_conciliacao_tesouraria(
  p_conta_id uuid DEFAULT NULL,
  p_dias_janela int DEFAULT 3,
  p_periodo_inicio date DEFAULT (current_date - interval '60 days')::date,
  p_periodo_fim    date DEFAULT current_date
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_sugestoes jsonb := '[]'::jsonb;
  v_mov RECORD;
  v_cand RECORD;
BEGIN
  -- Loop por movimentacao nao conciliada do extrato
  FOR v_mov IN
    SELECT id, conta_id, tipo, valor, data_movimentacao, descricao
    FROM fin_movimentacoes_tesouraria
    WHERE conciliado = false
      AND cp_id IS NULL
      AND cr_id IS NULL
      AND data_movimentacao BETWEEN p_periodo_inicio AND p_periodo_fim
      AND (p_conta_id IS NULL OR conta_id = p_conta_id)
    ORDER BY data_movimentacao DESC
    LIMIT 500
  LOOP
    -- DEBITO (saida): match com fin_contas_pagar em aberto
    IF v_mov.tipo = 'debito' THEN
      SELECT
        cp.id, cp.fornecedor_nome, cp.descricao,
        cp.valor_original, cp.data_vencimento, cp.status,
        100 - LEAST(15, abs(cp.data_vencimento - v_mov.data_movimentacao) * 5) AS score
      INTO v_cand
      FROM fin_contas_pagar cp
      WHERE cp.status NOT IN ('pago', 'conciliado', 'cancelado')
        AND abs(cp.valor_original - abs(v_mov.valor)) < 0.01
        AND abs(cp.data_vencimento - v_mov.data_movimentacao) <= p_dias_janela
      ORDER BY abs(cp.data_vencimento - v_mov.data_movimentacao) ASC,
               cp.data_vencimento DESC
      LIMIT 1;

      IF FOUND THEN
        v_sugestoes := v_sugestoes || jsonb_build_object(
          'mov_id', v_mov.id,
          'mov_tipo', v_mov.tipo,
          'mov_valor', v_mov.valor,
          'mov_data', v_mov.data_movimentacao,
          'mov_descricao', v_mov.descricao,
          'mov_conta_id', v_mov.conta_id,
          'tipo_match', 'cp',
          'cand_id', v_cand.id,
          'cand_nome', v_cand.fornecedor_nome,
          'cand_descricao', v_cand.descricao,
          'cand_valor', v_cand.valor_original,
          'cand_vencimento', v_cand.data_vencimento,
          'cand_status', v_cand.status,
          'score', v_cand.score
        );
      END IF;

    -- CREDITO (entrada): match com fin_contas_receber em aberto
    ELSIF v_mov.tipo = 'credito' THEN
      SELECT
        cr.id, cr.cliente_nome, cr.descricao,
        cr.valor_original, cr.data_vencimento, cr.status,
        100 - LEAST(15, abs(cr.data_vencimento - v_mov.data_movimentacao) * 5) AS score
      INTO v_cand
      FROM fin_contas_receber cr
      WHERE cr.status NOT IN ('recebido', 'conciliado', 'cancelado')
        AND abs(cr.valor_original - abs(v_mov.valor)) < 0.01
        AND abs(cr.data_vencimento - v_mov.data_movimentacao) <= p_dias_janela
      ORDER BY abs(cr.data_vencimento - v_mov.data_movimentacao) ASC,
               cr.data_vencimento DESC
      LIMIT 1;

      IF FOUND THEN
        v_sugestoes := v_sugestoes || jsonb_build_object(
          'mov_id', v_mov.id,
          'mov_tipo', v_mov.tipo,
          'mov_valor', v_mov.valor,
          'mov_data', v_mov.data_movimentacao,
          'mov_descricao', v_mov.descricao,
          'mov_conta_id', v_mov.conta_id,
          'tipo_match', 'cr',
          'cand_id', v_cand.id,
          'cand_nome', v_cand.cliente_nome,
          'cand_descricao', v_cand.descricao,
          'cand_valor', v_cand.valor_original,
          'cand_vencimento', v_cand.data_vencimento,
          'cand_status', v_cand.status,
          'score', v_cand.score
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'count', jsonb_array_length(v_sugestoes),
    'sugestoes', v_sugestoes
  );
END;
$function$;

COMMENT ON FUNCTION public.fn_sugerir_conciliacao_tesouraria(uuid, int, date, date) IS
  'Sugere matches entre fin_movimentacoes_tesouraria nao conciliadas e fin_contas_pagar/receber em aberto por valor exato + data dentro de janela (default ±3 dias). Score 85-100. Aplicar a conciliacao via useConciliarCPBatch/useConciliarCRBatch.';

-- ── RPC pra aplicar varias conciliacoes em uma transacao ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_aplicar_conciliacao_tesouraria(
  p_matches jsonb  -- [{mov_id, tipo_match: 'cp'|'cr', cand_id}]
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_match jsonb;
  v_aplicadas int := 0;
  v_now timestamptz := now();
BEGIN
  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'p_matches deve ser array');
  END IF;

  FOR v_match IN SELECT * FROM jsonb_array_elements(p_matches)
  LOOP
    IF (v_match->>'tipo_match') = 'cp' THEN
      -- Marca CP como conciliada e vincula a movimentacao
      UPDATE fin_contas_pagar
      SET status = 'conciliado', updated_at = v_now
      WHERE id = (v_match->>'cand_id')::uuid
        AND status NOT IN ('conciliado', 'cancelado');

      UPDATE fin_movimentacoes_tesouraria
      SET cp_id = (v_match->>'cand_id')::uuid,
          conciliado = true,
          conciliado_em = v_now
      WHERE id = (v_match->>'mov_id')::uuid;

      v_aplicadas := v_aplicadas + 1;

    ELSIF (v_match->>'tipo_match') = 'cr' THEN
      UPDATE fin_contas_receber
      SET status = 'conciliado', updated_at = v_now
      WHERE id = (v_match->>'cand_id')::uuid
        AND status NOT IN ('conciliado', 'cancelado');

      UPDATE fin_movimentacoes_tesouraria
      SET cr_id = (v_match->>'cand_id')::uuid,
          conciliado = true,
          conciliado_em = v_now
      WHERE id = (v_match->>'mov_id')::uuid;

      v_aplicadas := v_aplicadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'aplicadas', v_aplicadas);
END;
$function$;

COMMENT ON FUNCTION public.fn_aplicar_conciliacao_tesouraria(jsonb) IS
  'Aplica matches aprovados pelo usuario: marca CP/CR como conciliado e vincula a movimentacao do extrato.';
