-- ══════════════════════════════════════════════════════════════════════════════
-- 020_hht.sql — Módulo HHt (Homens-Hora de Campo) — TEG+ ERP
-- ══════════════════════════════════════════════════════════════════════════════
-- PRIORIDADE 1 — Base do custo real por obra
-- Tabelas: hht_atividades, hht_lancamentos, hht_aprovacoes, hht_consolidado
-- Depende de: sys_obras (001), rh_colaboradores (019)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Catálogo de Atividades ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hht_atividades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          VARCHAR(20) UNIQUE NOT NULL,
  descricao       VARCHAR(200) NOT NULL,
  categoria       VARCHAR(50)
                  CHECK (categoria IN (
                    'montagem','eletrica','civil','logistica',
                    'manutencao','ssma','administrativo','outro'
                  )),
  unidade_medida  VARCHAR(20) DEFAULT 'h'   -- h = horas, d = dias
                  CHECK (unidade_medida IN ('h','d')),
  custo_hora_ref  NUMERIC(10,2),            -- custo de referência por hora (atualizado pelo RH)
  requer_nr       TEXT[],                   -- NRs obrigatórias para esta atividade
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO hht_atividades (codigo, descricao, categoria) VALUES
  ('MONT-EST', 'Montagem de Estruturas Metálicas',     'montagem'),
  ('MONT-EQP', 'Montagem de Equipamentos',             'montagem'),
  ('ELET-CAB', 'Lançamento de Cabos',                 'eletrica'),
  ('ELET-CON', 'Conexões e Terminações Elétricas',    'eletrica'),
  ('ELET-TES', 'Testes e Comissionamento',            'eletrica'),
  ('CIV-ESC',  'Escavação e Terraplanagem',           'civil'),
  ('CIV-CON',  'Concretagem e Fundações',             'civil'),
  ('LOG-DES',  'Descarregamento e Movimentação',      'logistica'),
  ('MAN-PRE',  'Manutenção Preventiva',               'manutencao'),
  ('MAN-COR',  'Manutenção Corretiva',                'manutencao'),
  ('SSM-INS',  'Inspeção de Segurança',               'ssma'),
  ('ADM-REU',  'Reuniões e Administrativo',           'administrativo')
ON CONFLICT (codigo) DO NOTHING;

-- ── 2. Lançamentos de HHt (entidade principal) ────────────────────────────────
CREATE TABLE IF NOT EXISTS hht_lancamentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem / Onde / Quando
  colaborador_id      UUID REFERENCES rh_colaboradores(id) NOT NULL,
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL,
  atividade_id        UUID REFERENCES hht_atividades(id),
  data                DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Horas
  horas_normais       NUMERIC(5,2) DEFAULT 0 CHECK (horas_normais >= 0),
  horas_extras_50     NUMERIC(5,2) DEFAULT 0 CHECK (horas_extras_50 >= 0),   -- HE 50%
  horas_extras_100    NUMERIC(5,2) DEFAULT 0 CHECK (horas_extras_100 >= 0),  -- HE 100%
  horas_noturnas      NUMERIC(5,2) DEFAULT 0 CHECK (horas_noturnas >= 0),    -- adicional noturno
  -- Geolocalização (mobile)
  lat_checkin         NUMERIC(10,7),
  lng_checkin         NUMERIC(10,7),
  lat_checkout        NUMERIC(10,7),
  lng_checkout        NUMERIC(10,7),
  checkin_em          TIMESTAMPTZ,
  checkout_em         TIMESTAMPTZ,
  -- Custo calculado
  custo_calculado     NUMERIC(12,2),    -- preenchido pelo trigger
  -- Status e aprovação
  status              VARCHAR(20) DEFAULT 'pendente'
                      CHECK (status IN ('pendente','aprovado','rejeitado','corrigido')),
  -- Observações
  observacao          TEXT,
  motivo_rejeicao     TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  lancado_por         UUID   -- pode ser o próprio ou o encarregado
);

CREATE INDEX IF NOT EXISTS idx_hht_lan_colaborador ON hht_lancamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_hht_lan_obra        ON hht_lancamentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_hht_lan_data        ON hht_lancamentos(data);
CREATE INDEX IF NOT EXISTS idx_hht_lan_status      ON hht_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_hht_lan_atividade   ON hht_lancamentos(atividade_id);
-- Índice único: 1 lançamento por colaborador/obra/data/atividade
CREATE UNIQUE INDEX IF NOT EXISTS idx_hht_lan_unique
  ON hht_lancamentos(colaborador_id, obra_id, data, atividade_id)
  WHERE status != 'rejeitado';

