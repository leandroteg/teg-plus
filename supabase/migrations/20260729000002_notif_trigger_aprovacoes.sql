-- ─────────────────────────────────────────────────────────────────────────────
-- 20260729000002_notif_trigger_aprovacoes.sql
--
-- Piloto das notificacoes de etapa: apr_aprovacoes (aprovacoes transversais —
-- requisicao de compra, cotacao, minuta, pagamento, transporte).
--
-- apr_aprovacoes identifica o aprovador por EMAIL (aprovador_email), nao por
-- id — resolvemos via sys_perfis com lower/trim. Sem match, nao enfileira
-- (o sweep de reconciliacao pega depois, se o perfil for corrigido).
--
-- Dispara quando a aprovacao entra em 'pendente' (INSERT ou transicao) ou
-- quando o aprovador muda com status ja pendente. Idempotente por
-- (user_id, dedupe_key) — ver mig 20260729000001.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_notif_apr_aprovacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid;
  v_titulo text;
BEGIN
  IF NEW.status::text <> 'pendente' OR NEW.aprovador_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.aprovador_email IS NOT DISTINCT FROM NEW.aprovador_email THEN
    RETURN NEW;
  END IF;

  SELECT auth_id INTO v_uid
  FROM sys_perfis
  WHERE ativo = true AND auth_id IS NOT NULL
    AND lower(trim(email)) = lower(trim(NEW.aprovador_email))
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_titulo := CASE NEW.tipo_aprovacao
    WHEN 'requisicao_compra'     THEN 'Requisicao de compra aguardando sua aprovacao'
    WHEN 'cotacao'               THEN 'Cotacao aguardando sua aprovacao'
    WHEN 'minuta_contratual'     THEN 'Minuta contratual aguardando sua aprovacao'
    WHEN 'autorizacao_pagamento' THEN 'Autorizacao de pagamento aguardando sua aprovacao'
    WHEN 'aprovacao_transporte'  THEN 'Solicitacao de transporte aguardando sua aprovacao'
    ELSE 'Aprovacao aguardando sua acao'
  END;

  PERFORM fn_notif_enfileirar(
    v_uid,
    v_titulo,
    CASE WHEN NEW.entidade_numero IS NOT NULL THEN 'Nº ' || NEW.entidade_numero ELSE NULL END,
    '/aprovaai',
    'apr_aprovacao',
    NEW.id,
    format('apr_aprovacao:%s:%s', NEW.id, NEW.status)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_notif_apr_aprovacao ON public.apr_aprovacoes;
CREATE TRIGGER tr_notif_apr_aprovacao
  AFTER INSERT OR UPDATE OF status, aprovador_email ON public.apr_aprovacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notif_apr_aprovacao();

COMMENT ON FUNCTION public.fn_notif_apr_aprovacao() IS
  'Enfileira notificacao pro aprovador (resolvido por email em sys_perfis) quando apr_aprovacoes entra em pendente ou troca de aprovador.';
