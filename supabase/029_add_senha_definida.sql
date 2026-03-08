-- ============================================================================
-- Migration 029: Add senha_definida to sys_perfis
-- Date: 2026-03-08
-- Description: Track whether user has set a password.
--   Users invited via magic link start with false and must set a password
--   on first login. Existing users are marked as true.
-- ============================================================================

ALTER TABLE public.sys_perfis
  ADD COLUMN IF NOT EXISTS senha_definida BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing users as having a password set
UPDATE public.sys_perfis SET senha_definida = true WHERE senha_definida = false;

-- Partial index for quick lookup of users who haven't set a password
CREATE INDEX IF NOT EXISTS idx_sys_perfis_senha_definida
  ON public.sys_perfis (senha_definida) WHERE senha_definida = false;
