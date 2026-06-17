-- ─────────────────────────────────────────────────────────────────────────────
-- 151_con_assinaturas_hardening.sql
--
-- 1. Normaliza signatarios: caso o workflow n8n tenha gravado a coluna como
--    STRING (JSON serializado dentro de jsonb), faz parse de volta para array.
-- 2. CHECK em provedor (manual|certisign), tipo_assinatura (eletronica|digital|
--    fisica) e status (pendente|enviado|assinado|recusado|erro|expirado|
--    cancelado).
-- 3. RPC con_confirmar_assinatura SECURITY DEFINER: substitui INSERT/UPDATE
--    raw do useConfirmarAssinatura (idempotente, RLS-safe).
-- 4. Trigger que avanca etapa para 'arquivar' quando status muda para
--    'assinado' e a solicitacao esta em 'enviar_assinatura'.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.con_assinaturas
   SET signatarios = (signatarios #>> '{}')::jsonb
 WHERE jsonb_typeof(signatarios) = 'string';

UPDATE public.con_assinaturas
   SET signatarios = '[]'::jsonb
 WHERE signatarios IS NULL OR jsonb_typeof(signatarios) <> 'array';

ALTER TABLE public.con_assinaturas
  DROP CONSTRAINT IF EXISTS con_assinaturas_provedor_check,
  DROP CONSTRAINT IF EXISTS con_assinaturas_tipo_check,
  DROP CONSTRAINT IF EXISTS con_assinaturas_status_check;

ALTER TABLE public.con_assinaturas
  ADD CONSTRAINT con_assinaturas_provedor_check
    CHECK (provedor IN ('manual','certisign')),
  ADD CONSTRAINT con_assinaturas_tipo_check
    CHECK (tipo_assinatura IN ('eletronica','digital','fisica')),
  ADD CONSTRAINT con_assinaturas_status_check
    CHECK (status IN ('pendente','enviado','assinado','recusado','erro','expirado','cancelado'));

CREATE OR REPLACE FUNCTION public.con_confirmar_assinatura(
  p_solicitacao_id uuid,
  p_documento_assinado_url text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT id INTO v_id
  FROM con_assinaturas
  WHERE solicitacao_id = p_solicitacao_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO con_assinaturas (
      solicitacao_id, provedor, tipo_assinatura, status, concluido_em,
      documento_assinado_url, signatarios
    ) VALUES (
      p_solicitacao_id, 'manual', 'eletronica', 'assinado', v_now,
      p_documento_assinado_url, '[]'::jsonb
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE con_assinaturas
       SET status = 'assinado',
           concluido_em = coalesce(concluido_em, v_now),
           documento_assinado_url = coalesce(p_documento_assinado_url, documento_assinado_url),
           updated_at = v_now
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.con_assinaturas_auto_avancar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_etapa text;
BEGIN
  IF NEW.status = 'assinado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'assinado')
     AND NEW.solicitacao_id IS NOT NULL THEN

    SELECT etapa_atual::text INTO v_etapa
    FROM con_solicitacoes
    WHERE id = NEW.solicitacao_id;

    IF v_etapa = 'enviar_assinatura' THEN
      UPDATE con_solicitacoes
         SET etapa_atual = 'arquivar',
             status = 'em_andamento',
             updated_at = now()
       WHERE id = NEW.solicitacao_id;

      INSERT INTO con_solicitacao_historico (
        solicitacao_id, etapa_de, etapa_para, observacao
      ) VALUES (
        NEW.solicitacao_id, 'enviar_assinatura', 'arquivar',
        'Avanco automatico apos assinatura concluida'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_con_assinaturas_auto_avancar ON public.con_assinaturas;
CREATE TRIGGER trg_con_assinaturas_auto_avancar
  AFTER INSERT OR UPDATE ON public.con_assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.con_assinaturas_auto_avancar();
