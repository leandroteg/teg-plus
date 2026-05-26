-- 109: helper can_access_modulo() — usado pelo hardening 099.
-- Verifica se o usuario (por auth_id) tem acesso a um modulo,
-- via sys_perfis.modulos JSONB. Admin sempre passa.
-- Alias: patrimonio -> patrimonial (chave usada no sys_perfis).

CREATE OR REPLACE FUNCTION public.can_access_modulo(p_modulo text, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH norm AS (
    SELECT CASE lower(p_modulo)
      WHEN 'patrimonio' THEN 'patrimonial'
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

GRANT EXECUTE ON FUNCTION public.can_access_modulo(text, uuid) TO authenticated;
