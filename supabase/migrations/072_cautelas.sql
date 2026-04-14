-- ============================================================================
-- Cautela (Inventory Checkout) Tables
-- ============================================================================

-- 1. est_cautelas — Main checkout record
CREATE TABLE IF NOT EXISTS est_cautelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(20) UNIQUE,
  solicitante_id UUID,
  solicitante_nome TEXT,
  obra_id UUID,
  obra_nome TEXT,
  base_id UUID REFERENCES est_bases(id),
  centro_custo TEXT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','pendente_aprovacao','aprovada','em_separacao','retirada','parcial_devolvida','devolvida','vencida','cancelada')),
  urgencia TEXT DEFAULT 'normal' CHECK (urgencia IN ('normal','urgente','emergencia')),
  data_retirada TIMESTAMPTZ,
  data_devolucao_prevista DATE,
  data_devolucao_real TIMESTAMPTZ,
  aprovador_id UUID,
  aprovador_nome TEXT,
  aprovado_em TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  assinatura_retirada_url TEXT,
  assinatura_devolucao_url TEXT,
  foto_retirada_url TEXT[],
  foto_devolucao_url TEXT[],
  termo_url TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. est_cautela_itens — Items in each cautela
CREATE TABLE IF NOT EXISTS est_cautela_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cautela_id UUID NOT NULL REFERENCES est_cautelas(id) ON DELETE CASCADE,
  item_id UUID REFERENCES est_itens(id),
  descricao_livre TEXT,
  quantidade NUMERIC(12,3) NOT NULL,
  quantidade_devolvida NUMERIC(12,3) DEFAULT 0,
  condicao_retirada TEXT,
  condicao_devolucao TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- 3. est_cautela_favoritos — Frequent items per user
CREATE TABLE IF NOT EXISTS est_cautela_favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES est_itens(id),
  frequencia INT DEFAULT 1,
  ultimo_uso TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, item_id)
);

-- 4. est_cautela_templates — Pre-built kits
CREATE TABLE IF NOT EXISTS est_cautela_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  itens JSONB NOT NULL DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  criado_por UUID,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE est_cautelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_cautela_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_cautela_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_cautela_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_cautelas_all" ON est_cautelas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "est_cautela_itens_all" ON est_cautela_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "est_cautela_favoritos_all" ON est_cautela_favoritos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "est_cautela_templates_all" ON est_cautela_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_est_cautelas_status ON est_cautelas(status);
CREATE INDEX idx_est_cautelas_solicitante ON est_cautelas(solicitante_id);
CREATE INDEX idx_est_cautela_itens_cautela ON est_cautela_itens(cautela_id);

-- ── Auto-number trigger (CAU-YYYY-0001) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cautela_auto_numero()
RETURNS TRIGGER AS $$
DECLARE
  ano TEXT;
  seq INT;
BEGIN
  ano := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 10) AS INT)), 0) + 1
    INTO seq
    FROM est_cautelas
   WHERE numero LIKE 'CAU-' || ano || '-%';
  NEW.numero := 'CAU-' || ano || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cautela_auto_numero
  BEFORE INSERT ON est_cautelas
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION fn_cautela_auto_numero();
