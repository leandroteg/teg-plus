-- ============================================================
-- TEG+ | Schema Cotacoes, Categorias e Compradores
-- Extensao do modulo de compras com IA + cotacao + ApprovaAi
-- Executar no Supabase SQL Editor APOS 001_schema_compras.sql
-- ============================================================

-- ==========================
-- TABELA: categorias_material
-- ==========================
CREATE TABLE categorias_material (
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
  ('consumo', 'Material de Consumo', ARRAY['papel','toner','limpeza','agua','combustivel','diesel','gasolina','oleo','graxa','solvente','tinta','spray'], '#6b7280', 'Package');

-- ==========================
-- TABELA: compradores
-- ==========================
CREATE TABLE compradores (
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
  ('Ricardo Santos', 'ricardo.santos@teguniao.com.br', '(34) 99654-3210', ARRAY['epi','servicos']);

-- ==========================
-- TABELA: cotacoes
-- ==========================
CREATE TABLE cotacoes (
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

-- ==========================
-- TABELA: cotacao_fornecedores
-- ==========================
CREATE TABLE cotacao_fornecedores (
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
-- ALTER requisicoes (novas colunas)
-- ==========================
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS comprador_id UUID REFERENCES compradores(id);
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS texto_original TEXT;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS ai_confianca DECIMAL(3,2);

-- ==========================
-- INDEXES
-- ==========================
CREATE INDEX idx_cotacoes_requisicao ON cotacoes(requisicao_id);
CREATE INDEX idx_cotacoes_comprador ON cotacoes(comprador_id);
CREATE INDEX idx_cotacoes_status ON cotacoes(status);
CREATE INDEX idx_cotacao_fornecedores_cotacao ON cotacao_fornecedores(cotacao_id);
CREATE INDEX idx_compradores_categorias ON compradores USING GIN(categorias);
CREATE INDEX idx_categorias_keywords ON categorias_material USING GIN(keywords);
CREATE INDEX idx_requisicoes_categoria ON requisicoes(categoria);
CREATE INDEX idx_requisicoes_comprador ON requisicoes(comprador_id);

-- ==========================
-- RLS
-- ==========================
ALTER TABLE categorias_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE compradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacao_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias visiveis para todos" ON categorias_material FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role categorias" ON categorias_material FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Compradores visiveis para autenticados" ON compradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role compradores" ON compradores FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Cotacoes visiveis para autenticados" ON cotacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cotacoes inserir autenticados" ON cotacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Cotacoes update autenticados" ON cotacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role cotacoes" ON cotacoes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Fornecedores visiveis para autenticados" ON cotacao_fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Fornecedores inserir autenticados" ON cotacao_fornecedores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role fornecedores" ON cotacao_fornecedores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==========================
-- TRIGGER updated_at cotacoes
-- ==========================
CREATE TRIGGER tr_cotacoes_updated
  BEFORE UPDATE ON cotacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================
-- REALTIME
-- ==========================
ALTER PUBLICATION supabase_realtime ADD TABLE cotacoes;

-- ============================================================
-- FIM DO SCHEMA COTACOES
-- ============================================================
