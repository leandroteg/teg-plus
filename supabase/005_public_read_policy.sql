-- ============================================================
-- TEG+ | Politicas de leitura publica (anon key)
-- Permite o frontend React acessar dados sem autenticacao
-- Executar APOS os scripts 001 a 004
-- ============================================================

-- Requisicoes
CREATE POLICY "Leitura publica requisicoes" ON requisicoes
  FOR SELECT TO anon USING (true);

CREATE POLICY "Insercao publica requisicoes" ON requisicoes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Update publica requisicoes" ON requisicoes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Requisicao itens
CREATE POLICY "Leitura publica itens" ON requisicao_itens
  FOR SELECT TO anon USING (true);

CREATE POLICY "Insercao publica itens" ON requisicao_itens
  FOR INSERT TO anon WITH CHECK (true);

-- Aprovacoes
CREATE POLICY "Leitura publica aprovacoes" ON aprovacoes
  FOR SELECT TO anon USING (true);

CREATE POLICY "Insercao publica aprovacoes" ON aprovacoes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Update publica aprovacoes" ON aprovacoes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Obras
CREATE POLICY "Leitura publica obras" ON obras
  FOR SELECT TO anon USING (true);

-- Usuarios
CREATE POLICY "Leitura publica usuarios" ON usuarios
  FOR SELECT TO anon USING (true);

-- Alcadas
CREATE POLICY "Leitura publica alcadas" ON alcadas
  FOR SELECT TO anon USING (true);

-- Categorias
CREATE POLICY "Leitura publica categorias" ON categorias_material
  FOR SELECT TO anon USING (true);

-- Compradores
CREATE POLICY "Leitura publica compradores" ON compradores
  FOR SELECT TO anon USING (true);

-- Cotacoes
CREATE POLICY "Leitura publica cotacoes" ON cotacoes
  FOR SELECT TO anon USING (true);

CREATE POLICY "Insercao publica cotacoes" ON cotacoes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Update publica cotacoes" ON cotacoes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Cotacao fornecedores
CREATE POLICY "Leitura publica cotacao_fornecedores" ON cotacao_fornecedores
  FOR SELECT TO anon USING (true);

CREATE POLICY "Insercao publica cotacao_fornecedores" ON cotacao_fornecedores
  FOR INSERT TO anon WITH CHECK (true);

-- Atividades log
CREATE POLICY "Leitura publica atividades" ON atividades_log
  FOR SELECT TO anon USING (true);

-- RPC: permitir anon executar get_dashboard_compras
GRANT EXECUTE ON FUNCTION get_dashboard_compras(TEXT, UUID) TO anon;

-- ============================================================
-- FIM
-- ============================================================
