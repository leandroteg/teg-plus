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
-- =============================================================================
-- 018_mural_recados.sql — Mural de Recados e Comunicação Empresarial
-- =============================================================================
-- Tabela: mural_banners
-- Tipos:  fixa | campanha
-- Uso:    Slideshow na tela inicial ModuloSelector + Gestão no módulo RH (admin)
-- =============================================================================

-- ── Enum ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE mural_tipo AS ENUM ('fixa', 'campanha');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tabela principal ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mural_banners (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text        NOT NULL CHECK (char_length(titulo) >= 3),
  subtitulo     text,
  imagem_url    text        NOT NULL,
  tipo          mural_tipo  NOT NULL DEFAULT 'fixa',
  ativo         boolean     NOT NULL DEFAULT true,
  ordem         int         NOT NULL DEFAULT 0,
  -- Campos exclusivos de campanha
  data_inicio   date,
  data_fim      date,
  -- Customização visual (opcionais)
  cor_titulo    text        DEFAULT '#FFFFFF',
  cor_subtitulo text        DEFAULT '#CBD5E1',
  -- Auditoria
  criado_por    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Constraint: campanha deve ter data_fim
  CONSTRAINT campanha_requer_data_fim
    CHECK (tipo = 'fixa' OR (tipo = 'campanha' AND data_fim IS NOT NULL)),
  -- Constraint: data_inicio <= data_fim
  CONSTRAINT datas_validas
    CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_inicio <= data_fim)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mural_ativo  ON mural_banners(ativo);
CREATE INDEX IF NOT EXISTS idx_mural_tipo   ON mural_banners(tipo);
CREATE INDEX IF NOT EXISTS idx_mural_ordem  ON mural_banners(ordem);
CREATE INDEX IF NOT EXISTS idx_mural_datas  ON mural_banners(data_inicio, data_fim);

-- ── Trigger updated_at ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at_mural()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_updated_at_mural ON mural_banners;
CREATE TRIGGER trg_updated_at_mural
  BEFORE UPDATE ON mural_banners
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_mural();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE mural_banners ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados: leem apenas banners ativos e vigentes
DO $$ BEGIN
  CREATE POLICY "mural_banners_select_publico" ON mural_banners
    FOR SELECT TO authenticated
    USING (
      ativo = true
      AND (
        tipo = 'fixa'
        OR (
          tipo = 'campanha'
          AND (data_inicio IS NULL OR data_inicio <= CURRENT_DATE)
          AND (data_fim   IS NULL OR data_fim   >= CURRENT_DATE)
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin: acesso total (SELECT inclui inativos e fora do período)
DO $$ BEGIN
  CREATE POLICY "mural_banners_admin_all" ON mural_banners
    FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── View: banners_vigentes ────────────────────────────────────────────────────
-- Útil para RPC ou consultas sem considerar RLS
CREATE OR REPLACE VIEW mural_banners_vigentes AS
SELECT *
FROM mural_banners
WHERE ativo = true
  AND (
    tipo = 'fixa'
    OR (
      tipo = 'campanha'
      AND (data_inicio IS NULL OR data_inicio <= CURRENT_DATE)
      AND (data_fim   IS NULL OR data_fim   >= CURRENT_DATE)
    )
  )
ORDER BY ordem ASC;

-- ── Seed: banners padrão ──────────────────────────────────────────────────────
INSERT INTO mural_banners (titulo, subtitulo, imagem_url, tipo, ativo, ordem) VALUES
  (
    'Bem-vindo ao TEG+ ERP',
    'Sistema integrado para gestão de obras de engenharia elétrica e transmissão de energia',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1400&q=80',
    'fixa', true, 0
  ),
  (
    'Módulos Disponíveis',
    'Compras · Financeiro · Estoque · Logística · Frotas — todos operacionais',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=80',
    'fixa', true, 1
  ),
  (
    'Segurança em Primeiro Lugar',
    'Mantenha os checklists de frota em dia e os registros de SSMA atualizados',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=80',
    'fixa', true, 2
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- STORAGE: bucket para imagens do Mural de Recados
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mural-banners',
  'mural-banners',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: qualquer autenticado pode ler (bucket é público)
DO $$ BEGIN
  CREATE POLICY "mural_storage_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'mural-banners');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policy: apenas admin pode fazer upload
DO $$ BEGIN
  CREATE POLICY "mural_storage_admin_write" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'mural-banners'
      AND EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
