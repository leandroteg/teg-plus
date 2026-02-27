-- ============================================================
-- TEG+ | Schema de Compras e Aprovações
-- Sistema TEG Plus - TEG União Engenharia
-- Executar no Supabase SQL Editor
-- ============================================================

-- ==========================
-- EXTENSÕES
-- ==========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================
-- ENUM TYPES
-- ==========================
CREATE TYPE status_requisicao AS ENUM (
  'rascunho',
  'pendente',
  'em_aprovacao',
  'aprovada',
  'rejeitada',
  'em_cotacao',
  'comprada',
  'cancelada'
);

CREATE TYPE status_aprovacao AS ENUM (
  'pendente',
  'aprovada',
  'rejeitada',
  'expirada'
);

CREATE TYPE urgencia_tipo AS ENUM (
  'normal',
  'urgente',
  'critica'
);

-- ==========================
-- TABELA: obras (Canteiros)
-- ==========================
CREATE TABLE obras (
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

-- Obras iniciais do portfólio TEG
INSERT INTO obras (codigo, nome, municipio) VALUES
  ('FRUTAL', 'SE Frutal', 'Frutal'),
  ('PARACATU', 'SE Paracatu', 'Paracatu'),
  ('PERDIZES', 'SE Perdizes', 'Perdizes'),
  ('TRESMARIAS', 'SE Três Marias', 'Três Marias'),
  ('RIOPAR', 'SE Rio Paranaíba', 'Rio Paranaíba'),
  ('ITUIUTABA', 'SE Ituiutaba', 'Ituiutaba');

-- ==========================
-- TABELA: usuarios
-- ==========================
CREATE TABLE usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID UNIQUE, -- referência ao Supabase Auth
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  cargo VARCHAR(100),
  departamento VARCHAR(100),
  obra_id UUID REFERENCES obras(id),
  nivel_alcada INT DEFAULT 0, -- 0=sem alçada, 1=coord, 2=gerente, 3=diretor, 4=ceo
  ativo BOOLEAN DEFAULT true,
  telefone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================
-- TABELA: alcadas (Alçadas de Aprovação)
-- ==========================
CREATE TABLE alcadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nivel INT UNIQUE NOT NULL, -- 1, 2, 3, 4
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  valor_min DECIMAL(15,2) DEFAULT 0,
  valor_max DECIMAL(15,2),
  aprovador_padrao_id UUID REFERENCES usuarios(id),
  prazo_horas INT DEFAULT 48, -- prazo para aprovar
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alçadas padrão TEG
INSERT INTO alcadas (nivel, nome, descricao, valor_min, valor_max, prazo_horas) VALUES
  (1, 'Coordenador', 'Aprovação de compras até R$ 5.000', 0, 5000, 24),
  (2, 'Gerente', 'Aprovação de compras de R$ 5.001 a R$ 25.000', 5000.01, 25000, 48),
  (3, 'Diretor', 'Aprovação de compras de R$ 25.001 a R$ 100.000', 25000.01, 100000, 72),
  (4, 'CEO', 'Aprovação de compras acima de R$ 100.000', 100000.01, NULL, 72);

-- ==========================
-- TABELA: requisicoes (Requisições de Compra)
-- ==========================
CREATE TABLE requisicoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero VARCHAR(20) UNIQUE NOT NULL, -- RC-202602-0001

  -- Solicitante
  solicitante_id UUID REFERENCES usuarios(id),
  solicitante_nome VARCHAR(255) NOT NULL,

  -- Obra / Centro de Custo
  obra_id UUID REFERENCES obras(id),
  obra_nome VARCHAR(255),
  centro_custo VARCHAR(100),

  -- Detalhes
  descricao TEXT NOT NULL,
  justificativa TEXT,
  categoria VARCHAR(100), -- material, equipamento, serviço, epi

  -- Valores
  valor_estimado DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Prioridade e Status
  urgencia urgencia_tipo DEFAULT 'normal',
  status status_requisicao DEFAULT 'pendente',

  -- Alçada
  alcada_nivel INT NOT NULL DEFAULT 1,
  alcada_atual INT DEFAULT 1, -- nível atual de aprovação em andamento

  -- Datas
  data_necessidade DATE,
  data_aprovacao TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================
-- TABELA: requisicao_itens
-- ==========================
CREATE TABLE requisicao_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id UUID NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,

  descricao VARCHAR(500) NOT NULL,
  quantidade DECIMAL(10,2) NOT NULL,
  unidade VARCHAR(20) NOT NULL DEFAULT 'un', -- un, kg, m, m², m³, L, pç

  valor_unitario_estimado DECIMAL(15,2) DEFAULT 0,
  valor_total_estimado DECIMAL(15,2) GENERATED ALWAYS AS (quantidade * valor_unitario_estimado) STORED,

  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================
-- TABELA: aprovacoes
-- ==========================
CREATE TABLE aprovacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id UUID NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,

  -- Aprovador
  aprovador_id UUID REFERENCES usuarios(id),
  aprovador_nome VARCHAR(255) NOT NULL,
  aprovador_email VARCHAR(255) NOT NULL,

  -- Nível
  nivel INT NOT NULL,
  alcada_id UUID REFERENCES alcadas(id),

  -- Decisão
  status status_aprovacao DEFAULT 'pendente',
  observacao TEXT,

  -- Token único para link de aprovação (WhatsApp/Email)
  token VARCHAR(100) UNIQUE NOT NULL DEFAULT 'apr-' || gen_random_uuid()::text,

  -- Datas
  data_limite TIMESTAMPTZ,
  data_decisao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================
-- TABELA: atividades_log (Audit Trail)
-- ==========================
CREATE TABLE atividades_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Referências
  requisicao_id UUID REFERENCES requisicoes(id),
  aprovacao_id UUID REFERENCES aprovacoes(id),

  -- Atividade
  tipo VARCHAR(50) NOT NULL, -- criacao, envio_aprovacao, aprovacao, rejeicao, notificacao, cancelamento
  descricao TEXT,

  -- Quem fez
  usuario_id UUID REFERENCES usuarios(id),
  usuario_nome VARCHAR(255),

  -- Dados extras
  dados JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================
-- TABELA: configuracoes
-- ==========================
CREATE TABLE configuracoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT,
  tipo VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
  descricao TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO configuracoes (chave, valor, tipo, descricao) VALUES
  ('sequencial_requisicao', '0', 'number', 'Último número sequencial de requisição'),
  ('url_aprovacao', 'https://teg-plus.app/aprovacao', 'string', 'URL base para links de aprovação'),
  ('notificacao_whatsapp', 'true', 'boolean', 'Enviar notificações via WhatsApp'),
  ('notificacao_email', 'true', 'boolean', 'Enviar notificações via Email'),
  ('prazo_padrao_aprovacao_horas', '48', 'number', 'Prazo padrão para aprovação em horas');

-- ==========================
-- INDEXES
-- ==========================
CREATE INDEX idx_requisicoes_status ON requisicoes(status);
CREATE INDEX idx_requisicoes_obra ON requisicoes(obra_id);
CREATE INDEX idx_requisicoes_solicitante ON requisicoes(solicitante_id);
CREATE INDEX idx_requisicoes_created ON requisicoes(created_at DESC);
CREATE INDEX idx_requisicoes_numero ON requisicoes(numero);
CREATE INDEX idx_aprovacoes_requisicao ON aprovacoes(requisicao_id);
CREATE INDEX idx_aprovacoes_token ON aprovacoes(token);
CREATE INDEX idx_aprovacoes_status ON aprovacoes(status);
CREATE INDEX idx_aprovacoes_aprovador ON aprovacoes(aprovador_email);
CREATE INDEX idx_atividades_requisicao ON atividades_log(requisicao_id);
CREATE INDEX idx_atividades_tipo ON atividades_log(tipo);

-- ==========================
-- FUNCTIONS
-- ==========================

-- Função para gerar número sequencial de requisição
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

-- Função para determinar nível de alçada pelo valor
CREATE OR REPLACE FUNCTION determinar_alcada(valor DECIMAL)
RETURNS INT AS $$
BEGIN
  IF valor > 100000 THEN RETURN 4; -- CEO
  ELSIF valor > 25000 THEN RETURN 3; -- Diretor
  ELSIF valor > 5000 THEN RETURN 2;  -- Gerente
  ELSE RETURN 1;                      -- Coordenador
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_requisicoes_updated
  BEFORE UPDATE ON requisicoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_usuarios_updated
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_obras_updated
  BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================
-- VIEWS para Dashboard
-- ==========================

-- View: Resumo de requisições por status
CREATE OR REPLACE VIEW vw_dashboard_requisicoes AS
SELECT
  status,
  COUNT(*) as total,
  COALESCE(SUM(valor_estimado), 0) as valor_total,
  COALESCE(AVG(valor_estimado), 0) as valor_medio
FROM requisicoes
WHERE created_at >= date_trunc('month', now())
GROUP BY status;

-- View: Requisições com detalhes de aprovação
CREATE OR REPLACE VIEW vw_requisicoes_completas AS
SELECT
  r.*,
  a.nome as alcada_nome,
  ap.status as aprovacao_status,
  ap.aprovador_nome as aprovador_atual,
  ap.data_limite as aprovacao_data_limite
FROM requisicoes r
LEFT JOIN alcadas a ON a.nivel = r.alcada_nivel
LEFT JOIN aprovacoes ap ON ap.requisicao_id = r.id
  AND ap.nivel = r.alcada_atual
  AND ap.status = 'pendente';

-- View: KPIs do mês
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

-- View: Requisições por obra
CREATE OR REPLACE VIEW vw_requisicoes_por_obra AS
SELECT
  obra_nome,
  obra_id,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'em_aprovacao') as em_aprovacao,
  COUNT(*) FILTER (WHERE status = 'aprovada') as aprovadas,
  COUNT(*) FILTER (WHERE status = 'rejeitada') as rejeitadas,
  COALESCE(SUM(valor_estimado), 0) as valor_total
