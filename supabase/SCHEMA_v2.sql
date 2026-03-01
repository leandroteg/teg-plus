-- ============================================================
-- TEG+ | Schema v2 — Tabelas com prefixo de módulo
-- ============================================================
-- Convenção de prefixos:
--   sys_  → Sistema global (compartilhado por todos os módulos)
--   cmp_  → Compras (requisições, cotações, compradores)
--   apr_  → Aprovações (motor reutilizável — ApprovaAi)
--   cot_  → [futuro: motor de cotação avançado]
--   hht_  → [futuro: Homens-Hora de campo]
--   est_  → [futuro: Estoque / Almoxarifado]
--   pat_  → [futuro: Patrimônio e Ativos]
--   fro_  → [futuro: Frotas e Veículos]
--   ssm_  → [futuro: SSMA]
--   rh_   → [futuro: RH e DP]
--   con_  → [futuro: Contratos e Medições]
--   fin_  → [futuro: Financeiro / hub Omie]
--   crm_  → [futuro: CRM e Clientes]
-- ============================================================
-- COMO USAR:
--   Execute no SQL Editor do Supabase.
--   Este script é idempotente: pode ser re-executado.
--   Ele REMOVE as tabelas antigas (sem prefixo) e recria com prefixo.
-- ============================================================

-- ==========================
-- EXTENSÕES
-- ==========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================
-- REMOVER TABELAS ANTIGAS (sem prefixo)
-- Ordem: filhos antes dos pais (FK)
-- ==========================
DROP TABLE IF EXISTS cotacao_fornecedores    CASCADE;
DROP TABLE IF EXISTS cotacoes                CASCADE;
DROP TABLE IF EXISTS aprovacoes              CASCADE;
DROP TABLE IF EXISTS atividades_log          CASCADE;
DROP TABLE IF EXISTS requisicao_itens        CASCADE;
DROP TABLE IF EXISTS requisicoes             CASCADE;
DROP TABLE IF EXISTS categorias_material     CASCADE;
DROP TABLE IF EXISTS compradores             CASCADE;
DROP TABLE IF EXISTS alcadas                 CASCADE;
DROP TABLE IF EXISTS usuarios                CASCADE;
DROP TABLE IF EXISTS configuracoes           CASCADE;
DROP TABLE IF EXISTS obras                   CASCADE;

-- Remover tabelas v2 para rebuild limpo
DROP TABLE IF EXISTS cmp_cotacao_fornecedores CASCADE;
DROP TABLE IF EXISTS cmp_cotacoes             CASCADE;
DROP TABLE IF EXISTS apr_aprovacoes           CASCADE;
DROP TABLE IF EXISTS sys_log_atividades       CASCADE;
DROP TABLE IF EXISTS cmp_requisicao_itens     CASCADE;
DROP TABLE IF EXISTS cmp_requisicoes          CASCADE;
DROP TABLE IF EXISTS cmp_categorias           CASCADE;
DROP TABLE IF EXISTS cmp_compradores          CASCADE;
DROP TABLE IF EXISTS apr_alcadas              CASCADE;
DROP TABLE IF EXISTS sys_usuarios             CASCADE;
DROP TABLE IF EXISTS sys_configuracoes        CASCADE;
DROP TABLE IF EXISTS sys_obras                CASCADE;

-- Remover views
DROP VIEW IF EXISTS vw_dashboard_requisicoes  CASCADE;
DROP VIEW IF EXISTS vw_requisicoes_completas  CASCADE;
DROP VIEW IF EXISTS vw_kpis_compras           CASCADE;
DROP VIEW IF EXISTS vw_requisicoes_por_obra   CASCADE;

-- Remover types (recriar em seguida)
DROP TYPE IF EXISTS status_requisicao  CASCADE;
DROP TYPE IF EXISTS status_aprovacao   CASCADE;
DROP TYPE IF EXISTS urgencia_tipo      CASCADE;
DROP TYPE IF EXISTS status_cotacao     CASCADE;

