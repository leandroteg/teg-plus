-- =============================================================================
-- Migration 015: Módulo Estoque e Patrimonial
-- TEG+ ERP – Supabase PostgreSQL
-- Created: 2026-03-03
--
-- Sections:
--   1.  est_bases          — Depósitos / bases de estoque
--   2.  est_localizacoes   — Endereçamento físico (corredor/prateleira/posição)
--   3.  est_itens          — Catálogo de itens com curva ABC e min/max
--   4.  est_saldos         — Saldo por item + base
--   5.  est_movimentacoes  — Entradas, saídas, transferências e ajustes
--   6.  est_solicitacoes   — Solicitações de material
--   7.  est_inventarios    — Sessões de inventário cíclico/periódico
--   8.  est_inventario_itens — Contagens do inventário
--   9.  pat_imobilizados   — Cadastro de imobilizados
--   10. pat_movimentacoes  — Movimentações entre bases/colaboradores
--   11. pat_termos_responsabilidade — Termos digitais
--   12. pat_depreciacoes   — Depreciação mensal
--   13. Triggers
--   14. RLS Policies
--   15. Indexes
-- =============================================================================


-- =============================================================================
-- 1. est_bases — Depósitos e bases
-- =============================================================================
CREATE TABLE IF NOT EXISTS est_bases (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       VARCHAR(20) UNIQUE NOT NULL,
  nome         VARCHAR(100) NOT NULL,
  endereco     TEXT,
  responsavel  TEXT,
  ativa        BOOLEAN     DEFAULT true,
  criado_em    TIMESTAMPTZ DEFAULT now()
);

INSERT INTO est_bases (codigo, nome) VALUES
  ('MATRIZ', 'Depósito Central — Matriz'),
  ('SE-FRU',  'Almoxarifado SE Frutal'),
  ('SE-PAR',  'Almoxarifado SE Paracatu'),
  ('SE-PER',  'Almoxarifado SE Perdizes'),
  ('SE-TM',   'Almoxarifado SE Três Marias')
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 2. est_localizacoes — Endereçamento físico
-- =============================================================================
CREATE TABLE IF NOT EXISTS est_localizacoes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID        REFERENCES est_bases(id) ON DELETE CASCADE,
  corredor    VARCHAR(10) NOT NULL,
  prateleira  VARCHAR(10) NOT NULL,
  posicao     VARCHAR(10) NOT NULL,
  descricao   TEXT,
  ativa       BOOLEAN     DEFAULT true,
  UNIQUE (base_id, corredor, prateleira, posicao)
);


-- =============================================================================
-- 3. est_itens — Catálogo de itens
-- =============================================================================
CREATE TYPE IF NOT EXISTS est_curva_abc AS ENUM ('A', 'B', 'C');
CREATE TYPE IF NOT EXISTS est_unidade   AS ENUM (
  'UN', 'M', 'M2', 'M3', 'KG', 'TON', 'L', 'CX', 'PCT', 'RL', 'PR', 'JG'
);

CREATE TABLE IF NOT EXISTS est_itens (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                VARCHAR(30)   UNIQUE NOT NULL,
  descricao             TEXT          NOT NULL,
  descricao_complementar TEXT,
  categoria             VARCHAR(80),
  subcategoria          VARCHAR(80),
  unidade               est_unidade   DEFAULT 'UN',
  curva_abc             est_curva_abc DEFAULT 'C',

  -- Controle de estoque
  estoque_minimo        NUMERIC(12,3) DEFAULT 0 CHECK (estoque_minimo >= 0),
  estoque_maximo        NUMERIC(12,3) DEFAULT 0 CHECK (estoque_maximo >= 0),
  ponto_reposicao       NUMERIC(12,3) DEFAULT 0 CHECK (ponto_reposicao >= 0),
  lead_time_dias        INTEGER       DEFAULT 7,

  -- Rastreabilidade
  controla_lote         BOOLEAN       DEFAULT false,
  controla_serie        BOOLEAN       DEFAULT false,
  tem_validade          BOOLEAN       DEFAULT false,

  -- Valores de referência
  valor_medio           NUMERIC(14,4) DEFAULT 0,
  valor_ultima_entrada  NUMERIC(14,4) DEFAULT 0,

  -- Integração
  totvs_codigo          VARCHAR(40),
  ncm                   VARCHAR(10),

  ativo                 BOOLEAN       DEFAULT true,
  criado_em             TIMESTAMPTZ   DEFAULT now(),
  atualizado_em         TIMESTAMPTZ   DEFAULT now()
);

