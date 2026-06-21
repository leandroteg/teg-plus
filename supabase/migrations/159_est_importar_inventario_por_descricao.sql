-- 159_est_importar_inventario_por_descricao.sql
-- Importacao de inventario por DESCRICAO (em vez de codigo).
--
-- Use case: a planilha enviada pelo time de Estoque traz
-- DESCRICAO + MARCA + UNID + QTD, sem codigo real (a coluna "codigo" e apenas
-- um numero sequencial da planilha). Esta RPC:
--   1. Tenta casar cada linha por descricao normalizada (upper+unaccent) com
--      est_itens.
--   2. Se nao existe, AUTO-CRIA o item em est_itens com codigo gerado,
--      categoria 'Almoxarifado Geral', valor_medio=0.
--   3. Insere/atualiza est_inventario_itens (idempotente).
--
-- Combinada com mig 152 (est_concluir_inventario), ao concluir o inventario
-- as movimentacoes de ajuste levam o saldo de est_saldos.base_id para a
-- quantidade contada da planilha.

CREATE OR REPLACE FUNCTION public.est_importar_inventario_por_descricao(
  p_inventario_id uuid,
  p_itens         jsonb,
  p_contado_por   text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv          RECORD;
  v_linha        jsonb;
  v_descricao    text;
  v_descricao_n  text;
  v_unidade_raw  text;
  v_unidade      est_unidade;
  v_marca        text;
  v_qtd          numeric;
  v_item_id      uuid;
  v_codigo_novo  text;
  v_saldo        numeric;
  v_importados   int := 0;
  v_criados      int := 0;
  v_erros        jsonb := '[]'::jsonb;
BEGIN
  SELECT id, base_id, status INTO v_inv
  FROM est_inventarios WHERE id = p_inventario_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'inventario nao encontrado');
  END IF;

  IF v_inv.status NOT IN ('aberto', 'em_contagem') THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      format('inventario com status %s nao aceita importacao', v_inv.status));
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'p_itens deve ser array json');
  END IF;

  IF v_inv.status = 'aberto' THEN
    UPDATE est_inventarios SET status = 'em_contagem' WHERE id = p_inventario_id;
  END IF;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_descricao   := nullif(trim(v_linha->>'descricao'), '');
    v_unidade_raw := upper(coalesce(trim(v_linha->>'unidade'), 'UN'));
    v_marca       := nullif(trim(v_linha->>'marca'), '');
    v_qtd         := nullif(v_linha->>'quantidade', '')::numeric;

    IF v_descricao IS NULL THEN
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'descricao vazia');
      CONTINUE;
    END IF;
    IF v_qtd IS NULL OR v_qtd < 0 THEN
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'quantidade invalida');
      CONTINUE;
    END IF;

    -- Normaliza unidade contra o enum est_unidade. Se invalida, cai pra UN.
    BEGIN
      v_unidade := v_unidade_raw::est_unidade;
    EXCEPTION WHEN OTHERS THEN
      v_unidade := 'UN';
    END;

    -- Match por descricao normalizada
    v_descricao_n := upper(public.unaccent(v_descricao));

    SELECT id INTO v_item_id
    FROM est_itens
    WHERE upper(public.unaccent(descricao)) = v_descricao_n
      AND ativo = true
    LIMIT 1;

    -- Auto-create se nao existir
    IF v_item_id IS NULL THEN
      v_codigo_novo := 'AG-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(v_descricao || random()::text), 1, 6);
      INSERT INTO est_itens (
        codigo, descricao, categoria, subcategoria, unidade,
        ativo, valor_medio, destino_operacional, controle_estoque, descricao_complementar
      ) VALUES (
        v_codigo_novo, upper(v_descricao), 'Almoxarifado Geral', 'INVENTARIO_XLSX', v_unidade,
        true, 0, 'estoque', true, v_marca
      )
      RETURNING id INTO v_item_id;
      v_criados := v_criados + 1;
    END IF;

    -- Saldo sistema atual (na base do inventario)
    SELECT coalesce(sum(
      CASE WHEN tipo IN ('entrada', 'transferencia_in', 'ajuste_positivo', 'devolucao')
           THEN quantidade
           ELSE -quantidade
      END
    ), 0)
    INTO v_saldo
    FROM est_movimentacoes
    WHERE item_id = v_item_id
      AND (v_inv.base_id IS NULL OR base_id = v_inv.base_id);

    INSERT INTO est_inventario_itens (
      inventario_id, item_id, base_id,
      saldo_sistema, saldo_contado,
      divergencia_pct,
      contado_por, observacao, contado_em
    ) VALUES (
      p_inventario_id, v_item_id, v_inv.base_id,
      v_saldo, v_qtd,
      CASE WHEN v_saldo = 0 THEN NULL ELSE round(((v_qtd - v_saldo) / v_saldo) * 100, 2) END,
      coalesce(p_contado_por, v_linha->>'contado_por'),
      v_marca,
      now()
    )
    ON CONFLICT (inventario_id, item_id) DO UPDATE SET
      saldo_sistema   = EXCLUDED.saldo_sistema,
      saldo_contado   = EXCLUDED.saldo_contado,
      divergencia_pct = EXCLUDED.divergencia_pct,
      contado_por     = coalesce(EXCLUDED.contado_por, est_inventario_itens.contado_por),
      observacao      = coalesce(EXCLUDED.observacao, est_inventario_itens.observacao),
      contado_em      = EXCLUDED.contado_em;

    v_importados := v_importados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'importados', v_importados,
    'criados', v_criados,
    'erros_count', jsonb_array_length(v_erros),
    'erros', v_erros
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.est_importar_inventario_por_descricao(uuid, jsonb, text) TO authenticated;
