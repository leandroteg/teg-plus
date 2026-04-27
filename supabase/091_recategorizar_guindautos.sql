-- 091_recategorizar_guindautos.sql
-- Migra 9 veículos cuja "Categoria origem" no campo observacoes era GUINDAUTO,
-- mas estavam categorizados como 'truck' ou 'outras_maquinas', para 'guindauto'.
-- Aplicada em 2026-04-26 via Supabase MCP.

UPDATE fro_veiculos
SET categoria = 'guindauto'
WHERE observacoes ~* 'Categoria origem:\s*GUINDAUTO'
  AND categoria IN ('truck', 'outras_maquinas');
