-- ============================================================
-- Migration 071: RPC fallback para alteração de senha (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_set_password_rpc(
  p_auth_id UUID,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_actor_role TEXT;
  v_actor_papel TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_auth_id IS NULL THEN
    RAISE EXCEPTION 'Usuario alvo nao informado';
  END IF;

  IF COALESCE(length(p_password), 0) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 6 caracteres';
  END IF;

  SELECT p.role, COALESCE(p.papel_global, 'requisitante')
    INTO v_actor_role, v_actor_papel
  FROM public.sys_perfis p
  WHERE p.auth_id = auth.uid()
    AND p.ativo = true
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Perfil do solicitante nao encontrado';
  END IF;

  IF NOT (
    v_actor_role IN ('admin', 'administrador')
    OR v_actor_papel IN ('ceo', 'diretor')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para alterar senha';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE id = p_auth_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario de autenticacao nao encontrado';
  END IF;

  UPDATE public.sys_perfis
  SET senha_definida = true
  WHERE auth_id = p_auth_id;

  RETURN jsonb_build_object('ok', true, 'auth_id', p_auth_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_password_rpc(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_password_rpc(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_password_rpc(UUID, TEXT) TO service_role;

