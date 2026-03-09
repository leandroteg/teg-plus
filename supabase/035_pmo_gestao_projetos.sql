-- ============================================================================
-- 035_pmo_gestao_projetos.sql
-- Módulo PMO: portfolio, TAP, EAP, Gantt, medições, histograma, fluxo OS,
-- status report, multas, reuniões, mudanças, indicadores
-- ============================================================================

-- ── 1. pmo_portfolio — Portfólio de OSCs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES con_contratos(id),
  numero_osc TEXT NOT NULL,
  nome_obra TEXT NOT NULL,
  tipo_osc TEXT NOT NULL DEFAULT 'obra' CHECK (tipo_osc IN ('obra','manutencao')),
  resumo_osc TEXT,
  cluster TEXT,
  cidade_estado TEXT,
  status TEXT NOT NULL DEFAULT 'em_analise_ate'
    CHECK (status IN ('em_analise_ate','revisao_cliente','liberado_iniciar',
      'obra_andamento','obra_paralisada','obra_concluida','cancelada')),
  -- Gestão de Prazos
  data_inicio_contratual DATE,
  data_termino_contratual DATE,
  data_inicio_real DATE,
  data_termino_real DATE,
  -- Gestão de Faturamento
  valor_total_osc NUMERIC(15,2) DEFAULT 0,
  valor_faturado NUMERIC(15,2) DEFAULT 0,
  -- Gestão de Custos
  custo_orcado NUMERIC(15,2) DEFAULT 0,
  custo_planejado NUMERIC(15,2) DEFAULT 0,
  custo_real NUMERIC(15,2) DEFAULT 0,
  -- Risco de Multa
  multa_previsao TEXT CHECK (multa_previsao IS NULL OR multa_previsao IN ('baixo','medio','alto','critico')),
  multa_motivo TEXT,
  multa_valor_estimado NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. pmo_tap — Termo de Abertura do Projeto ──────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_tap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  -- Seção 1: Identificação
  nome_projeto TEXT NOT NULL,
  numero_projeto TEXT,
  cliente TEXT,
  data_abertura DATE DEFAULT CURRENT_DATE,
  patrocinador_cliente TEXT,
  gerente_projeto TEXT,
  -- Classificação
  classificacao_urgencia TEXT DEFAULT 'media' CHECK (classificacao_urgencia IN ('baixa','media','alta')),
  classificacao_complexidade TEXT DEFAULT 'media' CHECK (classificacao_complexidade IN ('baixa','media','alta')),
  classificacao_faturamento TEXT DEFAULT 'medio' CHECK (classificacao_faturamento IN ('baixo','medio','alto')),
  classificacao_duracao TEXT DEFAULT 'media' CHECK (classificacao_duracao IN ('baixa','media','alta')),
  tipo_projeto TEXT,
  -- Seção 2: Objetivo
  objetivo TEXT,
  -- Seção 3: Escopo
  escopo_inclui TEXT[],
  escopo_nao_inclui TEXT[],
  -- Seção 4: Premissas e Restrições
  premissas TEXT[],
  restricoes TEXT[],
  -- Seção 5: Riscos
  riscos_principais JSONB DEFAULT '[]'::jsonb,
  -- Seção 6: Stakeholders
  stakeholder_patrocinador TEXT,
  stakeholder_cliente_chave TEXT,
  stakeholders_outros TEXT[],
  -- Seção 7: Cronograma Macro
  marcos_cronograma JSONB DEFAULT '[]'::jsonb,
  -- Seção 8: Orçamento
  orcamento_total NUMERIC(15,2) DEFAULT 0,
  orcamento_referencia TEXT,
  orcamento_grupos JSONB DEFAULT '[]'::jsonb,
  -- Seção 9: Marcos de Pagamento
  marcos_pagamento JSONB DEFAULT '[]'::jsonb,
  -- Seção 10: Critérios de Sucesso
  criterios_sucesso TEXT[],
  -- Seção 11: Equipe
  equipe JSONB DEFAULT '[]'::jsonb,
  -- Seção 12: Aprovação
  aprovado_por TEXT,
  aprovado_cargo TEXT,
  aprovado_data DATE,
  aprovado_assinatura_url TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_aprovacao','aprovado','rejeitado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. pmo_eap — Estrutura Analítica (WBS) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_eap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES pmo_eap(id),
  codigo TEXT,
  titulo TEXT NOT NULL,
  fase TEXT CHECK (fase IS NULL OR fase IN ('iniciacao','planejamento','execucao','monitoramento','encerramento')),
  tipo_servico TEXT[],
  ordem INTEGER DEFAULT 0,
  descricao TEXT,
  responsavel TEXT,
  entregaveis TEXT[],
  criterio_conclusao TEXT,
  peso_percentual NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. pmo_tarefas — Cronograma Gantt ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  eap_id UUID REFERENCES pmo_eap(id),
  parent_id UUID REFERENCES pmo_tarefas(id),
  codigo TEXT,
  tarefa TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta','media','baixa')),
  status TEXT NOT NULL DEFAULT 'nao_iniciado'
    CHECK (status IN ('a_fazer','em_andamento','concluido','nao_iniciado','cancelado')),
  responsavel TEXT,
  responsavel_id UUID REFERENCES sys_perfis(id),
  data_inicio_planejado DATE,
  data_termino_planejado DATE,
  duracao_dias INTEGER,
  data_inicio_real DATE,
  data_termino_real DATE,
  percentual_concluido NUMERIC(5,2) DEFAULT 0,
  dependencias UUID[],
  tipo_dependencia TEXT DEFAULT 'fim_inicio' CHECK (tipo_dependencia IN ('fim_inicio','inicio_inicio','fim_fim')),
  notas TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. pmo_medicao_resumo — Visão Gerente ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_medicao_resumo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  cliente TEXT,
  numero_osc TEXT,
  nome_obra TEXT,
  valor_contrato NUMERIC(15,2) DEFAULT 0,
  prazo TEXT,
  total_medido_valor NUMERIC(15,2) DEFAULT 0,
  total_medido_pct NUMERIC(5,2) DEFAULT 0,
  total_a_medir_valor NUMERIC(15,2) DEFAULT 0,
  total_a_medir_pct NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. pmo_medicao_periodo — Desempenho mensal (previsto/real/delta) ────────
