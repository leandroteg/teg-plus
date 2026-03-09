-- ============================================================================
-- 032_contratos_completo.sql
-- Expand Contratos module: medições, aditivos, reajustes, cronograma
-- ============================================================================

-- ── 1. Expand tipo_contrato enum to include 'misto' ─────────────────────────
ALTER TYPE tipo_contrato ADD VALUE IF NOT EXISTS 'misto';

-- ── 2. Add new columns to con_contratos ─────────────────────────────────────
ALTER TABLE con_contratos
  ADD COLUMN IF NOT EXISTS sla_dias_pagamento INTEGER,
  ADD COLUMN IF NOT EXISTS penalidade_atraso_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periodicidade_reajuste TEXT; -- anual / semestral / contratual

-- ── 3. con_medicoes — Boletins de Medição ───────────────────────────────────
CREATE TABLE IF NOT EXISTS con_medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES con_contratos(id) ON DELETE CASCADE,
  numero_bm TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor_medido NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_retencao NUMERIC(15,2) DEFAULT 0,
  valor_liquido NUMERIC(15,2) GENERATED ALWAYS AS (valor_medido - COALESCE(valor_retencao, 0)) STORED,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_aprovacao','aprovado','rejeitado','faturado')),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. con_medicao_itens — Itens medidos por BM ────────────────────────────
CREATE TABLE IF NOT EXISTS con_medicao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id UUID NOT NULL REFERENCES con_medicoes(id) ON DELETE CASCADE,
  contrato_item_id UUID REFERENCES con_contrato_itens(id),
  quantidade_medida NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(15,2) GENERATED ALWAYS AS (quantidade_medida * valor_unitario) STORED,
  percentual_acumulado NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. con_aditivos — Aditivos contratuais ──────────────────────────────────
CREATE TABLE IF NOT EXISTS con_aditivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES con_contratos(id) ON DELETE CASCADE,
  numero_aditivo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('escopo','prazo','valor','misto')),
  descricao TEXT NOT NULL,
  valor_acrescimo NUMERIC(15,2) DEFAULT 0,
  nova_data_fim DATE,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_aprovacao','aprovado','rejeitado')),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  documento_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. con_reajustes — Histórico de reajustes ──────────────────────────────
CREATE TABLE IF NOT EXISTS con_reajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES con_contratos(id) ON DELETE CASCADE,
  data_base DATE NOT NULL,
  indice_nome TEXT NOT NULL,
  percentual_aplicado NUMERIC(5,4) NOT NULL,
  valor_antes NUMERIC(15,2) NOT NULL,
  valor_depois NUMERIC(15,2) NOT NULL,
  aplicado_em TIMESTAMPTZ DEFAULT now(),
  aplicado_por UUID REFERENCES sys_perfis(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 7. con_cronograma — Cronograma físico-financeiro ────────────────────────
CREATE TABLE IF NOT EXISTS con_cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES con_contratos(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL,
  peso_percentual NUMERIC(5,2) DEFAULT 0,
  data_inicio_prevista DATE,
  data_fim_prevista DATE,
  data_inicio_real DATE,
  data_fim_real DATE,
  valor_previsto NUMERIC(15,2) DEFAULT 0,
  valor_realizado NUMERIC(15,2) DEFAULT 0,
  percentual_fisico NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nao_iniciada'
    CHECK (status IN ('nao_iniciada','em_andamento','concluida','atrasada')),
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 8. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_con_medicoes_contrato ON con_medicoes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_medicoes_status ON con_medicoes(status);
CREATE INDEX IF NOT EXISTS idx_con_medicao_itens_medicao ON con_medicao_itens(medicao_id);
CREATE INDEX IF NOT EXISTS idx_con_aditivos_contrato ON con_aditivos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_reajustes_contrato ON con_reajustes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_cronograma_contrato ON con_cronograma(contrato_id);

-- ── 9. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE con_medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_medicao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_aditivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_reajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_cronograma ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated full access (same pattern as existing con_ tables)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'con_medicoes','con_medicao_itens','con_aditivos','con_reajustes','con_cronograma'
  ]) LOOP
    EXECUTE format('
      CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);
      CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true);
      CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);
    ',
      tbl || '_sel', tbl,
      tbl || '_ins', tbl,
      tbl || '_upd', tbl,
      tbl || '_del', tbl
    );
  END LOOP;
END $$;

-- ── 10. Trigger: auto-update valor_aditivos on con_contratos ────────────────
CREATE OR REPLACE FUNCTION fn_con_aditivo_update_contrato()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD IS NULL OR OLD.status <> 'aprovado') THEN
    UPDATE con_contratos
    SET valor_aditivos = COALESCE(valor_aditivos, 0) + COALESCE(NEW.valor_acrescimo, 0),
        updated_at = now()
    WHERE id = NEW.contrato_id;

    -- Update data_fim if aditivo changes it
    IF NEW.nova_data_fim IS NOT NULL THEN
      UPDATE con_contratos
      SET data_fim_previsto = NEW.nova_data_fim,
          updated_at = now()
      WHERE id = NEW.contrato_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_con_aditivo_update ON con_aditivos;
CREATE TRIGGER trg_con_aditivo_update
  AFTER INSERT OR UPDATE ON con_aditivos
  FOR EACH ROW EXECUTE FUNCTION fn_con_aditivo_update_contrato();

-- ── 11. Trigger: auto-update valor_medido on con_contratos ──────────────────
CREATE OR REPLACE FUNCTION fn_con_medicao_update_contrato()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD IS NULL OR OLD.status <> 'aprovado') THEN
    UPDATE con_contratos
    SET valor_medido = (
      SELECT COALESCE(SUM(valor_medido), 0)
      FROM con_medicoes
      WHERE contrato_id = NEW.contrato_id AND status IN ('aprovado','faturado')
    ),
    updated_at = now()
    WHERE id = NEW.contrato_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_con_medicao_update ON con_medicoes;
CREATE TRIGGER trg_con_medicao_update
  AFTER INSERT OR UPDATE ON con_medicoes
  FOR EACH ROW EXECUTE FUNCTION fn_con_medicao_update_contrato();

-- ── 12. View: resumo contratos ──────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_con_contratos_resumo AS
SELECT
  c.id,
  c.numero,
  c.tipo_contrato,
  c.objeto,
  c.status,
  c.valor_total,
  COALESCE(c.valor_aditivos, 0) AS valor_aditivos,
  c.valor_total + COALESCE(c.valor_aditivos, 0) AS valor_contrato_atual,
  COALESCE(c.valor_medido, 0) AS valor_medido,
  c.valor_total + COALESCE(c.valor_aditivos, 0) - COALESCE(c.valor_medido, 0) AS saldo_a_medir,
  CASE WHEN c.valor_total + COALESCE(c.valor_aditivos, 0) > 0
    THEN ROUND(COALESCE(c.valor_medido, 0) * 100.0 / (c.valor_total + COALESCE(c.valor_aditivos, 0)), 2)
    ELSE 0 END AS pct_medido,
  c.data_inicio,
  c.data_fim_previsto,
  o.nome AS obra_nome,
  cl.nome AS cliente_nome
FROM con_contratos c
LEFT JOIN sys_obras o ON o.id = c.obra_id
LEFT JOIN con_clientes cl ON cl.id = c.cliente_id;

-- ── 13. Updated at triggers ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['con_medicoes','con_aditivos','con_cronograma']) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
    ', tbl, tbl);
  END LOOP;
END $$;
