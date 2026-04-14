-- 082_frotas_itens_manutencao.sql — Preventive maintenance items tracking
-- Tables: fro_intervalos_preventiva (reference intervals) + fro_itens_manutencao (per-vehicle tracking)

-- 1. Reference table: standard maintenance intervals
CREATE TABLE IF NOT EXISTS fro_intervalos_preventiva (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_item        text UNIQUE NOT NULL,
  descricao        text NOT NULL,
  intervalo_km     integer NOT NULL,
  intervalo_meses  integer
);

-- 2. Per-vehicle maintenance item tracking
CREATE TABLE IF NOT EXISTS fro_itens_manutencao (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id         uuid NOT NULL REFERENCES fro_veiculos(id) ON DELETE CASCADE,
  tipo_item          text NOT NULL,
  km_ultima_troca    real DEFAULT 0,
  data_ultima_troca  date,
  km_proxima_troca   real,
  observacoes        text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE(veiculo_id, tipo_item)
);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_fro_itens_manutencao_veiculo ON fro_itens_manutencao(veiculo_id);

-- 4. RLS
ALTER TABLE fro_intervalos_preventiva ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_itens_manutencao ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY fro_intervalos_preventiva_auth ON fro_intervalos_preventiva
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY fro_itens_manutencao_auth ON fro_itens_manutencao
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER trg_updated_at_fro_itens_manutencao
    BEFORE UPDATE ON fro_itens_manutencao
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_fro();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Seed data
INSERT INTO fro_intervalos_preventiva (tipo_item, descricao, intervalo_km, intervalo_meses) VALUES
  ('oleo_motor',       'Oleo do Motor',       10000, 6),
  ('filtro_oleo',      'Filtro de Oleo',      10000, 6),
  ('filtro_ar',        'Filtro de Ar',        20000, 12),
  ('pneus',            'Pneus',               40000, 24),
  ('bateria',          'Bateria',             60000, 24),
  ('freios_pastilhas', 'Freios (Pastilhas)',  30000, 18),
  ('suspensao',        'Suspensao',           50000, 36),
  ('correia_dentada',  'Correia Dentada',     60000, 48),
  ('fluido_freio',     'Fluido de Freio',     40000, 24)
ON CONFLICT (tipo_item) DO NOTHING;
