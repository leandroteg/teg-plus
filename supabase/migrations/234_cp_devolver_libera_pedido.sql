-- 234_cp_devolver_libera_pedido.sql
-- Devolver título do Contas a Pagar passa a devolver TAMBÉM o pedido para a
-- aba "Entregue" em Pedidos.
--
-- Antes: a devolução só marcava a CP (mig 211). O pedido continuava com
-- status_pagamento='liberado', e a aba Entregue exige status_pagamento
-- diferente de 'liberado'/'pago' — então o pedido ficava parado em "Encerrado"
-- e o Compras nunca via que tinha algo para corrigir.
--
-- Agora a devolução desfaz a liberação do comprador (status_pagamento = NULL),
-- que é exatamente o gesto inverso do "Liberar pagamento". Seguro contra o
-- trigger fn_pedido_sync_status_pagamento: ele só promove para 'pago' quando
-- TODAS as CPs do pedido estão pagas, e nunca escreve 'liberado'.
--
-- A CP em si NÃO é cancelada — quem decide o destino do título é o Financeiro,
-- na mão (decisão do user 05/ago). Idempotente.

CREATE OR REPLACE FUNCTION public.fin_cp_devolver_correcao(
  p_cp_id  uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cp        fin_contas_pagar%ROWTYPE;
  v_autor     text;
  v_auth_id   uuid;
  v_quem      text;
  v_numero    text;
  v_pedido_volta boolean := false;
BEGIN
  IF coalesce(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Descreva a inconsistência para devolver o título.';
  END IF;

  SELECT * INTO v_cp FROM fin_contas_pagar WHERE id = p_cp_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_cp.status NOT IN ('previsto', 'confirmado') THEN
    RAISE EXCEPTION 'Só é possível devolver título em Previstos ou Confirmados (atual: %).', v_cp.status;
  END IF;
  IF v_cp.lote_id IS NOT NULL THEN
    RAISE EXCEPTION 'Título já está em lote de pagamento — remova do lote antes de devolver.';
  END IF;

  -- Autor: o do pedido quando houver (extraordinário), senão o da própria CP
  SELECT COALESCE(p.criado_por_nome, v_cp.criado_por_nome), p.numero_pedido
    INTO v_autor, v_numero
    FROM cmp_pedidos p WHERE p.id = v_cp.pedido_id;
  IF v_autor IS NULL THEN
    v_autor := v_cp.criado_por_nome;
  END IF;

  SELECT nome INTO v_quem FROM sys_perfis WHERE auth_id = auth.uid();

  UPDATE fin_contas_pagar
     SET devolucao_motivo    = btrim(p_motivo),
         devolvido_em        = now(),
         devolvido_por       = COALESCE(v_quem, 'Financeiro'),
         devolvido_para_nome = v_autor,
         updated_at          = now()
   WHERE id = p_cp_id;

  -- Desfaz a liberação de pagamento: o pedido reaparece na aba Entregue.
  -- 'pago' não é tocado — pedido já pago não volta por devolução de título.
  IF v_cp.pedido_id IS NOT NULL THEN
    UPDATE cmp_pedidos
       SET status_pagamento = NULL
     WHERE id = v_cp.pedido_id
       AND status_pagamento = 'liberado';
    v_pedido_volta := FOUND;
  END IF;

  -- Aviso in-app para o autor (best-effort: sem perfil casado, segue sem notificar)
  SELECT auth_id INTO v_auth_id
    FROM sys_perfis
   WHERE nome = v_autor AND ativo = true AND auth_id IS NOT NULL
   LIMIT 1;

  IF v_auth_id IS NOT NULL THEN
    INSERT INTO sys_notif_queue (user_id, titulo, corpo, url, origem, origem_id, dedupe_key)
    VALUES (
      v_auth_id,
      'Título devolvido para correção',
      COALESCE(v_numero || ' — ', '') || v_cp.fornecedor_nome || ': ' || btrim(p_motivo),
      CASE WHEN v_pedido_volta THEN '/pedidos' ELSE '/financeiro/contas-a-pagar' END,
      'fin_cp_devolucao',
      p_cp_id,
      'fin_cp_devolucao:' || p_cp_id::text || ':' || extract(epoch from now())::bigint
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'devolvido_para', v_autor,
    'notificado', v_auth_id IS NOT NULL,
    'pedido_voltou_entregue', v_pedido_volta,
    'numero_pedido', v_numero
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fin_cp_devolver_correcao(uuid, text) TO authenticated;
