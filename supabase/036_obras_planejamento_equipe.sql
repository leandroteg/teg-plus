-- Migration 036: Planejamento de Equipe (Obras) integrado com EGP
-- Tabela para planejamento de alocação de equipes em obras,
-- vinculada ao cronograma (pmo_tarefas) e histograma (pmo_histograma) do EGP

CREATE TABLE IF NOT EXISTS obr_planejamento_equipe (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id       UUID NOT NULL REFERENCES sys_obras(id),
  portfolio_id  UUID REFERENCES pmo_portfolio(id),
  
  -- Profissional
  nome          TEXT NOT NULL,
  funcao        TEXT NOT NULL,            -- ex: Eletricista, Encarregado, Engenheiro
  categoria     TEXT NOT NULL DEFAULT 'mod'
    CHECK (categoria IN ('mod', 'moi', 'maquinario', 'terceirizado')),
  
  -- Período de alocação
  data_inicio   DATE NOT NULL,
  data_fim      DATE,
  
  -- Vinculação ao cronograma EGP
  tarefa_id     UUID REFERENCES pmo_tarefas(id),
  
  -- Turno e carga
  turno         TEXT DEFAULT 'diurno'
    CHECK (turno IN ('diurno', 'noturno', 'revezamento')),
  horas_dia     NUMERIC(4,1) DEFAULT 8.0,
  
  -- Status
  status        TEXT DEFAULT 'planejado'
    CHECK (status IN ('planejado', 'mobilizado', 'ativo', 'desmobilizado', 'cancelado')),
  
  -- Custo
  custo_hora    NUMERIC(10,2) DEFAULT 0,
  custo_diaria  NUMERIC(10,2) DEFAULT 0,
  
  -- Observações
  observacoes   TEXT,
  
  -- Audit
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_obr_plan_equipe_obra ON obr_planejamento_equipe(obra_id);
CREATE INDEX IF NOT EXISTS idx_obr_plan_equipe_portfolio ON obr_planejamento_equipe(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_obr_plan_equipe_tarefa ON obr_planejamento_equipe(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_obr_plan_equipe_status ON obr_planejamento_equipe(status);
CREATE INDEX IF NOT EXISTS idx_obr_plan_equipe_periodo ON obr_planejamento_equipe(data_inicio, data_fim);

-- RLS
ALTER TABLE obr_planejamento_equipe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obr_plan_equipe_select"
  ON obr_planejamento_equipe FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "obr_plan_equipe_insert"
  ON obr_planejamento_equipe FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "obr_plan_equipe_update"
  ON obr_planejamento_equipe FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "obr_plan_equipe_delete"
  ON obr_planejamento_equipe FOR DELETE
  TO authenticated
  USING (true);

-- View: resumo de equipe por obra com totais
CREATE OR REPLACE VIEW vw_obr_equipe_resumo AS
SELECT
  pe.obra_id,
  o.nome AS obra_nome,
  pe.portfolio_id,
  pe.categoria,
  pe.status,
  COUNT(*)::int AS total_profissionais,
  SUM(pe.horas_dia)::numeric(8,1) AS total_horas_dia,
  SUM(pe.custo_diaria)::numeric(12,2) AS custo_diario_total,
  MIN(pe.data_inicio) AS primeira_mobilizacao,
  MAX(pe.data_fim) AS ultima_desmobilizacao
FROM obr_planejamento_equipe pe
JOIN sys_obras o ON o.id = pe.obra_id
GROUP BY pe.obra_id, o.nome, pe.portfolio_id, pe.categoria, pe.status;
