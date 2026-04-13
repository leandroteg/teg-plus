-- ============================================================
-- Migration 060: Link con_solicitacoes ← cmp_requisicoes
-- ============================================================
-- Adds requisicao_origem_id to con_solicitacoes so contract
-- solicitations can be traced back to the purchase requisition.
-- Adds 'aguardando_contrato' to status_requisicao enum.

-- 1. New column
ALTER TABLE con_solicitacoes
  ADD COLUMN IF NOT EXISTS requisicao_origem_id UUID REFERENCES cmp_requisicoes(id);

CREATE INDEX IF NOT EXISTS idx_con_sol_req_origem
  ON con_solicitacoes(requisicao_origem_id);

-- 2. Expand enum
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'aguardando_contrato';
