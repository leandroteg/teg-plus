-- 095_apr_validadores_tecnicos.sql
-- Adiciona area_tecnica em cmp_categorias + tabela apr_validadores_tecnicos
-- para definir quem valida tecnicamente cada categoria de produto.
-- Aplicada em 2026-05-04 via Supabase MCP.

ALTER TABLE cmp_categorias
  ADD COLUMN IF NOT EXISTS area_tecnica text;

DO $$ BEGIN
  ALTER TABLE cmp_categorias
    ADD CONSTRAINT cmp_categorias_area_tecnica_check
    CHECK (area_tecnica IS NULL OR area_tecnica IN ('operacional','administrativo','ti'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS apr_validadores_tecnicos (
  area text PRIMARY KEY,
  validador_id uuid REFERENCES sys_perfis(id),
  validador_nome text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE apr_validadores_tecnicos
    ADD CONSTRAINT apr_validadores_tecnicos_area_check
    CHECK (area IN ('operacional','administrativo','ti'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE apr_validadores_tecnicos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "apr_validadores_tecnicos_all" ON apr_validadores_tecnicos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill area_tecnica nas categorias (mapeamento inicial)
UPDATE cmp_categorias SET area_tecnica = 'operacional' WHERE codigo IN
  ('ACO','ALIMENTACAO_CANTEIRO','CONCRETO','EPI_EPC_UNIFORME','EQUIPAMENTOS','FERRAMENTAS',
   'ITENS_ALOJAMENTO','MANUT_FROTA','MAT_ESCRITORIO_CD','OUTROS_MAT_OBRA','SERV_OBRA_LOG');

UPDATE cmp_categorias SET area_tecnica = 'administrativo' WHERE codigo IN
  ('AQUISICAO_ATIVOS','COMPRAS_EXTRA','LOCACAO_IMOVEIS','MAT_ESCRITORIO_SEDE','PRODUTOS_LIMPEZA','SERV_ADMIN');

UPDATE cmp_categorias SET area_tecnica = 'ti' WHERE codigo IN ('SOFTWARE_HARDWARE_TI');

-- Seed validadores
INSERT INTO apr_validadores_tecnicos (area, validador_id, validador_nome, ativo) VALUES
  ('operacional',    'ca9b98a4-05bf-4a15-8234-54958c0e5b84', 'WELTON APARECIDO PEREIRA',         true),
  ('administrativo', 'f3a1a2c5-e8c2-4ef6-bfe7-6ae7ba36ad32', 'CLAUDIONOR MARIANO MENDONCA JUNIOR', true),
  ('ti',             'a61d1ffc-8d57-4156-88cb-82fcfd030a52', 'ELTON FERNANDES COSTA',            true)
ON CONFLICT (area) DO UPDATE SET
  validador_id   = EXCLUDED.validador_id,
  validador_nome = EXCLUDED.validador_nome,
  ativo          = EXCLUDED.ativo,
  updated_at     = now();
