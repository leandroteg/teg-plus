-- 084: Intervalos preventiva por categoria de veículo
-- Permite definir intervalos diferentes para cada tipo (passeio, truck, etc.)

-- Adicionar coluna categoria (NULL = padrão global)
ALTER TABLE fro_intervalos_preventiva ADD COLUMN IF NOT EXISTS categoria text;

-- Remover constraint única antiga (tipo_item sozinho)
ALTER TABLE fro_intervalos_preventiva DROP CONSTRAINT IF EXISTS fro_intervalos_preventiva_tipo_item_key;

-- Nova constraint: tipo_item + categoria (permite override por categoria)
-- COALESCE pra tratar NULL como '__default__' na constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_intervalos_tipo_cat
  ON fro_intervalos_preventiva (tipo_item, COALESCE(categoria, '__default__'));

-- Seed: overrides pra truck/carreta (intervalos maiores)
INSERT INTO fro_intervalos_preventiva (tipo_item, descricao, intervalo_km, intervalo_meses, categoria) VALUES
  ('oleo_motor',       'Óleo do Motor',       15000, 6,  'truck'),
  ('filtro_oleo',      'Filtro de Óleo',      15000, 6,  'truck'),
  ('filtro_ar',        'Filtro de Ar',         30000, 12, 'truck'),
  ('pneus',            'Pneus',               60000, 24, 'truck'),
  ('bateria',          'Bateria',              80000, 30, 'truck'),
  ('freios_pastilhas', 'Freios (Pastilhas)',   40000, 18, 'truck'),
  ('suspensao',        'Suspensão',            80000, 36, 'truck'),
  ('correia_dentada',  'Correia Dentada',      80000, 48, 'truck'),
  ('fluido_freio',     'Fluido de Freio',      50000, 24, 'truck'),
  ('oleo_motor',       'Óleo do Motor',       15000, 6,  'carreta'),
  ('filtro_oleo',      'Filtro de Óleo',      15000, 6,  'carreta'),
  ('filtro_ar',        'Filtro de Ar',         30000, 12, 'carreta'),
  ('pneus',            'Pneus',               60000, 24, 'carreta'),
  ('bateria',          'Bateria',              80000, 30, 'carreta'),
  ('freios_pastilhas', 'Freios (Pastilhas)',   40000, 18, 'carreta'),
  ('suspensao',        'Suspensão',            80000, 36, 'carreta'),
  ('correia_dentada',  'Correia Dentada',      80000, 48, 'carreta'),
  ('fluido_freio',     'Fluido de Freio',      50000, 24, 'carreta')
ON CONFLICT DO NOTHING;
