-- ─────────────────────────────────────────────────────────────────────────────
-- 227 — A justificativa da devolução precisa chegar em quem recebe o pedido
--
-- O "voltar etapa" (cmp_pedido_desfazer_recebimento) já exigia motivo, mas
-- gravava ele SÓ em cmp_historico_status — e só quando o pedido tinha
-- requisicao_id. Resultado: o comprador recebia o pedido de volta em Emitido
-- sem nenhuma pista do que corrigir, e no Pedido Direto (sem RC) o motivo
-- sumia por completo.
--
-- Aqui o motivo passa a morar no próprio pedido (devolucao_motivo/_por_nome/
-- _em), que é o que a tela do comprador lê. O histórico da RC continua sendo
-- gravado como antes.
--
-- Junto vai o par da mig 226: o conferido_motivo de cada documento deixa de ser
-- apagado na devolução — é justamente o detalhe documento a documento que o
-- comprador precisa ver. Ele é limpo quando o pedido volta a ser recebido.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cmp_pedidos
  ADD COLUMN IF NOT EXISTS devolucao_motivo   TEXT,
  ADD COLUMN IF NOT EXISTS devolucao_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS devolucao_em       TIMESTAMPTZ;

COMMENT ON COLUMN public.cmp_pedidos.devolucao_motivo IS
  'Justificativa da ultima devolucao do recebimento (voltar etapa). Limpa quando o pedido e recebido de novo.';

-- ── RPC: grava a devolucao no pedido e preserva o motivo de cada documento ────
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
    -- O que faltava: a justificativa fica NO PEDIDO, que e' o que o comprador abre.
    devolucao_motivo   = TRIM(p_motivo),
    devolucao_por_nome = COALESCE(v_nome, 'Comprador'),
    devolucao_em       = now()
  WHERE id = p_pedido_id;

  -- conferido_motivo NAO entra aqui de proposito: e' o detalhe documento a
  -- documento que explica a devolucao. Ele e' limpo no proximo recebimento.
  UPDATE cmp_pedidos_anexos SET
    conferido = NULL,
    conferido_por_nome = NULL,
    conferido_em = NULL
  WHERE pedido_id = p_pedido_id AND conferido IS NOT NULL;

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

-- ── Novo recebimento zera a devolucao anterior ───────────────────────────────
-- Sem isso o aviso de "devolvido para correcao" ficaria colado no pedido para
-- sempre, mesmo depois do comprador corrigir e receber de novo.
CREATE OR REPLACE FUNCTION public.cmp_pedido_limpar_devolucao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('entregue', 'parcialmente_recebido')
     AND COALESCE(OLD.status, '') IS DISTINCT FROM NEW.status
     AND NEW.devolucao_motivo IS NOT NULL
  THEN
    NEW.devolucao_motivo   := NULL;
    NEW.devolucao_por_nome := NULL;
    NEW.devolucao_em       := NULL;

    UPDATE cmp_pedidos_anexos
    SET conferido_motivo = NULL
    WHERE pedido_id = NEW.id AND conferido_motivo IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cmp_pedido_limpar_devolucao ON public.cmp_pedidos;
CREATE TRIGGER trg_cmp_pedido_limpar_devolucao
  BEFORE UPDATE OF status ON public.cmp_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.cmp_pedido_limpar_devolucao();

REVOKE EXECUTE ON FUNCTION public.cmp_pedido_desfazer_recebimento(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.cmp_pedido_desfazer_recebimento(uuid, text) TO authenticated, service_role;
