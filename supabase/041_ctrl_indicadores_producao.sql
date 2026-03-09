-- 041: Indicadores de Produção para Painel Executivo
-- Tabela para armazenar indicadores unitários de produção por obra/mês

CREATE TABLE IF NOT EXISTS ctrl_indicadores_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES sys_obras(id),
  mes date NOT NULL,
  tipo_indicador text NOT NULL,
  categoria text NOT NULL,
  label text NOT NULL,
  valor_unitario numeric(12,2),
  volume numeric(12,2),
  custo_total numeric(12,2),
  pct_faturamento numeric(5,2),
  unidade text,
  detalhe text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ctrl_indicadores_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read" ON ctrl_indicadores_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all" ON ctrl_indicadores_producao FOR ALL TO authenticated USING (true) WITH CHECK (true);
