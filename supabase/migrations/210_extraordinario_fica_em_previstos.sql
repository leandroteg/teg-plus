-- 210_extraordinario_fica_em_previstos.sql
-- Pedido Extraordinário (sem_cotacao = true) deve PERMANECER em Previstos no
-- Contas a Pagar (pedido do user 04/ago).
--
-- Como era: a CP nasce em 'previsto' e o trigger fn_oficializa_cp_no_recebimento
-- promovia para 'confirmado' assim que o pedido virava entregue/parcialmente
-- recebido — mesmo sem ter passado por cotação e aprovação formal.
--
-- Como fica: o recebimento oficializa apenas a CP de pedido COM cotação. Para o
-- extraordinário, a saída de Previstos passa a exigir ato explícito — "Liberar
-- Pagamento" no Compras (trigger atualizar_cp_ao_liberar_pagamento, inalterado)
-- ou a confirmação manual do Financeiro no próprio pipeline.
-- Idempotente.

CREATE OR REPLACE FUNCTION public.fn_oficializa_cp_no_recebimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Extraordinário não é oficializado pelo recebimento: fica em Previstos até
  -- alguém liberar/confirmar de propósito.
  IF COALESCE(NEW.sem_cotacao, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text IN ('entregue','parcialmente_recebido')
     AND COALESCE(OLD.status::text,'') <> NEW.status::text THEN
    UPDATE fin_contas_pagar
       SET status = 'confirmado', updated_at = now()
     WHERE pedido_id = NEW.id AND status = 'previsto';
  END IF;
  RETURN NEW;
END;
$function$;
