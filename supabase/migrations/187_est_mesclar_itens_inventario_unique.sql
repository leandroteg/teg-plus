-- ─────────────────────────────────────────────────────────────────────────────
-- 187_est_mesclar_itens_inventario_unique.sql
--
-- Corrige est_mesclar_itens (mig 182): est_inventario_itens tem UNIQUE INDEX
-- (inventario_id, item_id) — "uq_est_inventario_itens_inv_item" — que não é
-- constraint e escapou do mapeamento. Quando origem e destino participaram do
-- MESMO inventário, o reaponte violava o índice.
--
-- Agora, nesses inventários, os saldos da linha de origem são SOMADOS na linha
-- do destino (sistema/contado/recontado) e a linha de origem é removida; a
-- coluna gerada `divergencia` se recalcula sozinha. Nos demais inventários o
-- reaponte segue como antes. Restante da função idêntico à mig 182.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.est_mesclar_itens(p_de uuid[], p_para uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_para   est_itens%ROWTYPE;
  v_de_row est_itens%ROWTYPE;
  v_de     uuid;
  n        int;
  v_movs int := 0; v_sol int := 0; v_inv int := 0; v_cau int := 0;
  v_fav int := 0; v_rc int := 0; v_rec int := 0; v_saldos int := 0;
  v_mesclados int := 0;
BEGIN
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid() AND p.comprador = true
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissao para mesclar itens (requer Admin ou Comprador)';
  END IF;

  IF p_de IS NULL OR array_length(p_de, 1) IS NULL THEN
    RAISE EXCEPTION 'Informe ao menos um item de origem';
  END IF;
  IF p_para = ANY (p_de) THEN
    RAISE EXCEPTION 'O item destino nao pode estar entre os itens de origem';
  END IF;

  SELECT * INTO v_para FROM est_itens WHERE id = p_para;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item destino nao encontrado';
  END IF;
  IF NOT v_para.ativo THEN
    RAISE EXCEPTION 'Item destino esta inativo — escolha um item ativo como destino';
  END IF;

  FOREACH v_de IN ARRAY p_de LOOP
    SELECT * INTO v_de_row FROM est_itens WHERE id = v_de;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item de origem % nao encontrado', v_de;
    END IF;

    UPDATE est_movimentacoes SET item_id = p_para WHERE item_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_movs := v_movs + n;

    UPDATE est_solicitacao_itens SET item_id = p_para WHERE item_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_sol := v_sol + n;

    -- Inventários onde origem E destino coexistem (unique inv+item): soma na
    -- linha do destino e remove a da origem
    UPDATE est_inventario_itens dst
    SET saldo_sistema   = coalesce(dst.saldo_sistema, 0) + coalesce(src.saldo_sistema, 0),
        saldo_contado   = CASE WHEN dst.saldo_contado IS NULL AND src.saldo_contado IS NULL THEN NULL
                               ELSE coalesce(dst.saldo_contado, 0) + coalesce(src.saldo_contado, 0) END,
        saldo_recontado = CASE WHEN dst.saldo_recontado IS NULL AND src.saldo_recontado IS NULL THEN NULL
                               ELSE coalesce(dst.saldo_recontado, 0) + coalesce(src.saldo_recontado, 0) END
    FROM est_inventario_itens src
    WHERE dst.item_id = p_para
      AND src.item_id = v_de
      AND src.inventario_id = dst.inventario_id;

    DELETE FROM est_inventario_itens src
    WHERE src.item_id = v_de
      AND EXISTS (
        SELECT 1 FROM est_inventario_itens dst
        WHERE dst.inventario_id = src.inventario_id AND dst.item_id = p_para
      );

    UPDATE est_inventario_itens SET item_id = p_para WHERE item_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_inv := v_inv + n;

    UPDATE est_cautela_itens SET item_id = p_para WHERE item_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_cau := v_cau + n;

    DELETE FROM est_cautela_favoritos f
    WHERE f.item_id = v_de
      AND EXISTS (
        SELECT 1 FROM est_cautela_favoritos f2
        WHERE f2.usuario_id = f.usuario_id AND f2.item_id = p_para
      );
    UPDATE est_cautela_favoritos SET item_id = p_para WHERE item_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_fav := v_fav + n;

    UPDATE cmp_requisicao_itens
    SET est_item_id = p_para, est_item_codigo = v_para.codigo
    WHERE est_item_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_rc := v_rc + n;

    UPDATE cmp_requisicao_itens SET item_estoque_id = p_para WHERE item_estoque_id = v_de;

    UPDATE cmp_recebimento_itens SET item_estoque_id = p_para WHERE item_estoque_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_rec := v_rec + n;

    INSERT INTO est_saldos (item_id, base_id, saldo, saldo_reservado, ultima_entrada, ultima_saida, atualizado_em)
    SELECT p_para, s.base_id, s.saldo, coalesce(s.saldo_reservado, 0),
           s.ultima_entrada, s.ultima_saida, now()
    FROM est_saldos s
    WHERE s.item_id = v_de
    ON CONFLICT (item_id, base_id) DO UPDATE SET
      saldo           = est_saldos.saldo + EXCLUDED.saldo,
      saldo_reservado = coalesce(est_saldos.saldo_reservado, 0) + EXCLUDED.saldo_reservado,
      ultima_entrada  = greatest(est_saldos.ultima_entrada, EXCLUDED.ultima_entrada),
      ultima_saida    = greatest(est_saldos.ultima_saida, EXCLUDED.ultima_saida),
      atualizado_em   = now();
    GET DIAGNOSTICS n = ROW_COUNT; v_saldos := v_saldos + n;

    DELETE FROM est_saldos WHERE item_id = v_de;

    UPDATE est_itens
    SET valor_medio = coalesce(nullif(valor_medio, 0), nullif(v_de_row.valor_medio, 0), valor_medio),
        valor_ultima_entrada = coalesce(nullif(valor_ultima_entrada, 0), nullif(v_de_row.valor_ultima_entrada, 0), valor_ultima_entrada)
    WHERE id = p_para;

    UPDATE est_itens
    SET ativo = false,
        descricao_complementar = trim(coalesce(descricao_complementar, '') ||
          ' [MESCLADO EM ' || v_para.codigo || ' - ' || to_char(now(), 'DD/MM/YYYY') || ']'),
        atualizado_em = now()
    WHERE id = v_de;

    v_mesclados := v_mesclados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'mesclados', v_mesclados,
    'para_codigo', v_para.codigo,
    'para_descricao', v_para.descricao,
    'movimentacoes', v_movs,
    'solicitacao_itens', v_sol,
    'inventario_itens', v_inv,
    'cautela_itens', v_cau,
    'favoritos', v_fav,
    'requisicao_itens', v_rc,
    'recebimento_itens', v_rec,
    'saldos_transferidos', v_saldos
  );
END;
$function$;
