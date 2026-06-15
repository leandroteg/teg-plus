-- ─────────────────────────────────────────────────────────────────────────────
-- 143_est_concluir_inventario_pula_base_null.sql
--
-- Hardening da est_concluir_inventario (mig 142): pular itens com base_id NULL.
-- Causa: existem saldos orfaos em est_saldos com base_id NULL (dados de teste
-- antigos). useAbrirInventario carregava esses; ao concluir, a RPC gerava
-- ajuste com base=NULL, que apenas inflavava o lixo (trigger upsert criava
-- nova linha em est_saldos com base_id=NULL).
--
-- Agora: itens com base_id NULL sao pulados e contados em movs_puladas_sem_base.
-- O hook frontend useAbrirInventario tambem filtra saldos com base_id NULL
-- antes de carregar — dupla defesa.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.est_concluir_inventario(
  p_inventario_id uuid,
  p_aprovado_por  text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_inv RECORD;
  v_total int := 0;
  v_sem_div int := 0;
  v_acuracia numeric;
  v_item RECORD;
  v_movs_inseridas int := 0;
  v_movs_existentes int := 0;
  v_movs_puladas int := 0;
  v_tipo est_tipo_mov;
  v_qtd numeric;
BEGIN
  IF p_inventario_id IS NULL THEN
    RAISE EXCEPTION 'p_inventario_id obrigatorio';
  END IF;

  SELECT id, numero, base_id, status INTO v_inv
    FROM est_inventarios WHERE id = p_inventario_id;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Inventario % nao encontrado', p_inventario_id;
  END IF;

  SELECT count(*), count(*) FILTER (
    WHERE COALESCE(saldo_contado, 0) = COALESCE(saldo_sistema, 0)
  )
    INTO v_total, v_sem_div
    FROM est_inventario_itens WHERE inventario_id = p_inventario_id;
  v_acuracia := CASE WHEN v_total > 0 THEN round((v_sem_div::numeric / v_total) * 100, 2) ELSE 100 END;

  IF v_inv.status <> 'concluido' THEN
    UPDATE est_inventarios
       SET status = 'concluido',
           data_conclusao = CURRENT_DATE,
           aprovado_por = COALESCE(p_aprovado_por, aprovado_por),
           acuracia = v_acuracia,
           atualizado_em = now()
     WHERE id = p_inventario_id;
  ELSIF p_aprovado_por IS NOT NULL THEN
    UPDATE est_inventarios
       SET aprovado_por = COALESCE(NULLIF(aprovado_por, ''), p_aprovado_por),
           acuracia = v_acuracia,
           atualizado_em = now()
     WHERE id = p_inventario_id;
  END IF;

  FOR v_item IN
    SELECT ii.id, ii.item_id, ii.base_id,
           ii.saldo_sistema, ii.saldo_contado,
           ii.saldo_contado - COALESCE(ii.saldo_sistema, 0) AS delta
      FROM est_inventario_itens ii
     WHERE ii.inventario_id = p_inventario_id
       AND ii.saldo_contado IS NOT NULL
       AND ii.item_id IS NOT NULL
       AND ii.saldo_contado <> COALESCE(ii.saldo_sistema, 0)
  LOOP
    IF v_item.base_id IS NULL THEN
      v_movs_puladas := v_movs_puladas + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM est_movimentacoes
       WHERE inventario_id = p_inventario_id
         AND item_id = v_item.item_id
         AND base_id = v_item.base_id
         AND tipo IN ('ajuste_positivo', 'ajuste_negativo')
    ) THEN
      v_movs_existentes := v_movs_existentes + 1;
      CONTINUE;
    END IF;

    v_tipo := CASE WHEN v_item.delta > 0 THEN 'ajuste_positivo'::est_tipo_mov
                   ELSE 'ajuste_negativo'::est_tipo_mov END;
    v_qtd := abs(v_item.delta);

    INSERT INTO est_movimentacoes (
      item_id, base_id, tipo, quantidade,
      inventario_id, observacao
    ) VALUES (
      v_item.item_id, v_item.base_id, v_tipo, v_qtd,
      p_inventario_id,
      format('Ajuste de inventario %s (sistema %s -> contado %s)',
        v_inv.numero, v_item.saldo_sistema, v_item.saldo_contado)
    );
    v_movs_inseridas := v_movs_inseridas + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'inventario_id', p_inventario_id,
    'numero', v_inv.numero,
    'acuracia', v_acuracia,
    'movs_inseridas', v_movs_inseridas,
    'movs_existentes', v_movs_existentes,
    'movs_puladas_sem_base', v_movs_puladas
  );
END;
$function$;
