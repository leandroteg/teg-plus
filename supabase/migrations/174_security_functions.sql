-- 174_security_functions.sql
-- Fase 2: search_path, REVOKE anon em SECURITY DEFINER, internas sem EXECUTE,
--         correcao can_access_modulo em RPCs 132/133.

-- ============================================================================
-- 2.1 Fix search_path em funcoes publicas sem configuracao (advisor lint)
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
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.func_sig);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'search_path skip %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 2.2 REVOKE EXECUTE de PUBLIC/anon em todas SECURITY DEFINER (public)
--     e restaura EXECUTE para authenticated (RPCs de negocio)
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
      -- Internas (_*) ficam sem EXECUTE para authenticated
      IF r.proname NOT LIKE '\_%' ESCAPE '\' THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.func_sig);
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'revoke/grant skip %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 2.3 REVOKE EXECUTE de authenticated em auxiliares internas (_*)
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
      AND p.proname LIKE '\_%' ESCAPE '\'
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.func_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.func_sig);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'revoke auth skip %: %', r.func_sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- Reafirma GRANT em helpers de RLS usados pelas policies
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_modulo(text, uuid) TO authenticated;
DO $$
BEGIN
  IF to_regprocedure('public.can_see_base(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.can_see_base(uuid) TO authenticated;
  END IF;
  IF to_regprocedure('public.can_approve_tecnico(text, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.can_approve_tecnico(text, uuid) TO authenticated;
  END IF;
  IF to_regprocedure('public.get_feature_flag(text, boolean)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_feature_flag(text, boolean) TO authenticated;
  END IF;
  IF to_regprocedure('public.get_user_papel_global(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_user_papel_global(uuid) TO authenticated;
  END IF;
  IF to_regprocedure('public.auth_at_least(text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.auth_at_least(text) TO authenticated;
  END IF;
  IF to_regprocedure('public.role_at_least(text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.role_at_least(text) TO authenticated;
  END IF;
  IF to_regprocedure('public.get_user_role()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
  END IF;
  IF to_regprocedure('public.auth_role()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- 2.4 Bug: ordem de argumentos em can_access_modulo (modulo, user_id)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cmp_trocar_fornecedor_em_esclarecimento(
  p_cotacao_id uuid,
  p_novo_fornecedor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_req_id uuid;
  v_req_status text;
  v_cot_status text;
  v_autor_id uuid;
  v_autor_nome text;
  v_antes_id uuid;
  v_antes_nome text;
  v_antes_valor numeric;
  v_novo_nome text;
  v_novo_valor numeric;
BEGIN
  SELECT id, nome INTO v_autor_id, v_autor_nome
    FROM sys_perfis WHERE auth_id = auth.uid();
  IF v_autor_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado ou sem perfil cadastrado';
  END IF;

  IF NOT public.can_access_modulo('compras', auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao para alterar cotacoes de compras';
  END IF;

  SELECT c.requisicao_id, c.status::text, c.fornecedor_selecionado_id,
         c.fornecedor_selecionado_nome, c.valor_selecionado
    INTO v_req_id, v_cot_status, v_antes_id, v_antes_nome, v_antes_valor
    FROM cmp_cotacoes c
   WHERE c.id = p_cotacao_id;

  IF v_req_id IS NULL THEN
    RAISE EXCEPTION 'Cotacao % nao encontrada', p_cotacao_id;
  END IF;
  IF v_cot_status IS DISTINCT FROM 'concluida' THEN
    RAISE EXCEPTION 'Cotacao nao esta concluida (status atual: %)', v_cot_status;
  END IF;

  SELECT status::text INTO v_req_status
    FROM cmp_requisicoes WHERE id = v_req_id;
  IF v_req_status IS DISTINCT FROM 'cotacao_em_esclarecimento' THEN
    RAISE EXCEPTION 'RC nao esta em esclarecimento de cotacao (status atual: %)', v_req_status;
  END IF;

  SELECT fornecedor_nome, valor_total
    INTO v_novo_nome, v_novo_valor
    FROM cmp_cotacao_fornecedores
   WHERE id = p_novo_fornecedor_id AND cotacao_id = p_cotacao_id;
  IF v_novo_nome IS NULL THEN
    RAISE EXCEPTION 'Fornecedor % nao pertence a esta cotacao', p_novo_fornecedor_id;
  END IF;

  IF v_antes_id = p_novo_fornecedor_id THEN
    RETURN jsonb_build_object(
      'changed', false,
      'fornecedor_selecionado_id', v_antes_id,
      'fornecedor_selecionado_nome', v_antes_nome,
      'valor_selecionado', v_antes_valor
    );
  END IF;

  UPDATE cmp_cotacao_fornecedores
     SET selecionado = false
   WHERE cotacao_id = p_cotacao_id AND selecionado IS TRUE;

  UPDATE cmp_cotacao_fornecedores
     SET selecionado = true
   WHERE id = p_novo_fornecedor_id;

  UPDATE cmp_cotacoes
     SET fornecedor_selecionado_id = p_novo_fornecedor_id,
         fornecedor_selecionado_nome = v_novo_nome,
         valor_selecionado = v_novo_valor,
         updated_at = now()
   WHERE id = p_cotacao_id;

  INSERT INTO cmp_historico_status (
    requisicao_id, status_anterior, status_novo,
    responsavel_nome, responsavel_tipo, observacao, dados_extra
  ) VALUES (
    v_req_id,
    v_req_status,
    v_req_status,
    COALESCE(v_autor_nome, 'Sistema'),
    'comprador',
    format('Fornecedor escolhido alterado em esclarecimento: %s -> %s',
           COALESCE(v_antes_nome, '-'), v_novo_nome),
    jsonb_build_object(
      'tipo', 'troca_fornecedor_esclarecimento',
      'antes', jsonb_build_object(
        'fornecedor_id', v_antes_id,
        'fornecedor_nome', v_antes_nome,
        'valor_selecionado', v_antes_valor
      ),
      'depois', jsonb_build_object(
        'fornecedor_id', p_novo_fornecedor_id,
        'fornecedor_nome', v_novo_nome,
        'valor_selecionado', v_novo_valor
      )
    )
  );

  RETURN jsonb_build_object(
    'changed', true,
    'fornecedor_selecionado_id', p_novo_fornecedor_id,
    'fornecedor_selecionado_nome', v_novo_nome,
    'valor_selecionado', v_novo_valor
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cmp_trocar_fornecedor_em_esclarecimento(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cmp_trocar_fornecedor_em_esclarecimento(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cmp_renegociar_valor_em_esclarecimento(
  p_cotacao_id uuid,
  p_fornecedor_id uuid,
  p_novo_valor_total numeric,
  p_observacao text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_req_id uuid;
  v_req_status text;
  v_cot_status text;
  v_autor_id uuid;
  v_autor_nome text;
  v_sel_id uuid;
  v_sel_nome text;
  v_valor_anterior numeric;
  v_forn_nome text;
  v_forn_selecionado boolean;
  v_forn_valor numeric;
BEGIN
  SELECT id, nome INTO v_autor_id, v_autor_nome
    FROM sys_perfis WHERE auth_id = auth.uid();
  IF v_autor_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado ou sem perfil cadastrado';
  END IF;

  IF NOT public.can_access_modulo('compras', auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao para alterar cotacoes de compras';
  END IF;

  SELECT c.requisicao_id, c.status::text, c.fornecedor_selecionado_id,
         c.fornecedor_selecionado_nome, c.valor_selecionado
    INTO v_req_id, v_cot_status, v_sel_id, v_sel_nome, v_valor_anterior
    FROM cmp_cotacoes c
   WHERE c.id = p_cotacao_id;

  IF v_req_id IS NULL THEN
    RAISE EXCEPTION 'Cotacao % nao encontrada', p_cotacao_id;
  END IF;
  IF v_cot_status IS DISTINCT FROM 'concluida' THEN
    RAISE EXCEPTION 'Cotacao nao esta concluida (status atual: %)', v_cot_status;
  END IF;

  SELECT status::text INTO v_req_status
    FROM cmp_requisicoes WHERE id = v_req_id;
  IF v_req_status IS DISTINCT FROM 'cotacao_em_esclarecimento' THEN
    RAISE EXCEPTION 'RC nao esta em esclarecimento de cotacao (status atual: %)', v_req_status;
  END IF;

  SELECT fornecedor_nome, selecionado, valor_total
    INTO v_forn_nome, v_forn_selecionado, v_forn_valor
    FROM cmp_cotacao_fornecedores
   WHERE id = p_fornecedor_id AND cotacao_id = p_cotacao_id;
  IF v_forn_nome IS NULL THEN
    RAISE EXCEPTION 'Fornecedor % nao pertence a esta cotacao', p_fornecedor_id;
  END IF;
  IF v_forn_selecionado IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Fornecedor informado nao e o selecionado da cotacao. Para trocar o fornecedor, use o fluxo de troca.';
  END IF;

  IF p_novo_valor_total IS NULL OR p_novo_valor_total <= 0 THEN
    RAISE EXCEPTION 'Novo valor total deve ser maior que zero';
  END IF;

  IF v_forn_valor = p_novo_valor_total THEN
    RETURN jsonb_build_object(
      'changed', false,
      'valor_anterior', v_forn_valor,
      'valor_selecionado', v_forn_valor,
      'fornecedor_selecionado_id', v_sel_id,
      'fornecedor_selecionado_nome', v_sel_nome
    );
  END IF;

  UPDATE cmp_cotacao_fornecedores
     SET valor_total = p_novo_valor_total
   WHERE id = p_fornecedor_id;

  UPDATE cmp_cotacoes
     SET valor_selecionado = p_novo_valor_total,
         updated_at = now()
   WHERE id = p_cotacao_id;

  INSERT INTO cmp_historico_status (
    requisicao_id, status_anterior, status_novo,
    responsavel_nome, responsavel_tipo, observacao, dados_extra
  ) VALUES (
    v_req_id,
    v_req_status,
    v_req_status,
    COALESCE(v_autor_nome, 'Sistema'),
    'comprador',
    format('Valor renegociado em esclarecimento: R$ %s -> R$ %s (obs: %s)',
           to_char(v_valor_anterior, 'FM999G999G990D00'),
           to_char(p_novo_valor_total, 'FM999G999G990D00'),
           COALESCE(NULLIF(p_observacao, ''), '-')),
    jsonb_build_object(
      'tipo', 'renegociacao_valor_esclarecimento',
      'antes', jsonb_build_object(
        'fornecedor_id', p_fornecedor_id,
        'fornecedor_nome', v_forn_nome,
        'valor_total', v_valor_anterior
      ),
      'depois', jsonb_build_object(
        'fornecedor_id', p_fornecedor_id,
        'fornecedor_nome', v_forn_nome,
        'valor_total', p_novo_valor_total
      ),
      'observacao_comprador', p_observacao
    )
  );

  RETURN jsonb_build_object(
    'changed', true,
    'valor_anterior', v_valor_anterior,
    'valor_selecionado', p_novo_valor_total,
    'fornecedor_selecionado_id', p_fornecedor_id,
    'fornecedor_selecionado_nome', v_forn_nome
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cmp_renegociar_valor_em_esclarecimento(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cmp_renegociar_valor_em_esclarecimento(uuid, uuid, numeric, text) TO authenticated;