-- Seed de itens de exemplo
INSERT INTO est_itens (codigo, descricao, categoria, unidade, curva_abc, estoque_minimo, estoque_maximo, ponto_reposicao)
VALUES
  ('CAP-AM-001', 'Capacete de segurança amarelo classe B', 'EPI/EPC', 'UN', 'A', 20, 100, 30),
  ('LUV-RAS-01', 'Luvas de raspa CA aprovado', 'EPI/EPC', 'PR', 'A', 30, 150, 50),
  ('CAL-ELE-01', 'Calçado de segurança bico de aço', 'EPI/EPC', 'PR', 'A', 10, 50, 15),
  ('CAB-350-01', 'Cabo de energia 350 MCM XLPE', 'Material Elétrico', 'M', 'A', 500, 3000, 800),
  ('DIS-JUN-01', 'Disjuntor tripolar 70A', 'Material Elétrico', 'UN', 'B', 5, 30, 8),
  ('ELE-FER-01', 'Eletrodo de ferrite 3,25mm caixa 5kg', 'Ferramental', 'CX', 'B', 10, 50, 15),
  ('PAP-HIG-01', 'Papel higiênico folha dupla 64un', 'Material de Escritório', 'PCT', 'C', 5, 20, 8),
  ('AGU-MIN-01', 'Água mineral 20L', 'Almoxarifado Geral', 'UN', 'C', 5, 30, 10)
ON CONFLICT (codigo) DO NOTHING;


-- =============================================================================
-- 4. est_saldos — Saldo consolidado por item + base
-- =============================================================================
CREATE TABLE IF NOT EXISTS est_saldos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID        REFERENCES est_itens(id) ON DELETE CASCADE,
  base_id         UUID        REFERENCES est_bases(id) ON DELETE CASCADE,
  saldo           NUMERIC(12,3) DEFAULT 0,
  saldo_reservado NUMERIC(12,3) DEFAULT 0,     -- reservado por solicitação aprovada
  ultima_entrada  TIMESTAMPTZ,
  ultima_saida    TIMESTAMPTZ,
  atualizado_em   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (item_id, base_id)
);


-- =============================================================================
-- 5. est_movimentacoes — Registro de todas as movimentações
-- =============================================================================
CREATE TYPE IF NOT EXISTS est_tipo_mov AS ENUM (
  'entrada',          -- Recebimento de material
  'saida',            -- Consumo por obra/CC
  'transferencia_out',-- Transferência saindo desta base
  'transferencia_in', -- Transferência chegando nesta base
  'ajuste_positivo',  -- Ajuste de inventário +
  'ajuste_negativo',  -- Ajuste de inventário -
  'devolucao',        -- Devolução de obra para estoque
  'baixa'             -- Baixa por perda/avaria/descarte
);

CREATE TABLE IF NOT EXISTS est_movimentacoes (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           UUID              REFERENCES est_itens(id),
  base_id           UUID              REFERENCES est_bases(id),
  base_destino_id   UUID              REFERENCES est_bases(id),  -- para transferências
  localizacao_id    UUID              REFERENCES est_localizacoes(id),
  tipo              est_tipo_mov      NOT NULL,
  quantidade        NUMERIC(12,3)     NOT NULL CHECK (quantidade > 0),
  valor_unitario    NUMERIC(14,4)     DEFAULT 0,
  valor_total       NUMERIC(16,4)     GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,

  -- Rastreabilidade
  obra_nome         TEXT,
  centro_custo      TEXT,
  solicitacao_id    UUID,             -- ref est_solicitacoes
  nf_numero         VARCHAR(30),
  nf_serie          VARCHAR(5),
  fornecedor_nome   TEXT,
  lote              VARCHAR(40),
  numero_serie      VARCHAR(80),
  data_validade     DATE,

  -- Inventário
  inventario_id     UUID,             -- ref est_inventarios

  -- Controle
  responsavel_nome  TEXT,
  responsavel_id    UUID,
  observacao        TEXT,
  documento_url     TEXT,
  criado_em         TIMESTAMPTZ       DEFAULT now()
);


