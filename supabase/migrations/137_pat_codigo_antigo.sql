-- ─────────────────────────────────────────────────────────────────────────────
-- 137_pat_codigo_antigo.sql
--
-- Adiciona codigo_antigo em pat_imobilizados para rastrear o codigo do sistema
-- legado (ex.: TOTVS RM, planilha). Indexado para busca rapida no patrimonio
-- e usado na conferencia de migracao.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pat_imobilizados
  ADD COLUMN IF NOT EXISTS codigo_antigo text;

CREATE INDEX IF NOT EXISTS idx_pat_imobilizados_codigo_antigo
  ON public.pat_imobilizados(codigo_antigo)
  WHERE codigo_antigo IS NOT NULL;

COMMENT ON COLUMN public.pat_imobilizados.codigo_antigo IS
  'Codigo do bem no sistema/planilha legado, usado durante a migracao para conferencia. Nulo quando o item nasceu direto no TEG+.';
