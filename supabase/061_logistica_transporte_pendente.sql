-- 061_logistica_transporte_pendente.sql
-- Unifica o handoff documental da logística para o estágio canônico de transporte.

ALTER TYPE log_status_solicitacao
  ADD VALUE IF NOT EXISTS 'transporte_pendente' AFTER 'romaneio_emitido';

CREATE OR REPLACE FUNCTION fis_sync_nf_to_logistica()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'emitida' AND OLD.status != 'emitida' AND NEW.solicitacao_log_id IS NOT NULL THEN
    UPDATE log_solicitacoes
    SET
      status = 'transporte_pendente',
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

UPDATE log_solicitacoes ls
SET
  status = 'transporte_pendente',
  updated_at = NOW()
WHERE ls.status IN ('nfe_emitida', 'romaneio_emitido')
  AND NOT EXISTS (
    SELECT 1
    FROM log_transportes lt
    WHERE lt.solicitacao_id = ls.id
  );
