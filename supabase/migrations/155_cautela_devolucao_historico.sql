-- ─────────────────────────────────────────────────────────────────────────────
-- 155_cautela_devolucao_historico.sql
--
-- Histórico de devoluções parciais. Antes, os campos de assinatura/recebedor da
-- cautela eram únicos (sobrescritos a cada devolução) — devolver "1 por vez"
-- não deixava rastro de cada etapa.
--
-- Agora: est_cautelas.devolucoes (jsonb array) guarda 1 objeto por EVENTO de
-- devolução { data, devolvido_por_nome, recebedor_id, recebedor_nome,
-- assinatura_devolucao_url, assinatura_recebedor_url, itens:[{item_id,descricao,
-- quantidade,condicao}] }. A RPC est_cautela_devolver_itens passa a receber os
-- dados do recebedor + caminhos das assinaturas e registra o evento atomicamente.
--
-- Os campos "única" (assinatura_devolucao_url etc.) seguem refletindo a ÚLTIMA
-- devolução, p/ compatibilidade. Mantém a checagem de permissão da mig 154.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE est_cautelas
  ADD COLUMN IF NOT EXISTS devolucoes jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP FUNCTION IF EXISTS public.est_cautela_devolver_itens(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.est_cautela_devolver_itens(
  p_cautela_id uuid,
  p_itens jsonb,
  p_recebedor_id uuid DEFAULT NULL,
  p_recebedor_nome text DEFAULT NULL,
  p_assinatura_devolucao_url text DEFAULT NULL,
  p_assinatura_recebedor_url text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base_id uuid;
  v_obra_nome text;
  v_solicitante_id uuid;
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
  v_event_itens jsonb := '[]'::jsonb;
  -- permissão
  v_perfil record;
  v_is_admin boolean;
  v_is_holder boolean;
  v_eh_sede boolean;
BEGIN
  IF p_cautela_id IS NULL THEN
    RAISE EXCEPTION 'p_cautela_id obrigatorio';
  END IF;
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'p_itens vazio';
  END IF;

  SELECT base_id, obra_nome, solicitante_id, solicitante_nome, status
    INTO v_base_id, v_obra_nome, v_solicitante_id, v_solicitante_nome, v_status_atual
    FROM est_cautelas WHERE id = p_cautela_id;

  -- ── Permissão (mig 154) ───────────────────────────────────────────────────
  SELECT p.id, p.colaborador_id, p.base_id, p.role, p.almoxarife, p.comprador
    INTO v_perfil
    FROM sys_perfis p
   WHERE p.auth_id = auth.uid();

  IF v_perfil.id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao identificado para registrar devolucao';
  END IF;

  v_is_admin  := (v_perfil.role = 'administrador');
  v_is_holder := (v_solicitante_id IS NOT NULL AND v_solicitante_id = v_perfil.colaborador_id);
  v_eh_sede   := COALESCE((SELECT eh_sede FROM est_bases WHERE id = v_base_id), false);

  IF v_is_holder AND NOT v_is_admin THEN
    RAISE EXCEPTION 'O detentor da cautela nao pode registrar a propria devolucao';
  END IF;

  IF NOT v_is_admin THEN
    IF v_eh_sede THEN
      IF NOT COALESCE(v_perfil.comprador, false) THEN
        RAISE EXCEPTION 'Sem permissao: devolucao na Sede e restrita a compradores';
      END IF;
    ELSE
      IF NOT (COALESCE(v_perfil.almoxarife, false)
              AND v_perfil.base_id IS NOT DISTINCT FROM v_base_id) THEN
        RAISE EXCEPTION 'Sem permissao: devolucao em obra e restrita ao almoxarife lotado na base';
      END IF;
    END IF;
  END IF;
  -- ──────────────────────────────────────────────────────────────────────────

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

    UPDATE est_cautela_itens
       SET quantidade_devolvida = v_qtd_nova,
           condicao_devolucao   = COALESCE(v_item->>'condicao_devolucao', condicao_devolucao)
     WHERE id = v_ci.id;

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
        'Devolucao de cautela'
      );
      v_devs_inseridas := v_devs_inseridas + 1;

      -- itens deste EVENTO de devolução (apenas o delta retornado agora)
      v_event_itens := v_event_itens || jsonb_build_object(
        'item_id',    v_ci.item_id,
        'descricao',  (SELECT descricao FROM est_itens WHERE id = v_ci.item_id),
        'quantidade', v_delta,
        'condicao',   v_item->>'condicao_devolucao'
      );
    END IF;
  END LOOP;

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

  -- Registra o EVENTO de devolução (histórico) + campos "última" p/ compat.
  -- Só quando o front envia as assinaturas (caller novo).
  IF p_assinatura_devolucao_url IS NOT NULL THEN
    UPDATE est_cautelas
       SET assinatura_devolucao_url           = p_assinatura_devolucao_url,
           assinatura_recebedor_devolucao_url = p_assinatura_recebedor_url,
           recebedor_id   = COALESCE(p_recebedor_id, recebedor_id),
           recebedor_nome = COALESCE(p_recebedor_nome, recebedor_nome),
           devolucoes = COALESCE(devolucoes, '[]'::jsonb) || jsonb_build_object(
             'data',                     now(),
             'devolvido_por_nome',       v_solicitante_nome,
             'recebedor_id',             p_recebedor_id,
             'recebedor_nome',           p_recebedor_nome,
             'assinatura_devolucao_url', p_assinatura_devolucao_url,
             'assinatura_recebedor_url', p_assinatura_recebedor_url,
             'itens',                    v_event_itens
           )
     WHERE id = p_cautela_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status_anterior', v_status_atual,
    'status_novo', v_status_novo,
    'devolucoes_inseridas', v_devs_inseridas,
    'all_returned', v_all_returned
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.est_cautela_devolver_itens(uuid, jsonb, uuid, text, text, text) TO authenticated;
