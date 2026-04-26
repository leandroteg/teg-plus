-- 087_match_mobi7_veiculos.sql
-- Mapeia 13 veículos Mobi7 a fro_veiculos via placa
-- e marca veículos com dados Cobli existentes em external_ids->>'cobli'
-- Aplicada em 2026-04-26 via Supabase MCP.

-- 1. Match Mobi7 ↔ fro_veiculos por placa (13 veículos)
WITH mobi7 (placa, mobi7_id) AS (VALUES
  ('TXG6C92', 'ad519d3b-d898-48ab-aa9e-fc3dc2a2d382'),
  ('TXG6C97', '1fd526b9-a687-4d15-94aa-9b55652e6107'),
  ('TXG6C98', '3796aa02-0ecd-4a89-8bef-2363a5580e7d'),
  ('TXP0F63', '6e26257f-e6d8-402d-b336-f0e774b2220e'),
  ('TXP4C99', 'e37c888b-e005-441f-9135-5984ea7b45e6'),
  ('TXP4D00', '94da0ab9-f19e-4572-820b-a96af44e4f1e'),
  ('TXP4D01', '8d111238-0acd-48b7-83d8-4ce1d7573f49'),
  ('TXS6J75', '20550833-ec96-4802-847f-73e75ee92c21'),
  ('TXS6J78', '98435fdf-6868-40d2-b642-6f8fe00be597'),
  ('TXT7H61', 'f7e5ef79-eff5-4466-b9a7-6ef7a0b8b674'),
  ('TXT7H75', '7070a36c-51fb-49e2-a49c-b30fc8eb73c2'),
  ('TXU0F42', '7a7ab116-7643-4b1c-82d7-b2e1a34d84f5'),
  ('TXY4B59', 'acaef6d1-c640-4a0e-9f0b-75623bb9f023')
)
UPDATE fro_veiculos fv
   SET external_ids = jsonb_set(
     COALESCE(fv.external_ids, '{}'::jsonb),
     '{mobi7}',
     to_jsonb(m.mobi7_id)
   )
  FROM mobi7 m
 WHERE fv.placa = m.placa
   AND COALESCE(fv.external_ids, '{}'::jsonb) ->> 'mobi7' IS DISTINCT FROM m.mobi7_id;

-- 2. Backfill: marca external_ids->>'cobli' nos veículos com dados Cobli
WITH veic_cobli AS (
  SELECT DISTINCT veiculo_id
  FROM tel_posicoes
  WHERE provider = 'cobli' AND veiculo_id IS NOT NULL
)
UPDATE fro_veiculos fv
SET external_ids = jsonb_set(
  COALESCE(fv.external_ids, '{}'::jsonb),
  '{cobli}',
  to_jsonb(fv.placa)
)
FROM veic_cobli vc
WHERE fv.id = vc.veiculo_id
  AND NOT (fv.external_ids ? 'cobli');
