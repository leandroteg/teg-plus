-- ══════════════════════════════════════════════════════════════════════════════
-- 023_controladoria.sql — Módulo Controladoria / Dashboard Diretoria — TEG+ ERP
-- ══════════════════════════════════════════════════════════════════════════════
-- CEO Dashboard: DRE, Margens, KPIs consolidados de todas as áreas
-- Tabelas: ctrl_orcamentos, ctrl_dre, ctrl_kpis_snapshot, ctrl_cenarios
-- Views: vw_ctrl_custo_por_obra, vw_ctrl_dre_consolidado
-- Depende de: sys_obras, hht_lancamentos (020), fin_contas_pagar (011),
--             con_contratos (022), fro_* (017), est_* (015)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Orçamentos por Obra (baseline do custo planejado) ─────────────────────
CREATE TABLE IF NOT EXISTS ctrl_orcamentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL UNIQUE,
  -- Orçamento detalhado (valores planejados)
  valor_mao_obra      NUMERIC(15,2) DEFAULT 0,   -- HHt planejado × custo/h
  valor_materiais     NUMERIC(15,2) DEFAULT 0,   -- compras planejadas
  valor_equipamentos  NUMERIC(15,2) DEFAULT 0,   -- frota + locações
  valor_servicos_pj   NUMERIC(15,2) DEFAULT 0,   -- subempreiteiras
  valor_indirect      NUMERIC(15,2) DEFAULT 0,   -- custos indiretos
  valor_total         NUMERIC(15,2)              -- gerado automaticamente
    GENERATED ALWAYS AS (
      valor_mao_obra + valor_materiais + valor_equipamentos +
      valor_servicos_pj + valor_indirect
    ) STORED,
  -- Receita prevista
  valor_contrato      NUMERIC(15,2) DEFAULT 0,   -- valor do contrato
  margem_alvo         NUMERIC(5,2),              -- % de margem esperada
  -- Cronograma financeiro
  data_inicio         DATE,
  data_fim_previsto   DATE,
  duracao_meses       INTEGER,
  -- Referência
  revisao             INTEGER DEFAULT 1,
  observacoes         TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctrl_orc_obra ON ctrl_orcamentos(obra_id);

