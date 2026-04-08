-- ============================================================================
-- Migration 067: Add alterar_senha_proximo_login to sys_perfis
-- Date: 2026-03-31
-- Description: Allows admins to force users to redefine their password
--   on the next login. When set to true, the app redirects the user
--   to the password change screen after login.
-- ============================================================================

ALTER TABLE public.sys_perfis
  ADD COLUMN IF NOT EXISTS alterar_senha_proximo_login BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN sys_perfis.alterar_senha_proximo_login IS
  'Quando true, força o usuário a redefinir a senha no próximo login';
