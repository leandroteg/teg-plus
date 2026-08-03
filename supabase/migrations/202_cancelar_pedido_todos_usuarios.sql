-- 202_cancelar_pedido_todos_usuarios.sql
-- Cancelamento de pedido liberado para TODOS os usuários (decisão 03/ago/2026;
-- antes era restrito à flag sys_perfis.pode_cancelar_pedido — mig 196).
-- Travas que PERMANECEM (não são de permissão):
--   • só estágio emitido / confirmado / em_entrega;
--   • justificativa obrigatória;
--   • bloqueia se qualquer CP do pedido já estiver paga/conciliada (estorno = Fase 2).
-- A coluna pode_cancelar_pedido fica no schema (sem efeito) para eventual re-restrição.
-- Idempotente.

CREATE OR REPLACE FUNCTION public.cmp_cancelar_pedido(
  p_pedido_id     uuid,
  p_justificativa text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil_id   uuid;
  v_perfil_nome text;
  v_status      text;
  v_pagas       int;
  v_cps         int;
BEGIN
  IF coalesce(btrim(p_justificativa),'') = '' THEN
    RAISE EXCEPTION 'Justificativa do cancelamento é obrigatória.';
  END IF;

  SELECT id, nome
    INTO v_perfil_id, v_perfil_nome
    FROM public.sys_perfis WHERE auth_id = auth.uid();
  IF v_perfil_id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;

  SELECT status INTO v_status FROM public.cmp_pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Pedido já está cancelado.'; END IF;
  IF v_status NOT IN ('emitido','confirmado','em_entrega') THEN
    RAISE EXCEPTION 'Pedido não pode ser cancelado neste estágio (%). Recebimento/pagamento já iniciado.', v_status;
  END IF;

  -- Trava: nenhum CP do pedido pode estar liquidado (senão é estorno, Fase 2).
  SELECT count(*) INTO v_pagas
    FROM public.fin_contas_pagar
    WHERE pedido_id = p_pedido_id AND status IN ('pago','conciliado');
  IF v_pagas > 0 THEN
    RAISE EXCEPTION 'Pedido tem % lançamento(s) financeiro(s) já pago(s)/conciliado(s) — cancelamento exige estorno (indisponível nesta fase).', v_pagas;
  END IF;

  -- Cascata: cancela os CP não-liquidados do pedido.
  UPDATE public.fin_contas_pagar
    SET status = 'cancelado', cancelamento_pendente = false
    WHERE pedido_id = p_pedido_id AND status NOT IN ('cancelado','pago','conciliado');
  GET DIAGNOSTICS v_cps = ROW_COUNT;

  -- Resolve solicitações de cancelamento pendentes desses CP (ficaram sem efeito).
  UPDATE public.fin_cancelamentos c
    SET status = 'aprovado', decidido_por_id = v_perfil_id, decidido_por_nome = v_perfil_nome,
        decidido_em = now(), motivo_recusa = 'Cancelado em cascata pelo cancelamento do pedido'
    WHERE c.tipo_doc = 'cp' AND c.status = 'pendente'
      AND c.doc_id IN (SELECT id FROM public.fin_contas_pagar WHERE pedido_id = p_pedido_id);

  -- Marca o pedido como cancelado.
  UPDATE public.cmp_pedidos
    SET status = 'cancelado',
        cancelamento_justificativa = btrim(p_justificativa),
        cancelado_em = now(),
        cancelado_por_nome = v_perfil_nome
    WHERE id = p_pedido_id;

  RETURN jsonb_build_object('pedido_id', p_pedido_id, 'cps_canceladas', v_cps);
END; $$;

GRANT EXECUTE ON FUNCTION public.cmp_cancelar_pedido(uuid, text) TO authenticated;
