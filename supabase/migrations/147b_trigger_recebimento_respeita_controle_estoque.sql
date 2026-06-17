-- ─────────────────────────────────────────────────────────────────────────────
-- 147b_trigger_recebimento_respeita_controle_estoque.sql
--
-- O trigger fn_processar_recebimento_item gera est_movimentacoes diretamente
-- (em paralelo à RPC fn_confirmar_entrada_estoque). A mig 146c protegeu a RPC
-- mas o trigger continuava criando saldo de Serviço.
--
-- Este patch acrescenta o guard contra controle_estoque=false no ramo CONSUMO.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_processar_recebimento_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_receb RECORD;
  v_item RECORD;
  v_responsavel_nome TEXT;
  v_pat_num TEXT;
  v_controle_estoque BOOLEAN;
BEGIN
  -- CONSUMO: only process on confirmation
  IF NEW.tipo_destino = 'consumo' THEN
    IF TG_OP = 'INSERT' AND NEW.status <> 'confirmado' THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status <> 'confirmado' OR OLD.status = 'confirmado' THEN
        RETURN NEW;
      END IF;
    END IF;

    IF NEW.item_estoque_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Serviços (controle_estoque = false) não geram movimentação.
    SELECT controle_estoque INTO v_controle_estoque
    FROM public.est_itens WHERE id = NEW.item_estoque_id;
    IF v_controle_estoque IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    SELECT r.id, r.base_id, r.recebido_por, r.nf_numero,
           r.data_recebimento, r.observacao,
           p.fornecedor_nome,
           req.obra_nome, req.centro_custo
    INTO v_receb
    FROM public.cmp_recebimentos r
    JOIN public.cmp_pedidos p ON p.id = r.pedido_id
    LEFT JOIN public.cmp_requisicoes req ON req.id = p.requisicao_id
    WHERE r.id = NEW.recebimento_id;

    IF NOT FOUND THEN RETURN NEW; END IF;

    SELECT nome INTO v_responsavel_nome
    FROM public.sys_perfis WHERE id = v_receb.recebido_por;
    v_responsavel_nome := COALESCE(v_responsavel_nome, 'Sistema');

    INSERT INTO public.est_movimentacoes (
      item_id, base_id, tipo, quantidade, valor_unitario,
      obra_nome, centro_custo, nf_numero, fornecedor_nome,
      lote, numero_serie, data_validade,
      responsavel_nome, responsavel_id, observacao
    ) VALUES (
      NEW.item_estoque_id, v_receb.base_id, 'entrada',
      NEW.quantidade_recebida, COALESCE(NEW.valor_unitario, 0),
      v_receb.obra_nome, v_receb.centro_custo,
      v_receb.nf_numero, v_receb.fornecedor_nome,
      NEW.lote, NEW.numero_serie, NEW.data_validade,
      v_responsavel_nome, v_receb.recebido_por, v_receb.observacao
    );

    RETURN NEW;
  END IF;

  -- PATRIMONIAL: process on INSERT (pendente) AND confirmation (ativo)
  IF NEW.tipo_destino = 'patrimonial' THEN

    v_pat_num := 'PAT-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS') || '-' || substr(replace(NEW.id::text, '-', ''), 1, 8);

    IF TG_OP = 'INSERT' THEN
      SELECT r.id, r.base_id, r.recebido_por, r.nf_numero,
             r.data_recebimento, r.observacao,
             p.fornecedor_nome
      INTO v_receb
      FROM public.cmp_recebimentos r
      JOIN public.cmp_pedidos p ON p.id = r.pedido_id
      WHERE r.id = NEW.recebimento_id;

      IF NOT FOUND THEN RETURN NEW; END IF;

      IF NEW.item_estoque_id IS NOT NULL THEN
        SELECT i.id, i.descricao,
          COALESCE(NULLIF(i.categoria, ''), 'GERAL') AS categoria
        INTO v_item
        FROM public.est_itens i WHERE i.id = NEW.item_estoque_id;
      END IF;

      SELECT nome INTO v_responsavel_nome
      FROM public.sys_perfis WHERE id = v_receb.recebido_por;
      v_responsavel_nome := COALESCE(v_responsavel_nome, 'Sistema');

      INSERT INTO public.pat_imobilizados (
        numero_patrimonio, descricao, categoria, numero_serie,
        base_id, responsavel_nome, responsavel_id,
        status, valor_aquisicao, data_aquisicao,
        fornecedor_nome, nf_compra_numero, observacoes,
        recebimento_item_id
      ) VALUES (
        v_pat_num,
        COALESCE(NEW.descricao, v_item.descricao, 'Item patrimonial'),
        COALESCE(v_item.categoria, 'GERAL'),
        NEW.numero_serie,
        v_receb.base_id,
        v_responsavel_nome, v_receb.recebido_por,
        'pendente_registro'::public.pat_status_imob,
        COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade_recebida, 1),
        COALESCE(v_receb.data_recebimento::date, CURRENT_DATE),
        v_receb.fornecedor_nome, v_receb.nf_numero, v_receb.observacao,
        NEW.id
      );

      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.status = 'confirmado' AND OLD.status <> 'confirmado' THEN
      UPDATE public.pat_imobilizados
      SET status = 'ativo'::public.pat_status_imob
      WHERE recebimento_item_id = NEW.id;

      IF NOT FOUND THEN
        SELECT r.id, r.base_id, r.recebido_por, r.nf_numero,
               r.data_recebimento, r.observacao,
               p.fornecedor_nome
        INTO v_receb
        FROM public.cmp_recebimentos r
        JOIN public.cmp_pedidos p ON p.id = r.pedido_id
        WHERE r.id = NEW.recebimento_id;

        IF NOT FOUND THEN RETURN NEW; END IF;

        IF NEW.item_estoque_id IS NOT NULL THEN
          SELECT i.id, i.descricao,
            COALESCE(NULLIF(i.categoria, ''), 'GERAL') AS categoria
          INTO v_item
          FROM public.est_itens i WHERE i.id = NEW.item_estoque_id;
        END IF;

        SELECT nome INTO v_responsavel_nome
        FROM public.sys_perfis WHERE id = v_receb.recebido_por;
        v_responsavel_nome := COALESCE(v_responsavel_nome, 'Sistema');

        INSERT INTO public.pat_imobilizados (
          numero_patrimonio, descricao, categoria, numero_serie,
          base_id, responsavel_nome, responsavel_id,
          status, valor_aquisicao, data_aquisicao,
          fornecedor_nome, nf_compra_numero, observacoes,
          recebimento_item_id
        ) VALUES (
          v_pat_num,
          COALESCE(NEW.descricao, v_item.descricao, 'Item patrimonial'),
          COALESCE(v_item.categoria, 'GERAL'),
          NEW.numero_serie,
          v_receb.base_id,
          v_responsavel_nome, v_receb.recebido_por,
          'ativo'::public.pat_status_imob,
          COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade_recebida, 1),
          COALESCE(v_receb.data_recebimento::date, CURRENT_DATE),
          v_receb.fornecedor_nome, v_receb.nf_numero, v_receb.observacao,
          NEW.id
        );
      END IF;

      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.status = 'rejeitado' THEN
      DELETE FROM public.pat_imobilizados
      WHERE recebimento_item_id = NEW.id
        AND status = 'pendente_registro'::public.pat_status_imob;
      RETURN NEW;
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;
