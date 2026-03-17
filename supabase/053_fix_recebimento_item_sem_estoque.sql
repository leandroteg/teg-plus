-- Fix: allow receipt items without catalog link (item_estoque_id = NULL)
-- Previously the trigger raised an exception for consumo items without item_estoque_id.
-- Now it silently skips creating est_movimentacoes for unlinked items.

CREATE OR REPLACE FUNCTION public.fn_processar_recebimento_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receb RECORD;
  v_item RECORD;
  v_responsavel_nome TEXT;
  v_patrimonio_status TEXT;
BEGIN
  SELECT
    r.id,
    r.base_id,
    r.recebido_por,
    r.nf_numero,
    r.data_recebimento,
    r.observacao,
    p.id AS pedido_id,
    p.fornecedor_nome,
    req.id AS requisicao_id,
    req.obra_nome,
    req.centro_custo
  INTO v_receb
  FROM public.cmp_recebimentos r
  JOIN public.cmp_pedidos p
    ON p.id = r.pedido_id
  LEFT JOIN public.cmp_requisicoes req
    ON req.id = p.requisicao_id
  WHERE r.id = NEW.recebimento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento % nao encontrado', NEW.recebimento_id;
  END IF;

  -- Lookup catalog item (optional)
  IF NEW.item_estoque_id IS NOT NULL THEN
    SELECT
      i.id,
      i.codigo,
      i.descricao,
      COALESCE(NULLIF(i.categoria, ''), 'GERAL') AS categoria
    INTO v_item
    FROM public.est_itens i
    WHERE i.id = NEW.item_estoque_id;
  END IF;

  SELECT nome
  INTO v_responsavel_nome
  FROM public.sys_perfis
  WHERE id = v_receb.recebido_por;

  v_responsavel_nome := COALESCE(v_responsavel_nome, 'Sistema');

  -- CONSUMO: create est_movimentacoes entry
  IF NEW.tipo_destino = 'consumo' THEN
    -- Skip estoque entry if no catalog item linked (item avulso)
    IF NEW.item_estoque_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.est_movimentacoes (
      item_id,
      base_id,
      tipo,
      quantidade,
      valor_unitario,
      obra_nome,
      centro_custo,
      nf_numero,
      fornecedor_nome,
      lote,
      numero_serie,
      data_validade,
      responsavel_nome,
      responsavel_id,
      observacao
    ) VALUES (
      NEW.item_estoque_id,
      v_receb.base_id,
      'entrada',
      NEW.quantidade_recebida,
      COALESCE(NEW.valor_unitario, 0),
      v_receb.obra_nome,
      v_receb.centro_custo,
      v_receb.nf_numero,
      v_receb.fornecedor_nome,
      NEW.lote,
      NEW.numero_serie,
      NEW.data_validade,
      v_responsavel_nome,
      v_receb.recebido_por,
      v_receb.observacao
    );

    RETURN NEW;
  END IF;

  -- PATRIMONIAL: create pat_imobilizados entry
  IF NEW.tipo_destino = 'patrimonial' THEN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'pat_status_imob'
          AND e.enumlabel = 'pendente_registro'
      )
      THEN 'pendente_registro'
      ELSE 'ativo'
    END
    INTO v_patrimonio_status;

    INSERT INTO public.pat_imobilizados (
      numero_patrimonio,
      descricao,
      categoria,
      numero_serie,
      base_id,
      base_nome,
      responsavel_nome,
      responsavel_id,
      status,
      valor_aquisicao,
      data_aquisicao,
      fornecedor_nome,
      nf_compra_numero,
      observacoes
    ) VALUES (
      'PAT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(NEW.id::text, 1, 4),
      COALESCE(NEW.descricao, v_item.descricao, 'Item patrimonial'),
      COALESCE(v_item.categoria, 'GERAL'),
      NEW.numero_serie,
      v_receb.base_id,
      NULL,
      v_responsavel_nome,
      v_receb.recebido_por,
      v_patrimonio_status::public.pat_status_imob,
      COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade_recebida, 1),
      COALESCE(v_receb.data_recebimento::date, CURRENT_DATE),
      v_receb.fornecedor_nome,
      v_receb.nf_numero,
      v_receb.observacao
    );

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_processar_recebimento_item() SET search_path = public;