-- ── 2. DRE Mensal por Obra (snapshot mensal) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ctrl_dre (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL,
  ano                 INTEGER NOT NULL,
  mes                 INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  -- Receita (do módulo Contratos)
  receita_medida      NUMERIC(15,2) DEFAULT 0,   -- medições aprovadas
  receita_faturada    NUMERIC(15,2) DEFAULT 0,   -- NFs emitidas
  receita_recebida    NUMERIC(15,2) DEFAULT 0,   -- efetivamente recebido
  -- Custos diretos
  custo_mao_obra      NUMERIC(15,2) DEFAULT 0,   -- HHt aprovado × custo
  custo_materiais     NUMERIC(15,2) DEFAULT 0,   -- compras (cmp_pedidos)
  custo_equipamentos  NUMERIC(15,2) DEFAULT 0,   -- frotas (fro_*)
  custo_servicos_pj   NUMERIC(15,2) DEFAULT 0,   -- subempreiteiras
  custo_outros        NUMERIC(15,2) DEFAULT 0,
  custo_total         NUMERIC(15,2)
    GENERATED ALWAYS AS (
      custo_mao_obra + custo_materiais + custo_equipamentos +
      custo_servicos_pj + custo_outros
    ) STORED,
  -- Resultado
  margem_bruta        NUMERIC(15,2)
    GENERATED ALWAYS AS (receita_medida - (
      custo_mao_obra + custo_materiais + custo_equipamentos +
      custo_servicos_pj + custo_outros
    )) STORED,
  percentual_margem   NUMERIC(5,2),              -- atualizado por trigger
  -- Orçado vs Real
  orcado_total        NUMERIC(15,2) DEFAULT 0,   -- do ctrl_orcamentos
  desvio_orcamento    NUMERIC(15,2),             -- real - orçado
  -- Fonte de dados
  fonte_hht           JSONB DEFAULT '{}',         -- breakdown HHt
  fonte_compras       JSONB DEFAULT '{}',         -- breakdown compras
  fonte_frotas        JSONB DEFAULT '{}',         -- breakdown frotas
  -- Audit
  calculado_em        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(obra_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_ctrl_dre_obra ON ctrl_dre(obra_id);
CREATE INDEX IF NOT EXISTS idx_ctrl_dre_ano  ON ctrl_dre(ano, mes);

-- Trigger: calcula percentual de margem
CREATE OR REPLACE FUNCTION ctrl_calcular_margem()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receita_medida > 0 THEN
    NEW.percentual_margem = ROUND(
      (NEW.receita_medida - (
        NEW.custo_mao_obra + NEW.custo_materiais + NEW.custo_equipamentos +
        NEW.custo_servicos_pj + NEW.custo_outros
      )) / NEW.receita_medida * 100, 2
    );
  ELSE
    NEW.percentual_margem = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ctrl_margem
  BEFORE INSERT OR UPDATE ON ctrl_dre
  FOR EACH ROW EXECUTE FUNCTION ctrl_calcular_margem();

-- ── 3. Snapshot de KPIs (histórico para tendências) ──────────────────────────
CREATE TABLE IF NOT EXISTS ctrl_kpis_snapshot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_snapshot   DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo            VARCHAR(20) NOT NULL
                  CHECK (tipo IN ('diario','semanal','mensal')),
  -- KPIs Compras
  rcs_abertas             INTEGER DEFAULT 0,
  rcs_pendentes_aprovacao INTEGER DEFAULT 0,
  valor_rcs_abertas       NUMERIC(15,2) DEFAULT 0,
  -- KPIs Financeiro
  cp_vencidas             INTEGER DEFAULT 0,
  cp_a_vencer_7d          INTEGER DEFAULT 0,
  valor_cp_aberto         NUMERIC(15,2) DEFAULT 0,
  caixa_disponivel        NUMERIC(15,2) DEFAULT 0,  -- puxado do Omie
  -- KPIs RH
  headcount_total         INTEGER DEFAULT 0,
  headcount_por_obra      JSONB DEFAULT '{}',
  -- KPIs HHt
  hht_horas_semana        NUMERIC(10,2) DEFAULT 0,
  hht_custo_semana        NUMERIC(15,2) DEFAULT 0,
  -- KPIs SSMA
  ocorrencias_abertas     INTEGER DEFAULT 0,
  acidentes_mes           INTEGER DEFAULT 0,
  epis_vencendo           INTEGER DEFAULT 0,
  -- KPIs Frotas
  veiculos_ativos         INTEGER DEFAULT 0,
  os_abertas              INTEGER DEFAULT 0,
  -- KPIs Contratos
  valor_total_contratos   NUMERIC(15,2) DEFAULT 0,
  valor_medido_total      NUMERIC(15,2) DEFAULT 0,
  medicoes_pendentes      INTEGER DEFAULT 0,
  pleitos_abertos         INTEGER DEFAULT 0,
  -- Dado completo (JSON para frontend flexível)
  payload                 JSONB DEFAULT '{}',
  -- Audit
  created_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(data_snapshot, tipo)
);

CREATE INDEX IF NOT EXISTS idx_ctrl_kpi_data ON ctrl_kpis_snapshot(data_snapshot);
CREATE INDEX IF NOT EXISTS idx_ctrl_kpi_tipo ON ctrl_kpis_snapshot(tipo);

-- ── 4. Cenários (simulações hipotéticas) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ctrl_cenarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  descricao           TEXT,
  obra_id             UUID REFERENCES sys_obras(id),   -- NULL = empresa toda
  -- Hipóteses (inputs do usuário)
  hipoteses           JSONB DEFAULT '{}',
  -- Exemplo: {"atraso_semanas": 2, "custo_extra_percentual": 5, "taxa_overhead": 0.15}
  -- Resultados calculados
  impacto_custo       NUMERIC(15,2),
  impacto_receita     NUMERIC(15,2),
  impacto_margem      NUMERIC(5,2),
  nova_data_fim       DATE,
  resultado           JSONB DEFAULT '{}',  -- resultado detalhado
  -- Status
  status              VARCHAR(20) DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho','calculado','aprovado','arquivado')),
  -- Audit
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ── 5. View: Custo Real Consolidado por Obra ──────────────────────────────────
CREATE OR REPLACE VIEW vw_ctrl_custo_por_obra AS
WITH
-- Custo de mão de obra (HHt aprovado)
custo_hht AS (
  SELECT
    obra_id,
    COALESCE(SUM(custo_calculado), 0) AS custo_mao_obra,
    COALESCE(SUM(horas_normais + horas_extras_50 + horas_extras_100), 0) AS total_horas
  FROM hht_lancamentos
  WHERE status = 'aprovado'
  GROUP BY obra_id
),
-- Custo de compras (pedidos emitidos)
custo_compras AS (
  SELECT
    r.obra_id,
    COALESCE(SUM(
      (SELECT SUM(i.valor_total) FROM cmp_requisicao_itens i WHERE i.requisicao_id = r.id)
    ), 0) AS custo_materiais
  FROM cmp_requisicoes r
  WHERE r.status IN ('comprada')
  GROUP BY r.obra_id
),
-- Contrato vinculado
contratos AS (
  SELECT
    obra_id,
    COALESCE(SUM(valor_total + valor_aditivos), 0) AS valor_contrato,
    COALESCE(SUM(valor_medido), 0) AS valor_medido
  FROM con_contratos
  WHERE status IN ('vigente','assinado','encerrado')
  GROUP BY obra_id
)
SELECT
  o.id AS obra_id,
  o.nome AS obra_nome,
  o.status AS obra_status,
  COALESCE(h.custo_mao_obra, 0)    AS custo_mao_obra,
  COALESCE(h.total_horas, 0)       AS total_horas_hht,
  COALESCE(c.custo_materiais, 0)   AS custo_materiais,
  COALESCE(h.custo_mao_obra, 0) + COALESCE(c.custo_materiais, 0) AS custo_total,
  COALESCE(co.valor_contrato, 0)   AS valor_contrato,
  COALESCE(co.valor_medido, 0)     AS valor_medido,
  -- Margem
  COALESCE(co.valor_medido, 0) -
    (COALESCE(h.custo_mao_obra, 0) + COALESCE(c.custo_materiais, 0)) AS margem_bruta,
  CASE
    WHEN COALESCE(co.valor_medido, 0) > 0 THEN
      ROUND((COALESCE(co.valor_medido, 0) -
        (COALESCE(h.custo_mao_obra, 0) + COALESCE(c.custo_materiais, 0))) /
        co.valor_medido * 100, 1)
    ELSE 0
  END AS percentual_margem
FROM sys_obras o
LEFT JOIN custo_hht h ON h.obra_id = o.id
LEFT JOIN custo_compras c ON c.obra_id = o.id
LEFT JOIN contratos co ON co.obra_id = o.id;

-- ── 6. View: DRE Consolidado (empresa toda) ───────────────────────────────────
CREATE OR REPLACE VIEW vw_ctrl_dre_consolidado AS
SELECT
  ano,
  mes,
  TO_CHAR(make_date(ano, mes, 1), 'Mon/YYYY') AS periodo,
  COUNT(DISTINCT obra_id) AS obras_ativas,
  SUM(receita_medida)     AS receita_total,
  SUM(receita_faturada)   AS faturamento_total,
  SUM(custo_mao_obra)     AS custo_mao_obra_total,
  SUM(custo_materiais)    AS custo_materiais_total,
  SUM(custo_equipamentos) AS custo_equipamentos_total,
  SUM(custo_total)        AS custo_total,
  SUM(margem_bruta)       AS margem_bruta_total,
  CASE WHEN SUM(receita_medida) > 0
    THEN ROUND(SUM(margem_bruta) / SUM(receita_medida) * 100, 1)
    ELSE 0
  END AS percentual_margem
FROM ctrl_dre
GROUP BY ano, mes
ORDER BY ano DESC, mes DESC;

-- ── 7. RPC: Calcula DRE de um mês específico ─────────────────────────────────
CREATE OR REPLACE FUNCTION ctrl_calcular_dre_mes(
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM now())::INTEGER,
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM now())::INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_inicio DATE;
  v_fim    DATE;
  result   JSON;
