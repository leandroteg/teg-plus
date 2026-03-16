-- =============================================================================
-- 054_cp_parcelas_pedido.sql
-- Corrige a geração de contas a pagar na emissão do pedido para respeitar
-- parcelas_preview em vez de criar um único título com o valor total.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.criar_cp_ao_emitir_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_req public.cmp_requisicoes%ROWTYPE;
  v_total_parcelas INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM public.fin_contas_pagar WHERE pedido_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_req
  FROM public.cmp_requisicoes
  WHERE id = NEW.requisicao_id;

  v_total_parcelas := COALESCE(jsonb_array_length(COALESCE(NEW.parcelas_preview, '[]'::jsonb)), 0);

  IF v_total_parcelas > 0 THEN
    INSERT INTO public.fin_contas_pagar (
      pedido_id,
      requisicao_id,
      fornecedor_nome,
      valor_original,
      valor_pago,
      data_emissao,
      data_vencimento,
      data_vencimento_orig,
      status,
      centro_custo,
      classe_financeira,
      projeto_id,
      descricao,
      natureza,
      observacoes
    )
    SELECT
      NEW.id,
      NEW.requisicao_id,
      NEW.fornecedor_nome,
      ROUND(COALESCE((parcela.item->>'valor')::numeric, NEW.valor_total)::numeric, 2),
      0,
      COALESCE(NEW.data_pedido::date, CURRENT_DATE),
      COALESCE((parcela.item->>'data_vencimento')::date, NEW.data_prevista_entrega::date + 30, CURRENT_DATE + 30),
      COALESCE((parcela.item->>'data_vencimento')::date, NEW.data_prevista_entrega::date + 30, CURRENT_DATE + 30),
      'previsto',
      COALESCE(NEW.centro_custo, v_req.centro_custo),
      COALESCE(NEW.classe_financeira, v_req.classe_financeira),
      v_req.projeto_id,
      CASE
        WHEN v_total_parcelas = 1 THEN COALESCE(v_req.descricao, parcela.item->>'descricao', 'Pedido de compra')
        ELSE CONCAT(
          COALESCE(v_req.descricao, 'Pedido de compra'),
          ' - ',
          COALESCE(parcela.item->>'descricao', FORMAT('Parcela %s/%s', parcela.ordem, v_total_parcelas))
        )
      END,
      'material',
      CASE
        WHEN NEW.condicao_pagamento IS NOT NULL AND BTRIM(NEW.condicao_pagamento) <> '' THEN
          CONCAT('Condição: ', NEW.condicao_pagamento)
        ELSE NULL
      END
    FROM jsonb_array_elements(COALESCE(NEW.parcelas_preview, '[]'::jsonb)) WITH ORDINALITY AS parcela(item, ordem);

    RETURN NEW;
  END IF;

  INSERT INTO public.fin_contas_pagar (
    pedido_id,
    requisicao_id,
    fornecedor_nome,
    valor_original,
    valor_pago,
    data_emissao,
    data_vencimento,
    data_vencimento_orig,
    status,
    centro_custo,
    classe_financeira,
    projeto_id,
    descricao,
    natureza,
    observacoes
  ) VALUES (
    NEW.id,
    NEW.requisicao_id,
    NEW.fornecedor_nome,
    NEW.valor_total,
    0,
    COALESCE(NEW.data_pedido::date, CURRENT_DATE),
    COALESCE(NEW.data_prevista_entrega::date + 30, CURRENT_DATE + 30),
    COALESCE(NEW.data_prevista_entrega::date + 30, CURRENT_DATE + 30),
    'previsto',
    COALESCE(NEW.centro_custo, v_req.centro_custo),
    COALESCE(NEW.classe_financeira, v_req.classe_financeira),
    v_req.projeto_id,
    COALESCE(v_req.descricao, 'Pedido de compra'),
    'material',
    CASE
      WHEN NEW.condicao_pagamento IS NOT NULL AND BTRIM(NEW.condicao_pagamento) <> '' THEN
        CONCAT('Condição: ', NEW.condicao_pagamento)
      ELSE NULL
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
