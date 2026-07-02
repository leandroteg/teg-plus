-- 175_security_rls_write.sql
-- Fase 3: hardening de escrita (INSERT/UPDATE/DELETE/ALL) via can_access_modulo.
-- Mantem SELECT aberto onde ja existir ou cria policy de leitura aberta.
-- Estende o padrao de 099_security_go_live_hardening.sql.

-- ============================================================================
-- Registrar modulos faltantes em sys_setores (alinhamento com frontend)
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.sys_setores') IS NULL THEN
    RAISE NOTICE 'sys_setores nao existe neste ambiente; INSERT ignorado.';
    RETURN;
  END IF;

  INSERT INTO public.sys_setores (codigo, nome, modulo_key, descricao)
  VALUES
    ('egp',           'Gestao de Projetos', 'egp',           'PMO, OSCs e medicoes'),
    ('obras',         'Obras',              'obras',         'Mobilizacao, RDO e equipes de obra'),
    ('rh',            'Recursos Humanos',   'rh',            'Admissoes, colaboradores e DP'),
    ('sgi',           'Governanca SGI',     'sgi',           'Documentos, NC e objetivos'),
    ('orcamentacao',  'Orcamentacao',       'orcamentacao',  'Orcamentos e propostas'),
    ('locacao',       'Locacao',            'locacao',       'Imoveis e faturas de locacao'),
    ('paineis',       'Paineis',            'paineis',       'Dashboards e paineis gerenciais'),
    ('cadastros',     'Cadastros',          'cadastros',     'Cadastros mestres do ERP')
  ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      modulo_key = EXCLUDED.modulo_key,
      descricao = EXCLUDED.descricao,
      ativo = true;
END $$;

-- ============================================================================
-- Helper: garante SELECT aberto + write por modulo
-- ============================================================================
CREATE OR REPLACE FUNCTION public._security_apply_modulo_write(
  p_table text,
  p_module text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  v_select_policy text;
  v_write_policy text;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);

  v_select_policy := left(p_table || '_select', 60);
  v_write_policy := left(p_table || '_modulo_write', 60);

  -- Garante SELECT aberto para autenticados (intencional no ERP)
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_select_policy, p_table);
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = p_table
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY (roles)
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      v_select_policy, p_table
    );
  END IF;

  -- Remove escrita aberta (nao-SELECT) para authenticated/public
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = p_table
      AND ('authenticated' = ANY (roles) OR 'public' = ANY (roles))
      AND cmd <> 'SELECT'
      AND (
        lower(coalesce(qual, '')) IN ('true', '(true)')
        OR lower(coalesce(with_check, '')) IN ('true', '(true)')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p_table);
  END LOOP;

  -- Remove policy legada do go-live se existir
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    left('rls_go_live_' || p_table || '_module_write', 60),
    p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_write_policy, p_table);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I
       FOR ALL TO authenticated
       USING (public.can_access_modulo(%L, auth.uid()))
       WITH CHECK (public.can_access_modulo(%L, auth.uid()))',
    v_write_policy, p_table, p_module, p_module
  );
END;
$$;

