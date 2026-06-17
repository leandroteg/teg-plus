-- ─────────────────────────────────────────────────────────────────────────────
-- 148b_fin_contas_pagar_origem_medicao.sql
--
-- Permite origem = 'medicao_contrato' em fin_contas_pagar, gerado pelo RPC
-- con_faturar_medicao (mig 148).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE fin_contas_pagar
  DROP CONSTRAINT IF EXISTS fin_contas_pagar_origem_check;

ALTER TABLE fin_contas_pagar
  ADD CONSTRAINT fin_contas_pagar_origem_check
  CHECK (origem IN (
    'compras',
    'logistica',
    'manual',
    'omie',
    'cartao_fatura',
    'locacao',
    'medicao_contrato'
  ));
