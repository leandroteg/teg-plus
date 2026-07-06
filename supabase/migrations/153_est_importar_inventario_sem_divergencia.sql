-- ─────────────────────────────────────────────────────────────────────────────
-- 153_est_importar_inventario_sem_divergencia.sql
--
-- Bug: mig 127 (est_importar_inventario) escreve em `divergencia`, mas mig 141
-- transformou divergencia em GENERATED ALWAYS (calc automatico de
-- saldo_contado - saldo_sistema). Import quebra com:
--   "cannot insert a non-DEFAULT value into column 'divergencia'"
--
-- Fix: remove divergencia do INSERT e do ON CONFLICT UPDATE. O valor passa a
-- ser materializado pelo proprio Postgres a partir da expressao.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.est_importar_inventario(
  p_inventario_id uuid,
  p_linhas jsonb,
  p_contado_por text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_inv RECORD;
  v_linha jsonb;
  v_codigo text;
  v_qtd numeric;
  v_obs text;
  v_item_id uuid;
  v_saldo numeric;
  v_importados int := 0;
  v_erros jsonb := '[]'::jsonb;
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

  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'p_linhas deve ser array json');
  END IF;

  IF v_inv.status = 'aberto' THEN
    UPDATE est_inventarios SET status = 'em_contagem' WHERE id = p_inventario_id;
  END IF;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    v_codigo := trim(v_linha->>'codigo');
    v_qtd    := nullif(v_linha->>'quantidade', '')::numeric;
    v_obs    := nullif(trim(v_linha->>'observacao'), '');

    IF v_codigo IS NULL OR v_codigo = '' THEN
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'codigo vazio');
      CONTINUE;
    END IF;
    IF v_qtd IS NULL OR v_qtd < 0 THEN
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'quantidade invalida');
      CONTINUE;
    END IF;

    SELECT id INTO v_item_id
    FROM est_itens
    WHERE upper(codigo) = upper(v_codigo) AND ativo = true
    LIMIT 1;

    IF v_item_id IS NULL THEN
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'item nao encontrado ou inativo');
      CONTINUE;
    END IF;

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

    -- divergencia: NAO inserir (GENERATED ALWAYS desde mig 141)
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
      v_obs,
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
    'erros_count', jsonb_array_length(v_erros),
    'erros', v_erros
  );
END;
$function$;
