-- =============================================================================
-- 049: Flags de controle estoque/patrimonio em est_itens
--      + justificativa_destino em cmp_recebimento_itens
--      + item_estoque_id em cmp_requisicao_itens
-- =============================================================================

-- 1. Flags no catalogo de itens
ALTER TABLE est_itens
  ADD COLUMN IF NOT EXISTS controle_estoque    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS controle_patrimonio BOOLEAN DEFAULT false;

COMMENT ON COLUMN est_itens.controle_estoque
  IS 'Se true, item entra no fluxo de estoque (consumo) ao ser recebido';
COMMENT ON COLUMN est_itens.controle_patrimonio
  IS 'Se true, item entra no fluxo patrimonial (imobilizado) ao ser recebido';

-- 2. Justificativa quando usuario altera o destino padrao no recebimento
ALTER TABLE cmp_recebimento_itens
  ADD COLUMN IF NOT EXISTS justificativa_destino TEXT;

COMMENT ON COLUMN cmp_recebimento_itens.justificativa_destino
  IS 'Obrigatoria quando tipo_destino difere do cadastro do item';

-- 3. Vinculo opcional da requisicao ao catalogo de itens
ALTER TABLE cmp_requisicao_itens
  ADD COLUMN IF NOT EXISTS item_estoque_id UUID REFERENCES est_itens(id);

CREATE INDEX IF NOT EXISTS idx_cmp_req_itens_estoque
  ON cmp_requisicao_itens (item_estoque_id);