-- =============================================================================
-- 6. est_solicitacoes — Solicitações de material de obra
-- =============================================================================
CREATE TYPE IF NOT EXISTS est_status_solicitacao AS ENUM (
  'aberta', 'aprovada', 'em_separacao', 'atendida', 'parcial', 'cancelada'
);

CREATE TABLE IF NOT EXISTS est_solicitacoes (
  id               UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           VARCHAR(20)             UNIQUE,
  solicitante_nome TEXT                    NOT NULL,
  obra_nome        TEXT                    NOT NULL,
  centro_custo     TEXT,
  urgencia         TEXT                    DEFAULT 'normal' CHECK (urgencia IN ('normal','urgente','critica')),
  status           est_status_solicitacao  DEFAULT 'aberta',
  observacao       TEXT,
  aprovado_por     TEXT,
  aprovado_em      TIMESTAMPTZ,
  criado_em        TIMESTAMPTZ             DEFAULT now(),
  atualizado_em    TIMESTAMPTZ             DEFAULT now()
);

CREATE TABLE IF NOT EXISTS est_solicitacao_itens (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id   UUID        REFERENCES est_solicitacoes(id) ON DELETE CASCADE,
  item_id          UUID        REFERENCES est_itens(id),
  descricao_livre  TEXT,       -- quando item não está no catálogo
  quantidade       NUMERIC(12,3) NOT NULL,
  quantidade_atendida NUMERIC(12,3) DEFAULT 0,
  unidade          VARCHAR(10),
  observacao       TEXT
);

-- Auto-gera número da solicitação
CREATE OR REPLACE FUNCTION gerar_numero_solicitacao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, '-', 3) AS INT)), 0) + 1
    INTO v_seq
    FROM est_solicitacoes
    WHERE numero LIKE 'SOL-' || TO_CHAR(NOW(), 'YYYY') || '-%';
  NEW.numero := 'SOL-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trig_numero_solicitacao
  BEFORE INSERT ON est_solicitacoes
  FOR EACH ROW WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION gerar_numero_solicitacao();


-- =============================================================================
-- 7. est_inventarios — Sessões de inventário
-- =============================================================================
CREATE TYPE IF NOT EXISTS est_tipo_inventario AS ENUM (
  'ciclico',    -- Contagem parcial por curva ABC
  'periodico',  -- Inventário anual completo
  'surpresa'    -- Inventário surpresa de alto valor
);

CREATE TABLE IF NOT EXISTS est_inventarios (
  id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          VARCHAR(20)           UNIQUE,
  tipo            est_tipo_inventario   DEFAULT 'ciclico',
  base_id         UUID                  REFERENCES est_bases(id),
  curva_filtro    est_curva_abc,        -- NULL = todos
  status          VARCHAR(20)           DEFAULT 'aberto'
                    CHECK (status IN ('aberto','em_contagem','concluido','cancelado')),
  data_abertura   DATE                  DEFAULT CURRENT_DATE,
  data_conclusao  DATE,
  responsavel     TEXT,
  aprovado_por    TEXT,
  observacao      TEXT,
  acuracia        NUMERIC(5,2),         -- % de acurácia calculada ao finalizar
  criado_em       TIMESTAMPTZ           DEFAULT now()
);


-- =============================================================================
-- 8. est_inventario_itens — Contagens do inventário
-- =============================================================================
CREATE TABLE IF NOT EXISTS est_inventario_itens (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id     UUID        REFERENCES est_inventarios(id) ON DELETE CASCADE,
  item_id           UUID        REFERENCES est_itens(id),
  base_id           UUID        REFERENCES est_bases(id),
  saldo_sistema     NUMERIC(12,3),   -- Saldo no sistema na data da abertura
  saldo_contado     NUMERIC(12,3),   -- Saldo físico contado
  saldo_recontado   NUMERIC(12,3),   -- Recontagem se divergência > 2%
  divergencia       NUMERIC(12,3) GENERATED ALWAYS AS (
                      COALESCE(saldo_contado, 0) - COALESCE(saldo_sistema, 0)
                    ) STORED,
  divergencia_pct   NUMERIC(6,2),    -- Calculado pela app
  contado_por       TEXT,
  recontado_por     TEXT,
  causa_raiz        TEXT,
  acao_corretiva    TEXT,
  ajuste_aplicado   BOOLEAN     DEFAULT false,
  observacao        TEXT,
  contado_em        TIMESTAMPTZ
);