CREATE TABLE IF NOT EXISTS pmo_medicao_periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_resumo_id UUID NOT NULL REFERENCES pmo_medicao_resumo(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  valor_previsto NUMERIC(15,2) DEFAULT 0,
  valor_realizado NUMERIC(15,2) DEFAULT 0,
  delta NUMERIC(15,2) GENERATED ALWAYS AS (COALESCE(valor_realizado,0) - COALESCE(valor_previsto,0)) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 7. pmo_medicao_itens — Visão Engenheiro ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_medicao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  contrato_item_id UUID REFERENCES con_contrato_itens(id),
  numero_medicao INTEGER DEFAULT 1,
  item_descricao TEXT NOT NULL,
  unidade TEXT,
  quantidade_prevista NUMERIC DEFAULT 0,
  preco_unitario NUMERIC(15,2) DEFAULT 0,
  valor_total NUMERIC(15,2) GENERATED ALWAYS AS (COALESCE(quantidade_prevista,0) * COALESCE(preco_unitario,0)) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 8. pmo_medicao_item_periodo — Detalhe por item por período ──────────────
CREATE TABLE IF NOT EXISTS pmo_medicao_item_periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_item_id UUID NOT NULL REFERENCES pmo_medicao_itens(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  status_periodo TEXT DEFAULT 'teg_a_fazer'
    CHECK (status_periodo IN ('teg_a_fazer','teg_em_andamento','teg_revisao_final',
      'cemig_recebida','cemig_em_analise','cemig_comentarios','cemig_aprovada')),
  qtd_executada_acum NUMERIC DEFAULT 0,
  valor_medir NUMERIC(15,2) DEFAULT 0,
  valor_medir_pct NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 9. pmo_histograma — Alocação de recursos por semana ─────────────────────
CREATE TABLE IF NOT EXISTS pmo_histograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('mod','moi','maquinario')),
  funcao TEXT NOT NULL,
  semana TEXT,
  mes TEXT,
  data_inicio_semana DATE,
  quantidade_planejada INTEGER DEFAULT 0,
  quantidade_real INTEGER DEFAULT 0,
  custo_unitario_hora NUMERIC(10,2) DEFAULT 0,
  horas_semana NUMERIC(5,2) DEFAULT 44,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 10. pmo_fluxo_os — Tracking do fluxo de OS ─────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_fluxo_os (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  numero_os TEXT NOT NULL,
  etapa_atual TEXT NOT NULL DEFAULT 'recebida'
    CHECK (etapa_atual IN ('recebida','classificada','em_analise','devolvida_comentarios',
      'retornada_cliente','cancelada','planejamento_logistica','planejamento_materiais',
      'checagem_materiais','aguardando_suprimentos','aguardando_material_cemig',
      'pronta_iniciar','em_execucao')),
  tipo_servico TEXT,
  tipo_obra TEXT CHECK (tipo_obra IS NULL OR tipo_obra IN ('nova','em_andamento')),
  analise_coordenador JSONB DEFAULT '{}'::jsonb,
  informacoes_completas BOOLEAN DEFAULT false,
  materiais_cliente_disponiveis BOOLEAN,
  materiais_cemig_campo BOOLEAN,
  requisicao_suprimentos_id UUID,
  data_recebimento TIMESTAMPTZ,
  data_inicio_atividades TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 11. pmo_status_report — Reports periódicos ─────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_status_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  data_report DATE NOT NULL DEFAULT CURRENT_DATE,
  os_total INTEGER DEFAULT 0,
  os_a_iniciar INTEGER DEFAULT 0,
  os_em_andamento INTEGER DEFAULT 0,
  os_concluidas INTEGER DEFAULT 0,
  os_paralisadas INTEGER DEFAULT 0,
  meta_faturamento NUMERIC(15,2) DEFAULT 0,
  faturamento_atual NUMERIC(15,2) DEFAULT 0,
  delta_faturamento NUMERIC(15,2) GENERATED ALWAYS AS (COALESCE(faturamento_atual,0) - COALESCE(meta_faturamento,0)) STORED,
  detalhamento_os JSONB DEFAULT '[]'::jsonb,
  atividades JSONB DEFAULT '[]'::jsonb,
  riscos JSONB DEFAULT '[]'::jsonb,
  multas JSONB DEFAULT '[]'::jsonb,
  gerado_por UUID REFERENCES sys_perfis(id),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 12. pmo_multas — Controle de multas ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_multas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  tipo_multa TEXT NOT NULL CHECK (tipo_multa IN (
    'atraso_prazo','qualidade','ssma','documental','subcontratacao','outra'
  )),
  descricao TEXT NOT NULL,
  base_contratual TEXT,
  valor_estimado NUMERIC(15,2) DEFAULT 0,
  valor_confirmado NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'risco'
    CHECK (status IN ('risco','notificada','contestada','confirmada','paga','cancelada')),
  data_notificacao DATE,
  data_vencimento DATE,
  acao_mitigacao TEXT,
  responsavel TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 13. pmo_reunioes — Reuniões e atas ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES pmo_portfolio(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('dds','alinhamento_semanal','gestao_mensal','cliente_mensal','analise_trimestral')),
  data TIMESTAMPTZ NOT NULL,
  participantes TEXT[],
  pauta TEXT,
  ata TEXT,
  ata_url TEXT,
  decisoes JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada')),
  duracao_minutos INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 14. pmo_mudancas — Solicitações de mudança ──────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_mudancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('mudanca_escopo','mudanca_lider','mudanca_orcamento','mudanca_prazo')),
  descricao TEXT NOT NULL,
  justificativa TEXT,
  esforco_estimado TEXT DEFAULT 'baixo' CHECK (esforco_estimado IN ('baixo','medio','alto')),
  custo_estimado TEXT DEFAULT 'baixo' CHECK (custo_estimado IN ('baixo','medio','alto')),
  impacto_prazo TEXT DEFAULT 'baixo' CHECK (impacto_prazo IN ('baixo','medio','alto')),
  parecer TEXT NOT NULL DEFAULT 'pendente' CHECK (parecer IN ('pendente','aprovado','reprovado')),
  aprovado_por TEXT,
  data_solicitacao DATE DEFAULT CURRENT_DATE,
  data_parecer DATE,
  solicitado_por UUID REFERENCES sys_perfis(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 15. pmo_indicadores_snapshot — Snapshots de KPIs ────────────────────────
CREATE TABLE IF NOT EXISTS pmo_indicadores_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES pmo_portfolio(id),
  data_snapshot DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Financeiros
  pct_valor_executado NUMERIC(5,2),
  valor_medido_mes NUMERIC(15,2),
  meta_mensal NUMERIC(15,2),
  multas_acumuladas NUMERIC(15,2),
  idc NUMERIC(5,3),
  idp NUMERIC(5,3),
  -- Operacionais
  us_executadas NUMERIC(15,2),
  us_planejadas NUMERIC(15,2),
  os_abertas INTEGER,
  os_concluidas INTEGER,
  os_atrasadas INTEGER,
  pct_subcontratacao NUMERIC(5,2),
  prazo_medio_inicio_apos_ate NUMERIC(5,1),
  producao_mensal NUMERIC(15,2),
  -- Documental
  pct_docs_no_prazo NUMERIC(5,2),
  notificacoes_mes INTEGER,
  -- SSMA
  taxa_frequencia NUMERIC(8,2),
  taxa_gravidade NUMERIC(8,2),
  horas_trabalhadas NUMERIC(10,1),
  acidentes_graves INTEGER DEFAULT 0,
  dados_extras JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 16. Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pmo_portfolio_obra ON pmo_portfolio(obra_id);
CREATE INDEX IF NOT EXISTS idx_pmo_portfolio_status ON pmo_portfolio(status);
CREATE INDEX IF NOT EXISTS idx_pmo_tap_portfolio ON pmo_tap(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_eap_portfolio ON pmo_eap(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_eap_parent ON pmo_eap(parent_id);
CREATE INDEX IF NOT EXISTS idx_pmo_tarefas_portfolio ON pmo_tarefas(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_tarefas_status ON pmo_tarefas(status);
CREATE INDEX IF NOT EXISTS idx_pmo_tarefas_parent ON pmo_tarefas(parent_id);
CREATE INDEX IF NOT EXISTS idx_pmo_med_resumo_portfolio ON pmo_medicao_resumo(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_med_periodo_resumo ON pmo_medicao_periodo(medicao_resumo_id);
CREATE INDEX IF NOT EXISTS idx_pmo_med_itens_portfolio ON pmo_medicao_itens(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_med_item_periodo ON pmo_medicao_item_periodo(medicao_item_id);
CREATE INDEX IF NOT EXISTS idx_pmo_histograma_portfolio ON pmo_histograma(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_fluxo_portfolio ON pmo_fluxo_os(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_fluxo_etapa ON pmo_fluxo_os(etapa_atual);
CREATE INDEX IF NOT EXISTS idx_pmo_report_portfolio ON pmo_status_report(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_multas_portfolio ON pmo_multas(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_multas_status ON pmo_multas(status);
CREATE INDEX IF NOT EXISTS idx_pmo_reunioes_data ON pmo_reunioes(data);
CREATE INDEX IF NOT EXISTS idx_pmo_mudancas_portfolio ON pmo_mudancas(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pmo_indicadores_portfolio ON pmo_indicadores_snapshot(portfolio_id);

-- ── 17. RLS ─────────────────────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'pmo_portfolio','pmo_tap','pmo_eap','pmo_tarefas',
    'pmo_medicao_resumo','pmo_medicao_periodo','pmo_medicao_itens','pmo_medicao_item_periodo',
    'pmo_histograma','pmo_fluxo_os','pmo_status_report','pmo_multas',
    'pmo_reunioes','pmo_mudancas','pmo_indicadores_snapshot'
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

-- ── 18. Views ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_pmo_portfolio_resumo AS
SELECT
  p.id, p.numero_osc, p.nome_obra, p.tipo_osc, p.status,
  p.cluster, p.cidade_estado,
  p.data_inicio_contratual, p.data_termino_contratual,
  p.data_inicio_real, p.data_termino_real,
  p.valor_total_osc,
  COALESCE(p.valor_faturado, 0) AS valor_faturado,
  p.valor_total_osc - COALESCE(p.valor_faturado, 0) AS saldo_faturar,
  CASE WHEN p.valor_total_osc > 0
    THEN ROUND(COALESCE(p.valor_faturado,0) * 100.0 / p.valor_total_osc, 2)
    ELSE 0 END AS pct_faturado,
  p.custo_orcado, p.custo_planejado, p.custo_real,
  CASE WHEN p.valor_total_osc > 0 AND p.custo_orcado > 0
    THEN ROUND((p.valor_total_osc - p.custo_orcado) * 100.0 / p.valor_total_osc, 2)
    ELSE 0 END AS margem_orcada,
  p.multa_previsao, p.multa_valor_estimado,
  o.nome AS sys_obra_nome
FROM pmo_portfolio p
JOIN sys_obras o ON o.id = p.obra_id;

CREATE OR REPLACE VIEW vw_pmo_histograma_totais AS
SELECT
  h.portfolio_id, h.semana, h.mes, h.data_inicio_semana, h.categoria,
  SUM(h.quantidade_planejada) AS total_planejado,
  SUM(h.quantidade_real) AS total_real
FROM pmo_histograma h
GROUP BY h.portfolio_id, h.semana, h.mes, h.data_inicio_semana, h.categoria;

-- ── 19. Updated at triggers ─────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'pmo_portfolio','pmo_tap','pmo_tarefas','pmo_medicao_resumo','pmo_medicao_itens',
    'pmo_fluxo_os','pmo_status_report','pmo_multas','pmo_reunioes','pmo_mudancas'
  ]) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
    ', tbl, tbl);
  END LOOP;
END $$;
