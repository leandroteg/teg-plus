-- 235_cp_devolvido_bloqueia_lote.sql
-- Título devolvido para correção não pode entrar em lote de pagamento.
--
-- A mig 211 diz que a devolução "trava o avanço até alguém resolver", mas na
-- prática a trava existia só no botão Confirmar (previsto → confirmado). O
-- avanço a partir de Confirmados é "Adicionar ao Lote", que não checava nada:
-- um título devolvido entrava em lote e seguia para pagamento.
--
-- A montagem do lote é feita no cliente (sem RPC), então a trava mora aqui —
-- o bloqueio no frontend é só a mensagem amigável. Idempotente.

CREATE OR REPLACE FUNCTION public.fn_trg_cp_bloqueia_lote_devolvido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.lote_id IS NOT NULL
     AND OLD.lote_id IS DISTINCT FROM NEW.lote_id
     AND NEW.devolucao_motivo IS NOT NULL THEN
    RAISE EXCEPTION 'Título de % está devolvido para correção — resolva a pendência antes de incluir em lote.', NEW.fornecedor_nome;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_cp_bloqueia_lote_devolvido ON public.fin_contas_pagar;
CREATE TRIGGER trg_cp_bloqueia_lote_devolvido
  BEFORE UPDATE ON public.fin_contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_cp_bloqueia_lote_devolvido();
