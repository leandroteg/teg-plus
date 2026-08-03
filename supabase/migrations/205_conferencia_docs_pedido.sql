-- 205_conferencia_docs_pedido.sql
-- Conferência de documentos (NF/boleto/anexos) no pedido entregue, antes de
-- liberar para pagamento. Aprovar carimba quem conferiu; reprovar usa o
-- "Voltar etapa — desfazer recebimento" (pedido volta a Emitido).
-- Novo recebimento (ou desfazer) invalida conferência anterior.

ALTER TABLE public.cmp_pedidos
  ADD COLUMN IF NOT EXISTS docs_conferidos boolean,
  ADD COLUMN IF NOT EXISTS docs_conferidos_por_nome text,
  ADD COLUMN IF NOT EXISTS docs_conferidos_em timestamptz;
COMMENT ON COLUMN public.cmp_pedidos.docs_conferidos IS
  'Conferência dos documentos anexados (NF/boleto) após entrega: true = aprovados p/ liberar pagamento; NULL = pendente. Reprovação = desfazer recebimento.';

-- ── Novo recebimento invalida a conferência anterior ─────────────────────────
CREATE OR REPLACE FUNCTION public.fn_pedido_reset_conferencia_docs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE cmp_pedidos SET
    docs_conferidos = NULL,
    docs_conferidos_por_nome = NULL,
    docs_conferidos_em = NULL
  WHERE id = NEW.pedido_id AND docs_conferidos IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receb_reset_conferencia ON public.cmp_recebimentos;
CREATE TRIGGER trg_receb_reset_conferencia
  AFTER INSERT ON public.cmp_recebimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_pedido_reset_conferencia_docs();

-- ── Desfazer recebimento também limpa a conferência ──────────────────────────
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
    docs_conferidos_em = NULL
  WHERE id = p_pedido_id;

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
