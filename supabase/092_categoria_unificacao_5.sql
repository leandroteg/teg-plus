-- 092_categoria_unificacao_5.sql
-- Unifica fro_categoria em 5 categorias finais (sem subcategorias):
-- Leve · Ônibus/Van · Pesados · Guindauto · Máquinas
-- Aplicada em 2026-04-26 via Supabase MCP.

ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'leve';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'onibus_van';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'pesados';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'maquinas';

UPDATE fro_veiculos SET categoria = 'leve'
  WHERE categoria IN ('passeio', 'pickup', 'moto');

UPDATE fro_veiculos SET categoria = 'onibus_van'
  WHERE categoria IN ('onibus', 'van');

UPDATE fro_veiculos SET categoria = 'pesados'
  WHERE categoria IN ('truck', 'carreta', 'vuc');

UPDATE fro_veiculos SET categoria = 'guindauto'
  WHERE categoria IN ('guindaste', 'munck');

UPDATE fro_veiculos SET categoria = 'maquinas'
  WHERE categoria IN ('trator', 'retro', 'motoniveladora', 'escavadeira',
                      'carregadeira', 'rolo_compactador', 'betoneira', 'outras_maquinas');