-- =============================================================================
-- 9. pat_imobilizados — Cadastro de imobilizados
-- =============================================================================
CREATE TYPE IF NOT EXISTS pat_status_imob AS ENUM (
  'ativo', 'em_manutencao', 'cedido', 'baixado', 'em_transferencia'
);

CREATE TABLE IF NOT EXISTS pat_imobilizados (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_patrimonio     VARCHAR(30)       UNIQUE NOT NULL,
  descricao             TEXT              NOT NULL,
  categoria             VARCHAR(80)       NOT NULL,
  marca                 VARCHAR(80),
  modelo                VARCHAR(80),
  numero_serie          VARCHAR(80),

  -- Localização e responsabilidade
  base_id               UUID              REFERENCES est_bases(id),
  base_nome             TEXT,
  responsavel_nome      TEXT,
  responsavel_id        UUID,

  -- Status
  status                pat_status_imob   DEFAULT 'ativo',

  -- Valores e depreciação
  valor_aquisicao       NUMERIC(16,2)     NOT NULL DEFAULT 0,
  data_aquisicao        DATE,
  fornecedor_nome       TEXT,
  nf_compra_numero      VARCHAR(30),
  nf_compra_url         TEXT,
  vida_util_meses       INTEGER           DEFAULT 60,
  taxa_depreciacao_anual NUMERIC(5,2)     DEFAULT 20.00, -- % ao ano
  valor_residual        NUMERIC(16,2)     DEFAULT 0,
  valor_atual           NUMERIC(16,2),    -- atualizado mensalmente

  -- Detalhes adicionais
  observacoes           TEXT,
  foto_url              TEXT,

  -- Controle
  baixado_em            TIMESTAMPTZ,
  motivo_baixa          TEXT,
  laudo_baixa_url       TEXT,

  criado_em             TIMESTAMPTZ       DEFAULT now(),
  atualizado_em         TIMESTAMPTZ       DEFAULT now()
);


-- =============================================================================
-- 10. pat_movimentacoes — Movimentações de imobilizados
-- =============================================================================
CREATE TABLE IF NOT EXISTS pat_movimentacoes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imobilizado_id    UUID        REFERENCES pat_imobilizados(id) ON DELETE CASCADE,
  tipo              TEXT        NOT NULL
                      CHECK (tipo IN ('transferencia','manutencao','cessao','retorno','baixa','inventario')),
  base_origem_id    UUID        REFERENCES est_bases(id),
  base_destino_id   UUID        REFERENCES est_bases(id),
  responsavel_origem TEXT,
  responsavel_destino TEXT,
  data_movimentacao DATE        DEFAULT CURRENT_DATE,
  nf_transferencia_numero VARCHAR(30),
  confirmado        BOOLEAN     DEFAULT false,
  confirmado_em     TIMESTAMPTZ,
  confirmado_por    TEXT,
  observacao        TEXT,
  criado_em         TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- 11. pat_termos_responsabilidade — Termos digitais
-- =============================================================================
CREATE TABLE IF NOT EXISTS pat_termos_responsabilidade (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imobilizado_id    UUID        REFERENCES pat_imobilizados(id) ON DELETE CASCADE,
  responsavel_nome  TEXT        NOT NULL,
  responsavel_id    UUID,
  tipo              TEXT        DEFAULT 'vinculacao'
                      CHECK (tipo IN ('vinculacao','devolucao')),
  obra_nome         TEXT,
  data_vigencia     DATE        DEFAULT CURRENT_DATE,
  data_devolucao_prevista DATE,
  assinado          BOOLEAN     DEFAULT false,
  assinado_em       TIMESTAMPTZ,
  url_pdf           TEXT,
  observacao        TEXT,
  criado_em         TIMESTAMPTZ DEFAULT now()
);


-- =============================================================================
-- 12. pat_depreciacoes — Registro mensal de depreciação
-- =============================================================================
CREATE TABLE IF NOT EXISTS pat_depreciacoes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imobilizado_id    UUID        REFERENCES pat_imobilizados(id) ON DELETE CASCADE,
  competencia       DATE        NOT NULL,   -- 1º dia do mês
  valor_depreciacao NUMERIC(14,4) NOT NULL,
  valor_anterior    NUMERIC(14,4) NOT NULL,
  valor_apos        NUMERIC(14,4) NOT NULL,
  exportado_totvs   BOOLEAN     DEFAULT false,
  criado_em         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (imobilizado_id, competencia)
);