FROM requisicoes
WHERE created_at >= date_trunc('month', now())
GROUP BY obra_nome, obra_id;

-- ==========================
-- ROW LEVEL SECURITY (RLS)
-- ==========================
ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Policy: Todos autenticados podem ver requisições
CREATE POLICY "Requisições visíveis para autenticados"
  ON requisicoes FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Usuários podem criar requisições
CREATE POLICY "Usuários podem criar requisições"
  ON requisicoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Service role pode tudo (para n8n)
CREATE POLICY "Service role full access requisicoes"
  ON requisicoes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access aprovacoes"
  ON aprovacoes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access atividades"
  ON atividades_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access usuarios"
  ON usuarios FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Aprovações visíveis para autenticados
CREATE POLICY "Aprovações visíveis para autenticados"
  ON aprovacoes FOR SELECT
  TO authenticated
  USING (true);

-- Log visível para autenticados
CREATE POLICY "Log visível para autenticados"
  ON atividades_log FOR SELECT
  TO authenticated
  USING (true);

-- ==========================
-- REALTIME (para dashboard live)
-- ==========================
ALTER PUBLICATION supabase_realtime ADD TABLE requisicoes;
ALTER PUBLICATION supabase_realtime ADD TABLE aprovacoes;

-- ============================================================
-- FIM DO SCHEMA
-- Próximo passo: Configurar credenciais Supabase no n8n
-- ============================================================
