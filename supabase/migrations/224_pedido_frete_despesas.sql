-- ─────────────────────────────────────────────────────────────────────────────
-- 224 — Frete e Despesas no Pedido Extraordinário (Pedido Direto)
--
-- O modal do Pedido Direto já tinha Desconto (cmp_pedidos.valor_desconto), mas
-- não tinha onde lançar frete e outras despesas (taxa de entrega, pedágio,
-- montagem...). Frete já existia na tabela (usado pela cotação); falta só a
-- coluna de despesas.
--
-- Total do pedido = subtotal dos itens + frete + despesas − desconto.
-- O cálculo é feito no frontend e gravado em valor_total (mesma regra que as
-- parcelas do Contas a Pagar já usam), então nada aqui recalcula nada.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cmp_pedidos
  ADD COLUMN IF NOT EXISTS valor_despesas NUMERIC DEFAULT 0;

COMMENT ON COLUMN cmp_pedidos.valor_despesas IS
  'Outras despesas somadas ao pedido (taxa de entrega, pedágio, montagem). Soma no total, junto com valor_frete e descontando valor_desconto.';
