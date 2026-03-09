-- ============================================================
-- Migration 040: Contratos V2 — Fluxo de Assinatura (Phase 1)
-- ============================================================

-- 1. con_solicitacoes — Solicitação de Contrato (7-step flow)
CREATE TABLE IF NOT EXISTS con_solicitacoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                TEXT UNIQUE NOT NULL,
  solicitante_id        UUID REFERENCES sys_perfis(id),
  solicitante_nome      TEXT NOT NULL,
  departamento          TEXT,
  obra_id               UUID REFERENCES sys_obras(id),
  tipo_contraparte      TEXT NOT NULL CHECK (tipo_contraparte IN ('fornecedor','cliente','pj')),
  contraparte_nome      TEXT NOT NULL,
  contraparte_cnpj      TEXT,
  contraparte_id        UUID,
  tipo_contrato         TEXT NOT NULL CHECK (tipo_contrato IN ('receita','despesa','pj')),
  categoria_contrato    TEXT NOT NULL CHECK (categoria_contrato IN (
    'prestacao_servico','fornecimento','locacao','empreitada',
    'consultoria','pj_pessoa_fisica','outro'
  )),
  objeto                TEXT NOT NULL,
  descricao_escopo      TEXT,
  justificativa         TEXT,
  valor_estimado        NUMERIC(15,2),
  forma_pagamento       TEXT,
  data_inicio_prevista  DATE,
  data_fim_prevista     DATE,
  prazo_meses           INTEGER,
  centro_custo          TEXT,
  classe_financeira     TEXT,
  indice_reajuste       TEXT,
  urgencia              TEXT DEFAULT 'normal' CHECK (urgencia IN ('baixa','normal','alta','critica')),
  data_necessidade      DATE,
  documentos_ref        JSONB DEFAULT '[]',
  etapa_atual           TEXT NOT NULL DEFAULT 'solicitacao'
    CHECK (etapa_atual IN (
      'solicitacao','preparar_minuta','resumo_executivo',
      'aprovacao_diretoria','enviar_assinatura','arquivar',
      'liberar_execucao','concluido','cancelado'
    )),
  status                TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_andamento','aguardando_aprovacao','aprovado','rejeitado','cancelado','concluido')),
  observacoes           TEXT,
  motivo_cancelamento   TEXT,
  responsavel_id        UUID REFERENCES sys_perfis(id),
  responsavel_nome      TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  created_by            UUID REFERENCES sys_perfis(id)
);

-- 2. con_solicitacao_historico
CREATE TABLE IF NOT EXISTS con_solicitacao_historico (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id    UUID NOT NULL REFERENCES con_solicitacoes(id) ON DELETE CASCADE,
  etapa_de          TEXT NOT NULL,
  etapa_para        TEXT NOT NULL,
  executado_por     UUID REFERENCES sys_perfis(id),
  executado_nome    TEXT,
  observacao        TEXT,
  dados_etapa       JSONB,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 3. con_minutas
CREATE TABLE IF NOT EXISTS con_minutas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id    UUID REFERENCES con_solicitacoes(id),
  contrato_id       UUID REFERENCES con_contratos(id),
  tipo              TEXT NOT NULL CHECK (tipo IN ('modelo','rascunho','revisado','final','assinado')),
  categoria         TEXT,
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  versao            INTEGER NOT NULL DEFAULT 1,
  arquivo_url       TEXT NOT NULL,
  arquivo_nome      TEXT NOT NULL,
  mime_type         TEXT,
  tamanho_bytes     BIGINT,
  onedrive_id       TEXT,
  onedrive_url      TEXT,
  sharepoint_path   TEXT,
  ai_analise        JSONB,
  ai_analisado_em   TIMESTAMPTZ,
  status            TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_revisao','aprovado','obsoleto')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  created_by        UUID REFERENCES sys_perfis(id)
);

-- 4. con_resumos_executivos
CREATE TABLE IF NOT EXISTS con_resumos_executivos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id    UUID NOT NULL REFERENCES con_solicitacoes(id) ON DELETE CASCADE,
  titulo            TEXT NOT NULL,
  partes_envolvidas TEXT NOT NULL,
  objeto_resumo     TEXT NOT NULL,
  valor_total       NUMERIC(15,2),
  vigencia          TEXT,
  riscos            JSONB DEFAULT '[]',
  oportunidades     JSONB DEFAULT '[]',
  recomendacao      TEXT,
  aprovacao_id      UUID,
  status            TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','rejeitado')),
  arquivo_url       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  created_by        UUID REFERENCES sys_perfis(id)
);

-- 5. Alter con_contratos
ALTER TABLE con_contratos
  ADD COLUMN IF NOT EXISTS solicitacao_id        UUID REFERENCES con_solicitacoes(id),
  ADD COLUMN IF NOT EXISTS tipo_categoria        TEXT,
  ADD COLUMN IF NOT EXISTS is_pj                 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS assinatura_status     TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS documento_assinado_url TEXT,
  ADD COLUMN IF NOT EXISTS onedrive_url          TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_path       TEXT,
  ADD COLUMN IF NOT EXISTS renovacao_automatica  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_aviso_vencimento INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS politica_aplicada     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sem_contrato_emergencial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_dias_pagamento    INTEGER,
  ADD COLUMN IF NOT EXISTS penalidade_atraso_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periodicidade_reajuste TEXT;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_con_sol_etapa ON con_solicitacoes(etapa_atual);
CREATE INDEX IF NOT EXISTS idx_con_sol_status ON con_solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_con_sol_responsavel ON con_solicitacoes(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_con_sol_obra ON con_solicitacoes(obra_id);
CREATE INDEX IF NOT EXISTS idx_con_minutas_solicitacao ON con_minutas(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_con_minutas_contrato ON con_minutas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_hist_solicitacao ON con_solicitacao_historico(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_con_resumo_solicitacao ON con_resumos_executivos(solicitacao_id);

-- 7. Triggers
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_con_solicitacoes') THEN
    CREATE TRIGGER set_updated_at_con_solicitacoes BEFORE UPDATE ON con_solicitacoes
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_con_minutas') THEN
    CREATE TRIGGER set_updated_at_con_minutas BEFORE UPDATE ON con_minutas
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_con_resumos') THEN
    CREATE TRIGGER set_updated_at_con_resumos BEFORE UPDATE ON con_resumos_executivos
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- 8. RLS
ALTER TABLE con_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_solicitacao_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_minutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_resumos_executivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "con_solicitacoes_select" ON con_solicitacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_solicitacoes_insert" ON con_solicitacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "con_solicitacoes_update" ON con_solicitacoes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "con_hist_select" ON con_solicitacao_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_hist_insert" ON con_solicitacao_historico FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "con_minutas_select" ON con_minutas FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_minutas_insert" ON con_minutas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "con_minutas_update" ON con_minutas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "con_resumos_select" ON con_resumos_executivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_resumos_insert" ON con_resumos_executivos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "con_resumos_update" ON con_resumos_executivos FOR UPDATE TO authenticated USING (true);
