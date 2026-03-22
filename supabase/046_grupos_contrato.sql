-- ============================================================
-- Migration 046: Grupos de Contrato — Standardize 12 groups
-- ============================================================
-- Adds grupo_contrato + subtipo_contrato to con_solicitacoes
-- Adds grupo_contrato + arquivo_url + versao to con_modelos_contrato
-- Migrates existing categoria_contrato values to new groups

-- ============================================================
-- 1. Add new columns to con_modelos_contrato
-- ============================================================
ALTER TABLE con_modelos_contrato
  ADD COLUMN IF NOT EXISTS grupo_contrato TEXT DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS arquivo_url TEXT,
  ADD COLUMN IF NOT EXISTS versao INT DEFAULT 1;

-- ============================================================
-- 2. Add new columns to con_solicitacoes
-- ============================================================
ALTER TABLE con_solicitacoes
  ADD COLUMN IF NOT EXISTS grupo_contrato TEXT DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS subtipo_contrato TEXT;

-- ============================================================
-- 3. Migrate existing data: map categoria_contrato -> grupo_contrato
-- ============================================================
UPDATE con_solicitacoes SET
  subtipo_contrato = categoria_contrato,
  grupo_contrato = CASE
    WHEN categoria_contrato IN ('locacao', 'locacao_imovel_alojamento', 'locacao_imovel_canteiro', 'locacao_imovel_deposito')
      THEN 'locacao_imovel'
    WHEN categoria_contrato = 'locacao_veiculos'
      THEN 'locacao_veiculos'
    WHEN categoria_contrato IN ('locacao_equipamentos', 'locacao_ferramental')
      THEN 'locacao_equipamentos'
    WHEN categoria_contrato = 'pj_pessoa_fisica'
      THEN 'equipe_pj'
    WHEN categoria_contrato = 'prestacao_servico'
      THEN 'prestacao_servicos'
    WHEN categoria_contrato IN ('vigilancia_monitoramento', 'software_ti', 'contabilidade', 'internet_telefonia', 'servicos_medicos')
      THEN 'servico_recorrente'
    WHEN categoria_contrato IN ('fornecimento', 'aquisicao_equipamentos', 'aquisicao_ferramental', 'aquisicao_imovel', 'aquisicao_veiculos')
      THEN 'aquisicao'
    WHEN categoria_contrato IN ('subcontratacao', 'empreitada')
      THEN 'subcontratacao_empreitada'
    WHEN categoria_contrato IN ('consultoria', 'juridico_advocacia')
      THEN 'consultoria_juridico'
    WHEN categoria_contrato IN ('alimentacao_restaurante', 'hospedagem', 'frete_transportes')
      THEN 'apoio_operacional'
    WHEN categoria_contrato = 'seguros'
      THEN 'seguros'
    ELSE 'outro'
  END
WHERE grupo_contrato IS NULL OR grupo_contrato = 'outro';

-- ============================================================
-- 4. Drop old CHECK constraint on categoria_contrato
--    (inline constraints are auto-named: con_solicitacoes_categoria_contrato_check)
-- ============================================================
DO $$ BEGIN
  ALTER TABLE con_solicitacoes
    DROP CONSTRAINT IF EXISTS con_solicitacoes_categoria_contrato_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- 5. Set NOT NULL with default on grupo_contrato (safe for existing rows)
-- ============================================================
ALTER TABLE con_solicitacoes
  ALTER COLUMN grupo_contrato SET DEFAULT 'outro';
ALTER TABLE con_solicitacoes
  ALTER COLUMN grupo_contrato SET NOT NULL;

ALTER TABLE con_modelos_contrato
  ALTER COLUMN grupo_contrato SET DEFAULT 'outro';
ALTER TABLE con_modelos_contrato
  ALTER COLUMN grupo_contrato SET NOT NULL;

-- ============================================================
-- 6. Add CHECK constraints for the 12 valid groups
-- ============================================================
ALTER TABLE con_solicitacoes
  ADD CONSTRAINT chk_con_sol_grupo_contrato CHECK (
    grupo_contrato IN (
      'locacao_imovel', 'locacao_veiculos', 'locacao_equipamentos',
      'equipe_pj', 'prestacao_servicos', 'servico_recorrente',
      'aquisicao', 'subcontratacao_empreitada', 'consultoria_juridico',
      'apoio_operacional', 'seguros', 'outro'
    )
  );

ALTER TABLE con_modelos_contrato
  ADD CONSTRAINT chk_con_mod_grupo_contrato CHECK (
    grupo_contrato IN (
      'locacao_imovel', 'locacao_veiculos', 'locacao_equipamentos',
      'equipe_pj', 'prestacao_servicos', 'servico_recorrente',
      'aquisicao', 'subcontratacao_empreitada', 'consultoria_juridico',
      'apoio_operacional', 'seguros', 'outro'
    )
  );

-- ============================================================
-- 7. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_con_sol_grupo_contrato ON con_solicitacoes(grupo_contrato);
CREATE INDEX IF NOT EXISTS idx_con_mod_grupo_contrato ON con_modelos_contrato(grupo_contrato);
