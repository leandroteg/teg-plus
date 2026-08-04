-- ─────────────────────────────────────────────────────────────────────────────
-- 20260803000003_auditoria_receita_aplicar_auto.sql
--
-- O Elton quer o cadastro IGUAL ao cartão CNPJ, então a varredura passa a
-- aplicar sozinha o que encontra (antes só marcava para revisão).
--
-- Reversível: os valores anteriores continuam guardados em
-- divergencias->campo->>'atual' — fn_auditoria_receita_reverter(id) devolve.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auditoria_receita_aplicar_pendentes(p_limite int DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a record;
  v_qtd int := 0;
BEGIN
  FOR a IN
    SELECT id FROM cmp_fornecedores_receita_auditoria
    WHERE status = 'pendente' AND (qtd_divergencias > 0 OR (situacao IS NOT NULL AND situacao <> 'ATIVA'))
    LIMIT p_limite
  LOOP
    PERFORM cmp_fornecedor_aplicar_receita(a.id);
    v_qtd := v_qtd + 1;
  END LOOP;
  RETURN v_qtd;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_receita_reverter(p_auditoria_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aud cmp_fornecedores_receita_auditoria%ROWTYPE;
  v_campo text; v_valor text; v_rev text[] := '{}';
BEGIN
  SELECT * INTO v_aud FROM cmp_fornecedores_receita_auditoria WHERE id = p_auditoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria nao encontrada'; END IF;

  FOR v_campo IN SELECT jsonb_object_keys(v_aud.divergencias) LOOP
    CONTINUE WHEN v_campo NOT IN ('razao_social','nome_fantasia','endereco','cidade','uf','cep');
    v_valor := v_aud.divergencias -> v_campo ->> 'atual';
    EXECUTE format('UPDATE cmp_fornecedores SET %I = $1, updated_at = now() WHERE id = $2', v_campo)
      USING NULLIF(v_valor, ''), v_aud.fornecedor_id;
    v_rev := array_append(v_rev, v_campo);
  END LOOP;

  UPDATE cmp_fornecedores_receita_auditoria SET status = 'ignorado' WHERE id = p_auditoria_id;
  RETURN jsonb_build_object('revertidos', v_rev);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_receita_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_coletados int; v_disparados int; v_aplicados int;
  v_falta int; v_pendente_coleta int;
BEGIN
  v_coletados  := fn_auditoria_receita_coletar();
  v_aplicados  := fn_auditoria_receita_aplicar_pendentes(100);
  v_disparados := fn_auditoria_receita_disparar(15);

  SELECT count(*) INTO v_falta
  FROM cmp_fornecedores f
  LEFT JOIN cmp_fornecedores_receita_auditoria a ON a.fornecedor_id = f.id
  WHERE f.ativo
    AND length(regexp_replace(COALESCE(f.cnpj, ''), '\D', '', 'g')) = 14
    AND a.id IS NULL;

  SELECT count(*) INTO v_pendente_coleta
  FROM cmp_fornecedores_receita_auditoria WHERE status = 'consultando';

  IF v_falta = 0 AND v_pendente_coleta = 0 THEN
    PERFORM cron.unschedule('auditoria_receita_fornecedores')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auditoria_receita_fornecedores');
  END IF;

  RETURN jsonb_build_object('coletados', v_coletados, 'aplicados', v_aplicados,
                            'disparados', v_disparados, 'faltam', v_falta,
                            'aguardando_resposta', v_pendente_coleta);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_auditoria_receita_aplicar_pendentes(int) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_auditoria_receita_reverter(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_auditoria_receita_aplicar_pendentes(int) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.fn_auditoria_receita_reverter(uuid) TO authenticated, service_role;
