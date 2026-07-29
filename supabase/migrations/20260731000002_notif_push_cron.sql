-- ─────────────────────────────────────────────────────────────────────────────
-- 20260731000002_notif_push_cron.sql
--
-- Processador de push offline da fila sys_notif_queue — a funcao
-- fn_processar_notif_queue_push prometida na mig 129 e nunca criada.
--
-- pg_cron (a cada 1 min) seleciona notificacoes recentes ainda nao vistas e
-- nao enviadas, marca enviada_push_em ANTES do net.http_post (pg_net e
-- assincrono: marcar antes garante que nunca duplica; perda rara e aceitavel
-- — o sino in-app e a fonte confiavel) e chama a edge function send-push.
--
-- Notificacoes de usuarios sem subscription tambem sao marcadas (nada a
-- enviar), evitando re-escanear as mesmas linhas a cada minuto.
--
-- Token: vault 'portalteg_service_role' (mesmo padrao dos crons do Portal,
-- mig 181 — mesmo projeto/DB). Sem o secret (ex.: homolog), a funcao sai sem
-- marcar nada, e o envio se recupera sozinho quando o secret existir.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_processar_notif_queue_push()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_token text;
  r RECORD;
  v_enviadas integer := 0;
BEGIN
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = 'portalteg_service_role'
  LIMIT 1;

  IF v_token IS NULL THEN
    RAISE NOTICE 'fn_processar_notif_queue_push: secret portalteg_service_role ausente — push adiado';
    RETURN 0;
  END IF;

  FOR r IN
    UPDATE sys_notif_queue q
       SET enviada_push_em = now()
     WHERE q.id IN (
             SELECT id FROM sys_notif_queue
             WHERE enviada_push_em IS NULL
               AND vista_em IS NULL
               AND criada_em > now() - interval '1 day'
             ORDER BY criada_em
             LIMIT 50
             FOR UPDATE SKIP LOCKED
           )
    RETURNING q.id, q.user_id, q.titulo, q.corpo, q.url
  LOOP
    -- So chama a edge se o usuario tem subscription; linhas sem subscription
    -- ja ficaram marcadas pelo UPDATE acima.
    IF EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = r.user_id) THEN
      PERFORM net.http_post(
        url := 'https://uzfjfucrinokeuwpbeie.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_token
        ),
        body := jsonb_build_object(
          'user_ids', jsonb_build_array(r.user_id),
          'title', r.titulo,
          'body', coalesce(r.corpo, ''),
          'url', coalesce(r.url, '/')
        ),
        timeout_milliseconds := 15000
      );
      v_enviadas := v_enviadas + 1;
    END IF;
  END LOOP;

  RETURN v_enviadas;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_processar_notif_queue_push() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_processar_notif_queue_push() TO service_role;

COMMENT ON FUNCTION public.fn_processar_notif_queue_push() IS
  'Cron de push offline: envia sys_notif_queue nao vistas via edge send-push (pg_net). Marca enviada_push_em antes do post — nunca duplica.';

-- A cada minuto (upsert por nome de job)
SELECT cron.schedule('notif_push', '* * * * *', $$SELECT public.fn_processar_notif_queue_push()$$);
