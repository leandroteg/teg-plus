-- 093_proxima_status_rascunho.sql
-- Modo Planejamento: permite Obras criar demandas em RASCUNHO,
-- sem impactar Frotas, e depois "publicar" tudo de uma vez.
-- Aplicada em 2026-04-26 via Supabase MCP. Nao-destrutiva.

ALTER TABLE fro_alocacoes
  ADD COLUMN IF NOT EXISTS proxima_status text NOT NULL DEFAULT 'publicado';

DO $$ BEGIN
  ALTER TABLE fro_alocacoes
    ADD CONSTRAINT fro_alocacoes_proxima_status_check
    CHECK (proxima_status IN ('rascunho','publicado','cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_fro_alocacoes_proxima_status
  ON fro_alocacoes (proxima_solicitada_por, proxima_status)
  WHERE proxima_obra_id IS NOT NULL;

-- Triggers atualizadas: ignoram rascunho no log + so criam proxima alocacao
-- automatica quando proxima_status='publicado'. Codigo completo na migration.
