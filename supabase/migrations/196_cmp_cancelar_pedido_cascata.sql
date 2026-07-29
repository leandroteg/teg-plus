-- 196_cmp_cancelar_pedido_cascata.sql
-- Item 2: cancelamento de PEDIDO de compra, com cascata para o Financeiro (CP).
--
-- Regras (confirmadas):
--   • Quem cancela: flag sys_perfis.pode_cancelar_pedido (hoje só o Claudionor —
--     supervisor de Compras). Estrita, validada no servidor. NÃO é por papel
--     (senão pegaria a Eleni também). Marcável no AdminUsuarios.
--   • Só cancela pedido em estágio inicial: emitido / confirmado / em_entrega.
--     De parcialmente_recebido em diante bloqueia (já entrou mercadoria/estoque).
--   • Cascata: cancela os CP (fin_contas_pagar) do pedido DIRETO, sem passar pela
--     fila da Naira/Jackeline/Lauany — a decisão já foi tomada no pedido.
--   • Se QUALQUER CP do pedido já estiver pago/conciliado: BLOQUEIA (é estorno,
--     Fase 2). Nada de cancelar por cima de pagamento realizado.
-- Idempotente.

-- ── 1. Flag de quem pode cancelar pedido ─────────────────────────────────────
ALTER TABLE public.sys_perfis
  ADD COLUMN IF NOT EXISTS pode_cancelar_pedido boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.sys_perfis.pode_cancelar_pedido IS
  'Pode cancelar pedido de compra (supervisor de Compras). Cancela o pedido e cascateia o cancelamento dos CP não-liquidados.';

-- ── 2. Campos de auditoria do cancelamento no pedido ─────────────────────────
ALTER TABLE public.cmp_pedidos
  ADD COLUMN IF NOT EXISTS cancelamento_justificativa text,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por_nome text;

-- ── 3. RPC de cancelamento com cascata ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cmp_cancelar_pedido(
  p_pedido_id     uuid,
  p_justificativa text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil_id   uuid;
  v_perfil_nome text;
  v_pode        boolean;
  v_status      text;
  v_pagas       int;
  v_cps         int;
BEGIN
  IF coalesce(btrim(p_justificativa),'') = '' THEN
    RAISE EXCEPTION 'Justificativa do cancelamento é obrigatória.';
  END IF;

  SELECT id, nome, coalesce(pode_cancelar_pedido,false)
    INTO v_perfil_id, v_perfil_nome, v_pode
    FROM public.sys_perfis WHERE auth_id = auth.uid();
  IF v_perfil_id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  IF NOT v_pode THEN
    RAISE EXCEPTION 'Sem permissão para cancelar pedido de compra.';
  END IF;

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

-- ── 4. Habilita o Claudionor (supervisor de Compras) ─────────────────────────
UPDATE public.sys_perfis
  SET pode_cancelar_pedido = true
  WHERE lower(email) = 'claudionor.junior@teguniao.com.br';
