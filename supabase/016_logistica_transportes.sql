-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 016 — Módulo Logística e Transportes
-- ═══════════════════════════════════════════════════════════════════════════
-- Entidades: transportadoras, rotas, solicitações, NF-e, transportes,
--            ocorrências, recebimentos, checklists, avaliações
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE log_tipo_transporte AS ENUM (
    'viagem', 'mobilizacao', 'transferencia_material', 'transferencia_maquina'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE log_modal AS ENUM (
    'frota_propria', 'frota_locada', 'transportadora', 'motoboy', 'correios'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE log_status_solicitacao AS ENUM (
    'solicitado', 'validando', 'planejado', 'aguardando_aprovacao',
    'aprovado', 'nfe_emitida', 'em_transito', 'entregue',
    'confirmado', 'concluido', 'recusado', 'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE log_tipo_ocorrencia AS ENUM (
    'avaria_veiculo', 'acidente', 'atraso', 'desvio_rota',
    'parada_nao_programada', 'avaria_carga', 'roubo', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE log_status_nfe AS ENUM (
    'pendente', 'transmitida', 'autorizada', 'cancelada', 'denegada', 'rejeitada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Transportadoras ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_transportadoras (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social      TEXT    NOT NULL,
  nome_fantasia     TEXT,
  cnpj              TEXT    NOT NULL UNIQUE,
  ie                TEXT,
  email             TEXT,
  telefone          TEXT,
  endereco          JSONB,
  modalidades       TEXT[],
  ativo             BOOLEAN DEFAULT TRUE,
  avaliacao_media   NUMERIC(3,2) DEFAULT 0,
  total_avaliacoes  INT     DEFAULT 0,
  observacoes       TEXT,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Rotas padrão ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_rotas (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 TEXT    NOT NULL,
  origem               TEXT    NOT NULL,
  destino              TEXT    NOT NULL,
  distancia_km         NUMERIC(8,1),
  tempo_estimado_h     NUMERIC(5,1),
  custo_referencia     NUMERIC(10,2),
  transportadora_id    UUID    REFERENCES log_transportadoras(id),
  modal_preferencial   log_modal,
  observacoes          TEXT,
  ativo                BOOLEAN DEFAULT TRUE,
  criado_em            TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Solicitações de transporte ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_solicitacoes (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                     TEXT UNIQUE, -- LOG-YYYY-NNNN

  tipo                       log_tipo_transporte NOT NULL,
  status                     log_status_solicitacao DEFAULT 'solicitado',

  -- Solicitante
  solicitante_id             UUID REFERENCES auth.users(id),
  solicitante_nome           TEXT,
  obra_nome                  TEXT,
  centro_custo               TEXT,
  oc_numero                  TEXT,

  -- Rota
  origem                     TEXT NOT NULL,
  destino                    TEXT NOT NULL,
  rota_id                    UUID REFERENCES log_rotas(id),

  -- Descrição da carga
  descricao                  TEXT,
  peso_total_kg              NUMERIC(10,3),
  volumes_total              INT,
  carga_especial             BOOLEAN DEFAULT FALSE,
  observacoes_carga          TEXT,

  -- Prazo e urgência
  data_desejada              DATE,
  urgente                    BOOLEAN DEFAULT FALSE,
  justificativa_urgencia     TEXT,

  -- Validação (Passo 2)
  validado_por               UUID REFERENCES auth.users(id),
  validado_em                TIMESTAMPTZ,
  restricoes_seguranca       TEXT,
  motivo_recusa              TEXT,

  -- Planejamento (Passo 3)
  modal                      log_modal,
  transportadora_id          UUID REFERENCES log_transportadoras(id),
  veiculo_placa              TEXT,
  motorista_nome             TEXT,
  motorista_telefone         TEXT,
  data_prevista_saida        TIMESTAMPTZ,
  custo_estimado             NUMERIC(10,2),
  rota_planejada_id          UUID REFERENCES log_rotas(id),

  -- Aprovação de custo (Passo 4)
  aprovado_por               UUID REFERENCES auth.users(id),
  aprovado_em                TIMESTAMPTZ,
  motivo_reprovacao          TEXT,

  -- Observações gerais
  observacoes                TEXT,

  criado_em                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Itens da solicitação ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_itens_solicitacao (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  UUID    NOT NULL REFERENCES log_solicitacoes(id) ON DELETE CASCADE,
  descricao       TEXT    NOT NULL,
  quantidade      NUMERIC(10,3) DEFAULT 1,
  unidade         TEXT    DEFAULT 'UN',
  peso_kg         NUMERIC(10,3),
  volume_m3       NUMERIC(8,4),
  numero_serie    TEXT,
  lote            TEXT,
  observacao      TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Checklist de expedição ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_checklists_expedicao (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id            UUID    NOT NULL REFERENCES log_solicitacoes(id) UNIQUE,

  itens_conferidos          BOOLEAN DEFAULT FALSE,
  volumes_identificados     BOOLEAN DEFAULT FALSE,
  embalagem_verificada      BOOLEAN DEFAULT FALSE,
  documentacao_separada     BOOLEAN DEFAULT FALSE,
  motorista_habilitado      BOOLEAN DEFAULT FALSE,
  veiculo_vistoriado        BOOLEAN DEFAULT FALSE,
  contato_destinatario      BOOLEAN DEFAULT FALSE,

  conferido_por             UUID    REFERENCES auth.users(id),
  conferido_em              TIMESTAMPTZ,
  observacoes               TEXT,

  criado_em                 TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Notas Fiscais (NF-e / MDF-e) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_nfe (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id        UUID    NOT NULL REFERENCES log_solicitacoes(id),

  tipo                  TEXT    DEFAULT 'NFe', -- NFe, MDF-e
  numero                TEXT,
  serie                 TEXT    DEFAULT '1',
  chave_acesso          TEXT    UNIQUE,
  status                log_status_nfe DEFAULT 'pendente',

  -- Partes
  emitente_cnpj         TEXT,
  emitente_nome         TEXT,
  destinatario_cnpj     TEXT,
  destinatario_nome     TEXT,
  destinatario_uf       TEXT,

  -- Valores
  valor_total           NUMERIC(12,2),
  valor_frete           NUMERIC(12,2) DEFAULT 0,
  cfop                  TEXT,
  natureza_operacao     TEXT DEFAULT 'Remessa de Materiais',

  -- SEFAZ
  data_emissao          TIMESTAMPTZ,
  data_autorizacao      TIMESTAMPTZ,
  protocolo             TEXT,
  danfe_url             TEXT,
  xml_url               TEXT,

  -- Cancelamento
  cancelada_em          TIMESTAMPTZ,
  motivo_cancelamento   TEXT,

  -- MDF-e / CIOT
  ciot_numero           TEXT,
  mdf_chave             TEXT,

  emitida_por           UUID    REFERENCES auth.users(id),
  criado_em             TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. Execução do transporte ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_transportes (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id              UUID    NOT NULL REFERENCES log_solicitacoes(id) UNIQUE,

  -- Saída
  hora_saida                  TIMESTAMPTZ,
  placa                       TEXT,
  motorista_nome              TEXT,
  motorista_cpf               TEXT,
  motorista_telefone          TEXT,
  peso_total_kg               NUMERIC(10,3),
  volumes_total               INT,

  -- Rastreamento
  latitude_atual              NUMERIC(10,7),
  longitude_atual             NUMERIC(10,7),
  ultima_atualizacao_gps      TIMESTAMPTZ,
  codigo_rastreio             TEXT,

  -- ETA
  eta_original                TIMESTAMPTZ,
  eta_atual                   TIMESTAMPTZ,
  hora_chegada                TIMESTAMPTZ,

  -- Despachado por
  despachado_por              UUID    REFERENCES auth.users(id),

  criado_em                   TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. Ocorrências em rota ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_ocorrencias (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  transporte_id   UUID    NOT NULL REFERENCES log_transportes(id),
  solicitacao_id  UUID    NOT NULL REFERENCES log_solicitacoes(id),

  tipo            log_tipo_ocorrencia NOT NULL,
  descricao       TEXT    NOT NULL,
  localizacao     TEXT,
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),

  fotos           JSONB   DEFAULT '[]',

  registrado_por  UUID    REFERENCES auth.users(id),
  registrado_em   TIMESTAMPTZ DEFAULT NOW(),

  resolvido       BOOLEAN DEFAULT FALSE,
  resolucao       TEXT,
  resolvido_em    TIMESTAMPTZ
);

-- ── 10. Recebimentos ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_recebimentos (
  id                         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id             UUID    NOT NULL REFERENCES log_solicitacoes(id) UNIQUE,

  -- Entrega física
  entregue_em                TIMESTAMPTZ,

  -- Checklist
  quantidades_conferidas     BOOLEAN DEFAULT FALSE,
  estado_verificado          BOOLEAN DEFAULT FALSE,
  seriais_conferidos         BOOLEAN DEFAULT FALSE,
  temperatura_verificada     BOOLEAN DEFAULT FALSE,

  -- Resultado
  status                     TEXT    DEFAULT 'pendente', -- pendente, confirmado, parcial, recusado
  divergencias               TEXT,
  fotos                      JSONB   DEFAULT '[]',

  -- Confirmação
  confirmado_por             UUID    REFERENCES auth.users(id),
  confirmado_nome            TEXT,
  confirmado_em              TIMESTAMPTZ,
  assinatura_digital         TEXT,

  -- Avaliação da entrega
  prazo_cumprido             BOOLEAN,
  avaliacao_qualidade        INT     CHECK (avaliacao_qualidade BETWEEN 1 AND 5),
  observacoes                TEXT,

  criado_em                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. Avaliações de transportadoras ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_avaliacoes (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  transportadora_id UUID    NOT NULL REFERENCES log_transportadoras(id),
  solicitacao_id    UUID    REFERENCES log_solicitacoes(id),

  prazo             INT     CHECK (prazo BETWEEN 1 AND 5),
  qualidade         INT     CHECK (qualidade BETWEEN 1 AND 5),
  comunicacao       INT     CHECK (comunicacao BETWEEN 1 AND 5),
  media             NUMERIC(3,2),

  avaliado_por      UUID    REFERENCES auth.users(id),
  comentario        TEXT,
  criado_em         TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. Triggers ─────────────────────────────────────────────────────────────

-- Auto-número de solicitações: LOG-YYYY-NNNN
CREATE OR REPLACE FUNCTION fn_numero_log_solicitacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ano  TEXT := TO_CHAR(NOW(), 'YYYY');
  v_seq  BIGINT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, '-', 3) AS BIGINT)), 0) + 1
    INTO v_seq
    FROM log_solicitacoes
    WHERE numero LIKE 'LOG-' || v_ano || '-%';
  NEW.numero := 'LOG-' || v_ano || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_numero_log_solicitacao ON log_solicitacoes;
CREATE TRIGGER trig_numero_log_solicitacao
  BEFORE INSERT ON log_solicitacoes
  FOR EACH ROW WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION fn_numero_log_solicitacao();

-- updated_at automático
CREATE OR REPLACE FUNCTION fn_set_updated_at_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trig_updated_at_log_solicitacoes ON log_solicitacoes;
CREATE TRIGGER trig_updated_at_log_solicitacoes
  BEFORE UPDATE ON log_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_log();

DROP TRIGGER IF EXISTS trig_updated_at_log_transportes ON log_transportes;
CREATE TRIGGER trig_updated_at_log_transportes
  BEFORE UPDATE ON log_transportes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_log();

DROP TRIGGER IF EXISTS trig_updated_at_log_recebimentos ON log_recebimentos;
CREATE TRIGGER trig_updated_at_log_recebimentos
  BEFORE UPDATE ON log_recebimentos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_log();

-- Atualiza avaliação média da transportadora ao inserir avaliação
CREATE OR REPLACE FUNCTION fn_atualiza_avaliacao_transportadora()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE log_transportadoras
    SET
      avaliacao_media = (
        SELECT AVG(media) FROM log_avaliacoes
        WHERE transportadora_id = NEW.transportadora_id
      ),
      total_avaliacoes = (
        SELECT COUNT(*) FROM log_avaliacoes
        WHERE transportadora_id = NEW.transportadora_id
      )
    WHERE id = NEW.transportadora_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_avaliacao_transportadora ON log_avaliacoes;
CREATE TRIGGER trig_avaliacao_transportadora
  AFTER INSERT OR UPDATE ON log_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION fn_atualiza_avaliacao_transportadora();

-- ── 13. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_log_sol_status         ON log_solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_log_sol_criado         ON log_solicitacoes(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_log_sol_urgente        ON log_solicitacoes(urgente) WHERE urgente = TRUE;
CREATE INDEX IF NOT EXISTS idx_log_sol_centro_custo   ON log_solicitacoes(centro_custo);
CREATE INDEX IF NOT EXISTS idx_log_sol_transportadora ON log_solicitacoes(transportadora_id);
CREATE INDEX IF NOT EXISTS idx_log_transp_solicitacao ON log_transportes(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_log_ocorr_transporte   ON log_ocorrencias(transporte_id);
CREATE INDEX IF NOT EXISTS idx_log_receb_status       ON log_recebimentos(status);
CREATE INDEX IF NOT EXISTS idx_log_nfe_solicitacao    ON log_nfe(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_log_nfe_status         ON log_nfe(status);

-- ── 14. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE log_transportadoras          ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_rotas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_solicitacoes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_itens_solicitacao        ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_checklists_expedicao     ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_nfe                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_transportes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_ocorrencias              ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_recebimentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_avaliacoes               ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário autenticado
DO $$ BEGIN
  CREATE POLICY "log_transportadoras_read" ON log_transportadoras FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_transportadoras_write" ON log_transportadoras FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_rotas_read" ON log_rotas FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_rotas_write" ON log_rotas FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_solicitacoes_read" ON log_solicitacoes FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_solicitacoes_write" ON log_solicitacoes FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_itens_read" ON log_itens_solicitacao FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_itens_write" ON log_itens_solicitacao FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_checklist_read" ON log_checklists_expedicao FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_checklist_write" ON log_checklists_expedicao FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_nfe_read" ON log_nfe FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_nfe_write" ON log_nfe FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_transportes_read" ON log_transportes FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_transportes_write" ON log_transportes FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_ocorrencias_read" ON log_ocorrencias FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_ocorrencias_write" ON log_ocorrencias FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_recebimentos_read" ON log_recebimentos FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_recebimentos_write" ON log_recebimentos FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "log_avaliacoes_read" ON log_avaliacoes FOR SELECT TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "log_avaliacoes_write" ON log_avaliacoes FOR ALL TO authenticated USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 15. Seed Data ─────────────────────────────────────────────────────────────

INSERT INTO log_transportadoras (razao_social, nome_fantasia, cnpj, telefone, modalidades, ativo)
VALUES
  ('TransBrasil Logística LTDA',   'TransBrasil',  '12.345.678/0001-90', '(34) 99999-0001', ARRAY['transportadora'], TRUE),
  ('Rápido Mineiro Transportes',    'Rápido Min',  '98.765.432/0001-11', '(34) 99999-0002', ARRAY['transportadora', 'frota_locada'], TRUE),
  ('Moto Flash Express',            'Moto Flash',  '11.111.111/0001-22', '(34) 99999-0003', ARRAY['motoboy'], TRUE)
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO log_rotas (nome, origem, destino, distancia_km, tempo_estimado_h, custo_referencia)
VALUES
  ('Uberlândia → SE Frutal',       'Uberlândia - MG', 'SE Frutal - MG',         200, 3.0, 800.00),
  ('Uberlândia → SE Paracatu',     'Uberlândia - MG', 'SE Paracatu - MG',        380, 5.0, 1400.00),
  ('Uberlândia → SE Perdizes',     'Uberlândia - MG', 'SE Perdizes - MG',        155, 2.5, 650.00),
  ('Uberlândia → SE Três Marias',  'Uberlândia - MG', 'SE Três Marias - MG',     270, 4.0, 1100.00),
  ('Uberlândia → SE Ituiutaba',    'Uberlândia - MG', 'SE Ituiutaba - MG',       180, 2.5, 750.00)
ON CONFLICT DO NOTHING;
