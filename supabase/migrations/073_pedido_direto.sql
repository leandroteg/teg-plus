-- Pedido Direto: permite emissão de pedido sem RC e sem cotação
ALTER TABLE cmp_pedidos ADD COLUMN IF NOT EXISTS sem_cotacao BOOLEAN DEFAULT false;
ALTER TABLE cmp_pedidos ADD COLUMN IF NOT EXISTS justificativa_sem_cotacao TEXT;
ALTER TABLE cmp_pedidos ADD COLUMN IF NOT EXISTS itens_direto JSONB;

-- Marca/Fabricante por item de RC
ALTER TABLE cmp_requisicao_itens ADD COLUMN IF NOT EXISTS marca VARCHAR(200);

-- Planilha/arquivo de referência anexado pelo solicitante
ALTER TABLE cmp_requisicoes ADD COLUMN IF NOT EXISTS arquivo_url TEXT;