-- ==========================
-- ENUM TYPES
-- ==========================
CREATE TYPE status_requisicao AS ENUM (
  'rascunho', 'pendente', 'em_aprovacao',
  'aprovada', 'rejeitada', 'em_cotacao',
  'comprada', 'cancelada'
);

CREATE TYPE status_aprovacao AS ENUM (
  'pendente', 'aprovada', 'rejeitada', 'expirada'
);

CREATE TYPE urgencia_tipo AS ENUM (
  'normal', 'urgente', 'critica'
);

CREATE TYPE status_cotacao AS ENUM (
  'pendente', 'em_andamento', 'concluida', 'cancelada'
);

-- ============================================================
-- MÓDULO: sys_ — Sistema Global
-- ============================================================

-- sys_obras: canteiros de obra (usada por todos os módulos)
CREATE TABLE sys_obras (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo      VARCHAR(20) UNIQUE NOT NULL,
  nome        VARCHAR(255) NOT NULL,
  municipio   VARCHAR(100),
  uf          VARCHAR(2) DEFAULT 'MG',
  status      VARCHAR(20) DEFAULT 'ativa',
  responsavel_nome  VARCHAR(255),
  responsavel_email VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- sys_usuarios: usuários do sistema (solicitantes e aprovadores)
CREATE TABLE sys_usuarios (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id      UUID UNIQUE,                          -- Supabase Auth
  nome         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  cargo        VARCHAR(100),
  departamento VARCHAR(100),
  obra_id      UUID REFERENCES sys_obras(id),        -- obra principal
  nivel_alcada INT DEFAULT 0,                        -- 0=sem alçada, 1..4=aprovador
  ativo        BOOLEAN DEFAULT true,
  telefone     VARCHAR(20),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- sys_configuracoes: chave-valor de configuração do sistema
CREATE TABLE sys_configuracoes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave       VARCHAR(100) UNIQUE NOT NULL,
  valor       TEXT,
  tipo        VARCHAR(20) DEFAULT 'string',          -- string | number | boolean | json
  descricao   TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- sys_log_atividades: audit trail de todas as ações
CREATE TABLE sys_log_atividades (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modulo         VARCHAR(50) NOT NULL DEFAULT 'cmp', -- cmp | apr | hht | est | ...
  entidade_tipo  VARCHAR(50),                        -- requisicao | cotacao | aprovacao | ...
  entidade_id    UUID,                               -- id do registro afetado
  tipo           VARCHAR(50) NOT NULL,               -- criacao | atualizacao | aprovacao | rejeicao | ...
  descricao      TEXT,
  usuario_id     UUID REFERENCES sys_usuarios(id),
  usuario_nome   VARCHAR(255),
  dados          JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Configurações padrão
INSERT INTO sys_configuracoes (chave, valor, tipo, descricao) VALUES
  ('sequencial_requisicao',       '0',                             'number',  'Último número sequencial de requisição'),
  ('url_aprovacao',               'https://teg-plus.vercel.app/aprovacao', 'string', 'URL base para links de aprovação'),
  ('notificacao_whatsapp',        'true',                          'boolean', 'Enviar notificações via WhatsApp'),
  ('notificacao_email',           'true',                          'boolean', 'Enviar notificações via Email'),
  ('prazo_padrao_aprovacao_horas','48',                            'number',  'Prazo padrão para aprovação em horas');

-- Obras do portfólio TEG
INSERT INTO sys_obras (codigo, nome, municipio) VALUES
  ('FRUTAL',      'SE Frutal',          'Frutal'),
  ('PARACATU',    'SE Paracatu',        'Paracatu'),
  ('PERDIZES',    'SE Perdizes',        'Perdizes'),
  ('TRESMARIAS',  'SE Três Marias',     'Três Marias'),
  ('RIOPAR',      'SE Rio Paranaíba',   'Rio Paranaíba'),
  ('ITUIUTABA',   'SE Ituiutaba',       'Ituiutaba');

-- ============================================================
-- MÓDULO: apr_ — Aprovações (ApprovaAi)
-- Motor de aprovação reutilizável por qualquer módulo
-- ============================================================

-- apr_alcadas: faixas de alçada de aprovação
CREATE TABLE apr_alcadas (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nivel               INT UNIQUE NOT NULL,           -- 1, 2, 3, 4
  nome                VARCHAR(100) NOT NULL,
  descricao           TEXT,
  valor_min           DECIMAL(15,2) DEFAULT 0,
  valor_max           DECIMAL(15,2),                 -- NULL = sem limite
  aprovador_padrao_id UUID REFERENCES sys_usuarios(id),
  prazo_horas         INT DEFAULT 48,
  ativo               BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- apr_aprovacoes: registros individuais de aprovação
CREATE TABLE apr_aprovacoes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Referência flexível (qualquer módulo pode usar)
  modulo           VARCHAR(50) NOT NULL DEFAULT 'cmp',  -- cmp | con | fin | ...
  entidade_id      UUID NOT NULL,                       -- id da requisição, contrato, etc.
  entidade_numero  VARCHAR(50),                         -- número legível (RC-202602-0001)

  -- Aprovador
  aprovador_id     UUID REFERENCES sys_usuarios(id),
  aprovador_nome   VARCHAR(255) NOT NULL,
  aprovador_email  VARCHAR(255) NOT NULL,

  -- Nível e alçada
  nivel            INT NOT NULL,
  alcada_id        UUID REFERENCES apr_alcadas(id),

  -- Decisão
  status           status_aprovacao DEFAULT 'pendente',
  observacao       TEXT,

  -- Token único para link de aprovação (WhatsApp / e-mail)
  token            VARCHAR(100) UNIQUE NOT NULL DEFAULT 'apr-' || gen_random_uuid()::text,

  -- Datas
  data_limite      TIMESTAMPTZ,
  data_decisao     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Alçadas padrão TEG
INSERT INTO apr_alcadas (nivel, nome, descricao, valor_min, valor_max, prazo_horas) VALUES
  (1, 'Coordenador', 'Até R$ 5.000',            0,          5000,   24),
  (2, 'Gerente',     'R$ 5.001 a R$ 25.000',    5000.01,    25000,  48),
  (3, 'Diretor',     'R$ 25.001 a R$ 100.000',  25000.01,   100000, 72),
  (4, 'CEO',         'Acima de R$ 100.000',      100000.01,  NULL,   72);

-- ============================================================
-- MÓDULO: cmp_ — Compras (Suprimentos)
-- Requisições · Cotações · Compradores · Categorias
-- ============================================================

-- cmp_categorias: categorias de materiais (usadas pela IA para classificação)
CREATE TABLE cmp_categorias (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo    VARCHAR(20) UNIQUE NOT NULL,
  nome      VARCHAR(100) NOT NULL,
  keywords  TEXT[] DEFAULT '{}',                    -- palavras-chave para IA
  cor       VARCHAR(20) DEFAULT '#6366f1',           -- hex para UI
  icone     VARCHAR(50) DEFAULT 'Package',           -- Lucide icon name
  ativo     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- cmp_compradores: compradores por categoria de material
CREATE TABLE cmp_compradores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id  UUID REFERENCES sys_usuarios(id),
  nome        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  telefone    VARCHAR(20),
  categorias  TEXT[] DEFAULT '{}',                   -- categorias que este comprador atende
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- cmp_requisicoes: requisições de compra
CREATE TABLE cmp_requisicoes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero           VARCHAR(20) UNIQUE NOT NULL,       -- RC-202602-0001

  -- Solicitante
  solicitante_id   UUID REFERENCES sys_usuarios(id),
  solicitante_nome VARCHAR(255) NOT NULL,

  -- Obra / Centro de Custo
  obra_id          UUID REFERENCES sys_obras(id),
  obra_nome        VARCHAR(255),
  centro_custo     VARCHAR(100),

  -- Detalhes
  descricao        TEXT NOT NULL,
  justificativa    TEXT,
  categoria        VARCHAR(100),                      -- código da categoria
  comprador_id     UUID REFERENCES cmp_compradores(id),

  -- IA
  texto_original   TEXT,                             -- texto livre digitado pelo solicitante
  ai_confianca     DECIMAL(4,3) DEFAULT 0,           -- 0.0 a 1.0

  -- Valores
  valor_estimado   DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Prioridade e Status
  urgencia         urgencia_tipo DEFAULT 'normal',
  status           status_requisicao DEFAULT 'pendente',

  -- Alçada
  alcada_nivel     INT NOT NULL DEFAULT 1,           -- nível exigido para aprovação
  alcada_atual     INT DEFAULT 1,                    -- nível sendo aprovado agora

  -- Datas
  data_necessidade DATE,
  data_aprovacao   TIMESTAMPTZ,
  data_conclusao   TIMESTAMPTZ,

  -- Metadata
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- cmp_requisicao_itens: itens de uma requisição
CREATE TABLE cmp_requisicao_itens (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id  UUID NOT NULL REFERENCES cmp_requisicoes(id) ON DELETE CASCADE,
  descricao      VARCHAR(500) NOT NULL,
  quantidade     DECIMAL(10,2) NOT NULL,
  unidade        VARCHAR(20) NOT NULL DEFAULT 'un',  -- un | kg | m | m² | m³ | L | pç
  valor_unitario_estimado DECIMAL(15,2) DEFAULT 0,
  valor_total_estimado    DECIMAL(15,2) GENERATED ALWAYS AS (quantidade * valor_unitario_estimado) STORED,
  observacao     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- cmp_cotacoes: cotações vinculadas a uma requisição
CREATE TABLE cmp_cotacoes (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id           UUID NOT NULL REFERENCES cmp_requisicoes(id) ON DELETE CASCADE,
  comprador_id            UUID REFERENCES cmp_compradores(id),
  status                  status_cotacao DEFAULT 'pendente',
  fornecedor_selecionado_id UUID,                    -- FK para cmp_cotacao_fornecedores (adicionada abaixo)
  valor_selecionado       DECIMAL(15,2),
  fornecedor_selecionado_nome VARCHAR(255),
  observacao              TEXT,
  data_limite             TIMESTAMPTZ,
  data_conclusao          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- cmp_cotacao_fornecedores: propostas de fornecedores por cotação
CREATE TABLE cmp_cotacao_fornecedores (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id          UUID NOT NULL REFERENCES cmp_cotacoes(id) ON DELETE CASCADE,
  fornecedor_nome     VARCHAR(255) NOT NULL,
  fornecedor_contato  VARCHAR(255),
  fornecedor_cnpj     VARCHAR(18),
  valor_total         DECIMAL(15,2) NOT NULL DEFAULT 0,
  prazo_entrega_dias  INT,
  condicao_pagamento  VARCHAR(100),
  itens_precos        JSONB DEFAULT '[]',             -- [{descricao, qtd, valor_unitario, valor_total}]
  observacao          TEXT,
  arquivo_url         TEXT,
  selecionado         BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- FK circular após criação da tabela filha
ALTER TABLE cmp_cotacoes
  ADD CONSTRAINT fk_cotacoes_fornecedor_selecionado
  FOREIGN KEY (fornecedor_selecionado_id)
  REFERENCES cmp_cotacao_fornecedores(id)
  DEFERRABLE INITIALLY DEFERRED;

-- Seeds: categorias de material
INSERT INTO cmp_categorias (codigo, nome, keywords, cor, icone) VALUES
  ('ELETRICO',   'Elétrico',         ARRAY['cabo','fio','transformador','disjuntor','chave','painel','relé','medidor','capacitor','XLPE','kV'],    '#f59e0b', 'Zap'),
  ('EPI',        'EPI / Segurança',  ARRAY['capacete','luva','bota','cinto','óculos','protetor','epi','nr','segurança','colete'],                  '#ef4444', 'Shield'),
  ('CIVIL',      'Civil / Estrutura',ARRAY['cimento','areia','tijolo','brita','ferro','vergalhão','argamassa','concreto','forma'],                  '#8b5cf6', 'Building'),
  ('FERRAMENTA', 'Ferramentas',      ARRAY['chave','alicate','martelo','furadeira','esmerilhadeira','ferramenta','equipamento'],                    '#06b6d4', 'Wrench'),
  ('TRANSPORTE', 'Transporte / Frete',ARRAY['frete','transporte','entrega','caminhão','motoboy','logística'],                                      '#10b981', 'Truck'),
  ('OUTROS',     'Outros',           ARRAY['material','suprimento','consumível','escritório','limpeza'],                                            '#6b7280', 'Package');

-- Seeds: usuários aprovadores
INSERT INTO sys_usuarios (nome, email, cargo, departamento, nivel_alcada, telefone) VALUES
  ('Coordenador de Obras',   'coordenador@teguniao.com.br', 'Coordenador', 'Obras',       1, '(34) 99999-0001'),
  ('Gerente de Suprimentos', 'gerente@teguniao.com.br',     'Gerente',     'Suprimentos', 2, '(34) 99999-0002'),
  ('Diretor de Operações',   'diretor@teguniao.com.br',     'Diretor',     'Diretoria',   3, '(34) 99999-0003'),
  ('CEO',                    'ceo@teguniao.com.br',         'CEO',         'Diretoria',   4, '(34) 99999-0004');

-- Vincular aprovadores às alçadas
UPDATE apr_alcadas SET aprovador_padrao_id = (SELECT id FROM sys_usuarios WHERE nivel_alcada = 1 LIMIT 1) WHERE nivel = 1;
UPDATE apr_alcadas SET aprovador_padrao_id = (SELECT id FROM sys_usuarios WHERE nivel_alcada = 2 LIMIT 1) WHERE nivel = 2;
UPDATE apr_alcadas SET aprovador_padrao_id = (SELECT id FROM sys_usuarios WHERE nivel_alcada = 3 LIMIT 1) WHERE nivel = 3;
UPDATE apr_alcadas SET aprovador_padrao_id = (SELECT id FROM sys_usuarios WHERE nivel_alcada = 4 LIMIT 1) WHERE nivel = 4;

-- Seeds: usuários solicitantes de exemplo
INSERT INTO sys_usuarios (nome, email, cargo, departamento, obra_id, nivel_alcada, telefone) VALUES
  ('João Silva',     'joao.silva@teguniao.com.br',     'Engenheiro de Campo',    'Obras',       (SELECT id FROM sys_obras WHERE codigo = 'FRUTAL'),     0, '(34) 99999-1001'),
  ('Maria Santos',   'maria.santos@teguniao.com.br',   'Técnica de Segurança',   'SSMA',        (SELECT id FROM sys_obras WHERE codigo = 'PARACATU'),   0, '(34) 99999-1002'),
  ('Carlos Oliveira','carlos.oliveira@teguniao.com.br','Almoxarife',             'Suprimentos', (SELECT id FROM sys_obras WHERE codigo = 'PERDIZES'),   0, '(34) 99999-1003');

-- Seeds: compradores
INSERT INTO cmp_compradores (nome, email, telefone, categorias) VALUES
  ('Ana Compras',    'ana.compras@teguniao.com.br',    '(34) 99999-2001', ARRAY['ELETRICO', 'FERRAMENTA']),
  ('Pedro Suprimentos','pedro.sup@teguniao.com.br',   '(34) 99999-2002', ARRAY['CIVIL', 'OUTROS']),
  ('Sofia EPI',      'sofia.epi@teguniao.com.br',      '(34) 99999-2003', ARRAY['EPI', 'TRANSPORTE']);

-- ============================================================
-- INDEXES
-- ============================================================

-- sys_log_atividades
CREATE INDEX idx_log_modulo         ON sys_log_atividades(modulo);
CREATE INDEX idx_log_entidade       ON sys_log_atividades(entidade_id);
CREATE INDEX idx_log_created        ON sys_log_atividades(created_at DESC);

-- apr_aprovacoes
CREATE INDEX idx_apr_aprov_entidade ON apr_aprovacoes(entidade_id);
CREATE INDEX idx_apr_aprov_token    ON apr_aprovacoes(token);
CREATE INDEX idx_apr_aprov_status   ON apr_aprovacoes(status);
CREATE INDEX idx_apr_aprov_email    ON apr_aprovacoes(aprovador_email);
CREATE INDEX idx_apr_aprov_modulo   ON apr_aprovacoes(modulo);

-- cmp_requisicoes
CREATE INDEX idx_cmp_req_status     ON cmp_requisicoes(status);
CREATE INDEX idx_cmp_req_obra       ON cmp_requisicoes(obra_id);
CREATE INDEX idx_cmp_req_solicitante ON cmp_requisicoes(solicitante_id);
CREATE INDEX idx_cmp_req_created    ON cmp_requisicoes(created_at DESC);
CREATE INDEX idx_cmp_req_numero     ON cmp_requisicoes(numero);
CREATE INDEX idx_cmp_req_comprador  ON cmp_requisicoes(comprador_id);

-- cmp_cotacoes
CREATE INDEX idx_cmp_cot_requisicao ON cmp_cotacoes(requisicao_id);
CREATE INDEX idx_cmp_cot_comprador  ON cmp_cotacoes(comprador_id);
CREATE INDEX idx_cmp_cot_status     ON cmp_cotacoes(status);

-- cmp_cotacao_fornecedores
CREATE INDEX idx_cmp_forn_cotacao   ON cmp_cotacao_fornecedores(cotacao_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Gera número sequencial de requisição: RC-YYYYMM-NNNN
CREATE OR REPLACE FUNCTION cmp_gerar_numero_requisicao()
RETURNS TEXT AS $$
DECLARE
  seq INT;
  ano_mes TEXT;
BEGIN
  UPDATE sys_configuracoes
    SET valor = (valor::int + 1)::text, updated_at = now()
    WHERE chave = 'sequencial_requisicao'
    RETURNING valor::int INTO seq;

  ano_mes := to_char(now(), 'YYYYMM');
  RETURN 'RC-' || ano_mes || '-' || lpad(seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Determina o nível de alçada pelo valor da compra
CREATE OR REPLACE FUNCTION apr_determinar_alcada(p_valor DECIMAL)
RETURNS INT AS $$
BEGIN
  IF    p_valor > 100000 THEN RETURN 4;   -- CEO
  ELSIF p_valor > 25000  THEN RETURN 3;   -- Diretor
  ELSIF p_valor > 5000   THEN RETURN 2;   -- Gerente
  ELSE                        RETURN 1;   -- Coordenador
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION sys_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sys_obras_updated
  BEFORE UPDATE ON sys_obras
  FOR EACH ROW EXECUTE FUNCTION sys_update_updated_at();

CREATE TRIGGER tr_sys_usuarios_updated
  BEFORE UPDATE ON sys_usuarios
  FOR EACH ROW EXECUTE FUNCTION sys_update_updated_at();

CREATE TRIGGER tr_cmp_requisicoes_updated
  BEFORE UPDATE ON cmp_requisicoes
  FOR EACH ROW EXECUTE FUNCTION sys_update_updated_at();

CREATE TRIGGER tr_cmp_cotacoes_updated
  BEFORE UPDATE ON cmp_cotacoes
  FOR EACH ROW EXECUTE FUNCTION sys_update_updated_at();

-- ============================================================
-- RPC: Dashboard de Compras (uma chamada → retorna tudo)
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_compras(
  p_periodo TEXT DEFAULT 'mes',
  p_obra_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  data_inicio TIMESTAMPTZ;
  resultado JSON;
BEGIN
  CASE p_periodo
    WHEN 'semana'    THEN data_inicio := date_trunc('week',    now());
    WHEN 'mes'       THEN data_inicio := date_trunc('month',   now());
    WHEN 'trimestre' THEN data_inicio := date_trunc('quarter', now());
    WHEN 'ano'       THEN data_inicio := date_trunc('year',    now());
    ELSE                  data_inicio := date_trunc('month',   now());
  END CASE;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total',                    COUNT(*),
        'aguardando_aprovacao',     COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'aprovadas',                COUNT(*) FILTER (WHERE status = 'aprovada'),
        'rejeitadas',               COUNT(*) FILTER (WHERE status = 'rejeitada'),
        'valor_total',              COALESCE(SUM(valor_estimado), 0),
        'valor_aprovado',           COALESCE(SUM(valor_estimado) FILTER (WHERE status = 'aprovada'), 0),
        'ticket_medio',             COALESCE(AVG(valor_estimado), 0)
      )
      FROM cmp_requisicoes
      WHERE created_at >= data_inicio
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),
    'por_status', (
      SELECT json_agg(json_build_object('status', status, 'total', cnt, 'valor', valor))
      FROM (
        SELECT status, COUNT(*) cnt, COALESCE(SUM(valor_estimado), 0) valor
        FROM cmp_requisicoes
        WHERE created_at >= data_inicio
          AND (p_obra_id IS NULL OR obra_id = p_obra_id)
        GROUP BY status
      ) s
    ),
    'por_obra', (
      SELECT json_agg(json_build_object(
        'obra_nome', obra_nome, 'obra_id', obra_id,
        'total', cnt, 'valor', valor, 'pendentes', pend
      ))
      FROM (
        SELECT obra_nome, obra_id, COUNT(*) cnt,
               COALESCE(SUM(valor_estimado), 0) valor,
               COUNT(*) FILTER (WHERE status = 'em_aprovacao') pend
        FROM cmp_requisicoes
        WHERE created_at >= data_inicio
        GROUP BY obra_nome, obra_id
      ) o
    ),
    'recentes', (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT id, numero, solicitante_nome, obra_nome, descricao,
               valor_estimado, urgencia, status, alcada_nivel, categoria, created_at
        FROM cmp_requisicoes
        WHERE (p_obra_id IS NULL OR obra_id = p_obra_id)
        ORDER BY created_at DESC
        LIMIT 20
      ) r
    ),
    'aprovacoes_pendentes', (
      SELECT json_agg(row_to_json(ap))
      FROM (
        SELECT
          a.id, a.entidade_id, a.entidade_numero AS numero,
          r.descricao, r.valor_estimado AS valor,
          r.obra_nome AS obra, r.solicitante_nome AS solicitante,
          a.nivel, a.aprovador_nome AS aprovador,
          a.data_limite, a.token
        FROM apr_aprovacoes a
        JOIN cmp_requisicoes r ON r.id = a.entidade_id AND a.modulo = 'cmp'
        WHERE a.status = 'pendente'
          AND (p_obra_id IS NULL OR r.obra_id = p_obra_id)
        ORDER BY a.created_at DESC
        LIMIT 10
      ) ap
    )
  ) INTO resultado;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VIEWS para Dashboard
-- ============================================================

CREATE OR REPLACE VIEW vw_cmp_dashboard_status AS
SELECT
  status,
  COUNT(*)                          AS total,
  COALESCE(SUM(valor_estimado), 0)  AS valor_total,
  COALESCE(AVG(valor_estimado), 0)  AS valor_medio
FROM cmp_requisicoes
WHERE created_at >= date_trunc('month', now())
GROUP BY status;

CREATE OR REPLACE VIEW vw_cmp_requisicoes_completas AS
SELECT
  r.*,
  al.nome                           AS alcada_nome,
  ap.status                         AS aprovacao_status,
  ap.aprovador_nome                 AS aprovador_atual,
  ap.data_limite                    AS aprovacao_data_limite
FROM cmp_requisicoes r
LEFT JOIN apr_alcadas al ON al.nivel = r.alcada_nivel
LEFT JOIN apr_aprovacoes ap
       ON ap.entidade_id = r.id
      AND ap.modulo = 'cmp'
      AND ap.nivel = r.alcada_atual
      AND ap.status = 'pendente';

CREATE OR REPLACE VIEW vw_cmp_por_obra AS
SELECT
  obra_nome,
  obra_id,
  COUNT(*)                                                     AS total,
  COUNT(*) FILTER (WHERE status = 'em_aprovacao')              AS em_aprovacao,
  COUNT(*) FILTER (WHERE status = 'aprovada')                  AS aprovadas,
  COUNT(*) FILTER (WHERE status = 'rejeitada')                 AS rejeitadas,
  COALESCE(SUM(valor_estimado), 0)                             AS valor_total
FROM cmp_requisicoes
WHERE created_at >= date_trunc('month', now())
GROUP BY obra_nome, obra_id;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE cmp_requisicoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmp_cotacoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmp_cotacao_fornecedores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE apr_aprovacoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_log_atividades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_usuarios              ENABLE ROW LEVEL SECURITY;

-- Leitura anônima (para o app funcionar sem login por enquanto)
CREATE POLICY "anon_read_cmp_requisicoes"
  ON cmp_requisicoes FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_cmp_cotacoes"
  ON cmp_cotacoes FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_cmp_fornecedores"
  ON cmp_cotacao_fornecedores FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_apr_aprovacoes"
  ON apr_aprovacoes FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_sys_usuarios"
  ON sys_usuarios FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_sys_log"
  ON sys_log_atividades FOR SELECT TO anon USING (true);

-- Inserção anônima (para o app criar registros sem login)
CREATE POLICY "anon_insert_cmp_requisicoes"
  ON cmp_requisicoes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_insert_cmp_cotacoes"
  ON cmp_cotacoes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_insert_cmp_fornecedores"
  ON cmp_cotacao_fornecedores FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_insert_apr_aprovacoes"
  ON apr_aprovacoes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_insert_sys_log"
  ON sys_log_atividades FOR INSERT TO anon WITH CHECK (true);

-- Update anônimo (para aprovações e atualizações de status)
CREATE POLICY "anon_update_cmp_requisicoes"
  ON cmp_requisicoes FOR UPDATE TO anon USING (true);

CREATE POLICY "anon_update_cmp_cotacoes"
  ON cmp_cotacoes FOR UPDATE TO anon WITH CHECK (true);

CREATE POLICY "anon_update_apr_aprovacoes"
  ON apr_aprovacoes FOR UPDATE TO anon USING (true);

-- Usuários autenticados: acesso completo às suas tabelas
CREATE POLICY "auth_all_cmp_requisicoes"
  ON cmp_requisicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_apr_aprovacoes"
  ON apr_aprovacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role (n8n): acesso total
CREATE POLICY "service_all_cmp_requisicoes"
  ON cmp_requisicoes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_cmp_cotacoes"
  ON cmp_cotacoes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_cmp_fornecedores"
  ON cmp_cotacao_fornecedores FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_apr_aprovacoes"
  ON apr_aprovacoes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_sys_log"
  ON sys_log_atividades FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_sys_usuarios"
  ON sys_usuarios FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE cmp_requisicoes;
ALTER PUBLICATION supabase_realtime ADD TABLE apr_aprovacoes;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT
  'sys_obras'               AS tabela, COUNT(*) AS registros FROM sys_obras      UNION ALL
SELECT 'apr_alcadas',                  COUNT(*) FROM apr_alcadas                 UNION ALL
SELECT 'sys_usuarios',                 COUNT(*) FROM sys_usuarios                UNION ALL
SELECT 'cmp_categorias',               COUNT(*) FROM cmp_categorias              UNION ALL
SELECT 'cmp_compradores',              COUNT(*) FROM cmp_compradores             UNION ALL
SELECT 'cmp_requisicoes',              COUNT(*) FROM cmp_requisicoes             UNION ALL
SELECT 'apr_aprovacoes',               COUNT(*) FROM apr_aprovacoes              UNION ALL
SELECT 'sys_log_atividades',           COUNT(*) FROM sys_log_atividades;

-- ============================================================
-- FIM DO SCHEMA v2
-- Próximos módulos (descomentar quando implementar):
-- hht_ → Homens-Hora (colaboradores, lancamentos, atividades)
-- est_ → Estoque (materiais, saldos, movimentacoes)
-- pat_ → Patrimônio (ativos, movimentacoes, qrcodes)
-- fro_ → Frotas (veiculos, hodometros, abastecimentos)
-- ssm_ → SSMA (epis, permissoes_trabalho, ocorrencias)
-- rh_  → RH/DP (colaboradores, mobilizacao, banco_horas)
-- con_ → Contratos (contratos, medicoes, pleitos)
-- fin_ → Financeiro (hub Omie — contas, nfe, caixa)
-- crm_ → CRM (clientes, oportunidades, propostas)
-- ============================================================
