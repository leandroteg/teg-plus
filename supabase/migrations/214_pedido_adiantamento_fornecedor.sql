-- ─────────────────────────────────────────────────────────────────────────────
-- 214_pedido_adiantamento_fornecedor.sql
--
-- Compras > Nova Solicitação ganhou um segundo atalho sem cotação:
-- "Adiantamento a Fornecedor" (sinal / pagamento antecipado).
--
-- Mesmos campos do Extraordinário — muda só a natureza do gasto e o destino:
-- o extraordinário espera a conferência de documentos pelo Compras (mig 212),
-- o adiantamento não tem entrega para conferir e cai confirmado no Financeiro.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cmp_pedidos ADD COLUMN IF NOT EXISTS tipo_pedido text;

COMMENT ON COLUMN public.cmp_pedidos.tipo_pedido IS
  'Sabor do pedido sem cotação: extraordinario (emergência) | adiantamento_fornecedor (pagamento antecipado). NULL nos pedidos vindos de cotação.';

UPDATE public.cmp_pedidos
   SET tipo_pedido = 'extraordinario'
 WHERE sem_cotacao IS TRUE
   AND tipo_pedido IS NULL;
