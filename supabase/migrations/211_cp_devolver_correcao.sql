-- 211_cp_devolver_correcao.sql
-- Devolução de título do Contas a Pagar para quem o lançou, com aviso de
-- inconsistência (pedido do user 04/ago, a partir do caso GD Rio Verde: boleto
-- emitido por outro CNPJ que não o fornecedor do pedido).
--
-- Espelha o padrão já usado na RC devolvida ao solicitante
-- (cmp_requisicoes.devolucao_msg/_por/_em): o documento NÃO muda de status nem
-- é excluído — ganha uma marca de pendência que aparece como alerta e trava o
-- avanço até alguém resolver.
-- Idempotente.

ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS devolucao_motivo     text,
  ADD COLUMN IF NOT EXISTS devolvido_em         timestamptz,
  ADD COLUMN IF NOT EXISTS devolvido_por        text,
  ADD COLUMN IF NOT EXISTS devolvido_para_nome  text;

COMMENT ON COLUMN public.fin_contas_pagar.devolucao_motivo IS
  'Inconsistência apontada pelo Financeiro. Preenchido = título devolvido para correção; NULL = sem pendência.';

CREATE INDEX IF NOT EXISTS idx_fin_cp_devolvido
  ON public.fin_contas_pagar(devolvido_em) WHERE devolucao_motivo IS NOT NULL;

-- ── Devolver ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: além de marcar a CP, enfileira o aviso para OUTRO usuário
-- (sys_notif_queue é por user_id, o cliente não escreve na linha alheia).
CREATE OR REPLACE FUNCTION public.fin_cp_devolver_correcao(
  p_cp_id  uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cp        fin_contas_pagar%ROWTYPE;
  v_autor     text;
  v_auth_id   uuid;
  v_quem      text;
  v_numero    text;
BEGIN
  IF coalesce(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Descreva a inconsistência para devolver o título.';
  END IF;

  SELECT * INTO v_cp FROM fin_contas_pagar WHERE id = p_cp_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_cp.status NOT IN ('previsto', 'confirmado') THEN
    RAISE EXCEPTION 'Só é possível devolver título em Previstos ou Confirmados (atual: %).', v_cp.status;
  END IF;
  IF v_cp.lote_id IS NOT NULL THEN
    RAISE EXCEPTION 'Título já está em lote de pagamento — remova do lote antes de devolver.';
  END IF;

  -- Autor: o do pedido quando houver (extraordinário), senão o da própria CP
  SELECT COALESCE(p.criado_por_nome, v_cp.criado_por_nome), p.numero_pedido
    INTO v_autor, v_numero
    FROM cmp_pedidos p WHERE p.id = v_cp.pedido_id;
  IF v_autor IS NULL THEN
    v_autor := v_cp.criado_por_nome;
  END IF;

  SELECT nome INTO v_quem FROM sys_perfis WHERE auth_id = auth.uid();

  UPDATE fin_contas_pagar
     SET devolucao_motivo    = btrim(p_motivo),
         devolvido_em        = now(),
         devolvido_por       = COALESCE(v_quem, 'Financeiro'),
         devolvido_para_nome = v_autor,
         updated_at          = now()
   WHERE id = p_cp_id;

  -- Aviso in-app para o autor (best-effort: sem perfil casado, segue sem notificar)
  SELECT auth_id INTO v_auth_id
    FROM sys_perfis
   WHERE nome = v_autor AND ativo = true AND auth_id IS NOT NULL
   LIMIT 1;

  IF v_auth_id IS NOT NULL THEN
    INSERT INTO sys_notif_queue (user_id, titulo, corpo, url, origem, origem_id, dedupe_key)
    VALUES (
      v_auth_id,
      'Título devolvido para correção',
      COALESCE(v_numero || ' — ', '') || v_cp.fornecedor_nome || ': ' || btrim(p_motivo),
      '/financeiro/contas-a-pagar',
      'fin_cp_devolucao',
      p_cp_id,
      'fin_cp_devolucao:' || p_cp_id::text || ':' || extract(epoch from now())::bigint
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'devolvido_para', v_autor,
    'notificado', v_auth_id IS NOT NULL
  );
END;
$function$;

-- ── Resolver (some com a pendência) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_cp_resolver_devolucao(p_cp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE fin_contas_pagar
     SET devolucao_motivo = NULL,
         devolvido_em = NULL,
         devolvido_por = NULL,
         devolvido_para_nome = NULL,
         updated_at = now()
   WHERE id = p_cp_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fin_cp_devolver_correcao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fin_cp_resolver_devolucao(uuid) TO authenticated;
