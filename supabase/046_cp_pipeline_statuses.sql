-- Migration: CP Pipeline statuses — unified Contas a Pagar flow
-- Adds: 'confirmado', 'em_lote', 'em_pagamento' statuses
-- Removes (migrates): 'aprovado', 'aguardando_docs', 'aguardando_aprovacao', 'em_remessa'

-- 1. Migrate existing data to new statuses
UPDATE fin_contas_pagar SET status = 'confirmado'    WHERE status IN ('aguardando_aprovacao', 'aprovado');
UPDATE fin_contas_pagar SET status = 'previsto'      WHERE status = 'aguardando_docs';
UPDATE fin_contas_pagar SET status = 'em_pagamento'  WHERE status = 'em_remessa';

-- CPs that have a lote_id and are 'confirmado' should be 'em_lote'
UPDATE fin_contas_pagar SET status = 'em_lote' WHERE lote_id IS NOT NULL AND status = 'confirmado';

-- 2. Replace CHECK constraint with new statuses
ALTER TABLE fin_contas_pagar DROP CONSTRAINT IF EXISTS fin_contas_pagar_status_check;
ALTER TABLE fin_contas_pagar ADD CONSTRAINT fin_contas_pagar_status_check
  CHECK (status IN (
    'previsto','confirmado','em_lote',
    'aprovado_pgto','em_pagamento',
    'pago','conciliado','cancelado'
  ));

-- 3. Update trigger: when PO is released, set CP to 'confirmado' instead of 'aguardando_aprovacao'
CREATE OR REPLACE FUNCTION public.fn_atualizar_cp_ao_liberar()
RETURNS trigger AS $$
BEGIN
  IF NEW.status_pagamento = 'liberado' AND
     (OLD.status_pagamento IS DISTINCT FROM 'liberado') THEN
    UPDATE fin_contas_pagar
       SET status = 'confirmado'
     WHERE pedido_id = NEW.id
       AND status = 'previsto';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
