-- ─────────────────────────────────────────────────────────────────────────────
-- 146b_fin_contas_pagar_origem_cartao_locacao.sql
--
-- Amplia o check constraint de origem em fin_contas_pagar para aceitar
-- 'cartao_fatura' (CP gerado pela 146) e 'locacao' (CP gerado pelo RPC
-- loc_enviar_faturas_financeiro, que ja existia mas nao constava na
-- constraint - todo CP de locacao era barrado).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE fin_contas_pagar DROP CONSTRAINT IF EXISTS fin_contas_pagar_origem_check;
ALTER TABLE fin_contas_pagar ADD CONSTRAINT fin_contas_pagar_origem_check
  CHECK (origem IN ('compras', 'logistica', 'manual', 'omie', 'cartao_fatura', 'locacao'));
