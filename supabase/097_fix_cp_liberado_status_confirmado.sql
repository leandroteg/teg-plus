-- =============================================================================
-- 097: Corrige trigger de liberação de pagamento
--      Quando pedido é "Liberado p/ Pagamento", a CP passa para 'confirmado'
--      (aparece na aba Confirmados do Contas a Pagar) em vez de
--      'aguardando_aprovacao' (status sem suporte no frontend).
-- =============================================================================

CREATE OR REPLACE FUNCTION atualizar_cp_ao_liberar_pagamento()
RETURNS TRIGGER AS $$
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

  -- Financeiro confirmou pagamento → marca CP como paga
  IF NEW.status_pagamento = 'pago'
     AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento != 'pago')
  THEN
    UPDATE fin_contas_pagar
    SET
      status         = 'pago',
      data_pagamento = CURRENT_DATE,
      updated_at     = now()
    WHERE pedido_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
