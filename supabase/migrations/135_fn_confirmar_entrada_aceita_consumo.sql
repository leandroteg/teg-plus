-- ─────────────────────────────────────────────────────────────────────────────
-- 135_fn_confirmar_entrada_aceita_consumo.sql
--
-- Ajuste na fn_confirmar_entrada_estoque (mig 125): RecebimentoModal traduz
-- cmp_requisicao_itens.destino_operacional='estoque' para
-- cmp_recebimento_itens.tipo_destino='consumo'. A RPC original só aceitava
-- 'estoque' ou 'almoxarifado', o que faria itens reais cairem em "puladas"
-- silenciosamente quando o primeiro recebimento de material chegasse.
--
-- Esta versão aceita 'consumo' como sinônimo. Demais comportamentos iguais.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_confirmar_entrada_estoque(p_item_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_confirmados INT := 0;
  v_puladas     INT := 0;
  v_item RECORD;
BEGIN
  IF p_item_ids IS NULL OR cardinality(p_item_ids) = 0 THEN
    RETURN jsonb_build_object('confirmados', 0, 'puladas', 0);
  END IF;

  FOR v_item IN
    SELECT
      ri.id, ri.item_estoque_id, ri.quantidade_recebida, ri.valor_unitario,
      ri.lote, ri.numero_serie, ri.data_validade, ri.tipo_destino, ri.status,
      r.base_id, r.nf_numero, r.data_recebimento,
      p.fornecedor_nome, p.numero_pedido,
      req.obra_nome
    FROM cmp_recebimento_itens ri
    LEFT JOIN cmp_recebimentos r ON r.id = ri.recebimento_id
    LEFT JOIN cmp_pedidos p ON p.id = r.pedido_id
    LEFT JOIN cmp_requisicoes req ON req.id = p.requisicao_id
    WHERE ri.id = ANY(p_item_ids)
  LOOP
    IF v_item.status IS DISTINCT FROM 'aguardando_entrada' THEN
      v_puladas := v_puladas + 1;
      CONTINUE;
    END IF;

    IF v_item.item_estoque_id IS NULL THEN
      v_puladas := v_puladas + 1;
      UPDATE cmp_recebimento_itens SET status = 'confirmado' WHERE id = v_item.id;
      CONTINUE;
    END IF;

    -- Aceita 'consumo' como sinonimo de 'estoque' (traducao do RecebimentoModal).
    IF v_item.tipo_destino IS NOT NULL
       AND v_item.tipo_destino NOT IN ('estoque', 'almoxarifado', 'consumo') THEN
      v_puladas := v_puladas + 1;
      UPDATE cmp_recebimento_itens SET status = 'confirmado' WHERE id = v_item.id;
      CONTINUE;
    END IF;

    INSERT INTO est_movimentacoes (
      item_id, base_id, tipo,
      quantidade, valor_unitario, valor_total,
      nf_numero, fornecedor_nome, obra_nome,
      lote, numero_serie, data_validade,
      recebimento_item_id, observacao
    ) VALUES (
      v_item.item_estoque_id,
      v_item.base_id,
      'entrada'::est_tipo_mov,
      coalesce(v_item.quantidade_recebida, 0),
      coalesce(v_item.valor_unitario, 0),
      coalesce(v_item.quantidade_recebida, 0) * coalesce(v_item.valor_unitario, 0),
      v_item.nf_numero,
      v_item.fornecedor_nome,
      v_item.obra_nome,
      nullif(v_item.lote, ''),
      nullif(v_item.numero_serie, ''),
      v_item.data_validade,
      v_item.id,
      format('Entrada automatica do pedido %s', coalesce(v_item.numero_pedido, '?'))
    );

    UPDATE cmp_recebimento_itens
    SET status = 'confirmado'
    WHERE id = v_item.id;

    v_confirmados := v_confirmados + 1;
  END LOOP;

  RETURN jsonb_build_object('confirmados', v_confirmados, 'puladas', v_puladas);
END;
$function$;

COMMENT ON FUNCTION public.fn_confirmar_entrada_estoque(uuid[]) IS
  'Confirma itens de recebimento e gera est_movimentacoes (tipo=entrada). v2 (mig 135): aceita tipo_destino IN (estoque, almoxarifado, consumo) — alinhado ao RecebimentoModal.';
