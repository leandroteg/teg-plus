-- 213_lote_desfazer.sql
-- Desfazer lote de pagamento (pedido do user 04/ago).
--
-- Até aqui, montado o lote, só dava para tirar título por título no detalhe ou
-- pedir para alguém mexer no banco. O lote passa a poder ser desfeito de uma vez:
-- os títulos voltam para Confirmados e o lote fica registrado como cancelado
-- (nunca apagado — o número já circulou em aprovação/relatório).
--
-- Travas: só lote que ainda não virou dinheiro (montando / enviado_aprovacao /
-- parcialmente_aprovado / aprovado) e sem nenhum título pago, conciliado ou em
-- pagamento. Aprovação pendente no AprovAí expira junto.
-- Idempotente.

CREATE OR REPLACE FUNCTION public.fin_lote_desfazer(
  p_lote_id uuid,
  p_motivo  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lote      fin_lotes_pagamento%ROWTYPE;
  v_quem      text;
  v_bloqueio  int;
  v_liberados int;
BEGIN
  SELECT * INTO v_lote FROM fin_lotes_pagamento WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado.';
  END IF;

  IF v_lote.status = 'cancelado' THEN
    RAISE EXCEPTION 'Lote % já está desfeito.', v_lote.numero_lote;
  END IF;

  IF v_lote.status NOT IN ('montando','enviado_aprovacao','parcialmente_aprovado','aprovado') THEN
    RAISE EXCEPTION 'Lote % está em % — não pode mais ser desfeito.', v_lote.numero_lote, v_lote.status;
  END IF;

  -- Nenhum título pode ter avançado para pagamento
  SELECT count(*) INTO v_bloqueio
    FROM fin_lote_itens i
    JOIN fin_contas_pagar cp ON cp.id = i.cp_id
   WHERE i.lote_id = p_lote_id
     AND cp.status IN ('em_pagamento','pago','conciliado');
  IF v_bloqueio > 0 THEN
    RAISE EXCEPTION 'Lote % tem % título(s) em pagamento ou já pagos — desfazer exige estorno.',
      v_lote.numero_lote, v_bloqueio;
  END IF;

  SELECT nome INTO v_quem FROM sys_perfis WHERE auth_id = auth.uid();

  -- Títulos voltam para Confirmados, soltos do lote
  UPDATE fin_contas_pagar cp
     SET status     = 'confirmado',
         lote_id    = NULL,
         updated_at = now()
   WHERE cp.id IN (SELECT i.cp_id FROM fin_lote_itens i WHERE i.lote_id = p_lote_id)
     AND cp.status NOT IN ('cancelado','pago','conciliado');
  GET DIAGNOSTICS v_liberados = ROW_COUNT;

  DELETE FROM fin_lote_itens WHERE lote_id = p_lote_id;

  -- Some do AprovAí
  UPDATE apr_aprovacoes
     SET status = 'expirada',
         data_decisao = now(),
         observacao = COALESCE(observacao || ' | ', '') || 'Lote desfeito pelo Financeiro'
   WHERE entidade_id = p_lote_id
     AND status IN ('pendente','esclarecimento');

  UPDATE fin_lotes_pagamento
     SET status      = 'cancelado',
         qtd_itens   = 0,
         valor_total = 0,
         observacao  = COALESCE(observacao || ' | ', '')
                       || 'Desfeito por ' || COALESCE(v_quem, 'Financeiro')
                       || COALESCE(': ' || nullif(btrim(p_motivo), ''), ''),
         updated_at  = now()
   WHERE id = p_lote_id;

  RETURN jsonb_build_object(
    'lote', v_lote.numero_lote,
    'titulos_liberados', v_liberados
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fin_lote_desfazer(uuid, text) TO authenticated;
