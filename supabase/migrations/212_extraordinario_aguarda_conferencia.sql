-- 212_extraordinario_aguarda_conferencia.sql
-- Pedido Extraordinário não deve aparecer no Contas a Pagar enquanto o Compras
-- não conferir os documentos e liberar (pedido do user 04/ago, refinando a 210).
--
-- Fluxo alvo:
--   emitido  → CP em 'aguardando_conferencia' (fora das abas do Financeiro)
--   entregue → conferência documento a documento no Compras (aba Entregue)
--   liberado → CP vira 'confirmado' e entra no Financeiro
--
-- Nota: o trigger de liberação citava 'aguardando_aprovacao', status que NUNCA
-- foi aceito pela check constraint — era código morto. Aqui criamos um status
-- real ('aguardando_conferencia') e o incluímos na promoção.
-- Idempotente.

-- ── 1. Status novo aceito pela constraint ───────────────────────────────────
ALTER TABLE public.fin_contas_pagar DROP CONSTRAINT IF EXISTS fin_contas_pagar_status_check;
ALTER TABLE public.fin_contas_pagar ADD CONSTRAINT fin_contas_pagar_status_check
  CHECK (status::text = ANY (ARRAY[
    'aguardando_conferencia','previsto','confirmado','em_lote',
    'aprovado_pgto','em_pagamento','pago','conciliado','cancelado'
  ]::text[]));

-- ── 2. CP de pedido extraordinário nasce aguardando conferência ─────────────
CREATE OR REPLACE FUNCTION public.criar_cp_ao_emitir_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req       cmp_requisicoes%ROWTYPE;
  v_data_venc DATE;
  v_status    TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM fin_contas_pagar WHERE pedido_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_req FROM cmp_requisicoes WHERE id = NEW.requisicao_id;

  v_data_venc := COALESCE(NEW.data_vencimento::DATE,
                          NEW.data_prevista_entrega::DATE + 30,
                          CURRENT_DATE + 30);

  -- Extraordinário só chega ao Financeiro depois da conferência dos documentos
  v_status := CASE WHEN COALESCE(NEW.sem_cotacao, false)
                   THEN 'aguardando_conferencia'
                   ELSE 'previsto' END;

  INSERT INTO fin_contas_pagar (
    pedido_id, requisicao_id, fornecedor_nome, valor_original,
    data_emissao, data_vencimento, data_vencimento_orig, status,
    centro_custo, classe_financeira, projeto_id, descricao, natureza
  ) VALUES (
    NEW.id, NEW.requisicao_id, NEW.fornecedor_nome, NEW.valor_total,
    CURRENT_DATE, v_data_venc, v_data_venc, v_status,
    v_req.centro_custo, v_req.classe_financeira, v_req.projeto_id,
    v_req.descricao, COALESCE(v_req.categoria, 'material')
  );

  RETURN NEW;
END;
$function$;

-- ── 3. Liberação do Compras promove também o que aguarda conferência ────────
CREATE OR REPLACE FUNCTION public.atualizar_cp_ao_liberar_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status_pagamento = 'liberado'
     AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento != 'liberado')
  THEN
    UPDATE fin_contas_pagar
    SET status = 'confirmado', updated_at = now()
    WHERE pedido_id = NEW.id
      AND status IN ('previsto', 'aguardando_conferencia');
  END IF;

  IF NEW.status_pagamento = 'pago'
     AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento != 'pago')
  THEN
    UPDATE fin_contas_pagar
    SET status         = 'pago',
        valor_pago     = COALESCE(NULLIF(valor_pago, 0),
                                  valor_original - COALESCE(valor_desconto, 0) + COALESCE(valor_juros_multa, 0)),
        data_pagamento = CURRENT_DATE,
        updated_at     = now()
    WHERE pedido_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 4. Regulariza os extraordinários já emitidos e ainda não liberados ──────
UPDATE fin_contas_pagar cp
SET status = 'aguardando_conferencia', updated_at = now()
FROM cmp_pedidos p
WHERE cp.pedido_id = p.id
  AND p.sem_cotacao = true
  AND cp.status = 'previsto'
  AND cp.lote_id IS NULL
  AND cp.data_pagamento IS NULL
  AND p.status_pagamento IS DISTINCT FROM 'liberado'
  AND p.status_pagamento IS DISTINCT FROM 'pago';
