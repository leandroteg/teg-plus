-- ─────────────────────────────────────────────────────────────────────────────
-- 123_rpc_resolver_lote_nao_cancela.sql
--
-- Corrige rpc_resolver_lote_status pra NÃO cancelar mais lotes nem CPs quando
-- o aprovador rejeita. Cancelar pagamento por rejeição é semanticamente errado:
-- a intenção do aprovador é "preciso de esclarecimento", não "cancele tudo".
--
-- Comportamento ANTES desta migration:
--   - Todos itens rejeitados   → lote = 'cancelado'  + CPs = 'cancelado'
--   - Parcialmente aprovados   → lote = 'parcialmente_aprovado' + CPs rejeitados = 'cancelado'
--
-- Comportamento DEPOIS:
--   - Todos itens rejeitados   → lote = 'enviado_aprovacao' (volta pra fila, financeiro
--                                  responde via LoteDetalhe usando a observação do aprovador).
--                                  CPs rejeitados ficam em 'em_lote' (continuam no lote).
--   - Parcialmente aprovados   → lote = 'parcialmente_aprovado' (igual antes).
--                                  CPs rejeitados também ficam em 'em_lote' (não cancelam mais).
--   - Aprovados                → lote = 'aprovado', CPs = 'aprovado_pgto' (igual antes).
--
-- A decisão rejeitada do aprovador continua registrada em apr_aprovacoes e em
-- fin_lote_itens.decisao='rejeitado' (audit trail), pra que o financeiro veja
-- exatamente o que foi rejeitado e possa responder com esclarecimento ou
-- ajustar o lote.
--
-- Cancelar lote/CP continua possível, mas apenas via ação explícita do
-- financeiro (não como side-effect de rejeição em aprovação).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_resolver_lote_status(p_lote_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total      INT;
  v_aprovados  INT;
  v_rejeitados INT;
  v_pendentes  INT;
  v_new_status TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE decisao = 'aprovado'),
    COUNT(*) FILTER (WHERE decisao = 'rejeitado'),
    COUNT(*) FILTER (WHERE decisao = 'pendente')
  INTO v_total, v_aprovados, v_rejeitados, v_pendentes
  FROM fin_lote_itens
  WHERE lote_id = p_lote_id;

  IF v_total = 0 THEN
    RETURN 'montando';
  END IF;

  IF v_pendentes > 0 THEN
    v_new_status := 'enviado_aprovacao';
  ELSIF v_aprovados = v_total THEN
    v_new_status := 'aprovado';
  ELSIF v_aprovados > 0 THEN
    v_new_status := 'parcialmente_aprovado';
  ELSE
    -- Todos rejeitados: NAO cancela. Lote volta pra fila de aprovacao pra
    -- o financeiro responder o esclarecimento via LoteDetalhe.
    v_new_status := 'enviado_aprovacao';
  END IF;

  -- Atualizar status do lote
  UPDATE fin_lotes_pagamento
  SET status = v_new_status, updated_at = now()
  WHERE id = p_lote_id;

  -- CPs aprovados → aprovado_pgto
  UPDATE fin_contas_pagar
  SET status = 'aprovado_pgto',
      aprovado_por = li.decidido_por,
      aprovado_em  = li.decidido_em,
      updated_at   = now()
  FROM fin_lote_itens li
  WHERE fin_contas_pagar.id = li.cp_id
    AND li.lote_id = p_lote_id
    AND li.decisao = 'aprovado'
    AND fin_contas_pagar.status != 'aprovado_pgto';

  -- CPs rejeitados pelo aprovador: NAO cancela mais. Mantem em 'em_lote'
  -- pra que o financeiro decida (responder esclarecimento, mover pra outro
  -- lote, ou cancelar explicitamente via fluxo proprio).
  -- A decisao 'rejeitado' fica preservada em fin_lote_itens pra audit/leitura.
  UPDATE fin_contas_pagar
  SET status = 'em_lote', updated_at = now()
  FROM fin_lote_itens li
  WHERE fin_contas_pagar.id = li.cp_id
    AND li.lote_id = p_lote_id
    AND li.decisao = 'rejeitado'
    AND fin_contas_pagar.status NOT IN ('em_lote','aprovado_pgto','em_pagamento','pago','conciliado','cancelado');

  RETURN v_new_status;
END;
$function$;

COMMENT ON FUNCTION public.rpc_resolver_lote_status(uuid) IS
  'Resolve status do lote apos decisao do aprovador. v2 (mig 123): rejeicao NAO cancela mais, devolve lote pra "enviado_aprovacao" mantendo CPs em "em_lote". Cancelar fica exclusivo a fluxo explicito do financeiro.';
