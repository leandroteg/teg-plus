-- Fix #146: Unify rpc_registrar_pagamento_batch — remove ambiguous overloads
-- Old state: two overloads (text[], uuid[]) with different status checks
-- New state: single text[] version with full status support + valor_pago

DROP FUNCTION IF EXISTS rpc_registrar_pagamento_batch(uuid[], date);
DROP FUNCTION IF EXISTS rpc_registrar_pagamento_batch(text[], date);

CREATE OR REPLACE FUNCTION rpc_registrar_pagamento_batch(
  p_cp_ids TEXT[],
  p_data_pagamento DATE DEFAULT CURRENT_DATE
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE fin_contas_pagar
  SET status = 'pago',
      valor_pago = COALESCE(NULLIF(valor_pago, 0), valor_original),
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
$$;

ALTER FUNCTION rpc_registrar_pagamento_batch(text[], date) SET search_path = public;
