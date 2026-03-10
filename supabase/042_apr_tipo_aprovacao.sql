-- 042: Add tipo_aprovacao to apr_aprovacoes for multi-type approval support
-- Values: requisicao_compra, cotacao, autorizacao_pagamento, minuta_contratual

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apr_aprovacoes' AND column_name = 'tipo_aprovacao'
  ) THEN
    ALTER TABLE apr_aprovacoes
      ADD COLUMN tipo_aprovacao VARCHAR(50) NOT NULL DEFAULT 'requisicao_compra';

    COMMENT ON COLUMN apr_aprovacoes.tipo_aprovacao IS
      'Tipo de aprovação: requisicao_compra | cotacao | autorizacao_pagamento | minuta_contratual';
  END IF;
END $$;

-- Backfill existing rows (all are requisicao_compra from cmp module)
UPDATE apr_aprovacoes
SET tipo_aprovacao = 'requisicao_compra'
WHERE tipo_aprovacao IS NULL OR tipo_aprovacao = 'requisicao_compra';

-- Index for filtering by tipo_aprovacao
CREATE INDEX IF NOT EXISTS idx_apr_aprovacoes_tipo
  ON apr_aprovacoes(tipo_aprovacao);

-- Composite index for the pendentes query
CREATE INDEX IF NOT EXISTS idx_apr_aprovacoes_status_tipo
  ON apr_aprovacoes(status, tipo_aprovacao);
