-- ─────────────────────────────────────────────────────────────────────────────
-- 182_est_mesclar_itens.sql
--
-- De/Para de itens duplicados no catálogo de estoque. O catálogo acumulou
-- muitos itens repetidos (auto-criação por descrição no import de inventário +
-- cadastros manuais). Esta RPC funde um ou mais itens de origem (De) num item
-- canônico (Para):
--
--   * Reaponta TODAS as referências para o item destino:
--       est_movimentacoes.item_id, est_solicitacao_itens.item_id,
--       est_inventario_itens.item_id, est_cautela_itens.item_id,
--       est_cautela_favoritos.item_id (dedup pelo unique usuario+item),
--       cmp_requisicao_itens.est_item_id + item_estoque_id (+ est_item_codigo),
--       cmp_recebimento_itens.item_estoque_id
--   * Soma os saldos por base no destino (upsert pelo unique item_id+base_id)
--     e remove as linhas de saldo da origem
--   * Herda valor_medio/valor_ultima_entrada da origem quando o destino não tem
--   * Desativa a origem com rastro em descricao_complementar
--
-- Permissão: Admin ou perfil com flag comprador (sys_perfis.comprador).
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

    UPDATE est_inventario_itens SET item_id = p_para WHERE item_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_inv := v_inv + n;

    UPDATE est_cautela_itens SET item_id = p_para WHERE item_id = v_de;
    GET DIAGNOSTICS n = ROW_COUNT; v_cau := v_cau + n;

    -- Favoritos tem unique (usuario_id, item_id): descarta os que colidiriam
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

    -- Saldos: soma no destino por base (unique item_id+base_id) e apaga origem
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

    -- Destino sem valor de referencia herda o da origem
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

REVOKE ALL ON FUNCTION public.est_mesclar_itens(uuid[], uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.est_mesclar_itens(uuid[], uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.est_mesclar_itens(uuid[], uuid) TO authenticated;

COMMENT ON FUNCTION public.est_mesclar_itens(uuid[], uuid) IS
  'De/Para de itens duplicados: reaponta movimentacoes/solicitacoes/inventarios/cautelas/RCs/recebimentos, soma saldos por base no destino e desativa as origens. Admin ou comprador.';
