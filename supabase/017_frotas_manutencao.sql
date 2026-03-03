-- ─────────────────────────────────────────────────────────────────────────────
-- 017_frotas_manutencao.sql
-- Módulo Manutenção e Uso de Frotas — TEG+
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE fro_categoria AS ENUM ('passeio','pickup','van','vuc','truck','carreta','moto','onibus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_combustivel AS ENUM ('flex','gasolina','diesel','etanol','eletrico','gnv');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_propriedade AS ENUM ('propria','locada','cedida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_status_veiculo AS ENUM ('disponivel','em_uso','em_manutencao','bloqueado','baixado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_tipo_os AS ENUM ('preventiva','corretiva','sinistro','revisao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_prioridade_os AS ENUM ('critica','alta','media','baixa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_status_os AS ENUM (
    'aberta','em_cotacao','aguardando_aprovacao','aprovada',
    'em_execucao','concluida','rejeitada','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_tipo_item_os AS ENUM ('peca','mao_obra','outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_tipo_pagamento AS ENUM ('cartao_frota','dinheiro','pix','boleto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_tipo_checklist AS ENUM ('pre_viagem','pos_viagem','pos_manutencao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_tipo_ocorrencia AS ENUM (
    'excesso_velocidade','frenagem_brusca','aceleracao_brusca',
    'fora_horario','fora_area','parada_nao_autorizada','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_status_ocorrencia AS ENUM ('registrada','analisada','comunicado_rh','encerrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fro_tipo_fornecedor_fro AS ENUM ('oficina','autopecas','borracharia','locadora','outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Fornecedores de Frotas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_fornecedores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social    TEXT NOT NULL,
  nome_fantasia   TEXT,
  cnpj            TEXT,
  tipo            fro_tipo_fornecedor_fro NOT NULL DEFAULT 'oficina',
  telefone        TEXT,
  email           TEXT,
  endereco        TEXT,
  cidade          TEXT,
  avaliacao_media NUMERIC(3,2) DEFAULT 0 CHECK (avaliacao_media BETWEEN 0 AND 5),
  ativo           BOOLEAN NOT NULL DEFAULT true,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Veículos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_veiculos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa                    TEXT NOT NULL UNIQUE,
  renavam                  TEXT,
  marca                    TEXT NOT NULL,
  modelo                   TEXT NOT NULL,
  ano_fab                  SMALLINT,
  ano_mod                  SMALLINT,
  cor                      TEXT,
  categoria                fro_categoria NOT NULL DEFAULT 'passeio',
  combustivel              fro_combustivel NOT NULL DEFAULT 'flex',
  propriedade              fro_propriedade NOT NULL DEFAULT 'propria',
  status                   fro_status_veiculo NOT NULL DEFAULT 'disponivel',
  hodometro_atual          INTEGER NOT NULL DEFAULT 0,
  capacidade_carga_kg      INTEGER,
  base_id                  UUID REFERENCES est_bases(id),
  motorista_responsavel_id UUID REFERENCES auth.users(id),
  valor_fipe               NUMERIC(12,2),
  data_aquisicao           DATE,
  vencimento_crlv          DATE,
  vencimento_seguro        DATE,
  vencimento_tacografo     DATE,
  km_proxima_preventiva    INTEGER,
  data_proxima_preventiva  DATE,
  foto_url                 TEXT,
  observacoes              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Planos de Manutenção Preventiva ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_planos_preventiva (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id             UUID NOT NULL REFERENCES fro_veiculos(id) ON DELETE CASCADE,
  descricao              TEXT NOT NULL,
  intervalo_km           INTEGER,
  intervalo_dias         INTEGER,
  ultima_realizacao_km   INTEGER,
  ultima_realizacao_data DATE,
  proxima_km             INTEGER,
  proxima_data           DATE,
  ativo                  BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Ordens de Serviço ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_ordens_servico (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_os            TEXT UNIQUE,
  veiculo_id           UUID NOT NULL REFERENCES fro_veiculos(id),
  tipo                 fro_tipo_os NOT NULL,
  prioridade           fro_prioridade_os NOT NULL DEFAULT 'media',
  status               fro_status_os NOT NULL DEFAULT 'aberta',
  hodometro_entrada    INTEGER,
  hodometro_saida      INTEGER,
  data_abertura        DATE NOT NULL DEFAULT CURRENT_DATE,
  data_previsao        DATE,
  data_entrada_oficina TIMESTAMPTZ,
  data_conclusao       TIMESTAMPTZ,
  fornecedor_id        UUID REFERENCES fro_fornecedores(id),
  descricao_problema   TEXT NOT NULL,
  descricao_servico    TEXT,
  valor_orcado         NUMERIC(12,2),
  valor_aprovado       NUMERIC(12,2),
  valor_final          NUMERIC(12,2),
  aprovado_por         UUID REFERENCES auth.users(id),
  aprovado_em          TIMESTAMPTZ,
  rejeitado_por        UUID REFERENCES auth.users(id),
  motivo_rejeicao      TEXT,
  analista_id          UUID REFERENCES auth.users(id),
  checklist_saida_ok   BOOLEAN DEFAULT false,
  foto_antes_url       TEXT,
  foto_depois_url      TEXT,
  observacoes          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Itens da OS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_itens_os (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id          UUID NOT NULL REFERENCES fro_ordens_servico(id) ON DELETE CASCADE,
  tipo           fro_tipo_item_os NOT NULL DEFAULT 'peca',
  descricao      TEXT NOT NULL,
  quantidade     NUMERIC(10,3) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  garantia_km    INTEGER,
  garantia_dias  INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Cotações da OS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_cotacoes_os (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id               UUID NOT NULL REFERENCES fro_ordens_servico(id) ON DELETE CASCADE,
  fornecedor_id       UUID NOT NULL REFERENCES fro_fornecedores(id),
  valor_total         NUMERIC(12,2) NOT NULL,
  prazo_execucao_dias INTEGER,
  validade_orcamento  DATE,
  observacoes         TEXT,
  selecionado         BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Checklists Diários ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_checklists (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id          UUID NOT NULL REFERENCES fro_veiculos(id),
  motorista_id        UUID REFERENCES auth.users(id),
  data_checklist      DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo                fro_tipo_checklist NOT NULL DEFAULT 'pre_viagem',
  nivel_oleo_ok       BOOLEAN NOT NULL DEFAULT false,
  nivel_agua_ok       BOOLEAN NOT NULL DEFAULT false,
  calibragem_pneus_ok BOOLEAN NOT NULL DEFAULT false,
  lanternas_ok        BOOLEAN NOT NULL DEFAULT false,
  freios_ok           BOOLEAN NOT NULL DEFAULT false,
  documentacao_ok     BOOLEAN NOT NULL DEFAULT false,
  limpeza_ok          BOOLEAN NOT NULL DEFAULT false,
  hodometro           INTEGER,
  observacoes         TEXT,
  assinado_em         TIMESTAMPTZ,
  liberado            BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (veiculo_id, data_checklist, tipo)
);

-- ── Abastecimentos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_abastecimentos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id         UUID NOT NULL REFERENCES fro_veiculos(id),
  motorista_id       UUID REFERENCES auth.users(id),
  data_abastecimento DATE NOT NULL DEFAULT CURRENT_DATE,
  posto              TEXT,
  combustivel        fro_combustivel NOT NULL DEFAULT 'flex',
  hodometro          INTEGER NOT NULL,
  litros             NUMERIC(8,3) NOT NULL,
  valor_litro        NUMERIC(8,3) NOT NULL,
  valor_total        NUMERIC(12,2),
  forma_pagamento    fro_tipo_pagamento NOT NULL DEFAULT 'cartao_frota',
  numero_cupom       TEXT,
  km_litro           NUMERIC(8,2),
  desvio_detectado   BOOLEAN NOT NULL DEFAULT false,
  percentual_desvio  NUMERIC(6,2),
  autorizado_por     UUID REFERENCES auth.users(id),
  observacoes        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Ocorrências de Telemetria ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_ocorrencias_telemetria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id      UUID NOT NULL REFERENCES fro_veiculos(id),
  motorista_id    UUID REFERENCES auth.users(id),
  tipo_ocorrencia fro_tipo_ocorrencia NOT NULL,
  velocidade      NUMERIC(6,2),
  intensidade     NUMERIC(6,3),
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  endereco        TEXT,
  data_ocorrencia TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          fro_status_ocorrencia NOT NULL DEFAULT 'registrada',
  analista_id     UUID REFERENCES auth.users(id),
  analisado_em    TIMESTAMPTZ,
  rh_comunicado_em TIMESTAMPTZ,
  encerrado_em    TIMESTAMPTZ,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Avaliações de Fornecedor ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_avaliacoes_fornecedor (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES fro_fornecedores(id),
  os_id         UUID REFERENCES fro_ordens_servico(id),
  prazo         SMALLINT NOT NULL CHECK (prazo BETWEEN 1 AND 5),
  qualidade     SMALLINT NOT NULL CHECK (qualidade BETWEEN 1 AND 5),
  preco         SMALLINT NOT NULL CHECK (preco BETWEEN 1 AND 5),
  avaliador_id  UUID REFERENCES auth.users(id),
  observacoes   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Triggers ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at_fro()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_updated_at_fro_veiculos
    BEFORE UPDATE ON fro_veiculos
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_fro();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_updated_at_fro_fornecedores
    BEFORE UPDATE ON fro_fornecedores
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_fro();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_updated_at_fro_os
    BEFORE UPDATE ON fro_ordens_servico
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_fro();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Numeração automática FRO-OS-YYYY-NNNN
CREATE OR REPLACE FUNCTION fn_numero_os()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM fro_ordens_servico
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());
  NEW.numero_os := 'FRO-OS-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_numero_os
    BEFORE INSERT ON fro_ordens_servico
    FOR EACH ROW WHEN (NEW.numero_os IS NULL)
    EXECUTE FUNCTION fn_numero_os();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recalcula avaliação média do fornecedor
CREATE OR REPLACE FUNCTION fn_avaliacao_fro_fornecedor()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE fro_fornecedores
  SET avaliacao_media = (
    SELECT COALESCE(AVG((prazo + qualidade + preco)::NUMERIC / 3), 0)
    FROM fro_avaliacoes_fornecedor
    WHERE fornecedor_id = NEW.fornecedor_id
  )
  WHERE id = NEW.fornecedor_id;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_avaliacao_fro_fornecedor
    AFTER INSERT ON fro_avaliacoes_fornecedor
    FOR EACH ROW EXECUTE FUNCTION fn_avaliacao_fro_fornecedor();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fro_veiculos_status    ON fro_veiculos(status);
CREATE INDEX IF NOT EXISTS idx_fro_veiculos_base      ON fro_veiculos(base_id);
CREATE INDEX IF NOT EXISTS idx_fro_os_status          ON fro_ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_fro_os_prioridade      ON fro_ordens_servico(prioridade);
CREATE INDEX IF NOT EXISTS idx_fro_os_veiculo         ON fro_ordens_servico(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_fro_checklists_data    ON fro_checklists(data_checklist);
CREATE INDEX IF NOT EXISTS idx_fro_checklists_veiculo ON fro_checklists(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_fro_abast_veiculo      ON fro_abastecimentos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_fro_abast_data         ON fro_abastecimentos(data_abastecimento);
CREATE INDEX IF NOT EXISTS idx_fro_otel_status        ON fro_ocorrencias_telemetria(status);
CREATE INDEX IF NOT EXISTS idx_fro_otel_data          ON fro_ocorrencias_telemetria(data_ocorrencia);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE fro_veiculos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_fornecedores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_ordens_servico        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_itens_os              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_cotacoes_os           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_abastecimentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_ocorrencias_telemetria ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_avaliacoes_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_planos_preventiva     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_veiculos              FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_fornecedores          FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_ordens_servico        FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_itens_os              FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_cotacoes_os           FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_checklists            FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_abastecimentos        FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_ocorrencias_telemetria FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_avaliacoes_fornecedor FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY fro_auth_all ON fro_planos_preventiva     FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed ─────────────────────────────────────────────────────────────────────
INSERT INTO fro_fornecedores (razao_social, nome_fantasia, tipo, telefone, cidade, ativo) VALUES
  ('Auto Mecânica Central Ltda',   'Mecânica Central',   'oficina',     '(34) 3232-1000', 'Uberlândia', true),
  ('Borracharia Rápida ME',         'Borracharia Rápida', 'borracharia', '(34) 99811-2222','Uberlândia', true),
  ('Peças & Cia Distribuidora',     'Peças & Cia',        'autopecas',   '(34) 3311-5500', 'Uberlândia', true),
  ('Officina do Motor Ltda',        'Officina do Motor',  'oficina',     '(34) 3344-7700', 'Uberaba',    true)
ON CONFLICT DO NOTHING;
