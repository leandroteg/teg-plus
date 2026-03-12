-- =============================================================================
-- 047 – Contas a Receber: pipeline upgrade
-- Pipeline: previsto → autorizado → faturamento → nf_emitida → aguardando → recebido → conciliado
-- =============================================================================

BEGIN;

-- 1. Novas colunas
ALTER TABLE fin_contas_receber
  ADD COLUMN IF NOT EXISTS autorizado_por  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS autorizado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS danfe_url       TEXT,
  ADD COLUMN IF NOT EXISTS xml_url         TEXT,
  ADD COLUMN IF NOT EXISTS email_compartilhado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_compartilhado_para  TEXT;

-- 2. Migrar dados existentes para novos status
UPDATE fin_contas_receber SET status = 'nf_emitida' WHERE status = 'faturado';
UPDATE fin_contas_receber SET status = 'aguardando' WHERE status = 'parcial';
UPDATE fin_contas_receber SET status = 'previsto'   WHERE status = 'vencido';

-- 3. Atualizar CHECK constraint
ALTER TABLE fin_contas_receber DROP CONSTRAINT IF EXISTS fin_contas_receber_status_check;
ALTER TABLE fin_contas_receber ADD CONSTRAINT fin_contas_receber_status_check
  CHECK (status IN (
    'previsto','autorizado','faturamento','nf_emitida',
    'aguardando','recebido','conciliado','cancelado'
  ));

-- 4. RLS: permitir escrita para autenticados (mesmo padrao fin_cp_write_auth)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fin_contas_receber' AND policyname = 'fin_cr_write_auth'
  ) THEN
    CREATE POLICY "fin_cr_write_auth" ON fin_contas_receber
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_fin_cr_autorizado_em ON fin_contas_receber(autorizado_em);

COMMIT;
