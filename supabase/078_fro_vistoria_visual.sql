-- 078: Add vistoria_visual column to fro_checklist_execucoes
-- Stores JSON data from vehicle diagram inspection (zone damages)

ALTER TABLE fro_checklist_execucoes
  ADD COLUMN IF NOT EXISTS vistoria_visual jsonb;

COMMENT ON COLUMN fro_checklist_execucoes.vistoria_visual IS 'JSON array of zone damage data from visual vehicle inspection diagram';
