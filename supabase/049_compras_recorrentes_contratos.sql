-- Migration 049: Compras recorrentes integradas com Contratos

ALTER TABLE cmp_requisicoes
  ADD COLUMN IF NOT EXISTS compra_recorrente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_mensal numeric(15,2),
  ADD COLUMN IF NOT EXISTS contrato_solicitacao_id uuid REFERENCES con_solicitacoes(id),
  ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES con_contratos(id);

ALTER TABLE cmp_pedidos
  ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES con_contratos(id);

CREATE INDEX IF NOT EXISTS idx_cmp_requisicoes_compra_recorrente
  ON cmp_requisicoes (compra_recorrente);

CREATE INDEX IF NOT EXISTS idx_cmp_requisicoes_contrato_solicitacao
  ON cmp_requisicoes (contrato_solicitacao_id);

CREATE INDEX IF NOT EXISTS idx_cmp_requisicoes_contrato
  ON cmp_requisicoes (contrato_id);

CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_contrato
  ON cmp_pedidos (contrato_id);
