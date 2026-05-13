-- =============================================================================
-- 098: Adiciona colunas de imposto que faltavam em fin_contas_pagar
--      imposto_tipo e imposto_aliquota são usados pelo CPPipeline para
--      cálculo e registro de retenções (ISS, IPI, etc.)
-- =============================================================================

ALTER TABLE fin_contas_pagar
  ADD COLUMN IF NOT EXISTS imposto_tipo     TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS imposto_aliquota NUMERIC DEFAULT NULL;
