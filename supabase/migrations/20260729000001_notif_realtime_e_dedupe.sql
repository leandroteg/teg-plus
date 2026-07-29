-- ─────────────────────────────────────────────────────────────────────────────
-- 20260729000001_notif_realtime_e_dedupe.sql
--
-- Fase 1 das notificacoes de etapa (sino global): torna a fila generica
-- sys_notif_queue (mig 129) utilizavel de fato.
--
-- 1. Adiciona sys_notif_queue a publicacao supabase_realtime — o canal
--    postgres_changes do useNotificacoes.ts assinava uma tabela fora da
--    publicacao e nunca recebia eventos.
-- 2. Coluna dedupe_key + unique parcial (user_id, dedupe_key): idempotencia
--    generica para qualquer produtor. Mesma etapa do mesmo registro nunca
--    re-notifica o mesmo usuario; etapa nova ou responsavel novo notificam.
-- 3. fn_notif_resolver_user: resolve o "id de usuario" gravado nas tabelas de
--    origem para auth.users.id (a fila referencia auth.users). Aceita tanto
--    sys_perfis.auth_id (maioria das fontes) quanto sys_perfis.id (sgi_acoes
--    e afins) — defende contra o desalinhamento historico de identidades.
-- 4. fn_notif_enfileirar: unico ponto de INSERT para triggers e sweep.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Realtime (idempotente: só adiciona se ainda não publica)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sys_notif_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sys_notif_queue;
  END IF;
END $$;

-- 2. Idempotencia generica
ALTER TABLE public.sys_notif_queue ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sys_notif_queue_user_dedupe
  ON public.sys_notif_queue(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON COLUMN public.sys_notif_queue.dedupe_key IS
  'Chave de idempotencia (origem:origem_id:etapa). Unica por user_id; NULL desativa o dedupe (produtores legados).';

-- 3. Resolve id gravado na origem → auth.users.id
CREATE OR REPLACE FUNCTION public.fn_notif_resolver_user(p_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT auth_id FROM sys_perfis
  WHERE ativo = true AND auth_id IS NOT NULL
    AND (auth_id = p_id OR id = p_id)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_notif_resolver_user(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_notif_resolver_user(uuid) TO service_role;

-- 4. Nucleo idempotente de enfileiramento
CREATE OR REPLACE FUNCTION public.fn_notif_enfileirar(
  p_user_id    uuid,
  p_titulo     text,
  p_corpo      text,
  p_url        text,
  p_origem     text,
  p_origem_id  uuid,
  p_dedupe_key text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_titulo IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO sys_notif_queue (user_id, titulo, corpo, url, origem, origem_id, dedupe_key)
  VALUES (p_user_id, p_titulo, p_corpo, p_url, p_origem, p_origem_id, p_dedupe_key)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_notif_enfileirar(uuid, text, text, text, text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_notif_enfileirar(uuid, text, text, text, text, uuid, text) TO service_role;

COMMENT ON FUNCTION public.fn_notif_enfileirar(uuid, text, text, text, text, uuid, text) IS
  'Unico ponto de INSERT em sys_notif_queue para triggers de etapa e sweep. Idempotente por (user_id, dedupe_key).';