REVOKE ALL ON FUNCTION public._security_apply_modulo_write(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._security_apply_modulo_write(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public._security_apply_modulo_write(text, text) FROM authenticated;

-- ============================================================================
-- Aplicar hardening por modulo
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      -- PMO / EGP
      ('pmo_aceite', 'egp'),
      ('pmo_avanco_fisico', 'egp'),
      ('pmo_comunicacao', 'egp'),
      ('pmo_cronograma_versao', 'egp'),
      ('pmo_desmobilizacao', 'egp'),
      ('pmo_documentos', 'egp'),
      ('pmo_eap', 'egp'),
      ('pmo_entregaveis', 'egp'),
      ('pmo_fluxo_os', 'egp'),
      ('pmo_histograma', 'egp'),
      ('pmo_indicadores_snapshot', 'egp'),
      ('pmo_licoes_aprendidas', 'egp'),
      ('pmo_medicao_item_periodo', 'egp'),
      ('pmo_medicao_itens', 'egp'),
      ('pmo_medicao_periodo', 'egp'),
      ('pmo_medicao_resumo', 'egp'),
      ('pmo_medicoes', 'egp'),
      ('pmo_medicao_secao', 'egp'),
      ('pmo_medicao_mensal', 'egp'),
      ('pmo_osc_itens', 'egp'),
      ('pmo_mudancas', 'egp'),
      ('pmo_multas', 'egp'),
      ('pmo_orcamento', 'egp'),
      ('pmo_plano_acao', 'egp'),
      ('pmo_portfolio', 'egp'),
      ('pmo_projetos', 'egp'),
      ('pmo_reunioes', 'egp'),
      ('pmo_riscos', 'egp'),
      ('pmo_stakeholders', 'egp'),
      ('pmo_status_report', 'egp'),
      ('pmo_tap', 'egp'),
      ('pmo_tarefas', 'egp'),
      ('egp_tap', 'egp'),

      -- Obras
      ('obr_adiantamentos', 'obras'),
      ('obr_apontamentos', 'obras'),
      ('obr_equipes', 'obras'),
      ('obr_frentes', 'obras'),
      ('obr_mobilizacoes', 'obras'),
      ('obr_planejamento_equipe', 'obras'),
      ('obr_prestacao_contas', 'obras'),
      ('obr_rdo', 'obras'),

      -- Controladoria
      ('ctrl_alertas_desvio', 'controladoria'),
      ('ctrl_dre', 'controladoria'),
      ('ctrl_kpis_snapshot', 'controladoria'),
      ('ctrl_orcamento_linhas', 'controladoria'),

      -- Orcamentacao
      ('orc_arquivos', 'orcamentacao'),
      ('orc_orcamentos', 'orcamentacao'),
      ('orc_e2_backup', 'orcamentacao'),

      -- RH
      ('rh_admissao_anexos', 'rh'),
      ('rh_admissao_candidatos', 'rh'),
      ('rh_admissao_exame', 'rh'),
      ('rh_admissao_historico', 'rh'),
      ('rh_admissao_integracao', 'rh'),
      ('rh_admissao_mobilizacao', 'rh'),
      ('rh_admissao_proposta', 'rh'),
      ('rh_admissao_registro', 'rh'),
      ('rh_admissao_treinamentos', 'rh'),
      ('rh_admissoes', 'rh'),
      ('rh_comunicados', 'rh'),
      ('rh_dependentes', 'rh'),
      ('rh_desligamentos', 'rh'),
      ('rh_documentos', 'rh'),
      ('rh_identidade_visual', 'rh'),
      ('rh_movimentacoes', 'rh'),

      -- Telemetria / Frotas
      ('tel_eventos', 'frotas'),
      ('tel_posicoes', 'frotas'),
      ('tel_sync_state', 'frotas'),
      ('fro_checklist_fotos', 'frotas'),
      ('fro_intervalos_preventiva', 'frotas'),

      -- Contratos (tabelas nao cobertas pelo 099)
      ('con_aditivos', 'contratos'),
      ('con_cronograma', 'contratos'),
      ('con_reajustes', 'contratos'),
      ('con_solicitacao_historico', 'contratos'),

      -- Compras / Aprovacoes
      ('cmp_recebimento_itens', 'compras'),
      ('apr_validadores_tecnicos', 'compras'),
      ('apr_aprovacoes', 'compras'),

      -- Estoque
      ('est_bases', 'estoque'),

      -- Logistica
      ('log_viagens', 'logistica')
    ) AS x(table_name, module_key)
  LOOP
    PERFORM public._security_apply_modulo_write(r.table_name, r.module_key);
  END LOOP;
END $$;

-- ============================================================================
-- Integracoes: somente service_role (n8n / whatsapp)
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['n8n_chat_histories', 'sys_whatsapp_log']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Remove policies abertas de escrita
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      t || '_service_role', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role', t
    );

    -- Admin pode ler no ERP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_admin())',
      t || '_admin_select', t
    );
  END LOOP;
END $$;

-- ============================================================================
-- Portal TEG: remove escrita aberta de authenticated (acesso via RPC/service_role)
-- ============================================================================
DO $$
DECLARE
  t text;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'portalteg_acessos',
    'portalteg_documentos',
    'portalteg_downloads',
    'portalteg_login_tentativas',
    'portalteg_push_envios',
    'portalteg_push_mensagens_ponto',
    'portalteg_push_subscriptions'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND ('authenticated' = ANY (roles) OR 'public' = ANY (roles) OR 'anon' = ANY (roles))
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role', t
    );
  END LOOP;
END $$;

-- Limpa helper temporario
DROP FUNCTION IF EXISTS public._security_apply_modulo_write(text, text);
