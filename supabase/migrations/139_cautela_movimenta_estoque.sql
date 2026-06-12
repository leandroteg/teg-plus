-- ─────────────────────────────────────────────────────────────────────────────
-- 139_cautela_movimenta_estoque.sql
--
-- Cautela agora BAIXA o estoque na retirada (saida) e DEVOLVE (devolucao)
-- quando o colaborador entrega de volta. Antes a cautela so registrava o
-- "termo" mas nao mexia em est_saldos — o material saia fisicamente sem
-- reflexo no sistema (vinha aparecendo como se estivesse "reservado", mas
-- nem reserva era).
--
-- Mudancas:
--   1. est_movimentacoes ganha cautela_id + cautela_item_id (traceability +
--      chave de idempotencia pra nao baixar duas vezes).
--   2. est_cautela_salvar_termo: ao transitar pra em_aberto, insere uma
--      saida por item (skip se ja existir mov saida pro mesmo item).
--   3. est_cautela_devolver_itens (novo RPC): recebe array json de
--      {id, quantidade_devolvida, condicao_devolucao}, atualiza
--      est_cautela_itens, insere devolucao pelo DELTA da quantidade ja
--      devolvida e transita status conforme tudo devolvido ou nao.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Colunas de traceability em est_movimentacoes
ALTER TABLE public.est_movimentacoes
  ADD COLUMN IF NOT EXISTS cautela_id      uuid,
  ADD COLUMN IF NOT EXISTS cautela_item_id uuid;

CREATE INDEX IF NOT EXISTS idx_est_mov_cautela_item
  ON public.est_movimentacoes (cautela_item_id, tipo)
  WHERE cautela_item_id IS NOT NULL;

