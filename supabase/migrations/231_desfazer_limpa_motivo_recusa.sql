-- ─────────────────────────────────────────────────────────────────────────────
-- 231 — Desfazer recebimento também limpa a justificativa da recusa
--
-- A mig 226 criou cmp_pedidos_anexos.conferido_motivo, mas a RPC de desfazer
-- recebimento (mig 227) zera apenas conferido / conferido_por_nome /
-- conferido_em. O motivo da recusa sobrevivia: o anexo voltava para "pendente"
-- carregando a justificativa do ciclo anterior, e na reconferência aparecia
-- um motivo de recusa em documento que ninguém reprovou ainda.
--
-- Consertando junto o passivo: anexo pendente/aprovado não deve ter motivo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cmp_pedido_desfazer_recebimento(p_pedido_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ped   cmp_pedidos%ROWTYPE;
  v_nome  text;
  v_perfil_id uuid;
  v_item  RECORD;
  v_qtd_estornos int := 0;
  v_qtd_pat      int := 0;
  v_qtd_receb    int := 0;
BEGIN
  IF COALESCE(TRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo para desfazer o recebimento';
  END IF;

  SELECT nome, id INTO v_nome, v_perfil_id
  FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true LIMIT 1;

  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM sys_perfis p
    WHERE p.auth_id = auth.uid() AND p.ativo = true AND p.comprador = true
  )) THEN
    RAISE EXCEPTION 'Sem permissao: apenas admin ou comprador podem desfazer recebimento';
  END IF;

  SELECT * INTO v_ped FROM cmp_pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado'; END IF;
  IF v_ped.status NOT IN ('entregue', 'parcialmente_recebido') THEN
    RAISE EXCEPTION 'Pedido nao esta recebido (status=%)', v_ped.status;
  END IF;
  IF v_ped.status_pagamento IS NOT NULL THEN
    RAISE EXCEPTION 'Pagamento ja % — desfaca a liberacao/pagamento antes de voltar o recebimento',
      v_ped.status_pagamento;
  END IF;

  FOR v_item IN
    SELECT ri.*, r.base_id, r.nf_numero AS receb_nf
    FROM cmp_recebimento_itens ri
    JOIN cmp_recebimentos r ON r.id = ri.recebimento_id
    WHERE r.pedido_id = p_pedido_id
  LOOP
    IF v_item.tipo_destino = 'consumo'
       AND v_item.item_estoque_id IS NOT NULL
       AND v_item.status = 'confirmado'
       AND EXISTS (SELECT 1 FROM est_itens i WHERE i.id = v_item.item_estoque_id AND i.controle_estoque IS TRUE)
    THEN
      INSERT INTO est_movimentacoes (
        item_id, base_id, tipo, quantidade, valor_unitario,
        nf_numero, fornecedor_nome, responsavel_nome, responsavel_id, observacao
      ) VALUES (
        v_item.item_estoque_id, v_item.base_id, 'saida',
        v_item.quantidade_recebida, COALESCE(v_item.valor_unitario, 0),
        v_item.receb_nf, v_ped.fornecedor_nome,
        COALESCE(v_nome, 'Sistema'), v_perfil_id,
        'ESTORNO de recebimento do pedido ' || COALESCE(v_ped.numero_pedido, p_pedido_id::text) || ': ' || TRIM(p_motivo)
      );
      v_qtd_estornos := v_qtd_estornos + 1;
    END IF;

    IF v_item.tipo_destino = 'patrimonial' THEN
      BEGIN
        DELETE FROM pat_imobilizados WHERE recebimento_item_id = v_item.id;
        GET DIAGNOSTICS v_qtd_pat = ROW_COUNT;
      EXCEPTION WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Item patrimonial gerado por este recebimento ja possui vinculos (cautela/movimentacao) — trate o ativo no Patrimonial antes de desfazer';
      END;
    END IF;
  END LOOP;

  DELETE FROM cmp_recebimento_itens ri
  USING cmp_recebimentos r
  WHERE ri.recebimento_id = r.id AND r.pedido_id = p_pedido_id;
  DELETE FROM cmp_recebimentos WHERE pedido_id = p_pedido_id;
  GET DIAGNOSTICS v_qtd_receb = ROW_COUNT;

  UPDATE cmp_pedidos SET
    status = 'emitido',
    data_entrega_real = NULL,
    qtd_itens_recebidos = 0,
    nf_numero = NULL,
    docs_conferidos = NULL,
    docs_conferidos_por_nome = NULL,
    docs_conferidos_em = NULL,
    devolucao_motivo = TRIM(p_motivo),
    devolucao_por_nome = COALESCE(v_nome, 'Financeiro'),
    devolucao_em = now()
  WHERE id = p_pedido_id;

  -- conferido_motivo entra aqui (mig 231): sem isso o anexo voltava pendente
  -- carregando a justificativa da recusa anterior.
  UPDATE cmp_pedidos_anexos SET
    conferido = NULL,
    conferido_por_nome = NULL,
    conferido_em = NULL,
    conferido_motivo = NULL
  WHERE pedido_id = p_pedido_id
    AND (conferido IS NOT NULL OR conferido_motivo IS NOT NULL);

  IF v_ped.requisicao_id IS NOT NULL THEN
    INSERT INTO cmp_historico_status
      (requisicao_id, status_anterior, status_novo, responsavel_nome, responsavel_tipo, observacao)
    VALUES
      (v_ped.requisicao_id, v_ped.status, 'emitido', COALESCE(v_nome, 'Comprador'), 'comprador',
       'Recebimento do pedido ' || COALESCE(v_ped.numero_pedido, '') || ' desfeito: ' || TRIM(p_motivo));
  END IF;

  RETURN jsonb_build_object(
    'recebimentos_removidos', v_qtd_receb,
    'estornos_estoque', v_qtd_estornos,
    'patrimoniais_removidos', v_qtd_pat
  );
END;
$function$;

-- Passivo: motivo de recusa em anexo que não está reprovado.
UPDATE cmp_pedidos_anexos
   SET conferido_motivo = NULL
 WHERE conferido_motivo IS NOT NULL
   AND conferido IS DISTINCT FROM false;
