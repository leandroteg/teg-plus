-- 089_fro_categoria_expandir.sql
-- Adiciona categorias de máquinas pesadas / equipamentos de obra civil
-- ao enum fro_categoria. Não-destrutivo: valores existentes preservados.
-- Aplicada em 2026-04-26 via Supabase MCP.

ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'guindauto';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'guindaste';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'retro';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'betoneira';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'escavadeira';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'motoniveladora';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'rolo_compactador';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'carregadeira';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'trator';
ALTER TYPE fro_categoria ADD VALUE IF NOT EXISTS 'munck';
