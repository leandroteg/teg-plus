-- Adiciona campo marca/fabricante nos itens de requisição
ALTER TABLE cmp_requisicao_itens ADD COLUMN IF NOT EXISTS marca VARCHAR(200);
