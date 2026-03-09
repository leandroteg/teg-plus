-- ============================================================================
-- 034_controladoria_full.sql
-- Módulo Controladoria: orçamentos, DRE, KPIs, cenários, alertas
-- ============================================================================

-- ── 1. ctrl_orcamentos — Orçamento base por obra ────────────────────────────
CREATE TABLE IF NOT EXISTS ctrl_orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  valor_contrato NUMERIC(15,2) DEFAULT 0,
  valor_mao_obra NUMERIC(15,2) DEFAULT 0,
  valor_materiais NUMERIC(15,2) DEFAULT 0,
  valor_equipamentos NUMERIC(15,2) DEFAULT 0,
  valor_servicos_pj NUMERIC(15,2) DEFAULT 0,
  valor_indirect NUMERIC(15,2) DEFAULT 0,
  valor_gastos_campo NUMERIC(15,2) DEFAULT 0,
  margem_alvo NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aprovado','revisado')),
  aprovado_por UUID REFERENCES sys_perfis(id),
  aprovado_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(obra_id, ano)
);

-- ── 2. ctrl_orcamento_linhas — Detalhamento por categoria/mês ───────────────
CREATE TABLE IF NOT EXISTS ctrl_orcamento_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES ctrl_orcamentos(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor_planejado NUMERIC(15,2) DEFAULT 0,
  valor_realizado NUMERIC(15,2) DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. ctrl_dre — DRE mensal por obra ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ctrl_dre (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  receita_medida NUMERIC(15,2) DEFAULT 0,
  receita_faturada NUMERIC(15,2) DEFAULT 0,
  receita_recebida NUMERIC(15,2) DEFAULT 0,
  custo_mao_obra NUMERIC(15,2) DEFAULT 0,
  custo_materiais NUMERIC(15,2) DEFAULT 0,
  custo_equipamentos NUMERIC(15,2) DEFAULT 0,
  custo_servicos_pj NUMERIC(15,2) DEFAULT 0,
  custo_gastos_campo NUMERIC(15,2) DEFAULT 0,
  custo_outros NUMERIC(15,2) DEFAULT 0,
  custo_total NUMERIC(15,2) GENERATED ALWAYS AS (
    COALESCE(custo_mao_obra,0) + COALESCE(custo_materiais,0) +
    COALESCE(custo_equipamentos,0) + COALESCE(custo_servicos_pj,0) +
    COALESCE(custo_gastos_campo,0) + COALESCE(custo_outros,0)
  ) STORED,
  margem_bruta NUMERIC(15,2) GENERATED ALWAYS AS (
    COALESCE(receita_medida,0) - (
      COALESCE(custo_mao_obra,0) + COALESCE(custo_materiais,0) +
      COALESCE(custo_equipamentos,0) + COALESCE(custo_servicos_pj,0) +
      COALESCE(custo_gastos_campo,0) + COALESCE(custo_outros,0)
    )
  ) STORED,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(obra_id, ano, mes)
);

-- ── 4. ctrl_kpis_snapshot — KPIs periódicos ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ctrl_kpis_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES sys_obras(id),
  data_snapshot DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'semanal'
    CHECK (tipo IN ('semanal','mensal','trimestral')),
  idc NUMERIC(5,3),          -- CPI
  idp NUMERIC(5,3),          -- SPI
  eac NUMERIC(15,2),         -- Estimate at Completion
  margem_real NUMERIC(5,2),
  faturamento_mes NUMERIC(15,2),
  producao_mes NUMERIC(15,2),
  dados_extras JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. ctrl_cenarios — Simulações ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ctrl_cenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES sys_obras(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'base'
    CHECK (tipo IN ('otimista','base','conservador','personalizado')),
  premissas JSONB DEFAULT '{}'::jsonb,
  resultados JSONB DEFAULT '{}'::jsonb,
  criado_por UUID REFERENCES sys_perfis(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. ctrl_alertas_desvio — Alertas automáticos ────────────────────────────
CREATE TABLE IF NOT EXISTS ctrl_alertas_desvio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'custo_total','custo_categoria','margem','prazo','multa'
  )),
  categoria TEXT,
  desvio_pct NUMERIC(5,2) NOT NULL,
  valor_orcado NUMERIC(15,2),
  valor_realizado NUMERIC(15,2),
  severidade TEXT NOT NULL DEFAULT 'amarelo'
    CHECK (severidade IN ('amarelo','vermelho','critico')),
  mensagem TEXT NOT NULL,
  lido BOOLEAN DEFAULT false,
  resolvido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 7. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ctrl_orcamentos_obra ON ctrl_orcamentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_orcamento_linhas_orc ON ctrl_orcamento_linhas(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_dre_obra ON ctrl_dre(obra_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_dre_periodo ON ctrl_dre(ano, mes);
CREATE INDEX IF NOT EXISTS idx_ctrl_kpis_obra ON ctrl_kpis_snapshot(obra_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_kpis_data ON ctrl_kpis_snapshot(data_snapshot);
CREATE INDEX IF NOT EXISTS idx_ctrl_cenarios_obra ON ctrl_cenarios(obra_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_alertas_obra ON ctrl_alertas_desvio(obra_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_alertas_lido ON ctrl_alertas_desvio(lido);

-- ── 8. RLS ──────────────────────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'ctrl_orcamentos','ctrl_orcamento_linhas','ctrl_dre',
    'ctrl_kpis_snapshot','ctrl_cenarios','ctrl_alertas_desvio'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
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

-- ── 9. Views ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_ctrl_dre_consolidado AS
SELECT
  d.ano, d.mes,
  COUNT(DISTINCT d.obra_id) AS obras_ativas,
  SUM(d.receita_medida) AS receita_total,
  SUM(d.receita_faturada) AS faturamento_total,
  SUM(d.custo_total) AS custo_total,
  SUM(d.margem_bruta) AS margem_bruta_total,
  CASE WHEN SUM(d.receita_medida) > 0
    THEN ROUND(SUM(d.margem_bruta) * 100.0 / SUM(d.receita_medida), 2)
    ELSE 0 END AS pct_margem
FROM ctrl_dre d
GROUP BY d.ano, d.mes
ORDER BY d.ano, d.mes;

CREATE OR REPLACE VIEW vw_ctrl_custo_por_obra AS
WITH custo_cp AS (
  SELECT cp.obra_id, COALESCE(SUM(cp.valor), 0) AS custo_cp
  FROM fin_contas_pagar cp
  WHERE cp.status = 'pago' AND cp.obra_id IS NOT NULL
  GROUP BY cp.obra_id
),
custo_prestacoes AS (
  SELECT pc.obra_id, COALESCE(SUM(pc.valor), 0) AS custo_prestacoes
  FROM obr_prestacao_contas pc
  WHERE pc.status = 'aprovada'
  GROUP BY pc.obra_id
)
SELECT
  o.id AS obra_id,
  o.nome AS obra_nome,
  COALESCE(cp.custo_cp, 0) AS custo_financeiro,
  COALESCE(pr.custo_prestacoes, 0) AS custo_campo,
  COALESCE(cp.custo_cp, 0) + COALESCE(pr.custo_prestacoes, 0) AS custo_total
FROM sys_obras o
LEFT JOIN custo_cp cp ON cp.obra_id = o.id
LEFT JOIN custo_prestacoes pr ON pr.obra_id = o.id;

CREATE OR REPLACE VIEW vw_ctrl_gastos_campo_por_cc AS
SELECT
  o.nome AS obra,
  cc.codigo AS centro_custo,
  cf.descricao AS classe_financeira,
  pc.categoria,
  DATE_TRUNC('month', pc.data_gasto)::DATE AS mes,
  SUM(pc.valor) AS total_gasto,
  COUNT(*) AS qtd_lancamentos
FROM obr_prestacao_contas pc
JOIN sys_obras o ON o.id = pc.obra_id
LEFT JOIN sys_centros_custo cc ON cc.id = pc.centro_custo_id
LEFT JOIN fin_classes_financeiras cf ON cf.id = pc.classe_financeira_id
WHERE pc.status = 'aprovada'
GROUP BY o.nome, cc.codigo, cf.descricao, pc.categoria, DATE_TRUNC('month', pc.data_gasto);

-- ── 10. Updated at triggers ─────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['ctrl_orcamentos','ctrl_dre','ctrl_cenarios']) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
    ', tbl, tbl);
  END LOOP;
END $$;
