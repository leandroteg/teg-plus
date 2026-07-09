-- =====================================================================
-- 20260708100005_fix_get_feature_flag.sql
-- Corrige RPC quebrada: o frontend chama supabase.rpc('get_feature_flag')
-- em frontend/src/contexts/AuthContext.tsx (~linha 316), mas a função NÃO
-- existe em produção (a migração 068 que a definia não foi totalmente
-- aplicada). Hoje a chamada falha silenciosamente (try/catch).
--
-- Esta migração (re)cria a função exatamente como especificada em
-- supabase/068_rbac_v2_papeis_setores.sql, lendo de sys_config.
-- NÃO APLICAR EM PRODUÇÃO ANTES DE VALIDAR EM HOMOLOGAÇÃO.
--
-- ALTERNATIVA: se a feature-flag não for mais desejada, remover a chamada no
-- frontend em vez de criar a função. Confirmar com o time de produto.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.get_feature_flag(p_chave text, p_default boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sys_config'
  ) THEN
    RETURN p_default;
  END IF;

  SELECT valor INTO v_raw FROM sys_config WHERE chave = p_chave LIMIT 1;

  IF v_raw IS NULL THEN
    RETURN p_default;
  END IF;

  RETURN lower(v_raw) IN ('true', 't', '1', 'yes', 'sim');
EXCEPTION WHEN OTHERS THEN
  RETURN p_default;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_feature_flag(text, boolean) TO authenticated, service_role;

COMMIT;

-- =====================================================================
-- ROLLBACK:
-- =====================================================================
/*
DROP FUNCTION IF EXISTS public.get_feature_flag(text, boolean);
*/
