-- 025 — Cadastros Master Tables
-- TEG+ ERP — 2026-03-05

-- 1. fin_classes_financeiras
CREATE TABLE IF NOT EXISTS fin_classes_financeiras (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  descricao   text NOT NULL,
  tipo        text CHECK (tipo IN ('receita', 'despesa', 'ambos')) DEFAULT 'ambos',
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fin_classes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_classes_all" ON fin_classes_financeiras
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. sys_centros_custo
CREATE TABLE IF NOT EXISTS sys_centros_custo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  descricao   text NOT NULL,
  obra_id     uuid REFERENCES sys_obras(id),
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sys_centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sys_centros_custo_all" ON sys_centros_custo
  FOR ALL USING (auth.role() = 'authenticated');

-- 3. rh_colaboradores
CREATE TABLE IF NOT EXISTS rh_colaboradores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  cpf             text UNIQUE,
  cargo           text,
  departamento    text,
  obra_id         uuid REFERENCES sys_obras(id),
  email           text,
  telefone        text,
  data_admissao   date,
  ativo           boolean NOT NULL DEFAULT true,
  foto_url        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rh_colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_colaboradores_all" ON rh_colaboradores
  FOR ALL USING (auth.role() = 'authenticated');

-- Triggers updated_at
CREATE OR REPLACE FUNCTION cad_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fin_classes_updated BEFORE UPDATE ON fin_classes_financeiras
  FOR EACH ROW EXECUTE FUNCTION cad_set_updated_at();
CREATE TRIGGER trg_sys_centros_custo_updated BEFORE UPDATE ON sys_centros_custo
  FOR EACH ROW EXECUTE FUNCTION cad_set_updated_at();
CREATE TRIGGER trg_rh_colaboradores_updated BEFORE UPDATE ON rh_colaboradores
  FOR EACH ROW EXECUTE FUNCTION cad_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fin_classes_tipo ON fin_classes_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_sys_cc_obra ON sys_centros_custo(obra_id);
CREATE INDEX IF NOT EXISTS idx_rh_colab_obra ON rh_colaboradores(obra_id);
CREATE INDEX IF NOT EXISTS idx_rh_colab_depto ON rh_colaboradores(departamento);
