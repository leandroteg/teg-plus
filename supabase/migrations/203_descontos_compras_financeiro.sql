-- 203_descontos_compras_financeiro.sql
-- Descontos no fluxo de compra e pagamento (pedido do user 2026-08-03):
--   1. Desconto COMERCIAL: negociado na cotação (por fornecedor), herdado pelo pedido
--      (inclusive Pedido Extraordinário). Custo entregue = produtos + frete − desconto.
--   2. Desconto FINANCEIRO na baixa: desconto por antecipação + juros/multa por atraso.
--      valor_pago = valor_original − valor_desconto + valor_juros_multa.
-- Idempotente (prod + homolog).

-- ── 1. Colunas ───────────────────────────────────────────────────────────────
ALTER TABLE public.cmp_cotacao_fornecedores
  ADD COLUMN IF NOT EXISTS valor_desconto numeric NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.cmp_cotacao_fornecedores.valor_desconto IS
  'Desconto comercial (R$) sobre o total da proposta. Custo entregue = produtos + frete − desconto.';

ALTER TABLE public.cmp_pedidos
  ADD COLUMN IF NOT EXISTS valor_frete    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.cmp_pedidos.valor_desconto IS
  'Desconto comercial herdado da proposta vencedora (ou informado no Pedido Direto). valor_total já é líquido.';
COMMENT ON COLUMN public.cmp_pedidos.valor_frete IS
  'Frete da proposta vencedora. Junto com valor_desconto compõe o quadro Subtotal/Frete/Desconto/Total do PDF.';

ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS valor_desconto    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_juros_multa numeric NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.fin_contas_pagar.valor_desconto IS
  'Desconto financeiro obtido na baixa (ex.: antecipação). valor_pago = valor_original − desconto + juros/multa.';
COMMENT ON COLUMN public.fin_contas_pagar.valor_juros_multa IS
  'Juros/multa pagos na baixa (atraso). valor_pago = valor_original − desconto + juros/multa.';

-- ── 2. Baixa em lote considera desconto/juros carimbados na CP ───────────────
CREATE OR REPLACE FUNCTION public.rpc_registrar_pagamento_batch(p_cp_ids text[], p_data_pagamento date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT;
BEGIN
  UPDATE fin_contas_pagar
  SET status = 'pago',
      valor_pago = COALESCE(NULLIF(valor_pago, 0),
                            valor_original - COALESCE(valor_desconto, 0) + COALESCE(valor_juros_multa, 0)),
      data_pagamento = p_data_pagamento,
      remessa_status = CASE
        WHEN status = 'em_pagamento' THEN 'confirmada_manual'
        WHEN remessa_id IS NOT NULL THEN COALESCE(remessa_status, 'confirmada_manual')
        ELSE COALESCE(remessa_status, 'nao_enviada')
      END,
      updated_at = now()
  WHERE id = ANY(p_cp_ids::uuid[])
    AND status IN ('aprovado_pgto', 'em_pagamento');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ── 3. Baixa via pedido (status_pagamento='pago') também grava valor_pago líquido ──
CREATE OR REPLACE FUNCTION public.atualizar_cp_ao_liberar_pagamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Compras liberou o pedido para pagamento → CP vai para 'confirmado'
  -- (aguarda autorização do financeiro na aba Confirmados)
  IF NEW.status_pagamento = 'liberado'
     AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento != 'liberado')
  THEN
    UPDATE fin_contas_pagar
    SET
      status     = 'confirmado',
      updated_at = now()
    WHERE pedido_id = NEW.id
      AND status IN ('previsto', 'aguardando_aprovacao');
  END IF;

  -- Financeiro confirmou pagamento → marca CP como paga com o valor líquido
  IF NEW.status_pagamento = 'pago'
     AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento != 'pago')
  THEN
    UPDATE fin_contas_pagar
    SET
      status         = 'pago',
      valor_pago     = COALESCE(NULLIF(valor_pago, 0),
                                valor_original - COALESCE(valor_desconto, 0) + COALESCE(valor_juros_multa, 0)),
      data_pagamento = CURRENT_DATE,
      updated_at     = now()
    WHERE pedido_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