-- =============================================================================
-- 13. Triggers
-- =============================================================================

-- 13a. Atualiza est_saldos após cada movimentação
CREATE OR REPLACE FUNCTION fn_atualiza_saldo_estoque()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_delta NUMERIC(12,3);
BEGIN
  -- Calcular delta conforme tipo
  v_delta := CASE NEW.tipo
    WHEN 'entrada'           THEN  NEW.quantidade
    WHEN 'devolucao'         THEN  NEW.quantidade
    WHEN 'transferencia_in'  THEN  NEW.quantidade
    WHEN 'ajuste_positivo'   THEN  NEW.quantidade
    WHEN 'saida'             THEN -NEW.quantidade
    WHEN 'transferencia_out' THEN -NEW.quantidade
    WHEN 'ajuste_negativo'   THEN -NEW.quantidade
    WHEN 'baixa'             THEN -NEW.quantidade
    ELSE 0
  END;

  -- Upsert saldo na base de origem (ou destino para transferência_in)
  INSERT INTO est_saldos (item_id, base_id, saldo, ultima_entrada, ultima_saida)
  VALUES (
    NEW.item_id,
    NEW.base_id,
    GREATEST(0, v_delta),
    CASE WHEN v_delta > 0 THEN NOW() ELSE NULL END,
    CASE WHEN v_delta < 0 THEN NOW() ELSE NULL END
  )
  ON CONFLICT (item_id, base_id) DO UPDATE SET
    saldo        = GREATEST(0, est_saldos.saldo + v_delta),
    ultima_entrada = CASE WHEN v_delta > 0 THEN NOW() ELSE est_saldos.ultima_entrada END,
    ultima_saida   = CASE WHEN v_delta < 0 THEN NOW() ELSE est_saldos.ultima_saida   END,
    atualizado_em  = NOW();

  -- Atualizar valor médio do item
  IF NEW.tipo = 'entrada' AND NEW.valor_unitario > 0 THEN
    UPDATE est_itens
    SET
      valor_ultima_entrada = NEW.valor_unitario,
      valor_medio = (
        SELECT COALESCE(
          (SUM(m.quantidade * m.valor_unitario) / NULLIF(SUM(m.quantidade), 0)),
          NEW.valor_unitario
        )
        FROM est_movimentacoes m
        WHERE m.item_id = NEW.item_id
          AND m.tipo = 'entrada'
          AND m.valor_unitario > 0
      ),
      atualizado_em = NOW()
    WHERE id = NEW.item_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trig_atualiza_saldo
  AFTER INSERT ON est_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fn_atualiza_saldo_estoque();


-- 13b. Auto-gera número de inventário
CREATE OR REPLACE FUNCTION gerar_numero_inventario()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, '-', 3) AS INT)), 0) + 1
    INTO v_seq
    FROM est_inventarios
    WHERE numero LIKE 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-%';
  NEW.numero := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trig_numero_inventario
  BEFORE INSERT ON est_inventarios
  FOR EACH ROW WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION gerar_numero_inventario();


-- 13c. Atualiza updated_at dos imobilizados
CREATE TRIGGER trig_imob_updated_at
  BEFORE UPDATE ON pat_imobilizados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================================
-- 14. RLS Policies
-- =============================================================================

