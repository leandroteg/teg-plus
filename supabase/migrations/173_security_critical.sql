-- 173_security_critical.sql
-- Fase 1: RLS em tabelas expostas, security_invoker em views, policies faltantes.

-- ============================================================================
-- 1.1 Tabelas com RLS desligado (advisor: rls_disabled_in_public)
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('pmo_medicoes',         'egp'),
      ('pmo_medicao_secao',    'egp'),
      ('pmo_medicao_mensal',   'egp'),
      ('pmo_osc_itens',        'egp'),
      ('orc_e2_backup',        'orcamentacao')
    ) AS x(table_name, module_key)
  LOOP
    IF to_regclass('public.' || r.table_name) IS NULL THEN
      RAISE NOTICE 'Tabela % nao existe; ignorada.', r.table_name;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_select', r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      r.table_name || '_select', r.table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_modulo_write', r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR ALL TO authenticated
         USING (public.can_access_modulo(%L, auth.uid()))
         WITH CHECK (public.can_access_modulo(%L, auth.uid()))',
      r.table_name || '_modulo_write', r.table_name, r.module_key, r.module_key
    );
  END LOOP;
END $$;

-- ============================================================================
-- 1.2 Views SECURITY DEFINER -> security_invoker (advisor: security_definer_view)
-- ============================================================================
DO $$
DECLARE
  v_view text;
BEGIN
  FOREACH v_view IN ARRAY ARRAY[
    'desp_adiantamentos_prestacao_vencida',
    'tel_ultima_posicao',
    'vw_con_contratos_resumo',
    'vw_ctrl_custo_por_obra',
    'vw_ctrl_dre_consolidado',
    'vw_ctrl_gastos_campo_por_cc',
    'vw_legado_resumo',
    'vw_minhas_solicitacoes',
    'vw_obr_avanco_fisico',
    'vw_obr_equipe_resumo',
    'vw_obr_prestacao_resumo',
    'vw_pmo_histograma_totais',
    'vw_pmo_portfolio_resumo'
  ]
  LOOP
    IF to_regclass('public.' || v_view) IS NULL THEN
      RAISE NOTICE 'View % nao existe; ignorada.', v_view;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v_view);
  END LOOP;
END $$;

-- ============================================================================
-- 1.3 Tabelas com RLS ligado mas sem policy (advisor: rls_enabled_no_policy)
-- ============================================================================

-- Portal TEG: acesso somente via RPC SECURITY DEFINER / service_role
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'portalteg_missoes',
    'portalteg_passkeys',
    'portalteg_push_mensagens_seg_exc',
    'portalteg_webauthn_challenges'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR ALL TO service_role
         USING (true) WITH CHECK (true)',
      t || '_service_role', t
    );
  END LOOP;
END $$;

-- RH admissao: emails processados por batch (modulo rh ou admin)
DO $$
BEGIN
  IF to_regclass('public.rh_admissao_emails_processados') IS NOT NULL THEN
    ALTER TABLE public.rh_admissao_emails_processados ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS rh_admissao_emails_select ON public.rh_admissao_emails_processados;
    CREATE POLICY rh_admissao_emails_select ON public.rh_admissao_emails_processados
      FOR SELECT TO authenticated
      USING (public.is_admin() OR public.can_access_modulo('rh', auth.uid()));
    DROP POLICY IF EXISTS rh_admissao_emails_write ON public.rh_admissao_emails_processados;
    CREATE POLICY rh_admissao_emails_write ON public.rh_admissao_emails_processados
      FOR ALL TO authenticated
      USING (public.is_admin() OR public.can_access_modulo('rh', auth.uid()))
      WITH CHECK (public.is_admin() OR public.can_access_modulo('rh', auth.uid()));
    DROP POLICY IF EXISTS rh_admissao_emails_service ON public.rh_admissao_emails_processados;
    CREATE POLICY rh_admissao_emails_service ON public.rh_admissao_emails_processados
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Site: formulario publico (INSERT anon) + leitura admin
DO $$
BEGIN
  IF to_regclass('public.site_contato_mensagens') IS NOT NULL THEN
    ALTER TABLE public.site_contato_mensagens ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS site_contato_anon_insert ON public.site_contato_mensagens;
    CREATE POLICY site_contato_anon_insert ON public.site_contato_mensagens
      FOR INSERT TO anon
      WITH CHECK (true);
    DROP POLICY IF EXISTS site_contato_auth_insert ON public.site_contato_mensagens;
    CREATE POLICY site_contato_auth_insert ON public.site_contato_mensagens
      FOR INSERT TO authenticated
      WITH CHECK (true);
    DROP POLICY IF EXISTS site_contato_admin_select ON public.site_contato_mensagens;
    CREATE POLICY site_contato_admin_select ON public.site_contato_mensagens
      FOR SELECT TO authenticated
      USING (public.is_admin());
    DROP POLICY IF EXISTS site_contato_admin_write ON public.site_contato_mensagens;
    CREATE POLICY site_contato_admin_write ON public.site_contato_mensagens
      FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
    DROP POLICY IF EXISTS site_contato_service ON public.site_contato_mensagens;
    CREATE POLICY site_contato_service ON public.site_contato_mensagens
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
