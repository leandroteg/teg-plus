-- =====================================================================
-- 20260708100004_consolida_role_helpers.sql
-- Consolida helpers de papel/role duplicados.
-- NÃO APLICAR EM PRODUÇÃO ANTES DE VALIDAR EM HOMOLOGAÇÃO.
--
-- Confirmado via pg_proc:
--   * auth_role()  ==  get_user_role()   (corpo BYTE-IDÊNTICO)
--   * auth_at_least(text) == role_at_least(text) (lógica idêntica)
--
-- Estratégia conservadora: NÃO dropamos funções (podem ser referenciadas em
-- policies/outras RPCs). Em vez disso, redefinimos as duplicatas como
-- wrappers finos da versão canônica, eliminando a divergência de manutenção
-- sem quebrar dependências. Um DROP futuro pode ser feito após confirmar que
-- nenhuma policy referencia a versão redundante.
--
-- Canônicas escolhidas: get_user_role()  e  role_at_least(text).
-- =====================================================================
BEGIN;

-- auth_role() passa a delegar para get_user_role()
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.get_user_role(); $$;

-- auth_at_least(text) passa a delegar para role_at_least(text)
CREATE OR REPLACE FUNCTION public.auth_at_least(p_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.role_at_least(p_role); $$;

COMMIT;

-- -------------------------------------------------------------------
-- ⚠️ SEPARADO (decisão de negócio): is_admin() vs is_admin_safe()
-- NÃO é duplicata — checam papéis DIFERENTES:
--   is_admin()      -> role = 'administrador'
--   is_admin_safe() -> role = 'admin'
-- Isso é um BUG latente de autorização. Padronizar o valor do papel de admin
-- em sys_perfis.role e unificar as duas. Requer decisão sobre qual string é a
-- correta. Exemplo (NÃO habilitado — descomente após decidir):
--
-- CREATE OR REPLACE FUNCTION public.is_admin_safe()
-- RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $$ SELECT public.is_admin(); $$;   -- unifica para 'administrador'
-- -------------------------------------------------------------------

-- =====================================================================
-- ROLLBACK:
-- =====================================================================
/*
BEGIN;
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true), 'visitante'); $$;

CREATE OR REPLACE FUNCTION public.auth_at_least(p_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE auth_role()
    WHEN 'administrador' THEN 5 WHEN 'diretor' THEN 4 WHEN 'gestor' THEN 3 WHEN 'requisitante' THEN 2 WHEN 'visitante' THEN 1 ELSE 0
  END >= CASE p_role
    WHEN 'administrador' THEN 5 WHEN 'diretor' THEN 4 WHEN 'gestor' THEN 3 WHEN 'requisitante' THEN 2 WHEN 'visitante' THEN 1
    WHEN 'admin' THEN 5 WHEN 'gerente' THEN 4 WHEN 'aprovador' THEN 3 WHEN 'comprador' THEN 3 ELSE 0
  END;
$$;
COMMIT;
*/