ALTER TABLE est_bases                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_localizacoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_itens                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_saldos                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_movimentacoes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_solicitacoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_solicitacao_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_inventarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE est_inventario_itens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pat_imobilizados              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pat_movimentacoes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pat_termos_responsabilidade   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pat_depreciacoes              ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all estoque data
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_bases' AND policyname = 'auth_read_est_bases') THEN
    CREATE POLICY auth_read_est_bases ON est_bases FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_localizacoes' AND policyname = 'auth_read_localizacoes') THEN
    CREATE POLICY auth_read_localizacoes ON est_localizacoes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_itens' AND policyname = 'auth_read_itens') THEN
    CREATE POLICY auth_read_itens ON est_itens FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_saldos' AND policyname = 'auth_read_saldos') THEN
    CREATE POLICY auth_read_saldos ON est_saldos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_movimentacoes' AND policyname = 'auth_read_movs') THEN
    CREATE POLICY auth_read_movs ON est_movimentacoes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_solicitacoes' AND policyname = 'auth_read_sol') THEN
    CREATE POLICY auth_read_sol ON est_solicitacoes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_solicitacao_itens' AND policyname = 'auth_read_sol_itens') THEN
    CREATE POLICY auth_read_sol_itens ON est_solicitacao_itens FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_inventarios' AND policyname = 'auth_read_inv') THEN
    CREATE POLICY auth_read_inv ON est_inventarios FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_inventario_itens' AND policyname = 'auth_read_inv_itens') THEN
    CREATE POLICY auth_read_inv_itens ON est_inventario_itens FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pat_imobilizados' AND policyname = 'auth_read_imob') THEN
    CREATE POLICY auth_read_imob ON pat_imobilizados FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pat_movimentacoes' AND policyname = 'auth_read_pat_movs') THEN
    CREATE POLICY auth_read_pat_movs ON pat_movimentacoes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pat_termos_responsabilidade' AND policyname = 'auth_read_termos') THEN
    CREATE POLICY auth_read_termos ON pat_termos_responsabilidade FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pat_depreciacoes' AND policyname = 'auth_read_depre') THEN
    CREATE POLICY auth_read_depre ON pat_depreciacoes FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Authenticated users can write (almoxarife/admin roles enforced at app level)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_movimentacoes' AND policyname = 'auth_write_movs') THEN
    CREATE POLICY auth_write_movs ON est_movimentacoes FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_solicitacoes' AND policyname = 'auth_write_sol') THEN
    CREATE POLICY auth_write_sol ON est_solicitacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_solicitacao_itens' AND policyname = 'auth_write_sol_itens') THEN
    CREATE POLICY auth_write_sol_itens ON est_solicitacao_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_inventarios' AND policyname = 'auth_write_inv') THEN
    CREATE POLICY auth_write_inv ON est_inventarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_inventario_itens' AND policyname = 'auth_write_inv_itens') THEN
    CREATE POLICY auth_write_inv_itens ON est_inventario_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'est_itens' AND policyname = 'auth_write_itens') THEN
    CREATE POLICY auth_write_itens ON est_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pat_imobilizados' AND policyname = 'auth_write_imob') THEN
    CREATE POLICY auth_write_imob ON pat_imobilizados FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pat_movimentacoes' AND policyname = 'auth_write_pat_movs') THEN
    CREATE POLICY auth_write_pat_movs ON pat_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pat_termos_responsabilidade' AND policyname = 'auth_write_termos') THEN
    CREATE POLICY auth_write_termos ON pat_termos_responsabilidade FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pat_depreciacoes' AND policyname = 'auth_write_depre') THEN
    CREATE POLICY auth_write_depre ON pat_depreciacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- =============================================================================
-- 15. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_est_itens_categoria   ON est_itens (categoria);
CREATE INDEX IF NOT EXISTS idx_est_itens_curva        ON est_itens (curva_abc);
CREATE INDEX IF NOT EXISTS idx_est_itens_ativo        ON est_itens (ativo);
CREATE INDEX IF NOT EXISTS idx_est_saldos_item        ON est_saldos (item_id);
CREATE INDEX IF NOT EXISTS idx_est_saldos_base        ON est_saldos (base_id);
CREATE INDEX IF NOT EXISTS idx_est_movs_item          ON est_movimentacoes (item_id);
CREATE INDEX IF NOT EXISTS idx_est_movs_base          ON est_movimentacoes (base_id);
CREATE INDEX IF NOT EXISTS idx_est_movs_tipo          ON est_movimentacoes (tipo);
CREATE INDEX IF NOT EXISTS idx_est_movs_criado        ON est_movimentacoes (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_est_movs_obra          ON est_movimentacoes (obra_nome);
CREATE INDEX IF NOT EXISTS idx_est_sol_status         ON est_solicitacoes (status);
CREATE INDEX IF NOT EXISTS idx_est_inv_status         ON est_inventarios (status);
CREATE INDEX IF NOT EXISTS idx_pat_imob_status        ON pat_imobilizados (status);
CREATE INDEX IF NOT EXISTS idx_pat_imob_base          ON pat_imobilizados (base_id);
CREATE INDEX IF NOT EXISTS idx_pat_imob_categoria     ON pat_imobilizados (categoria);
CREATE INDEX IF NOT EXISTS idx_pat_depre_competencia  ON pat_depreciacoes (competencia);

-- Enable Realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE est_saldos;
ALTER PUBLICATION supabase_realtime ADD TABLE est_movimentacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE pat_imobilizados;
