-- Novo estado da RC: aguardando_catalogo
-- Solicitante criou com item(s) sem est_item_id (descricao livre).
-- Em vez de mandar pro aprovador com descricao livre, segura na fila do
-- comprador ate vinculo de catalogo. Quando todos os itens estiverem
-- com est_item_id, comprador clica "Enviar para Aprovacao" e vira em_aprovacao.

ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'aguardando_catalogo';
