-- ============================================================
-- TEG+ | Script Completo - Execute UMA VEZ no Supabase SQL Editor
-- Idempotente: seguro rodar mesmo se ja executou partes antes
-- https://supabase.com/dashboard -> SQL Editor -> New Query
-- ============================================================

-- ==========================
-- EXTENSOES
-- ==========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================
-- ENUM TYPES (com verificacao)
-- ==========================
DO $$ BEGIN
  CREATE TYPE status_requisicao AS ENUM (
    'rascunho','pendente','em_aprovacao','aprovada','rejeitada','em_cotacao','comprada','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_aprovacao AS ENUM ('pendente','aprovada','rejeitada','expirada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE urgencia_tipo AS ENUM ('normal','urgente','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================
-- TABELAS
-- ==========================

CREATE TABLE IF NOT EXISTS obras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  municipio VARCHAR(100),
  uf VARCHAR(2) DEFAULT 'MG',
  status VARCHAR(20) DEFAULT 'ativa',
  responsavel_nome VARCHAR(255),
  responsavel_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO obras (codigo, nome, municipio) VALUES
  ('FRUTAL', 'SE Frutal', 'Frutal'),
  ('PARACATU', 'SE Paracatu', 'Paracatu'),
  ('PERDIZES', 'SE Perdizes', 'Perdizes'),
  ('TRESMARIAS', 'SE Tres Marias', 'Tres Marias'),
  ('RIOPAR', 'SE Rio Paranaiba', 'Rio Paranaiba'),
  ('ITUIUTABA', 'SE Ituiutaba', 'Ituiutaba')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID UNIQUE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  cargo VARCHAR(100),
  departamento VARCHAR(100),
  obra_id UUID REFERENCES obras(id),
  nivel_alcada INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  telefone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alcadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nivel INT UNIQUE NOT NULL,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  valor_min DECIMAL(15,2) DEFAULT 0,
  valor_max DECIMAL(15,2),
  aprovador_padrao_id UUID REFERENCES usuarios(id),
  prazo_horas INT DEFAULT 48,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO alcadas (nivel, nome, descricao, valor_min, valor_max, prazo_horas) VALUES
  (1, 'Coordenador', 'Ate R$ 5.000', 0, 5000, 24),
  (2, 'Gerente', 'R$ 5.001 a R$ 25.000', 5000.01, 25000, 48),
  (3, 'Diretor', 'R$ 25.001 a R$ 100.000', 25000.01, 100000, 72),
  (4, 'CEO', 'Acima de R$ 100.000', 100000.01, NULL, 72)
ON CONFLICT (nivel) DO NOTHING;

CREATE TABLE IF NOT EXISTS requisicoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero VARCHAR(20) UNIQUE NOT NULL,
  solicitante_id UUID REFERENCES usuarios(id),
  solicitante_nome VARCHAR(255) NOT NULL,
  obra_id UUID REFERENCES obras(id),
  obra_nome VARCHAR(255),
  centro_custo VARCHAR(100),
  descricao TEXT NOT NULL,
  justificativa TEXT,
  categoria VARCHAR(100),
  valor_estimado DECIMAL(15,2) NOT NULL DEFAULT 0,
  urgencia urgencia_tipo DEFAULT 'normal',
  status status_requisicao DEFAULT 'pendente',
  alcada_nivel INT NOT NULL DEFAULT 1,
  alcada_atual INT DEFAULT 1,
  data_necessidade DATE,
  data_aprovacao TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Colunas adicionadas na v2 (AI + Cotacao)
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS comprador_id UUID;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS texto_original TEXT;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS ai_confianca DECIMAL(3,2);

CREATE TABLE IF NOT EXISTS requisicao_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id UUID NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,
  descricao VARCHAR(500) NOT NULL,
  quantidade DECIMAL(10,2) NOT NULL,
  unidade VARCHAR(20) NOT NULL DEFAULT 'un',
  valor_unitario_estimado DECIMAL(15,2) DEFAULT 0,
  valor_total_estimado DECIMAL(15,2) GENERATED ALWAYS AS (quantidade * valor_unitario_estimado) STORED,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aprovacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id UUID NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,
  aprovador_id UUID REFERENCES usuarios(id),
  aprovador_nome VARCHAR(255) NOT NULL,
  aprovador_email VARCHAR(255) NOT NULL,
  nivel INT NOT NULL,
  alcada_id UUID REFERENCES alcadas(id),
  status status_aprovacao DEFAULT 'pendente',
  observacao TEXT,
  token VARCHAR(100) UNIQUE NOT NULL DEFAULT 'apr-' || gen_random_uuid()::text,
  data_limite TIMESTAMPTZ,
  data_decisao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atividades_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id UUID REFERENCES requisicoes(id),
  aprovacao_id UUID REFERENCES aprovacoes(id),
  tipo VARCHAR(50) NOT NULL,
  descricao TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  usuario_nome VARCHAR(255),
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configuracoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT,
  tipo VARCHAR(20) DEFAULT 'string',
  descricao TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO configuracoes (chave, valor, tipo, descricao) VALUES
  ('sequencial_requisicao', '0', 'number', 'Ultimo numero sequencial de requisicao'),
  ('url_aprovacao', 'https://teg-plus.vercel.app/aprovacao', 'string', 'URL base para links de aprovacao'),
  ('notificacao_whatsapp', 'true', 'boolean', 'Enviar notificacoes via WhatsApp'),
  ('notificacao_email', 'true', 'boolean', 'Enviar notificacoes via Email'),
  ('prazo_padrao_aprovacao_horas', '48', 'number', 'Prazo padrao para aprovacao em horas')
ON CONFLICT (chave) DO NOTHING;

-- ==========================
-- TABELAS v2: CATEGORIAS, COMPRADORES, COTACOES
-- ==========================

CREATE TABLE IF NOT EXISTS categorias_material (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(100) NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  cor VARCHAR(7) DEFAULT '#6366f1',
  icone VARCHAR(50) DEFAULT 'Package',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO categorias_material (codigo, nome, keywords, cor, icone) VALUES
  ('eletrico', 'Material Eletrico', ARRAY['cabo','fio','condutor','xlpe','disjuntor','transformador','chave','isolador','conector','terminal','rele','fusivel','quadro','painel','barramento','para-raios','tc','tp','seccionadora','religador'], '#f59e0b', 'Zap'),
  ('epi', 'EPIs e Seguranca', ARRAY['epi','luva','capacete','bota','oculos','cinto','protetor','mascara','uniforme','colete','sinalizacao','cone','fita'], '#ef4444', 'Shield'),
  ('civil', 'Material Civil', ARRAY['cimento','areia','brita','concreto','ferro','aco','forma','madeira','tijolo','tubo','pvc','tela','manta','impermeabilizante'], '#8b5cf6', 'Building'),
  ('ferramentas', 'Ferramentas', ARRAY['chave','alicate','martelo','furadeira','serra','esmerilhadeira','torquimetro','multimetro','megometro','terrometro','ferramenta'], '#3b82f6', 'Wrench'),
  ('servicos', 'Servicos e Locacoes', ARRAY['locacao','aluguel','guindaste','munck','caminhao','transporte','frete','servico','mao de obra','empreiteiro','topografia','sondagem'], '#10b981', 'Truck'),
  ('consumo', 'Material de Consumo', ARRAY['papel','toner','limpeza','agua','combustivel','diesel','gasolina','oleo','graxa','solvente','tinta','spray'], '#6b7280', 'Package')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS compradores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  categorias TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO compradores (nome, email, telefone, categorias) VALUES
  ('Marcos Almeida', 'marcos.almeida@teguniao.com.br', '(34) 99876-5432', ARRAY['eletrico','ferramentas']),
  ('Patricia Souza', 'patricia.souza@teguniao.com.br', '(34) 99765-4321', ARRAY['civil','consumo']),
  ('Ricardo Santos', 'ricardo.santos@teguniao.com.br', '(34) 99654-3210', ARRAY['epi','servicos'])
ON CONFLICT DO NOTHING;

-- Adicionar FK de requisicoes para compradores (apos criar tabela)
DO $$ BEGIN
  ALTER TABLE requisicoes ADD CONSTRAINT fk_req_comprador
    FOREIGN KEY (comprador_id) REFERENCES compradores(id);
EXCEPTION WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS cotacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id UUID NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,
  comprador_id UUID NOT NULL REFERENCES compradores(id),
  status VARCHAR(30) DEFAULT 'pendente',
  fornecedor_selecionado_id UUID,
  valor_selecionado DECIMAL(15,2),
  observacao TEXT,
  data_limite TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cotacao_fornecedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id UUID NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  fornecedor_nome VARCHAR(255) NOT NULL,
  fornecedor_contato VARCHAR(255),
  fornecedor_cnpj VARCHAR(20),
  valor_total DECIMAL(15,2) NOT NULL,
  prazo_entrega_dias INT,
  condicao_pagamento VARCHAR(255),
  itens_precos JSONB DEFAULT '[]',
  observacao TEXT,
  arquivo_url TEXT,
  selecionado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================
-- USUARIOS SEED
-- ==========================
INSERT INTO usuarios (nome, email, cargo, departamento, nivel_alcada, telefone) VALUES
  ('Coordenador de Obras', 'coordenador@teguniao.com.br', 'Coordenador', 'Obras', 1, '(34) 99999-0001'),
  ('Gerente de Suprimentos', 'gerente@teguniao.com.br', 'Gerente', 'Suprimentos', 2, '(34) 99999-0002'),
  ('Diretor de Operacoes', 'diretor@teguniao.com.br', 'Diretor', 'Diretoria', 3, '(34) 99999-0003'),
  ('CEO', 'ceo@teguniao.com.br', 'CEO', 'Diretoria', 4, '(34) 99999-0004')
ON CONFLICT (email) DO NOTHING;

UPDATE alcadas SET aprovador_padrao_id = (SELECT id FROM usuarios WHERE nivel_alcada = 1 LIMIT 1) WHERE nivel = 1;
UPDATE alcadas SET aprovador_padrao_id = (SELECT id FROM usuarios WHERE nivel_alcada = 2 LIMIT 1) WHERE nivel = 2;
UPDATE alcadas SET aprovador_padrao_id = (SELECT id FROM usuarios WHERE nivel_alcada = 3 LIMIT 1) WHERE nivel = 3;
UPDATE alcadas SET aprovador_padrao_id = (SELECT id FROM usuarios WHERE nivel_alcada = 4 LIMIT 1) WHERE nivel = 4;

-- ==========================
-- INDEXES
-- ==========================
CREATE INDEX IF NOT EXISTS idx_requisicoes_status ON requisicoes(status);
CREATE INDEX IF NOT EXISTS idx_requisicoes_obra ON requisicoes(obra_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_created ON requisicoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requisicoes_numero ON requisicoes(numero);
CREATE INDEX IF NOT EXISTS idx_requisicoes_categoria ON requisicoes(categoria);
CREATE INDEX IF NOT EXISTS idx_requisicoes_comprador ON requisicoes(comprador_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_requisicao ON aprovacoes(requisicao_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_token ON aprovacoes(token);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_status ON aprovacoes(status);
CREATE INDEX IF NOT EXISTS idx_cotacoes_requisicao ON cotacoes(requisicao_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_comprador ON cotacoes(comprador_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_status ON cotacoes(status);
CREATE INDEX IF NOT EXISTS idx_cotacao_fornecedores_cotacao ON cotacao_fornecedores(cotacao_id);

-- ==========================
-- FUNCTIONS & TRIGGERS
-- ==========================
CREATE OR REPLACE FUNCTION gerar_numero_requisicao()
RETURNS TEXT AS $$
DECLARE
  seq INT;
  ano_mes TEXT;
BEGIN
  UPDATE configuracoes
  SET valor = (valor::int + 1)::text, updated_at = now()
  WHERE chave = 'sequencial_requisicao'
  RETURNING valor::int INTO seq;
  ano_mes := to_char(now(), 'YYYYMM');
  RETURN 'RC-' || ano_mes || '-' || lpad(seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION determinar_alcada(valor DECIMAL)
RETURNS INT AS $$
BEGIN
  IF valor > 100000 THEN RETURN 4;
  ELSIF valor > 25000 THEN RETURN 3;
  ELSIF valor > 5000 THEN RETURN 2;
  ELSE RETURN 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (drop + create para ser idempotente)
DROP TRIGGER IF EXISTS tr_requisicoes_updated ON requisicoes;
CREATE TRIGGER tr_requisicoes_updated
  BEFORE UPDATE ON requisicoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_usuarios_updated ON usuarios;
CREATE TRIGGER tr_usuarios_updated
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_obras_updated ON obras;
CREATE TRIGGER tr_obras_updated
  BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_cotacoes_updated ON cotacoes;
CREATE TRIGGER tr_cotacoes_updated
  BEFORE UPDATE ON cotacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================
-- VIEWS
-- ==========================
CREATE OR REPLACE VIEW vw_dashboard_requisicoes AS
SELECT status, COUNT(*) as total,
  COALESCE(SUM(valor_estimado), 0) as valor_total,
  COALESCE(AVG(valor_estimado), 0) as valor_medio
FROM requisicoes
WHERE created_at >= date_trunc('month', now())
GROUP BY status;

CREATE OR REPLACE VIEW vw_kpis_compras AS
SELECT
  (SELECT COUNT(*) FROM requisicoes WHERE created_at >= date_trunc('month', now())) as total_mes,
  (SELECT COUNT(*) FROM requisicoes WHERE status = 'em_aprovacao') as aguardando_aprovacao,
  (SELECT COUNT(*) FROM requisicoes WHERE status = 'aprovada' AND created_at >= date_trunc('month', now())) as aprovadas_mes,
  (SELECT COUNT(*) FROM requisicoes WHERE status = 'rejeitada' AND created_at >= date_trunc('month', now())) as rejeitadas_mes,
  (SELECT COALESCE(SUM(valor_estimado), 0) FROM requisicoes WHERE created_at >= date_trunc('month', now())) as valor_total_mes,
  (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (ap.data_decisao - ap.created_at))/3600), 0)
   FROM aprovacoes ap WHERE ap.data_decisao IS NOT NULL
   AND ap.created_at >= date_trunc('month', now())) as tempo_medio_aprovacao_horas;

CREATE OR REPLACE VIEW vw_requisicoes_por_obra AS
SELECT obra_nome, obra_id, COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'em_aprovacao') as em_aprovacao,
  COUNT(*) FILTER (WHERE status = 'aprovada') as aprovadas,
  COUNT(*) FILTER (WHERE status = 'rejeitada') as rejeitadas,
  COALESCE(SUM(valor_estimado), 0) as valor_total
FROM requisicoes
WHERE created_at >= date_trunc('month', now())
GROUP BY obra_nome, obra_id;

-- ==========================
-- RPC DASHBOARD
-- ==========================
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
    WHEN 'semana' THEN data_inicio := date_trunc('week', now());
    WHEN 'mes' THEN data_inicio := date_trunc('month', now());
    WHEN 'trimestre' THEN data_inicio := date_trunc('quarter', now());
    WHEN 'ano' THEN data_inicio := date_trunc('year', now());
    ELSE data_inicio := date_trunc('month', now());
  END CASE;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total', COUNT(*),
        'aguardando_aprovacao', COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'aprovadas', COUNT(*) FILTER (WHERE status = 'aprovada'),
        'rejeitadas', COUNT(*) FILTER (WHERE status = 'rejeitada'),
        'valor_total', COALESCE(SUM(valor_estimado), 0),
        'valor_aprovado', COALESCE(SUM(valor_estimado) FILTER (WHERE status = 'aprovada'), 0),
        'ticket_medio', COALESCE(AVG(valor_estimado), 0)
      )
      FROM requisicoes
      WHERE created_at >= data_inicio
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),
    'por_status', (
      SELECT json_agg(json_build_object('status', status, 'total', cnt, 'valor', valor))
      FROM (
        SELECT status, COUNT(*) cnt, COALESCE(SUM(valor_estimado), 0) valor
        FROM requisicoes
        WHERE created_at >= data_inicio AND (p_obra_id IS NULL OR obra_id = p_obra_id)
        GROUP BY status
      ) s
    ),
    'por_obra', (
      SELECT json_agg(json_build_object('obra_nome', obra_nome, 'obra_id', obra_id, 'total', cnt, 'valor', valor, 'pendentes', pend))
      FROM (
        SELECT obra_nome, obra_id, COUNT(*) cnt,
               COALESCE(SUM(valor_estimado), 0) valor,
               COUNT(*) FILTER (WHERE status = 'em_aprovacao') pend
        FROM requisicoes WHERE created_at >= data_inicio
        GROUP BY obra_nome, obra_id
      ) o
    ),
    'recentes', (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT id, numero, solicitante_nome, obra_nome, descricao,
               valor_estimado, urgencia, status, alcada_nivel, created_at
        FROM requisicoes
        WHERE (p_obra_id IS NULL OR obra_id = p_obra_id)
        ORDER BY created_at DESC LIMIT 20
      ) r
    ),
    'aprovacoes_pendentes', (
      SELECT json_agg(json_build_object(
        'id', a.id, 'requisicao_id', a.requisicao_id,
        'aprovador_nome', a.aprovador_nome, 'aprovador_email', a.aprovador_email,
        'nivel', a.nivel, 'status', a.status, 'token', a.token,
        'data_limite', a.data_limite,
        'requisicao', json_build_object(
          'id', r.id, 'numero', r.numero, 'solicitante_nome', r.solicitante_nome,
          'obra_nome', r.obra_nome, 'descricao', r.descricao,
          'valor_estimado', r.valor_estimado, 'urgencia', r.urgencia,
          'status', r.status, 'alcada_nivel', r.alcada_nivel, 'created_at', r.created_at
        )
      ))
      FROM aprovacoes a
      JOIN requisicoes r ON r.id = a.requisicao_id
      WHERE a.status = 'pendente' AND (p_obra_id IS NULL OR r.obra_id = p_obra_id)
      ORDER BY a.created_at DESC LIMIT 10
    )
  ) INTO resultado;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================
-- ROW LEVEL SECURITY
-- ==========================
ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE compradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacao_fornecedores ENABLE ROW LEVEL SECURITY;

-- Drop policies que podem ja existir antes de recriar
DO $$ BEGIN
  DROP POLICY IF EXISTS "Leitura publica requisicoes" ON requisicoes;
  DROP POLICY IF EXISTS "Insercao publica requisicoes" ON requisicoes;
  DROP POLICY IF EXISTS "Update publica requisicoes" ON requisicoes;
  DROP POLICY IF EXISTS "Leitura publica aprovacoes" ON aprovacoes;
  DROP POLICY IF EXISTS "Insercao publica aprovacoes" ON aprovacoes;
  DROP POLICY IF EXISTS "Update publica aprovacoes" ON aprovacoes;
  DROP POLICY IF EXISTS "Leitura publica obras" ON obras;
  DROP POLICY IF EXISTS "Leitura publica usuarios" ON usuarios;
  DROP POLICY IF EXISTS "Leitura publica alcadas" ON alcadas;
  DROP POLICY IF EXISTS "Leitura publica categorias" ON categorias_material;
  DROP POLICY IF EXISTS "Leitura publica compradores" ON compradores;
  DROP POLICY IF EXISTS "Leitura publica cotacoes" ON cotacoes;
  DROP POLICY IF EXISTS "Insercao publica cotacoes" ON cotacoes;
  DROP POLICY IF EXISTS "Update publica cotacoes" ON cotacoes;
  DROP POLICY IF EXISTS "Leitura publica cotacao_fornecedores" ON cotacao_fornecedores;
  DROP POLICY IF EXISTS "Insercao publica cotacao_fornecedores" ON cotacao_fornecedores;
  DROP POLICY IF EXISTS "Leitura publica atividades" ON atividades_log;
  DROP POLICY IF EXISTS "Service role full access requisicoes" ON requisicoes;
  DROP POLICY IF EXISTS "Service role full access aprovacoes" ON aprovacoes;
  DROP POLICY IF EXISTS "Service role full access usuarios" ON usuarios;
  DROP POLICY IF EXISTS "Service role full access atividades" ON atividades_log;
  DROP POLICY IF EXISTS "Requisicoes visiveis para autenticados" ON requisicoes;
  DROP POLICY IF EXISTS "Usuarios podem criar requisicoes" ON requisicoes;
  DROP POLICY IF EXISTS "Aprovacoes visiveis para autenticados" ON aprovacoes;
  DROP POLICY IF EXISTS "Log visivel para autenticados" ON atividades_log;
  DROP POLICY IF EXISTS "Categorias visiveis para todos" ON categorias_material;
  DROP POLICY IF EXISTS "Service role categorias" ON categorias_material;
  DROP POLICY IF EXISTS "Compradores visiveis para autenticados" ON compradores;
  DROP POLICY IF EXISTS "Service role compradores" ON compradores;
  DROP POLICY IF EXISTS "Cotacoes visiveis para autenticados" ON cotacoes;
  DROP POLICY IF EXISTS "Cotacoes inserir autenticados" ON cotacoes;
  DROP POLICY IF EXISTS "Cotacoes update autenticados" ON cotacoes;
  DROP POLICY IF EXISTS "Service role cotacoes" ON cotacoes;
  DROP POLICY IF EXISTS "Fornecedores visiveis para autenticados" ON cotacao_fornecedores;
  DROP POLICY IF EXISTS "Fornecedores inserir autenticados" ON cotacao_fornecedores;
  DROP POLICY IF EXISTS "Service role fornecedores" ON cotacao_fornecedores;
EXCEPTION WHEN others THEN NULL; END $$;

-- Politicas: acesso publico (anon) para leitura - frontend sem auth
CREATE POLICY "anon_read_requisicoes"    ON requisicoes          FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_requisicoes"  ON requisicoes          FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_requisicoes"  ON requisicoes          FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_read_aprovacoes"     ON aprovacoes           FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_aprovacoes"   ON aprovacoes           FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_aprovacoes"   ON aprovacoes           FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_read_usuarios"       ON usuarios             FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_categorias"     ON categorias_material  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_compradores"    ON compradores          FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_cotacoes"       ON cotacoes             FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_cotacoes"     ON cotacoes             FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_cotacoes"     ON cotacoes             FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_read_fornecedores"   ON cotacao_fornecedores FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_fornecedores" ON cotacao_fornecedores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_read_atividades"     ON atividades_log       FOR SELECT TO anon USING (true);

-- Service role: acesso total (para n8n)
CREATE POLICY "svc_all_requisicoes"   ON requisicoes          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_all_aprovacoes"    ON aprovacoes           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_all_usuarios"      ON usuarios             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_all_atividades"    ON atividades_log       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_all_categorias"    ON categorias_material  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_all_compradores"   ON compradores          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_all_cotacoes"      ON cotacoes             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_all_fornecedores"  ON cotacao_fornecedores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Permissao para anon executar a RPC
GRANT EXECUTE ON FUNCTION get_dashboard_compras(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION gerar_numero_requisicao() TO service_role;

-- ==========================
-- REALTIME
-- ==========================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE requisicoes;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE aprovacoes;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE cotacoes;
EXCEPTION WHEN others THEN NULL; END $$;

-- ==========================
-- VERIFICACAO FINAL
-- ==========================
SELECT
  (SELECT COUNT(*) FROM obras) as obras,
  (SELECT COUNT(*) FROM alcadas) as alcadas,
  (SELECT COUNT(*) FROM usuarios) as usuarios,
  (SELECT COUNT(*) FROM categorias_material) as categorias,
  (SELECT COUNT(*) FROM compradores) as compradores,
  (SELECT COUNT(*) FROM requisicoes) as requisicoes;

-- ============================================================
-- PRONTO! O retorno acima deve mostrar as contagens corretas.
-- ============================================================
