-- 178_security_followup_20260702.sql
-- Fecha gaps encontrados no Security Advisor de producao apos 173-177, e um
-- efeito colateral da 174 que quebrou o Portal TEG (login por CPF+nascimento,
-- sem Supabase Auth, depende de EXECUTE para o role anon).
--
-- 1) Re-sweep REVOKE PUBLIC/anon em todas as SECURITY DEFINER (mesmo padrao
--    da 174/177) -- fecha rh_admissao_reg_enviar_assinatura_anexo (reaberta
--    por um CREATE OR REPLACE posterior, que reseta o GRANT default do PG
--    para PUBLIC) e qualquer outra que tenha regredido do mesmo jeito.
-- 2) GRANT EXECUTE ... TO anon de volta para toda funcao portalteg_% --
--    esse modulo nao usa auth.uid()/sessao Supabase, o cliente e sempre anon
--    e a identidade e verificada dentro da propria funcao (CPF+nascimento,
--    com lockout de forca bruta ja embutido em portalteg_login).
-- 3) orc_benchmark_ref criada sem RLS.
-- 4) vw_ctrl_realizado_categoria ficou fora da lista da 173, ainda SECURITY DEFINER.
-- 5) rh_ponto_* com policy FOR ALL USING(true)/WITH CHECK(true) para
--    authenticated -- qualquer usuario logado podia ler E ALTERAR/APAGAR
--    ponto de qualquer colaborador. Passa a: leitura aberta (padrao do
--    resto do ERP) + escrita restrita a can_access_modulo('rh', ...),
--    igual ja feito para as demais tabelas de RH na 175. rh_ponto_dia e
--    rh_ponto_marcacao sao particionadas: a policy no pai propaga as
--    particoes e fecha de brinde o advisor rls_enabled_no_policy nelas.

-- ============================================================================
-- 1) Re-sweep REVOKE PUBLIC/anon (identico ao padrao 174/177 -- idempotente)
-- ============================================================================
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
        RAISE NOTICE '178 revoke skip %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_modulo(text, uuid) TO authenticated;

-- ============================================================================
-- 2) Portal TEG: restaura EXECUTE para anon (login proprio, sem auth.uid())
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname LIKE 'portalteg%'
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.func_sig);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '178 portalteg grant skip %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 3) orc_benchmark_ref sem RLS
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.orc_benchmark_ref') IS NOT NULL THEN
    ALTER TABLE public.orc_benchmark_ref ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS orc_benchmark_ref_select ON public.orc_benchmark_ref;
    CREATE POLICY orc_benchmark_ref_select ON public.orc_benchmark_ref
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS orc_benchmark_ref_modulo_write ON public.orc_benchmark_ref;
    CREATE POLICY orc_benchmark_ref_modulo_write ON public.orc_benchmark_ref
      FOR ALL TO authenticated
      USING (public.can_access_modulo('orcamentacao', auth.uid()))
      WITH CHECK (public.can_access_modulo('orcamentacao', auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- 4) vw_ctrl_realizado_categoria ainda SECURITY DEFINER
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.vw_ctrl_realizado_categoria') IS NOT NULL THEN
    ALTER VIEW public.vw_ctrl_realizado_categoria SET (security_invoker = on);
  END IF;
END $$;

-- ============================================================================
-- 5) rh_ponto_*: fecha escrita aberta para qualquer authenticated
-- ============================================================================
DO $$
DECLARE
  t text;
  v_select_policy text;
  v_write_policy text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rh_ponto_dia',
    'rh_ponto_marcacao',
    'rh_ponto_aprovacao',
    'rh_ponto_afastamento',
    'rh_ponto_saldo_mes',
    'rh_ponto_pendencia',
    'rh_ponto_aej_arquivo',
    'rh_ponto_linkcolab',
    'rh_ponto_linkdisp',
    'rh_ponto_sync_log'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Tabela % nao existe; ignorada.', t;
      CONTINUE;
    END IF;

    v_select_policy := left(t || '_select', 60);
    v_write_policy := left(t || '_modulo_write', 60);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_select_policy, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      v_select_policy, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_write_policy, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR ALL TO authenticated
         USING (public.can_access_modulo(''rh'', auth.uid()))
         WITH CHECK (public.can_access_modulo(''rh'', auth.uid()))',
      v_write_policy, t
    );
  END LOOP;
END $$;
