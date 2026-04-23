-- Adiciona rastreamento de usuário de criação e última alteração em cmp_pedidos
ALTER TABLE cmp_pedidos
  ADD COLUMN IF NOT EXISTS criado_por_nome    TEXT,
  ADD COLUMN IF NOT EXISTS atualizado_por_nome TEXT;
