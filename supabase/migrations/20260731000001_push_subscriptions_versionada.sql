-- ─────────────────────────────────────────────────────────────────────────────
-- 20260731000001_push_subscriptions_versionada.sql
--
-- Versiona a tabela push_subscriptions, que hoje so existe em producao
-- (criada fora do fluxo de migrations — drift). Schema compativel com o de
-- prod e com o uso em frontend/src/hooks/usePushNotifications.ts
-- (upsert onConflict: 'user_id') e na edge function send-push
-- (select user_id, subscription).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Dono gerencia a propria subscription; service_role (edge function) le tudo.
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push (VAPID) do TEG+ ERP: 1 subscription por usuario (formato PushSubscription.toJSON em jsonb). Consumida pela edge function send-push.';
