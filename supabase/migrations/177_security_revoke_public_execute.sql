-- 177_security_revoke_public_execute.sql
-- Corrige REVOKE incompleto da 174: GRANT TO PUBLIC expoe funcoes a anon.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func_sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.func_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.func_sig);
      IF r.proname NOT LIKE '\_%' ESCAPE '\' THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.func_sig);
      ELSE
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.func_sig);
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '177 skip %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_modulo(text, uuid) TO authenticated;
