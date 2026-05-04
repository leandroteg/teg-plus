-- 094: Subcategoria livre em veiculos + status_detalhe livre em OS
-- Aplicada 2026-05-04 via Supabase MCP. Nao-destrutiva.

ALTER TABLE fro_veiculos
  ADD COLUMN IF NOT EXISTS subcategoria text;

ALTER TABLE fro_ordens_servico
  ADD COLUMN IF NOT EXISTS status_detalhe text;

CREATE INDEX IF NOT EXISTS idx_fro_veiculos_subcategoria
  ON fro_veiculos (subcategoria) WHERE subcategoria IS NOT NULL;

-- Backfill subcategorias por placa (planilha BEP_TEG ATIVOS OBRAS) — 82 veiculos
-- Importacao das 7 OS abertas da planilha BEP feitas via SQL direto no MCP.

COMMENT ON COLUMN fro_veiculos.subcategoria IS
  'Subcategoria livre granular (Pick-up Leve/Media, Caminhao 3/4/Pesado, Furgao, Implemento etc). Categoria principal continua em fro_veiculos.categoria (5 grupos finais).';

COMMENT ON COLUMN fro_ordens_servico.status_detalhe IS
  'Texto livre detalhando status atual (AGUARDANDO ORCAMENTO, PNEUS MONTADOS, FORNECEDOR EM DESLOCAMENTO etc). Complementa fro_ordens_servico.status (enum).';
