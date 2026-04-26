-- 085_telemetria_multi_provedor.sql
-- Suporte multi-provedor de telemetria (Cobli + Mobi7 + futuros)
-- Aplicada em 2026-04-26 via Supabase MCP. Não-destrutiva: dados Cobli existentes
-- ficam marcados com provider='cobli' via DEFAULT.

-- 1. Coluna provider em tel_posicoes / tel_eventos
ALTER TABLE tel_posicoes
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'cobli';
ALTER TABLE tel_eventos
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'cobli';

-- 2. Índices por (provider, ts)
CREATE INDEX IF NOT EXISTS idx_tel_pos_provider_ts
  ON tel_posicoes (provider, cobli_ts DESC);
CREATE INDEX IF NOT EXISTS idx_tel_ev_provider_ts
  ON tel_eventos (provider, cobli_ts DESC);

-- 3. UNIQUE parcial para dedup só em providers de PULL (Mobi7)
--    Cobli (push) mantém comportamento atual sem constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_tel_pos_mobi7
  ON tel_posicoes (veiculo_id, cobli_ts)
  WHERE provider = 'mobi7' AND veiculo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tel_ev_mobi7
  ON tel_eventos (veiculo_id, tipo_evento, cobli_ts)
  WHERE provider = 'mobi7' AND veiculo_id IS NOT NULL;

-- 4. Mapeamento de IDs externos em fro_veiculos
--    Estrutura: {"cobli": "...", "mobi7": "uuid-da-mobi7", ...}
ALTER TABLE fro_veiculos
  ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_fro_external_ids
  ON fro_veiculos USING GIN (external_ids);

-- 5. Recria view tel_ultima_posicao incluindo provider
DROP VIEW IF EXISTS tel_ultima_posicao;
CREATE VIEW tel_ultima_posicao AS
SELECT DISTINCT ON (veiculo_id)
  veiculo_id, placa, latitude, longitude, velocidade, ignicao, hodometro, cobli_ts, provider
FROM tel_posicoes
ORDER BY veiculo_id, cobli_ts DESC;

-- 6. Tabela de cursor para sync incremental (providers de PULL)
CREATE TABLE IF NOT EXISTS tel_sync_state (
  provider          text NOT NULL,
  veiculo_id        uuid REFERENCES fro_veiculos(id) ON DELETE CASCADE,
  endpoint          text NOT NULL,
  last_arrival_ts   timestamptz,
  last_event_ts     timestamptz,
  last_synced_at    timestamptz NOT NULL DEFAULT now(),
  rows_last_batch   integer DEFAULT 0,
  PRIMARY KEY (provider, veiculo_id, endpoint)
);
ALTER TABLE tel_sync_state ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tel_sync_state_all" ON tel_sync_state
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE tel_sync_state IS
  'Cursor de sincronização incremental por provider/veículo/endpoint. Usado por workflows pull-based (Mobi7).';
COMMENT ON COLUMN tel_posicoes.provider IS
  'Origem da telemetria: cobli, mobi7, ... DEFAULT cobli para compatibilidade.';
COMMENT ON COLUMN tel_eventos.provider IS
  'Origem da telemetria: cobli, mobi7, ... DEFAULT cobli para compatibilidade.';
COMMENT ON COLUMN fro_veiculos.external_ids IS
  'IDs do veículo em sistemas externos. Ex.: {"cobli":"...","mobi7":"uuid"}';