BEGIN
  v_inicio := make_date(p_ano, p_mes, 1);
  v_fim    := (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

  -- Upsert DRE para cada obra
  INSERT INTO ctrl_dre (obra_id, ano, mes,
    custo_mao_obra, custo_materiais, receita_medida, orcado_total)
  SELECT
    o.id,
    p_ano, p_mes,
    -- Custo HHt do mês
    COALESCE((
      SELECT SUM(custo_calculado) FROM hht_lancamentos
      WHERE obra_id = o.id AND data BETWEEN v_inicio AND v_fim AND status = 'aprovado'
    ), 0),
    -- Custo materiais (contas a pagar do mês)
    COALESCE((
      SELECT SUM(valor_original) FROM fin_contas_pagar
      WHERE centro_custo = o.codigo
        AND data_vencimento BETWEEN v_inicio AND v_fim
        AND status NOT IN ('cancelado')
    ), 0),
    -- Receita medida (medições aprovadas do período)
    COALESCE((
      SELECT SUM(m.valor_liquido) FROM con_medicoes m
      JOIN con_contratos ct ON ct.id = m.contrato_id
      WHERE ct.obra_id = o.id
        AND m.periodo_fim BETWEEN v_inicio AND v_fim
        AND m.status IN ('aprovada','faturada','paga')
    ), 0),
    -- Orçado total
    COALESCE((
      SELECT valor_total / NULLIF(duracao_meses, 0)
      FROM ctrl_orcamentos WHERE obra_id = o.id
    ), 0)
  FROM sys_obras o
  WHERE o.status = 'ativa'
  ON CONFLICT (obra_id, ano, mes) DO UPDATE SET
    custo_mao_obra   = EXCLUDED.custo_mao_obra,
    custo_materiais  = EXCLUDED.custo_materiais,
    receita_medida   = EXCLUDED.receita_medida,
    orcado_total     = EXCLUDED.orcado_total,
    calculado_em     = now();

  -- Retorna o DRE calculado
  SELECT json_build_object(
    'periodo', TO_CHAR(v_inicio, 'Mon/YYYY'),
    'por_obra', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT
          o.nome AS obra,
          d.custo_mao_obra, d.custo_materiais, d.custo_total,
          d.receita_medida, d.margem_bruta, d.percentual_margem,
          d.orcado_total, d.desvio_orcamento
        FROM ctrl_dre d
        JOIN sys_obras o ON o.id = d.obra_id
        WHERE d.ano = p_ano AND d.mes = p_mes
        ORDER BY o.nome
      ) d
    ),
    'consolidado', (
      SELECT row_to_json(c)
      FROM (
        SELECT
          SUM(receita_medida) AS receita_total,
          SUM(custo_total)    AS custo_total,
          SUM(margem_bruta)   AS margem_bruta,
          CASE WHEN SUM(receita_medida) > 0
            THEN ROUND(SUM(margem_bruta)/SUM(receita_medida)*100, 1) ELSE 0
          END AS percentual_margem
        FROM ctrl_dre WHERE ano = p_ano AND mes = p_mes
      ) c
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 8. RPC: Dashboard CEO (todas as áreas) ────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_ceo()
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'gerado_em',  now(),

    -- ── Compras ──
    'compras', (
      SELECT json_build_object(
        'rcs_abertas',     COUNT(*) FILTER (WHERE status NOT IN ('comprada','cancelada','rejeitada')),
        'aguard_aprovacao',COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'valor_aberto',    COALESCE(SUM(
          (SELECT SUM(valor_estimado) FROM cmp_requisicao_itens WHERE requisicao_id = r.id)
        ) FILTER (WHERE status NOT IN ('comprada','cancelada','rejeitada')), 0)
      )
      FROM cmp_requisicoes r
      WHERE created_at >= now() - INTERVAL '90 days'
    ),

    -- ── Financeiro ──
    'financeiro', (
      SELECT json_build_object(
        'cp_vencidas',     COUNT(*) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento < CURRENT_DATE),
        'cp_a_vencer_7d',  COUNT(*) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),
        'valor_cp_aberto', COALESCE(SUM(valor_original) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado')), 0)
      )
      FROM fin_contas_pagar
    ),

    -- ── RH/HHt ──
    'pessoas', (
      SELECT json_build_object(
        'headcount_total',  COUNT(*) FILTER (WHERE status = 'ativo'),
        'hht_horas_semana', COALESCE((
          SELECT SUM(horas_normais + horas_extras_50 + horas_extras_100)
          FROM hht_lancamentos
          WHERE data >= CURRENT_DATE - 7 AND status = 'aprovado'
        ), 0),
        'hht_pendentes',    COALESCE((
          SELECT COUNT(*) FROM hht_lancamentos WHERE status = 'pendente'
        ), 0)
      )
      FROM rh_colaboradores
    ),

    -- ── SSMA ──
    'ssma', (
      SELECT json_build_object(
        'ocorrencias_abertas', COUNT(*) FILTER (WHERE status != 'encerrada'),
        'acidentes_30d',       COUNT(*) FILTER (WHERE tipo LIKE 'acidente%' AND data_ocorrencia >= now() - INTERVAL '30 days'),
        'epis_vencendo',       (SELECT COUNT(*) FROM ssm_epi_colaborador WHERE estado = 'ativo' AND data_vencimento <= CURRENT_DATE + 30)
      )
      FROM ssm_ocorrencias
    ),

    -- ── Contratos ──
    'contratos', (
      SELECT json_build_object(
        'valor_total',      COALESCE(SUM(valor_total + valor_aditivos), 0),
        'valor_medido',     COALESCE(SUM(valor_medido), 0),
        'valor_a_medir',    COALESCE(SUM(valor_a_medir), 0),
        'medicoes_pendentes', (SELECT COUNT(*) FROM con_medicoes WHERE status IN ('submetida','em_analise_cliente')),
        'contratos_vencendo_60d', COUNT(*) FILTER (WHERE status = 'vigente' AND data_fim_previsto <= CURRENT_DATE + 60)
      )
      FROM con_contratos WHERE status IN ('vigente','assinado')
    ),

    -- ── Custo Real por Obra ──
    'custo_por_obra', (
      SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json)
      FROM vw_ctrl_custo_por_obra v
      WHERE obra_status = 'ativa'
    )

  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 9. RPC: Snapshot de KPIs (chamado pelo n8n diariamente) ──────────────────
