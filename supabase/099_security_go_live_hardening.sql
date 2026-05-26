-- 099_security_go_live_hardening.sql
-- Hardening incremental para go-live.
-- - Segredos de sys_config ficam somente para service_role/server-side.
-- - Policies amplas de escrita passam a exigir acesso ao modulo.

-- 1) sys_config: browser nao deve ler nem gravar segredos.
DO $$
DECLARE
  v_secret_keys TEXT[] := ARRAY[
    'omie_app_key',
    'omie_app_secret',
    'omie_sandbox_app_key',
    'omie_sandbox_app_secret'
  ];
BEGIN
  IF to_regclass('public.sys_config') IS NULL THEN
    RAISE NOTICE 'sys_config nao existe; hardening ignorado.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.sys_config ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS "sys_config_admin_read" ON public.sys_config';
  EXECUTE 'DROP POLICY IF EXISTS "sys_config_admin_write" ON public.sys_config';
  EXECUTE 'DROP POLICY IF EXISTS "sys_config_auth_read_safe" ON public.sys_config';
  EXECUTE 'DROP POLICY IF EXISTS "sys_config_auth_write_safe" ON public.sys_config';

  EXECUTE format(
    'CREATE POLICY "sys_config_auth_read_safe" ON public.sys_config
       FOR SELECT TO authenticated
       USING (is_admin() AND NOT (chave = ANY (%L::text[])))',
    v_secret_keys
  );

  EXECUTE format(
    'CREATE POLICY "sys_config_auth_write_safe" ON public.sys_config
       FOR ALL TO authenticated
       USING (is_admin() AND NOT (chave = ANY (%L::text[])))
       WITH CHECK (is_admin() AND NOT (chave = ANY (%L::text[])))',
    v_secret_keys,
    v_secret_keys
  );

  EXECUTE 'DROP POLICY IF EXISTS "sys_config_service_role" ON public.sys_config';
  EXECUTE 'CREATE POLICY "sys_config_service_role" ON public.sys_config
     FOR ALL TO service_role
     USING (true)
     WITH CHECK (true)';
END $$;

-- 2) Escrita autenticada: trocar USING(true) por acesso ao modulo.
DO $$
DECLARE
  r RECORD;
  p RECORD;
  v_policy_name TEXT;
BEGIN
  IF to_regprocedure('public.can_access_modulo(text, uuid)') IS NULL THEN
    RAISE NOTICE 'can_access_modulo(text, uuid) nao existe; hardening de modulos ignorado.';
    RETURN;
  END IF;

  FOR r IN
    SELECT *
    FROM (VALUES
      -- Financeiro
      ('fin_contas_pagar', 'financeiro'),
      ('fin_contas_receber', 'financeiro'),
      ('fin_lotes_pagamento', 'financeiro'),
      ('fin_lote_itens', 'financeiro'),
      ('fin_contas_bancarias', 'financeiro'),
      ('fin_movimentacoes_tesouraria', 'financeiro'),
      ('fin_extratos_import', 'financeiro'),

      -- Contratos
      ('con_clientes', 'contratos'),
      ('con_contratos', 'contratos'),
      ('con_medicoes', 'contratos'),
      ('con_medicao_itens', 'contratos'),
      ('con_pleitos', 'contratos'),
      ('con_solicitacoes', 'contratos'),
      ('con_minutas', 'contratos'),
      ('con_resumos_executivos', 'contratos'),

      -- Controladoria
      ('ctrl_orcamentos', 'controladoria'),
      ('ctrl_cenarios', 'controladoria'),
      ('ctrl_indicadores_producao', 'controladoria'),

      -- Frotas
      ('fro_veiculos', 'frotas'),
      ('fro_fornecedores', 'frotas'),
      ('fro_ordens_servico', 'frotas'),
      ('fro_itens_os', 'frotas'),
      ('fro_cotacoes_os', 'frotas'),
      ('fro_checklists', 'frotas'),
      ('fro_abastecimentos', 'frotas'),
      ('fro_ocorrencias_telemetria', 'frotas'),
      ('fro_avaliacoes_fornecedor', 'frotas'),
      ('fro_planos_preventiva', 'frotas'),
      ('fro_acessorios', 'frotas'),
      ('fro_veiculo_acessorios', 'frotas'),
      ('fro_alocacoes', 'frotas'),
      ('fro_checklist_templates', 'frotas'),
      ('fro_checklist_template_itens', 'frotas'),
      ('fro_checklist_execucoes', 'frotas'),
      ('fro_checklist_execucao_itens', 'frotas'),
      ('fro_multas', 'frotas'),
      ('fro_itens_manutencao', 'frotas'),
      ('fro_alocacoes_hist', 'frotas'),

      -- Estoque / Patrimonio
      ('est_itens', 'estoque'),
      ('est_solicitacoes', 'estoque'),
      ('est_solicitacao_itens', 'estoque'),
      ('est_inventarios', 'estoque'),
      ('est_inventario_itens', 'estoque'),
      ('est_cautelas', 'estoque'),
      ('est_cautela_itens', 'estoque'),
      ('est_cautela_favoritos', 'estoque'),
      ('est_cautela_templates', 'estoque'),
      ('pat_imobilizados', 'patrimonio'),
      ('pat_movimentacoes', 'patrimonio'),
      ('pat_termos_responsabilidade', 'patrimonio'),
      ('pat_depreciacoes', 'patrimonio'),
      ('pat_transferencias', 'patrimonio')
    ) AS x(table_name, module_key)
  LOOP
    IF to_regclass('public.' || r.table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = r.table_name
        AND ('authenticated' = ANY (roles) OR 'public' = ANY (roles))
        AND cmd <> 'SELECT'
        AND (
          lower(coalesce(qual, '')) IN ('true', '(true)')
          OR lower(coalesce(with_check, '')) IN ('true', '(true)')
        )
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, r.table_name);
    END LOOP;

    v_policy_name := left('rls_go_live_' || r.table_name || '_module_write', 60);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_name, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         FOR ALL TO authenticated
         USING (public.can_access_modulo(%L, auth.uid()))
         WITH CHECK (public.can_access_modulo(%L, auth.uid()))',
      v_policy_name,
      r.table_name,
      r.module_key,
      r.module_key
    );
  END LOOP;
END $$;