-- 2) est_cautela_salvar_termo: baixa estoque ao liberar material
CREATE OR REPLACE FUNCTION public.est_cautela_salvar_termo(
  p_cautela_id        uuid,
  p_assinatura_path   text,
  p_termo_path        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_status_anterior text;
  v_status_novo text;
  v_base_id uuid;
  v_obra_nome text;
  v_solicitante_nome text;
  v_item record;
  v_saidas_inseridas int := 0;
  v_saidas_existentes int := 0;
BEGIN
  IF p_cautela_id IS NULL THEN
    RAISE EXCEPTION 'p_cautela_id obrigatório';
  END IF;

  SELECT status, base_id, obra_nome, solicitante_nome
    INTO v_status_anterior, v_base_id, v_obra_nome, v_solicitante_nome
    FROM est_cautelas WHERE id = p_cautela_id;
  IF v_status_anterior IS NULL THEN
    RAISE EXCEPTION 'Cautela % não encontrada', p_cautela_id;
  END IF;

  v_status_novo := CASE
    WHEN v_status_anterior IN ('pendente', 'aprovada') THEN 'em_aberto'
    ELSE v_status_anterior
  END;

  UPDATE est_cautelas
     SET assinatura_retirada_url = p_assinatura_path,
         termo_url               = p_termo_path,
         data_retirada           = COALESCE(data_retirada, now()),
         status                  = v_status_novo,
         atualizado_em           = now()
   WHERE id = p_cautela_id;

  -- Baixa o estoque (saida) por item — apenas se transitou pra em_aberto
  -- agora E o item tem item_id (catalogado) E ainda nao tem saida lançada.
  IF v_status_novo = 'em_aberto' AND v_base_id IS NOT NULL THEN
    FOR v_item IN
      SELECT ci.id, ci.item_id, ci.quantidade
        FROM est_cautela_itens ci
       WHERE ci.cautela_id = p_cautela_id
         AND ci.item_id IS NOT NULL
    LOOP
      IF EXISTS (
        SELECT 1 FROM est_movimentacoes
         WHERE cautela_item_id = v_item.id AND tipo = 'saida'
      ) THEN
        v_saidas_existentes := v_saidas_existentes + 1;
        CONTINUE;
      END IF;

      INSERT INTO est_movimentacoes (
        item_id, base_id, tipo, quantidade,
        obra_nome, responsavel_nome,
        cautela_id, cautela_item_id,
        observacao
      ) VALUES (
        v_item.item_id, v_base_id, 'saida'::est_tipo_mov, v_item.quantidade,
        v_obra_nome, v_solicitante_nome,
        p_cautela_id, v_item.id,
        'Saida por cautela'
      );
      v_saidas_inseridas := v_saidas_inseridas + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status_anterior', v_status_anterior,
    'status_novo', v_status_novo,
    'assinatura_path', p_assinatura_path,
    'termo_path', p_termo_path,
    'saidas_inseridas', v_saidas_inseridas,
    'saidas_existentes', v_saidas_existentes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.est_cautela_salvar_termo(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.est_cautela_salvar_termo(uuid, text, text) TO authenticated;

-- 3) Novo RPC: devolver itens (insere devolucao pelo delta)
CREATE OR REPLACE FUNCTION public.est_cautela_devolver_itens(
  p_cautela_id uuid,
  p_itens      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_base_id uuid;
  v_obra_nome text;
  v_solicitante_nome text;
  v_status_atual text;
  v_status_novo text;
  v_all_returned boolean;
  v_item jsonb;
  v_ci record;
  v_qtd_nova numeric;
  v_qtd_anterior numeric;
  v_delta numeric;
  v_devs_inseridas int := 0;
BEGIN
  IF p_cautela_id IS NULL THEN
    RAISE EXCEPTION 'p_cautela_id obrigatório';
  END IF;
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'p_itens vazio';
  END IF;

  SELECT base_id, obra_nome, solicitante_nome, status
    INTO v_base_id, v_obra_nome, v_solicitante_nome, v_status_atual
    FROM est_cautelas WHERE id = p_cautela_id;
  IF v_base_id IS NULL THEN
    -- continua mesmo sem base (cautelas legadas) — apenas não insere mov
    NULL;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qtd_nova := COALESCE((v_item->>'quantidade_devolvida')::numeric, 0);

    SELECT id, item_id, quantidade, COALESCE(quantidade_devolvida, 0) AS quantidade_devolvida
      INTO v_ci
      FROM est_cautela_itens
     WHERE id = (v_item->>'id')::uuid
       AND cautela_id = p_cautela_id;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_qtd_anterior := v_ci.quantidade_devolvida;
    v_delta := v_qtd_nova - v_qtd_anterior;

    -- Atualiza est_cautela_itens
    UPDATE est_cautela_itens
       SET quantidade_devolvida = v_qtd_nova,
           condicao_devolucao   = COALESCE(v_item->>'condicao_devolucao', condicao_devolucao)
     WHERE id = v_ci.id;

    -- Insere devolucao apenas se houve delta positivo, item catalogado e base
    IF v_delta > 0 AND v_ci.item_id IS NOT NULL AND v_base_id IS NOT NULL THEN
      INSERT INTO est_movimentacoes (
        item_id, base_id, tipo, quantidade,
        obra_nome, responsavel_nome,
        cautela_id, cautela_item_id,
        observacao
      ) VALUES (
        v_ci.item_id, v_base_id, 'devolucao'::est_tipo_mov, v_delta,
        v_obra_nome, v_solicitante_nome,
        p_cautela_id, v_ci.id,
        'Devolução de cautela'
      );
      v_devs_inseridas := v_devs_inseridas + 1;
    END IF;
  END LOOP;

  -- Transita status: encerrada se tudo devolvido, em_devolucao caso contrario
  SELECT COALESCE(bool_and(quantidade_devolvida >= quantidade), false)
    INTO v_all_returned
    FROM est_cautela_itens
   WHERE cautela_id = p_cautela_id;

  v_status_novo := CASE WHEN v_all_returned THEN 'encerrada' ELSE 'em_devolucao' END;

  UPDATE est_cautelas
     SET status = v_status_novo,
         data_devolucao_real = CASE WHEN v_all_returned THEN now() ELSE data_devolucao_real END,
         atualizado_em = now()
   WHERE id = p_cautela_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status_anterior', v_status_atual,
    'status_novo', v_status_novo,
    'devolucoes_inseridas', v_devs_inseridas,
    'all_returned', v_all_returned
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.est_cautela_devolver_itens(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.est_cautela_devolver_itens(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.est_cautela_devolver_itens(uuid, jsonb) IS
  'Recebe array de {id, quantidade_devolvida, condicao_devolucao?}; atualiza est_cautela_itens, insere devolucao em est_movimentacoes pelo delta, e transita status (em_devolucao | encerrada).';

-- 4) Catch-up: cautelas em_aberto/em_devolucao SEM saida lançada (legado)
-- Insere saida retroativa pra elas baterem com o saldo real. Idempotente.
DO $$
DECLARE
  v_c record;
  v_ci record;
BEGIN
  FOR v_c IN
    SELECT id, base_id, obra_nome, solicitante_nome
      FROM est_cautelas
     WHERE status IN ('em_aberto', 'em_devolucao', 'encerrada')
       AND base_id IS NOT NULL
  LOOP
    FOR v_ci IN
      SELECT id, item_id, quantidade, COALESCE(quantidade_devolvida, 0) AS qd
        FROM est_cautela_itens
       WHERE cautela_id = v_c.id AND item_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM est_movimentacoes
         WHERE cautela_item_id = v_ci.id AND tipo = 'saida'
      ) THEN
        INSERT INTO est_movimentacoes (
          item_id, base_id, tipo, quantidade,
          obra_nome, responsavel_nome,
          cautela_id, cautela_item_id, observacao
        ) VALUES (
          v_ci.item_id, v_c.base_id, 'saida'::est_tipo_mov, v_ci.quantidade,
          v_c.obra_nome, v_c.solicitante_nome,
          v_c.id, v_ci.id, 'Saida por cautela (catch-up)'
        );
      END IF;
      IF v_ci.qd > 0 AND NOT EXISTS (
        SELECT 1 FROM est_movimentacoes
         WHERE cautela_item_id = v_ci.id AND tipo = 'devolucao'
      ) THEN
        INSERT INTO est_movimentacoes (
          item_id, base_id, tipo, quantidade,
          obra_nome, responsavel_nome,
          cautela_id, cautela_item_id, observacao
        ) VALUES (
          v_ci.item_id, v_c.base_id, 'devolucao'::est_tipo_mov, v_ci.qd,
          v_c.obra_nome, v_c.solicitante_nome,
          v_c.id, v_ci.id, 'Devolução de cautela (catch-up)'
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
