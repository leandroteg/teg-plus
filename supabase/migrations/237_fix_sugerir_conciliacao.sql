-- 237_fix_sugerir_conciliacao.sql
-- Conciliação automática nunca sugeriu nada. Três defeitos somados na
-- fn_sugerir_conciliacao_tesouraria, todos confirmados com o extrato Itaú
-- importado em 05/08:
--
-- 1. VOCABULÁRIO DE TIPO. A função ramificava em tipo='debito'/'credito', mas
--    fin_movimentacoes_tesouraria tem CHECK que só aceita entrada/saida/
--    transferencia — e o parse-extrato grava 'entrada'/'saida'. Nenhum dos dois
--    ramos jamais executou: a função retornava lista vazia para todo extrato,
--    sempre. Este é o motivo principal do "não dá match com nada".
--
-- 2. STATUS. Excluía CP 'pago' dos candidatos. Mas o extrato mostra o que JÁ
--    saiu do banco, então o título correspondente está pago. Pior: a
--    conciliação manual (Conciliacao.tsx) só aceita título 'pago' — as duas
--    pontas se excluíam mutuamente.
--
-- 3. VALOR. Comparava com valor_original. Desconto, juros e imposto fazem o
--    banco divergir do valor de face: a CP da Prefeitura de Araxá tem face
--    169,09 e débito real 182,61. Passa a comparar com valor_pago quando existe.
--
-- Depois do fix, o débito de 182,61 casa com a Prefeitura de Araxá com score 100.
--
-- NÃO resolve pagamento em lote (SISPAG): uma linha do banco cobre vários
-- títulos (7.900,00 = 7.500 + 300 + 100; 3.655,25 = 2.276,04 + 1.379,21). Isso
-- exige match 1:N, que a função não modela.

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
BEGIN
  FOR v_mov IN
    SELECT id, conta_id, tipo, valor, data_movimentacao, descricao
    FROM fin_movimentacoes_tesouraria
    WHERE conciliado = false
      AND cp_id IS NULL AND cr_id IS NULL
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
        AND abs(COALESCE(NULLIF(cp.valor_pago, 0), cp.valor_original) - abs(v_mov.valor)) < 0.01
        AND abs(COALESCE(cp.data_pagamento, cp.data_vencimento) - v_mov.data_movimentacao) <= p_dias_janela
      ORDER BY abs(COALESCE(cp.data_pagamento, cp.data_vencimento) - v_mov.data_movimentacao) ASC,
               cp.data_vencimento DESC
      LIMIT 1;

      IF FOUND THEN
        v_sugestoes := v_sugestoes || jsonb_build_object(
          'mov_id', v_mov.id, 'mov_tipo', v_mov.tipo, 'mov_valor', v_mov.valor,
          'mov_data', v_mov.data_movimentacao, 'mov_descricao', v_mov.descricao,
          'mov_conta_id', v_mov.conta_id,
          'tipo_match', 'cp', 'cand_id', v_cand.id,
          'cand_nome', v_cand.fornecedor_nome, 'cand_descricao', v_cand.descricao,
          'cand_valor', v_cand.valor_original, 'cand_vencimento', v_cand.data_vencimento,
          'cand_status', v_cand.status, 'score', v_cand.score
        );
      END IF;
    ELSIF v_mov.tipo IN ('entrada', 'credito') THEN
      SELECT cr.id, cr.cliente_nome, cr.descricao,
        cr.valor_original, cr.data_vencimento, cr.status,
        100 - LEAST(15, abs(COALESCE(cr.data_recebimento, cr.data_vencimento) - v_mov.data_movimentacao) * 5) AS score
      INTO v_cand
      FROM fin_contas_receber cr
      WHERE cr.status NOT IN ('conciliado', 'cancelado')
        AND abs(COALESCE(NULLIF(cr.valor_recebido, 0), cr.valor_original) - abs(v_mov.valor)) < 0.01
        AND abs(COALESCE(cr.data_recebimento, cr.data_vencimento) - v_mov.data_movimentacao) <= p_dias_janela
      ORDER BY abs(COALESCE(cr.data_recebimento, cr.data_vencimento) - v_mov.data_movimentacao) ASC,
               cr.data_vencimento DESC
      LIMIT 1;

      IF FOUND THEN
        v_sugestoes := v_sugestoes || jsonb_build_object(
          'mov_id', v_mov.id, 'mov_tipo', v_mov.tipo, 'mov_valor', v_mov.valor,
          'mov_data', v_mov.data_movimentacao, 'mov_descricao', v_mov.descricao,
          'mov_conta_id', v_mov.conta_id,
          'tipo_match', 'cr', 'cand_id', v_cand.id,
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
