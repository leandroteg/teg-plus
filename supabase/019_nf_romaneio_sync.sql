-- 019_nf_romaneio_sync.sql
-- Adds romaneio_emitido status + auto-sync trigger from fiscal -> logistica

-- 1. Add 'romaneio_emitido' to log_status_solicitacao enum
ALTER TYPE log_status_solicitacao ADD VALUE IF NOT EXISTS 'romaneio_emitido' AFTER 'nfe_emitida';

-- 2. Add romaneio fields to log_solicitacoes
ALTER TABLE log_solicitacoes
  ADD COLUMN IF NOT EXISTS romaneio_url text,
  ADD COLUMN IF NOT EXISTS doc_fiscal_tipo text DEFAULT 'nenhum',
  ADD COLUMN IF NOT EXISTS danfe_url text;

-- 3. Add destination/emitente/items columns to fis_solicitacoes_nf for richer fiscal data
ALTER TABLE fis_solicitacoes_nf
  ADD COLUMN IF NOT EXISTS destinatario_cnpj text,
  ADD COLUMN IF NOT EXISTS destinatario_nome text,
  ADD COLUMN IF NOT EXISTS destinatario_uf text,
  ADD COLUMN IF NOT EXISTS emitente_cnpj text,
  ADD COLUMN IF NOT EXISTS emitente_nome text,
  ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS valor_frete numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_seguro numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto_nf numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icms_base numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icms_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS info_complementar text,
  ADD COLUMN IF NOT EXISTS obra_id uuid,
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

-- 4. Trigger: when fis_solicitacoes_nf status -> 'emitida', sync back to log_solicitacoes
CREATE OR REPLACE FUNCTION fis_sync_nf_to_logistica()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'emitida' AND OLD.status != 'emitida' AND NEW.solicitacao_log_id IS NOT NULL THEN
    UPDATE log_solicitacoes
    SET
      status = 'nfe_emitida',
      danfe_url = NEW.danfe_url,
      doc_fiscal_tipo = 'nf',
      updated_at = NOW()
    WHERE id = NEW.solicitacao_log_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fis_sync_to_logistica ON fis_solicitacoes_nf;
CREATE TRIGGER trg_fis_sync_to_logistica
  AFTER UPDATE ON fis_solicitacoes_nf
  FOR EACH ROW
  EXECUTE FUNCTION fis_sync_nf_to_logistica();
