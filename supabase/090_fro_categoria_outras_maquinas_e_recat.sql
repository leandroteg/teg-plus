-- 090_fro_categoria_outras_maquinas_e_recat.sql
-- 1) Adiciona "outras_maquinas" ao enum (catch-all p/ motoniveladora etc)
-- 2) Recategoriza veículos cadastrados como 'truck' que NÃO eram caminhões
-- Aplicada em 2026-04-26 via Supabase MCP.

-- Adiciona enum
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'outras_maquinas';

-- 5 Tratores Valtra (BH140/BH180/BH210i) -> trator
UPDATE fro_veiculos SET categoria = 'trator'
WHERE categoria = 'truck' AND marca = 'VALTRA' AND modelo LIKE 'BH%';

-- 4 Retroescavadeiras -> retro
UPDATE fro_veiculos SET categoria = 'retro'
WHERE categoria = 'truck' AND (
  (marca = 'JCB' AND modelo = '3CX') OR
  (marca = 'JOHN DEERE' AND modelo = '310L') OR
  (marca = 'NEW HOLLAND' AND modelo = 'B95C')
);

-- 1 Motoniveladora XCMG BR300 -> outras_maquinas
UPDATE fro_veiculos SET categoria = 'outras_maquinas'
WHERE categoria = 'truck' AND marca = 'XCMG' AND modelo = 'BR300';

-- 1 Micro-onibus Marcopolo Volare V8L -> onibus
UPDATE fro_veiculos SET categoria = 'onibus'
WHERE categoria = 'truck' AND marca = 'MARCOPOLO' AND modelo = 'VOLARE V8L';
