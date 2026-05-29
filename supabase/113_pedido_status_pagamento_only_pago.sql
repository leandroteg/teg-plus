-- 113: Ajuste do trigger 112.
-- Anteriormente o trigger setava 'liberado' assim que qualquer CP saisse de 'previsto',
-- o que fazia pedidos pularem de Emitido/Entregue para Encerrado sem o clique do comprador.
-- Agora o trigger SO promove para 'pago' quando todas as CPs estao pagas/conciliadas.
-- O status 'liberado' fica reservado para o clique do comprador (useLiberarPagamento).

CREATE OR REPLACE FUNCTION fn_pedido_sync_status_pagamento(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total      int;
  v_pagos      int;
  v_current    text;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('pago','conciliado'))
  INTO v_total, v_pagos
  FROM fin_contas_pagar
  WHERE pedido_id = p_pedido_id;

  IF v_total = 0 THEN RETURN; END IF;

  SELECT status_pagamento INTO v_current FROM cmp_pedidos WHERE id = p_pedido_id;

  IF v_pagos = v_total AND v_current IS DISTINCT FROM 'pago' THEN
    UPDATE cmp_pedidos
       SET status_pagamento = 'pago',
           pago_em = coalesce(pago_em, now())
     WHERE id = p_pedido_id;
  END IF;
END
$$;

-- Reverter pedidos que foram setados 'liberado' pelo trigger antigo sem clique do comprador
UPDATE cmp_pedidos
   SET status_pagamento = NULL
 WHERE status_pagamento = 'liberado'
   AND liberado_pagamento_em IS NULL
   AND liberado_pagamento_por IS NULL;
