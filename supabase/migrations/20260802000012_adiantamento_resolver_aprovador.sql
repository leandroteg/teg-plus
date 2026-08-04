-- ─────────────────────────────────────────────────────────────────────────────
-- 20260802000012_adiantamento_resolver_aprovador.sql
--
-- BUG: "Nenhum aprovador disponível para esta solicitação".
-- O front resolvia o aprovador lendo sys_perfis (Welton/Leandro) direto do
-- cliente, mas a RLS de sys_perfis só deixa o usuário ler o PRÓPRIO perfil
-- (admin/TI à parte) — a busca voltava vazia e a solicitação morria aí.
--
-- Roteamento passa a ser resolvido no banco (SECURITY DEFINER), pela lotação do
-- FAVORECIDO: UF do local de trabalho → obra → endereço; MG=Welton, MS=Leandro;
-- senão gestor direto do RH; senão Welton (fallback).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.desp_resolver_aprovador_adiantamento(
  p_favorecido_email text DEFAULT NULL,
  p_favorecido_nome  text DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_colab   rh_colaboradores%ROWTYPE;
  v_uf      text;
  v_welton  record;
  v_leandro record;
  v_gestor  record;
BEGIN
  -- 1. Colaborador do favorecido (e-mail > nome); sem match, o do usuário logado
  IF COALESCE(TRIM(p_favorecido_email), '') <> '' THEN
    SELECT * INTO v_colab FROM rh_colaboradores
    WHERE ativo AND lower(trim(email)) = lower(trim(p_favorecido_email)) LIMIT 1;
  END IF;

  IF v_colab.id IS NULL AND COALESCE(TRIM(p_favorecido_nome), '') <> '' THEN
    SELECT * INTO v_colab FROM rh_colaboradores
    WHERE ativo AND upper(trim(nome)) = upper(trim(p_favorecido_nome)) LIMIT 1;
  END IF;

  IF v_colab.id IS NULL THEN
    SELECT c.* INTO v_colab FROM rh_colaboradores c
    JOIN sys_perfis p ON p.id = c.perfil_id
    WHERE p.auth_id = auth.uid() LIMIT 1;
  END IF;

  -- 2. UF efetiva do favorecido
  IF v_colab.id IS NOT NULL THEN
    v_uf := NULLIF(upper(trim(COALESCE(v_colab.local_trabalho_uf, ''))), '');
    IF v_uf IS NULL AND v_colab.obra_id IS NOT NULL THEN
      SELECT NULLIF(upper(trim(COALESCE(uf, ''))), '') INTO v_uf FROM sys_obras WHERE id = v_colab.obra_id;
    END IF;
    IF v_uf IS NULL THEN
      v_uf := NULLIF(upper(trim(COALESCE(v_colab.uf, ''))), '');
    END IF;
  END IF;

  SELECT id, nome, email INTO v_welton  FROM sys_perfis
  WHERE ativo AND nome ILIKE '%WELTON APARECIDO PEREIRA%' AND COALESCE(email,'') <> '' LIMIT 1;
  SELECT id, nome, email INTO v_leandro FROM sys_perfis
  WHERE ativo AND nome ILIKE '%LEANDRO MAIA MALLET%' AND COALESCE(email,'') <> '' LIMIT 1;

  -- 3. Rota por UF
  IF v_uf = 'MG' AND v_welton.email IS NOT NULL THEN
    RETURN jsonb_build_object('nome', v_welton.nome, 'email', v_welton.email,
                              'gestor_rh_id', NULL, 'uf', v_uf, 'via', 'uf_mg');
  ELSIF v_uf = 'MS' AND v_leandro.email IS NOT NULL THEN
    RETURN jsonb_build_object('nome', v_leandro.nome, 'email', v_leandro.email,
                              'gestor_rh_id', NULL, 'uf', v_uf, 'via', 'uf_ms');
  END IF;

  -- 4. Gestor direto do RH
  IF v_colab.gestor_id IS NOT NULL THEN
    SELECT id, nome, email INTO v_gestor FROM rh_colaboradores WHERE id = v_colab.gestor_id;
    IF v_gestor.email IS NOT NULL AND TRIM(v_gestor.email) <> '' THEN
      RETURN jsonb_build_object('nome', v_gestor.nome, 'email', v_gestor.email,
                                'gestor_rh_id', v_gestor.id, 'uf', v_uf, 'via', 'gestor_rh');
    END IF;
  END IF;

  -- 5. Fallback
  IF v_welton.email IS NOT NULL THEN
    RETURN jsonb_build_object('nome', v_welton.nome, 'email', v_welton.email,
                              'gestor_rh_id', NULL, 'uf', v_uf, 'via', 'fallback');
  END IF;
  IF v_leandro.email IS NOT NULL THEN
    RETURN jsonb_build_object('nome', v_leandro.nome, 'email', v_leandro.email,
                              'gestor_rh_id', NULL, 'uf', v_uf, 'via', 'fallback');
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.desp_resolver_aprovador_adiantamento(text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.desp_resolver_aprovador_adiantamento(text, text) TO authenticated, service_role;