CREATE OR REPLACE FUNCTION ctrl_gerar_snapshot_kpis(
  p_tipo VARCHAR DEFAULT 'diario'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_payload JSONB;
BEGIN
  -- Gera snapshot completo
  SELECT get_dashboard_ceo()::JSONB INTO v_payload;

  INSERT INTO ctrl_kpis_snapshot (tipo, payload,
    rcs_abertas, cp_vencidas, valor_cp_aberto,
    headcount_total, ocorrencias_abertas,
    valor_total_contratos, valor_medido_total
  )
  SELECT
    p_tipo,
    v_payload,
    (v_payload->'compras'->>'rcs_abertas')::INTEGER,
    (v_payload->'financeiro'->>'cp_vencidas')::INTEGER,
    (v_payload->'financeiro'->>'valor_cp_aberto')::NUMERIC,
    (v_payload->'pessoas'->>'headcount_total')::INTEGER,
    (v_payload->'ssma'->>'ocorrencias_abertas')::INTEGER,
    (v_payload->'contratos'->>'valor_total')::NUMERIC,
    (v_payload->'contratos'->>'valor_medido')::NUMERIC
  ON CONFLICT (data_snapshot, tipo) DO UPDATE SET
    payload = EXCLUDED.payload,
    rcs_abertas = EXCLUDED.rcs_abertas,
    cp_vencidas = EXCLUDED.cp_vencidas,
    valor_cp_aberto = EXCLUDED.valor_cp_aberto,
    headcount_total = EXCLUDED.headcount_total,
    ocorrencias_abertas = EXCLUDED.ocorrencias_abertas,
    valor_total_contratos = EXCLUDED.valor_total_contratos,
    valor_medido_total = EXCLUDED.valor_medido_total
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 10. Triggers updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ctrl_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ctrl_orc_updated
  BEFORE UPDATE ON ctrl_orcamentos
  FOR EACH ROW EXECUTE FUNCTION ctrl_set_updated_at();

CREATE OR REPLACE TRIGGER trg_ctrl_cen_updated
  BEFORE UPDATE ON ctrl_cenarios
  FOR EACH ROW EXECUTE FUNCTION ctrl_set_updated_at();

-- ── 11. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE ctrl_orcamentos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ctrl_dre           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ctrl_kpis_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE ctrl_cenarios      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ctrl_orc_read"  ON ctrl_orcamentos    FOR SELECT TO authenticated USING (true);
CREATE POLICY "ctrl_dre_read"  ON ctrl_dre           FOR SELECT TO authenticated USING (true);
CREATE POLICY "ctrl_kpi_read"  ON ctrl_kpis_snapshot FOR SELECT TO authenticated USING (true);
CREATE POLICY "ctrl_cen_read"  ON ctrl_cenarios      FOR SELECT TO authenticated USING (true);

CREATE POLICY "ctrl_orc_write" ON ctrl_orcamentos    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ctrl_dre_write" ON ctrl_dre           FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "ctrl_kpi_write" ON ctrl_kpis_snapshot FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "ctrl_cen_write" ON ctrl_cenarios      FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM 023_controladoria.sql
-- ══════════════════════════════════════════════════════════════════════════════
