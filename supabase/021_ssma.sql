-- ══════════════════════════════════════════════════════════════════════════════
-- 021_ssma.sql — Módulo SSMA (Segurança, Saúde e Meio Ambiente) — TEG+ ERP
-- ══════════════════════════════════════════════════════════════════════════════
-- OBRIGAÇÃO LEGAL + requisito CEMIG (cliente principal)
-- Tabelas: ssm_epis, ssm_epi_colaborador, ssm_treinamentos, ssm_col_treinamento,
--          ssm_aso, ssm_permissoes_trabalho, ssm_inspecoes, ssm_ocorrencias, ssm_alertas
-- Depende de: sys_obras (001), rh_colaboradores (019)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Catálogo de EPIs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssm_epis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          VARCHAR(20) UNIQUE NOT NULL,
  descricao       VARCHAR(200) NOT NULL,
  ca              VARCHAR(20),          -- Certificado de Aprovação MTE
  categoria       VARCHAR(50)
                  CHECK (categoria IN (
                    'cabeca','olhos_face','audicao','respiratorio',
                    'maos','pes','corpo','queda','outro'
                  )),
  vida_util_dias  INTEGER,              -- validade em dias
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO ssm_epis (codigo, descricao, categoria, vida_util_dias) VALUES
  ('CAP-SEG',  'Capacete de Segurança',              'cabeca',      365),
  ('ONI-SEG',  'Óculos de Proteção',                 'olhos_face',  365),
  ('PRO-AUD',  'Protetor Auricular',                 'audicao',     180),
  ('LUV-NIT',  'Luvas de Nitrílica',                 'maos',         30),
  ('LUV-BOR',  'Luvas de Borracha Isolante',         'maos',        180),
  ('BOT-SEG',  'Botina de Segurança',                'pes',         365),
  ('CIN-SEG',  'Cinto de Segurança Tipo Paraquedista','queda',      365),
  ('COL-ANT',  'Cordão Antichoque',                  'queda',       365),
  ('VES-REF',  'Colete Refletivo',                   'corpo',       365),
  ('MAC-SEG',  'Macacão de Proteção',                'corpo',       180),
  ('MAS-FFP2', 'Máscara PFF2',                       'respiratorio', 30),
  ('FAC-SHI',  'Protetor Facial',                    'olhos_face',  365)
ON CONFLICT (codigo) DO NOTHING;

