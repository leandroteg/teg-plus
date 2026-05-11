-- 096_cmp_categorias_aprovadores.sql
-- Aprovadores por categoria (validador tecnico + alcadas 1 e 2 com IDs)
-- Aplicada em 2026-05-04 via Supabase MCP.

ALTER TABLE cmp_categorias
  ADD COLUMN IF NOT EXISTS validador_tecnico_id uuid REFERENCES sys_perfis(id),
  ADD COLUMN IF NOT EXISTS alcada1_aprovador_id uuid REFERENCES sys_perfis(id),
  ADD COLUMN IF NOT EXISTS alcada2_aprovador_id uuid REFERENCES sys_perfis(id);

-- Backfill validador tecnico via area_tecnica
UPDATE cmp_categorias c
SET validador_tecnico_id = v.validador_id
FROM apr_validadores_tecnicos v
WHERE v.area = c.area_tecnica AND c.validador_tecnico_id IS NULL;

-- Backfill alcadas padrao
UPDATE cmp_categorias SET
  alcada1_aprovador_id = COALESCE(alcada1_aprovador_id, '1a530a02-9eec-4aa7-8bbc-7805895b1904'),
  alcada2_aprovador_id = COALESCE(alcada2_aprovador_id, '98723949-73fa-4961-b032-3ef599464e2e'),
  alcada1_limite       = COALESCE(alcada1_limite, 3000)
WHERE ativo = true;
