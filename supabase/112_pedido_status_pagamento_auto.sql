-- 112: Sincroniza cmp_pedidos.status_pagamento com base no estado das CPs (fin_contas_pagar)
-- Regras:
--   * Se TODAS as CPs do pedido estao em ('pago','conciliado') -> 'pago'
--   * Caso contrario, se alguma CP saiu de 'previsto' (e nao 'cancelado') -> 'liberado'
--   * Caso contrario, mantem NULL
-- Nao regredimos um pedido ja 'pago' (uma vez encerrado, permanece encerrado).

CREATE OR REPLACE FUNCTION fn_pedido_sync_status_pagamento(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total      int;
  v_pagos      int;
  v_avancadas  int;
  v_current    text;
  v_new        text;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('pago','conciliado')),
    count(*) FILTER (WHERE status NOT IN ('previsto','cancelado'))
  INTO v_total, v_pagos, v_avancadas
  FROM fin_contas_pagar
  WHERE pedido_id = p_pedido_id;

  IF v_total = 0 THEN RETURN; END IF;

  SELECT status_pagamento INTO v_current FROM cmp_pedidos WHERE id = p_pedido_id;

  IF v_pagos = v_total THEN
    v_new := 'pago';
  ELSIF v_avancadas > 0 THEN
    v_new := 'liberado';
  ELSE
    v_new := NULL;
  END IF;

  IF v_current = 'pago' AND v_new IS DISTINCT FROM 'pago' THEN
    RETURN;
  END IF;

  IF v_new IS DISTINCT FROM v_current THEN
    UPDATE cmp_pedidos
       SET status_pagamento = v_new,
           pago_em = CASE WHEN v_new = 'pago' AND pago_em IS NULL THEN now() ELSE pago_em END
     WHERE id = p_pedido_id;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION fn_trg_cp_sync_pedido_pagamento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fn_pedido_sync_status_pagamento(OLD.pedido_id);
    RETURN OLD;
  END IF;

  PERFORM fn_pedido_sync_status_pagamento(NEW.pedido_id);

  IF TG_OP = 'UPDATE' AND OLD.pedido_id IS DISTINCT FROM NEW.pedido_id THEN
    PERFORM fn_pedido_sync_status_pagamento(OLD.pedido_id);
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_cp_sync_pedido_pagamento ON fin_contas_pagar;
CREATE TRIGGER trg_cp_sync_pedido_pagamento
AFTER INSERT OR UPDATE OF status, pedido_id OR DELETE
ON fin_contas_pagar
FOR EACH ROW
EXECUTE FUNCTION fn_trg_cp_sync_pedido_pagamento();

-- Backfill: aplica a regra em todos os pedidos que tem CPs
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT pedido_id FROM fin_contas_pagar WHERE pedido_id IS NOT NULL LOOP
    PERFORM fn_pedido_sync_status_pagamento(r.pedido_id);
  END LOOP;
END
$$;