-- ── 3. Aprovações de HHt ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hht_aprovacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id   UUID REFERENCES hht_lancamentos(id) NOT NULL,
  aprovador_id    UUID,                     -- sys_perfis
  aprovador_nome  TEXT NOT NULL,
  decisao         VARCHAR(20) NOT NULL
                  CHECK (decisao IN ('aprovado','rejeitado')),
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hht_apr_lancamento ON hht_aprovacoes(lancamento_id);

-- ── 4. Consolidado diário por obra (materializado via trigger) ────────────────
CREATE TABLE IF NOT EXISTS hht_consolidado (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL,
  data                DATE NOT NULL,
  -- Totais do dia
  total_colaboradores INTEGER DEFAULT 0,
  total_horas_normais NUMERIC(8,2) DEFAULT 0,
  total_horas_extras  NUMERIC(8,2) DEFAULT 0,
  total_horas_geral   NUMERIC(8,2) DEFAULT 0,
  custo_total         NUMERIC(14,2) DEFAULT 0,
  -- Breakdown por atividade (JSON)
  por_atividade       JSONB DEFAULT '[]',
  -- Audit
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(obra_id, data)
);

CREATE INDEX IF NOT EXISTS idx_hht_cons_obra ON hht_consolidado(obra_id);
CREATE INDEX IF NOT EXISTS idx_hht_cons_data ON hht_consolidado(data);

-- ── 5. Trigger: calcula custo e atualiza consolidado ─────────────────────────
CREATE OR REPLACE FUNCTION hht_calcular_custo()
RETURNS TRIGGER AS $$
DECLARE
  v_custo_hora NUMERIC;
BEGIN
  -- Busca custo de referência da atividade
  SELECT COALESCE(custo_hora_ref, 0)
  INTO v_custo_hora
  FROM hht_atividades
  WHERE id = NEW.atividade_id;

  -- Calcula custo: normais + 50% extras + 100% extras
  NEW.custo_calculado = (
    NEW.horas_normais * v_custo_hora +
    NEW.horas_extras_50 * v_custo_hora * 1.5 +
    NEW.horas_extras_100 * v_custo_hora * 2.0 +
    NEW.horas_noturnas * v_custo_hora * 0.2   -- adicional noturno 20%
  );

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_hht_custo
  BEFORE INSERT OR UPDATE ON hht_lancamentos
  FOR EACH ROW EXECUTE FUNCTION hht_calcular_custo();

-- ── 6. Trigger: atualiza consolidado quando lançamento aprovado ───────────────
CREATE OR REPLACE FUNCTION hht_atualizar_consolidado()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcula consolidado para obra+data afetada
  INSERT INTO hht_consolidado (obra_id, data, total_colaboradores,
    total_horas_normais, total_horas_extras, total_horas_geral, custo_total, por_atividade)
  SELECT
    l.obra_id,
    l.data,
    COUNT(DISTINCT l.colaborador_id),
    COALESCE(SUM(l.horas_normais), 0),
    COALESCE(SUM(l.horas_extras_50 + l.horas_extras_100), 0),
    COALESCE(SUM(l.horas_normais + l.horas_extras_50 + l.horas_extras_100 + l.horas_noturnas), 0),
    COALESCE(SUM(l.custo_calculado), 0),
    COALESCE(
      json_agg(json_build_object(
        'atividade_id', l.atividade_id,
        'horas', l.horas_normais + l.horas_extras_50 + l.horas_extras_100,
        'custo', l.custo_calculado
      )) FILTER (WHERE l.atividade_id IS NOT NULL),
      '[]'
    )::jsonb
  FROM hht_lancamentos l
  WHERE l.obra_id = NEW.obra_id AND l.data = NEW.data AND l.status = 'aprovado'
  GROUP BY l.obra_id, l.data
  ON CONFLICT (obra_id, data) DO UPDATE SET
    total_colaboradores = EXCLUDED.total_colaboradores,
    total_horas_normais = EXCLUDED.total_horas_normais,
    total_horas_extras  = EXCLUDED.total_horas_extras,
    total_horas_geral   = EXCLUDED.total_horas_geral,
    custo_total         = EXCLUDED.custo_total,
    por_atividade       = EXCLUDED.por_atividade,
    updated_at          = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_hht_consolidado
  AFTER INSERT OR UPDATE ON hht_lancamentos
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION hht_atualizar_consolidado();

-- ── 7. Trigger: aprovação automática ao registrar em hht_aprovacoes ──────────
CREATE OR REPLACE FUNCTION hht_processar_aprovacao()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE hht_lancamentos
  SET status = NEW.decisao, updated_at = now()
  WHERE id = NEW.lancamento_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_hht_processar_apr
  AFTER INSERT ON hht_aprovacoes
  FOR EACH ROW EXECUTE FUNCTION hht_processar_aprovacao();