-- ── 2. EPIs por Colaborador (controle de entrega / vencimento) ────────────────
CREATE TABLE IF NOT EXISTS ssm_epi_colaborador (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      UUID REFERENCES rh_colaboradores(id) NOT NULL,
  epi_id              UUID REFERENCES ssm_epis(id) NOT NULL,
  obra_id             UUID REFERENCES sys_obras(id),
  -- Entrega
  data_entrega        DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento     DATE,             -- calculado: entrega + vida_util_dias
  quantidade          INTEGER DEFAULT 1,
  -- Estado
  estado              VARCHAR(20) DEFAULT 'ativo'
                      CHECK (estado IN ('ativo','devolvido','extraviado','danificado','vencido')),
  -- Devolução
  data_devolucao      DATE,
  motivo_devolucao    TEXT,
  -- Responsável pela entrega
  entregue_por        TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssm_epi_col_colab  ON ssm_epi_colaborador(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ssm_epi_col_venc   ON ssm_epi_colaborador(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_ssm_epi_col_estado ON ssm_epi_colaborador(estado);

-- Trigger: calcula data_vencimento automaticamente
CREATE OR REPLACE FUNCTION ssm_calcular_vencimento_epi()
RETURNS TRIGGER AS $$
DECLARE
  v_vida_util INTEGER;
BEGIN
  SELECT vida_util_dias INTO v_vida_util FROM ssm_epis WHERE id = NEW.epi_id;
  IF v_vida_util IS NOT NULL AND NEW.data_vencimento IS NULL THEN
    NEW.data_vencimento = NEW.data_entrega + v_vida_util;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ssm_venc_epi
  BEFORE INSERT OR UPDATE ON ssm_epi_colaborador
  FOR EACH ROW EXECUTE FUNCTION ssm_calcular_vencimento_epi();

-- ── 3. Treinamentos / NRs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssm_treinamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          VARCHAR(20) UNIQUE NOT NULL,   -- NR-10, NR-35, etc.
  descricao       VARCHAR(200) NOT NULL,
  tipo            VARCHAR(20) DEFAULT 'nr'
                  CHECK (tipo IN ('nr','integração','reciclagem','especifico','outro')),
  validade_anos   INTEGER,                        -- quantos anos vale
  carga_horaria   INTEGER,                        -- em horas
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO ssm_treinamentos (codigo, descricao, tipo, validade_anos, carga_horaria) VALUES
  ('NR-10',    'Segurança em Instalações Elétricas',       'nr', 2,  40),
  ('NR-33',    'Espaços Confinados',                       'nr', 1,  16),
  ('NR-35',    'Trabalho em Altura',                       'nr', 2,  8),
  ('NR-12',    'Segurança em Máquinas e Equipamentos',     'nr', 2,  8),
  ('NR-06',    'EPIs — Uso e Conservação',                 'nr', 1,  4),
  ('NR-18',    'Obras de Engenharia',                      'nr', 1,  6),
  ('INTEG',    'Integração de Segurança',                  'integração', 1, 4),
  ('PRIM-SOC', 'Primeiros Socorros',                       'especifico', 2, 8),
  ('BRIG',     'Brigada de Emergência',                    'especifico', 1, 16),
  ('DIR-DEF',  'Direção Defensiva',                        'especifico', 3, 8)
ON CONFLICT (codigo) DO NOTHING;

-- ── 4. Treinamentos por Colaborador ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssm_col_treinamento (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      UUID REFERENCES rh_colaboradores(id) NOT NULL,
  treinamento_id      UUID REFERENCES ssm_treinamentos(id) NOT NULL,
  -- Realização
  data_realizacao     DATE NOT NULL,
  data_vencimento     DATE,             -- calculado ou manual
  instituicao         VARCHAR(200),     -- quem ministrou
  certificado_url     TEXT,
  -- Status
  status              VARCHAR(20) DEFAULT 'valido'
                      CHECK (status IN ('valido','vencido','cancelado')),
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(colaborador_id, treinamento_id, data_realizacao)
);

CREATE INDEX IF NOT EXISTS idx_ssm_col_trei_colab ON ssm_col_treinamento(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ssm_col_trei_venc  ON ssm_col_treinamento(data_vencimento);

-- Trigger: calcula vencimento do treinamento
CREATE OR REPLACE FUNCTION ssm_calcular_vencimento_treinamento()
RETURNS TRIGGER AS $$
DECLARE
  v_validade INTEGER;
BEGIN
  SELECT validade_anos INTO v_validade FROM ssm_treinamentos WHERE id = NEW.treinamento_id;
  IF v_validade IS NOT NULL AND NEW.data_vencimento IS NULL THEN
    NEW.data_vencimento = NEW.data_realizacao + (v_validade || ' years')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ssm_venc_treinamento
  BEFORE INSERT ON ssm_col_treinamento
  FOR EACH ROW EXECUTE FUNCTION ssm_calcular_vencimento_treinamento();

-- ── 5. ASO — Atestado de Saúde Ocupacional ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssm_aso (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      UUID REFERENCES rh_colaboradores(id) NOT NULL,
  tipo                VARCHAR(20) NOT NULL
                      CHECK (tipo IN ('admissional','periodico','demissional',
                                      'retorno','mudanca_funcao')),
  data_realizacao     DATE NOT NULL,
  data_vencimento     DATE,
  resultado           VARCHAR(20) DEFAULT 'apto'
                      CHECK (resultado IN ('apto','apto_restricoes','inapto')),
  restricoes          TEXT,
  medico              TEXT,
  crm                 VARCHAR(20),
  clinica             TEXT,
  arquivo_url         TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssm_aso_colaborador ON ssm_aso(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ssm_aso_vencimento  ON ssm_aso(data_vencimento);

-- ── 6. Permissão de Trabalho (PT Digital) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssm_permissoes_trabalho (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pt           VARCHAR(30) UNIQUE,       -- gerado automaticamente
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL,
  -- Atividade
  tipo_atividade      VARCHAR(50)
                      CHECK (tipo_atividade IN (
                        'trabalho_altura','espaco_confinado','eletrica',
                        'escavacao','solda','uso_produto_quimico','outro'
                      )),
  descricao_servico   TEXT NOT NULL,
  local               TEXT,
  -- Validade
  data_inicio         TIMESTAMPTZ NOT NULL,
  data_fim            TIMESTAMPTZ NOT NULL,
  -- Riscos identificados
  riscos              TEXT[],
  medidas_controle    TEXT,
  epis_necessarios    TEXT[],
  -- Equipe
  responsavel_nome    TEXT NOT NULL,
  equipe              TEXT[],                   -- nomes dos trabalhadores
  -- Aprovação
  status              VARCHAR(20) DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho','pendente','aprovada','recusada','encerrada','vencida')),
  aprovador_nome      TEXT,
  aprovado_em         TIMESTAMPTZ,
  motivo_recusa       TEXT,
  -- Encerramento
  encerrado_por       TEXT,
  encerrado_em        TIMESTAMPTZ,
  pendencias          TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssm_pt_obra   ON ssm_permissoes_trabalho(obra_id);
CREATE INDEX IF NOT EXISTS idx_ssm_pt_status ON ssm_permissoes_trabalho(status);
CREATE INDEX IF NOT EXISTS idx_ssm_pt_data   ON ssm_permissoes_trabalho(data_inicio);

-- Gera número da PT automaticamente
CREATE OR REPLACE FUNCTION ssm_gerar_numero_pt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_pt IS NULL THEN
    NEW.numero_pt = 'PT-' || TO_CHAR(now(), 'YYYY') || '-' ||
                    LPAD(nextval('ssm_pt_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS ssm_pt_seq START 1;

CREATE OR REPLACE TRIGGER trg_ssm_pt_numero
  BEFORE INSERT ON ssm_permissoes_trabalho
  FOR EACH ROW EXECUTE FUNCTION ssm_gerar_numero_pt();

-- ── 7. Inspeções de Segurança ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssm_inspecoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL,
  -- Tipo e local
  tipo                VARCHAR(30) DEFAULT 'rotina'
                      CHECK (tipo IN ('rotina','especifica','cemig','auditoria','outro')),
  area_inspecionada   TEXT,
  -- Inspetor
  inspetor_nome       TEXT NOT NULL,
  data_inspecao       DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Resultado
  itens_verificados   INTEGER DEFAULT 0,
  conformes           INTEGER DEFAULT 0,
  nao_conformes       INTEGER DEFAULT 0,
  resultado_geral     VARCHAR(20) DEFAULT 'aprovado'
                      CHECK (resultado_geral IN ('aprovado','reprovado','parcial')),
  -- Detalhes (checklist em JSON)
  checklist           JSONB DEFAULT '[]',
  -- Achados e ações
  observacoes         TEXT,
  acoes_corretivas    TEXT,
  prazo_correcao      DATE,
  -- Fotos (URLs Supabase Storage)
  fotos               TEXT[] DEFAULT '{}',
  -- Geolocalização
  lat                 NUMERIC(10,7),
  lng                 NUMERIC(10,7),
  -- Status
  status              VARCHAR(20) DEFAULT 'aberta'
                      CHECK (status IN ('aberta','em_correcao','encerrada')),
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssm_insp_obra   ON ssm_inspecoes(obra_id);
CREATE INDEX IF NOT EXISTS idx_ssm_insp_data   ON ssm_inspecoes(data_inspecao);
CREATE INDEX IF NOT EXISTS idx_ssm_insp_status ON ssm_inspecoes(status);

-- ── 8. Ocorrências (quase-acidente, acidente, observação) ────────────────────
CREATE TABLE IF NOT EXISTS ssm_ocorrencias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              VARCHAR(30) UNIQUE,       -- gerado automaticamente
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL,
  -- Classificação
  tipo                VARCHAR(30) NOT NULL
                      CHECK (tipo IN (
                        'quase_acidente','acidente_sem_afastamento',
                        'acidente_com_afastamento','acidente_fatal',
                        'incidente_ambiental','observacao_segura','outros'
                      )),
  gravidade           VARCHAR(20) DEFAULT 'baixa'
                      CHECK (gravidade IN ('baixa','media','alta','critica')),
  -- Data/Hora e Local
  data_ocorrencia     TIMESTAMPTZ NOT NULL DEFAULT now(),
  local_ocorrencia    TEXT,
  lat                 NUMERIC(10,7),
  lng                 NUMERIC(10,7),
  -- Envolvidos
  colaborador_id      UUID REFERENCES rh_colaboradores(id),
  colaborador_nome    TEXT,
  testemunhas         TEXT[],
  -- Descrição
  descricao           TEXT NOT NULL,
  causa_imediata      TEXT,
  causa_raiz          TEXT,
  -- Consequências
  lesao_tipo          VARCHAR(50),
  parte_corpo         VARCHAR(50),
  dias_afastamento    INTEGER DEFAULT 0,
  danos_materiais     TEXT,
  -- Ações
  acoes_imediatas     TEXT,
  plano_acao          TEXT,
  prazo_acao          DATE,
  responsavel_acao    TEXT,
  -- Notificações
  notificado_diretoria BOOLEAN DEFAULT false,
  notificado_cemig     BOOLEAN DEFAULT false,
  cat_emitida          BOOLEAN DEFAULT false,   -- Comunicação de Acidente de Trabalho
  -- Fotos
  fotos               TEXT[] DEFAULT '{}',
  -- Status
  status              VARCHAR(20) DEFAULT 'aberta'
                      CHECK (status IN ('aberta','investigando','plano_acao','encerrada')),
  encerrado_por       TEXT,
  encerrado_em        TIMESTAMPTZ,
  -- Registrado por
  registrado_por      TEXT NOT NULL,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssm_ocor_obra      ON ssm_ocorrencias(obra_id);
CREATE INDEX IF NOT EXISTS idx_ssm_ocor_tipo      ON ssm_ocorrencias(tipo);
CREATE INDEX IF NOT EXISTS idx_ssm_ocor_data      ON ssm_ocorrencias(data_ocorrencia);
CREATE INDEX IF NOT EXISTS idx_ssm_ocor_gravidade ON ssm_ocorrencias(gravidade);
CREATE INDEX IF NOT EXISTS idx_ssm_ocor_status    ON ssm_ocorrencias(status);

-- Gera número da ocorrência
CREATE OR REPLACE FUNCTION ssm_gerar_numero_ocorrencia()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero = 'OC-' || TO_CHAR(now(), 'YYYY') || '-' ||
                 LPAD(nextval('ssm_ocor_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS ssm_ocor_seq START 1;

CREATE OR REPLACE TRIGGER trg_ssm_ocor_numero
  BEFORE INSERT ON ssm_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION ssm_gerar_numero_ocorrencia();

-- ── 9. Alertas automáticos SSMA ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssm_alertas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            VARCHAR(30) NOT NULL
                  CHECK (tipo IN (
                    'epi_vencimento','treinamento_vencimento','aso_vencimento',
                    'pt_expirando','ocorrencia_critica','inspecao_pendente'
                  )),
  -- Referência
  entity_type     VARCHAR(30),     -- 'epi','treinamento','aso','pt','ocorrencia'
  entity_id       UUID,
  -- Destinatário
  colaborador_id  UUID REFERENCES rh_colaboradores(id),
  obra_id         UUID REFERENCES sys_obras(id),
  -- Mensagem
  titulo          TEXT NOT NULL,
  mensagem        TEXT NOT NULL,
  -- Envio
  status          VARCHAR(20) DEFAULT 'pendente'
                  CHECK (status IN ('pendente','enviado','ignorado')),
  canal           VARCHAR(20) DEFAULT 'whatsapp'
                  CHECK (canal IN ('whatsapp','email','sistema')),
  enviado_em      TIMESTAMPTZ,
  -- Datas
  data_alerta     DATE NOT NULL DEFAULT CURRENT_DATE,  -- quando alertar
  data_vencimento DATE,                                -- data do item que está vencendo
  -- Audit
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssm_alert_tipo   ON ssm_alertas(tipo);
CREATE INDEX IF NOT EXISTS idx_ssm_alert_status ON ssm_alertas(status);
CREATE INDEX IF NOT EXISTS idx_ssm_alert_data   ON ssm_alertas(data_alerta);

-- ── 10. Função: gera alertas de vencimento ────────────────────────────────────
CREATE OR REPLACE FUNCTION ssm_gerar_alertas_vencimento(p_dias_antecedencia INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Alertas de EPI vencendo
  INSERT INTO ssm_alertas (tipo, entity_type, entity_id, colaborador_id, obra_id,
                            titulo, mensagem, data_alerta, data_vencimento)
  SELECT
    'epi_vencimento', 'epi', ec.id, ec.colaborador_id, ec.obra_id,
    'EPI Vencendo: ' || e.descricao,
    'Colaborador ' || c.nome || ' tem ' || e.descricao || ' vencendo em ' || ec.data_vencimento,
    CURRENT_DATE,
    ec.data_vencimento
  FROM ssm_epi_colaborador ec
  JOIN ssm_epis e ON e.id = ec.epi_id
  JOIN rh_colaboradores c ON c.id = ec.colaborador_id
  WHERE ec.estado = 'ativo'
    AND ec.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + p_dias_antecedencia
    AND NOT EXISTS (
      SELECT 1 FROM ssm_alertas a
      WHERE a.entity_id = ec.id AND a.tipo = 'epi_vencimento'
        AND a.data_alerta = CURRENT_DATE
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Alertas de Treinamento vencendo
  INSERT INTO ssm_alertas (tipo, entity_type, entity_id, colaborador_id,
                            titulo, mensagem, data_alerta, data_vencimento)
  SELECT
    'treinamento_vencimento', 'treinamento', ct.id, ct.colaborador_id,
    'Treinamento Vencendo: ' || t.codigo,
    'Colaborador ' || c.nome || ' tem ' || t.descricao || ' vencendo em ' || ct.data_vencimento,
    CURRENT_DATE,
    ct.data_vencimento
  FROM ssm_col_treinamento ct
  JOIN ssm_treinamentos t ON t.id = ct.treinamento_id
  JOIN rh_colaboradores c ON c.id = ct.colaborador_id
  WHERE ct.status = 'valido'
    AND ct.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + p_dias_antecedencia
    AND NOT EXISTS (
      SELECT 1 FROM ssm_alertas a
      WHERE a.entity_id = ct.id AND a.tipo = 'treinamento_vencimento'
        AND a.data_alerta = CURRENT_DATE
    )
  ON CONFLICT DO NOTHING;

  -- Alertas de ASO vencendo
  INSERT INTO ssm_alertas (tipo, entity_type, entity_id, colaborador_id,
                            titulo, mensagem, data_alerta, data_vencimento)
  SELECT
    'aso_vencimento', 'aso', a.id, a.colaborador_id,
    'ASO Vencendo: ' || c.nome,
    'ASO do colaborador ' || c.nome || ' vence em ' || a.data_vencimento,
    CURRENT_DATE,
    a.data_vencimento
  FROM ssm_aso a
  JOIN rh_colaboradores c ON c.id = a.colaborador_id
  WHERE a.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + p_dias_antecedencia
    AND NOT EXISTS (
      SELECT 1 FROM ssm_alertas al
      WHERE al.entity_id = a.id AND al.tipo = 'aso_vencimento'
        AND al.data_alerta = CURRENT_DATE
    )
  ON CONFLICT DO NOTHING;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 11. RPC: Dashboard SSMA ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_ssma(
  p_obra_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'ocorrencias', (
      SELECT json_build_object(
        'total_mes',         COUNT(*) FILTER (WHERE date_trunc('month', data_ocorrencia) = date_trunc('month', now())),
        'acidentes',         COUNT(*) FILTER (WHERE tipo LIKE 'acidente%'),
        'quase_acidentes',   COUNT(*) FILTER (WHERE tipo = 'quase_acidente'),
        'abertas',           COUNT(*) FILTER (WHERE status != 'encerrada'),
        'criticas',          COUNT(*) FILTER (WHERE gravidade IN ('alta','critica') AND status != 'encerrada')
      )
      FROM ssm_ocorrencias
      WHERE (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),
    'epis_vencendo', (
      SELECT COUNT(*) FROM ssm_epi_colaborador ec
      JOIN rh_colaboradores c ON c.id = ec.colaborador_id
      WHERE ec.estado = 'ativo'
        AND ec.data_vencimento <= CURRENT_DATE + 30
        AND (p_obra_id IS NULL OR c.obra_atual_id = p_obra_id)
    ),
    'treinamentos_vencendo', (
      SELECT COUNT(*) FROM ssm_col_treinamento ct
      JOIN rh_colaboradores c ON c.id = ct.colaborador_id
      WHERE ct.status = 'valido'
        AND ct.data_vencimento <= CURRENT_DATE + 30
        AND (p_obra_id IS NULL OR c.obra_atual_id = p_obra_id)
    ),
    'pts_abertas', (
      SELECT COUNT(*) FROM ssm_permissoes_trabalho
      WHERE status IN ('aprovada')
        AND data_fim >= now()
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),
    'alertas_pendentes', (
      SELECT COUNT(*) FROM ssm_alertas
      WHERE status = 'pendente'
        AND data_alerta <= CURRENT_DATE
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),
    'ocorrencias_recentes', (
      SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json)
      FROM (
        SELECT id, numero, tipo, gravidade, data_ocorrencia,
               local_ocorrencia, status, registrado_por
        FROM ssm_ocorrencias
        WHERE (p_obra_id IS NULL OR obra_id = p_obra_id)
        ORDER BY data_ocorrencia DESC
        LIMIT 10
      ) o
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 12. Triggers updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ssm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ssm_epi_updated
  BEFORE UPDATE ON ssm_epi_colaborador
  FOR EACH ROW EXECUTE FUNCTION ssm_set_updated_at();

CREATE OR REPLACE TRIGGER trg_ssm_pt_updated
  BEFORE UPDATE ON ssm_permissoes_trabalho
  FOR EACH ROW EXECUTE FUNCTION ssm_set_updated_at();

CREATE OR REPLACE TRIGGER trg_ssm_insp_updated
  BEFORE UPDATE ON ssm_inspecoes
  FOR EACH ROW EXECUTE FUNCTION ssm_set_updated_at();

CREATE OR REPLACE TRIGGER trg_ssm_ocor_updated
  BEFORE UPDATE ON ssm_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION ssm_set_updated_at();

-- ── 13. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE ssm_epis                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssm_epi_colaborador      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssm_treinamentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssm_col_treinamento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssm_aso                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssm_permissoes_trabalho  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssm_inspecoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssm_ocorrencias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssm_alertas              ENABLE ROW LEVEL SECURITY;

-- Leitura: autenticados
CREATE POLICY "ssm_epis_read"   ON ssm_epis                FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_epict_read"  ON ssm_epi_colaborador     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_trei_read"   ON ssm_treinamentos        FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_ctrei_read"  ON ssm_col_treinamento     FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_aso_read"    ON ssm_aso                 FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_pt_read"     ON ssm_permissoes_trabalho FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_insp_read"   ON ssm_inspecoes           FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_ocor_read"   ON ssm_ocorrencias         FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssm_alert_read"  ON ssm_alertas             FOR SELECT TO authenticated USING (true);

-- Escrita: autenticados + service_role
CREATE POLICY "ssm_epis_write"   ON ssm_epis                FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ssm_epict_write"  ON ssm_epi_colaborador     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ssm_ctrei_write"  ON ssm_col_treinamento     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ssm_aso_write"    ON ssm_aso                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ssm_pt_write"     ON ssm_permissoes_trabalho FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ssm_insp_write"   ON ssm_inspecoes           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ssm_ocor_write"   ON ssm_ocorrencias         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ssm_alert_write"  ON ssm_alertas             FOR ALL TO service_role   USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM 021_ssma.sql
-- ══════════════════════════════════════════════════════════════════════════════
