-- Migration 031: Cache de consultas externas (CNPJ via BrasilAPI, CEP via BrasilAPI)
-- TTL padrão: 7 dias

CREATE TABLE IF NOT EXISTS cache_consultas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('cnpj','cep')),
  chave text NOT NULL,
  dados jsonb NOT NULL,
  consultado_em timestamptz DEFAULT now(),
  expira_em timestamptz DEFAULT now() + interval '7 days',
  UNIQUE(tipo, chave)
);

-- Index para lookup rápido
CREATE INDEX idx_cache_consultas_lookup ON cache_consultas(tipo, chave);

-- Index para limpeza de expirados
CREATE INDEX idx_cache_consultas_expira ON cache_consultas(expira_em);

-- RLS
ALTER TABLE cache_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cache"
  ON cache_consultas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cache"
  ON cache_consultas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cache"
  ON cache_consultas FOR UPDATE
  TO authenticated
  USING (true);

-- Permitir acesso anon para n8n webhooks
CREATE POLICY "Anon can read cache"
  ON cache_consultas FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert cache"
  ON cache_consultas FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can upsert cache"
  ON cache_consultas FOR UPDATE
  TO anon
  USING (true);