-- ── 8. RPC: Dashboard HHt ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_hht(
  p_obra_id UUID DEFAULT NULL,
  p_dias INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'resumo', (
      SELECT json_build_object(
        'total_lancamentos',  COUNT(*),
        'aprovados',          COUNT(*) FILTER (WHERE status = 'aprovado'),
        'pendentes',          COUNT(*) FILTER (WHERE status = 'pendente'),
        'rejeitados',         COUNT(*) FILTER (WHERE status = 'rejeitado'),
        'total_horas',        COALESCE(SUM(horas_normais + horas_extras_50 + horas_extras_100) FILTER (WHERE status = 'aprovado'), 0),
        'custo_total',        COALESCE(SUM(custo_calculado) FILTER (WHERE status = 'aprovado'), 0),
        'colaboradores_ativos', COUNT(DISTINCT colaborador_id) FILTER (WHERE status = 'aprovado')
      )
      FROM hht_lancamentos
      WHERE data >= CURRENT_DATE - p_dias
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),
    'por_obra', (
      SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json)
      FROM (
        SELECT
          o.nome AS obra,
          COALESCE(SUM(l.horas_normais + l.horas_extras_50 + l.horas_extras_100), 0) AS horas,
          COALESCE(SUM(l.custo_calculado), 0) AS custo,
          COUNT(DISTINCT l.colaborador_id) AS colaboradores
        FROM sys_obras o
        LEFT JOIN hht_lancamentos l ON l.obra_id = o.id
          AND l.status = 'aprovado'
          AND l.data >= CURRENT_DATE - p_dias
        WHERE o.status = 'ativa'
          AND (p_obra_id IS NULL OR o.id = p_obra_id)
        GROUP BY o.id, o.nome
        ORDER BY horas DESC
      ) x
    ),
    'por_atividade', (
      SELECT COALESCE(json_agg(row_to_json(y)), '[]'::json)
      FROM (
        SELECT
          a.descricao AS atividade,
          a.categoria,
          COALESCE(SUM(l.horas_normais + l.horas_extras_50 + l.horas_extras_100), 0) AS horas,
          COALESCE(SUM(l.custo_calculado), 0) AS custo
        FROM hht_atividades a
        LEFT JOIN hht_lancamentos l ON l.atividade_id = a.id
          AND l.status = 'aprovado'
          AND l.data >= CURRENT_DATE - p_dias
          AND (p_obra_id IS NULL OR l.obra_id = p_obra_id)
        GROUP BY a.id, a.descricao, a.categoria
        ORDER BY horas DESC
      ) y
    ),
    'pendentes_aprovacao', (
      SELECT COALESCE(json_agg(row_to_json(z)), '[]'::json)
      FROM (
        SELECT
          l.id,
          c.nome AS colaborador,
          o.nome AS obra,
          a.descricao AS atividade,
          l.data,
          l.horas_normais + l.horas_extras_50 + l.horas_extras_100 AS total_horas,
          l.created_at
        FROM hht_lancamentos l
        JOIN rh_colaboradores c ON c.id = l.colaborador_id
        JOIN sys_obras o ON o.id = l.obra_id
        LEFT JOIN hht_atividades a ON a.id = l.atividade_id
        WHERE l.status = 'pendente'
          AND (p_obra_id IS NULL OR l.obra_id = p_obra_id)
        ORDER BY l.data DESC, l.created_at DESC
        LIMIT 50
      ) z
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 9. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE hht_atividades  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hht_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hht_aprovacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hht_consolidado ENABLE ROW LEVEL SECURITY;

-- Leitura: autenticados
DROP POLICY IF EXISTS "hht_ativ_read" ON hht_atividades;
DROP POLICY IF EXISTS "hht_lan_read"  ON hht_lancamentos;
DROP POLICY IF EXISTS "hht_apr_read"  ON hht_aprovacoes;
DROP POLICY IF EXISTS "hht_cons_read" ON hht_consolidado;

CREATE POLICY "hht_ativ_read" ON hht_atividades  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hht_lan_read"  ON hht_lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "hht_apr_read"  ON hht_aprovacoes  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hht_cons_read" ON hht_consolidado FOR SELECT TO authenticated USING (true);

-- Escrita: autenticados (campo lança) + service_role (n8n)
DROP POLICY IF EXISTS "hht_ativ_write"  ON hht_atividades;
DROP POLICY IF EXISTS "hht_lan_write"   ON hht_lancamentos;
DROP POLICY IF EXISTS "hht_apr_write"   ON hht_aprovacoes;
DROP POLICY IF EXISTS "hht_cons_write"  ON hht_consolidado;

CREATE POLICY "hht_ativ_write"  ON hht_atividades  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "hht_lan_write"   ON hht_lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hht_apr_write"   ON hht_aprovacoes  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hht_cons_write"  ON hht_consolidado FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM 020_hht.sql
-- ══════════════════════════════════════════════════════════════════════════════
