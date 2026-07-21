-- 181_security_admin_rpc_authz_20260703.sql
-- Item 2 do checklist de seguranca: proteger o acesso administrativo.
--
-- Achado critico: admin_create_user_rpc e admin_delete_user_rpc sao
-- SECURITY DEFINER, liberadas para o role authenticated, e nao tinham
-- NENHUMA verificacao de permissao internamente -- qualquer usuario logado
-- (mesmo requisitante) podia chamar essas RPCs direto via
-- POST /rest/v1/rpc/admin_delete_user_rpc (ou admin_create_user_rpc) e
-- criar/apagar qualquer usuario, inclusive admins. Esta migration:
--
-- 1) Adiciona a mesma checagem de autorizacao ja usada em
--    admin_set_password_rpc (071_admin_set_password_rpc.sql) nas duas RPCs,
--    preservando o corpo/search_path exatos hoje em producao (capturados via
--    pg_get_functiondef antes desta migration).
-- 2) Adiciona guarda contra auto-exclusao em admin_delete_user_rpc.
-- 3) Corrige a policy mural_banners_admin_all, que comparava com
--    role = 'admin' -- valor que a CHECK constraint de sys_perfis.role nao
--    permite mais (so existem administrador/diretor/gestor/requisitante/
--    visitante) -- ou seja, nenhum admin real conseguia gerenciar banners
--    pelo lado do servidor.
-- 4) Documenta (CREATE OR REPLACE identico ao que ja roda em producao, sem
--    mudanca de comportamento) is_admin() e can_access_modulo(), usadas por
--    este fix mas que so existiam no banco, nao no repo. Captura parcial e
--    deliberada -- nao e reconciliacao de todo o drift de migrations.

-- ============================================================================
-- 1) admin_create_user_rpc: adiciona checagem de autorizacao
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_user_rpc(p_email text, p_password text, p_nome text DEFAULT ''::text, p_username text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_actor_role text;
  v_actor_papel text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT p.role, COALESCE(p.papel_global, 'requisitante')
    INTO v_actor_role, v_actor_papel
  FROM public.sys_perfis p
  WHERE p.auth_id = auth.uid() AND p.ativo = true
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Perfil do solicitante nao encontrado';
  END IF;

  IF NOT (
    v_actor_role IN ('admin', 'administrador')
    OR v_actor_papel IN ('ceo', 'diretor')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar usuarios';
  END IF;

  -- 1. Auth user (trigger on_auth_user_created cria sys_perfis automaticamente)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role, confirmation_token, is_sso_user,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token,
    reauthentication_token, recovery_token
  ) VALUES (
    v_uid, '00000000-0000-0000-0000-000000000000',
    p_email, crypt(p_password, gen_salt('bf', 10)),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome, 'username', p_username),
    'authenticated', 'authenticated', '', false,
    '', '', '', '', '', '', ''
  );

  -- 2. Identity (required for GoTrue login)
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_uid, v_uid::text, 'email',
    jsonb_build_object(
      'sub', v_uid::text,
      'email', p_email,
      'email_verified', true,
      'phone_verified', false
    ),
    now(), now(), now()
  );

  -- 3. NAO cria perfil aqui -- trigger handle_new_auth_user ja cria via auth_id
  -- O frontend faz UPDATE depois com role, modulos, etc.

  RETURN v_uid;
END;
$function$;

-- ============================================================================
-- 2) admin_delete_user_rpc: adiciona checagem de autorizacao + auto-exclusao
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user_rpc(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_papel text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Nao e permitido excluir o proprio usuario';
  END IF;

  SELECT p.role, COALESCE(p.papel_global, 'requisitante')
    INTO v_actor_role, v_actor_papel
  FROM public.sys_perfis p
  WHERE p.auth_id = auth.uid() AND p.ativo = true
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Perfil do solicitante nao encontrado';
  END IF;

  IF NOT (
    v_actor_role IN ('admin', 'administrador')
    OR v_actor_papel IN ('ceo', 'diretor')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar usuarios';
  END IF;

  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM sys_convites WHERE email IN (SELECT email FROM auth.users WHERE id = p_user_id);
  DELETE FROM sys_perfis WHERE auth_id = p_user_id;
  DELETE FROM sys_perfis WHERE id = p_user_id; -- fallback para perfis antigos sem auth_id
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_user_rpc(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user_rpc(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user_rpc(text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_delete_user_rpc(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_rpc(uuid) TO service_role;

-- ============================================================================
-- 3) mural_banners_admin_all: corrige comparacao com valor de role obsoleto
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.mural_banners') IS NOT NULL THEN
    DROP POLICY IF EXISTS "mural_banners_admin_all" ON public.mural_banners;
    CREATE POLICY "mural_banners_admin_all" ON public.mural_banners
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- 4) Documentacao minima de drift: is_admin() e can_access_modulo() ja
--    existem em producao com este exato corpo (capturado via
--    pg_get_functiondef antes desta migration) -- so passam a existir
--    tambem como arquivo versionado, sem mudanca de comportamento.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador' AND ativo = true); $function$;

CREATE OR REPLACE FUNCTION public.can_access_modulo(p_modulo text, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH norm AS (
    SELECT CASE lower(p_modulo)
      WHEN 'patrimonio' THEN 'patrimonial'
      WHEN 'locacao' THEN 'locacoes'
      ELSE lower(p_modulo)
    END AS chave
  )
  SELECT EXISTS (
    SELECT 1
    FROM sys_perfis p, norm n
    WHERE p.auth_id = p_user_id
      AND p.ativo = true
      AND (
        p.role = 'administrador'
        OR COALESCE((p.modulos ->> n.chave)::boolean, false) = true
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_modulo(text, uuid) TO authenticated;
