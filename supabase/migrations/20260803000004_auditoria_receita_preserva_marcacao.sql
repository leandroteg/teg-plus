-- ─────────────────────────────────────────────────────────────────────────────
-- 20260803000004_auditoria_receita_preserva_marcacao.sql
--
-- O time usa MARCAÇÕES INTERNAS no nome do fornecedor e a sincronização com a
-- Receita estava apagando todas:
--   "(ML)" / "- ML"  → fornecedor comprado pelo Mercado Livre
--   "(AG 5807)"      → agência do banco
--   "(PECAS)"        → especialidade
--   "(NOME DO SOCIO)"→ identificação da pessoa (essa o Elton QUER remover)
--
-- Regra: aplica o nome oficial da Receita e reanexa só a marcação OPERACIONAL
-- (conteúdo ≤ 10 caracteres, ou começando com "AG "). Nome de sócio sai.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_preservar_marcacao(p_atual text, p_novo text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_marca text; v_conteudo text;
BEGIN
  IF COALESCE(TRIM(p_novo), '') = '' THEN RETURN p_novo; END IF;

  v_marca := (regexp_match(COALESCE(p_atual, ''), '(\([^)]+\))\s*$'))[1];
  IF v_marca IS NOT NULL THEN
    v_conteudo := btrim(regexp_replace(v_marca, '^\(|\)$', '', 'g'));
    IF NOT (length(v_conteudo) <= 10 OR v_conteudo ~* '^AG\s') THEN
      v_marca := NULL;
    END IF;
  END IF;

  IF v_marca IS NULL THEN
    v_marca := (regexp_match(COALESCE(p_atual, ''), '(-\s*ML)\s*$', 'i'))[1];
  END IF;

  IF v_marca IS NULL THEN RETURN p_novo; END IF;
  IF upper(p_novo) LIKE '%' || upper(v_marca) || '%' THEN RETURN p_novo; END IF;

  RETURN btrim(p_novo) || ' ' || btrim(v_marca);
END $$;

CREATE OR REPLACE FUNCTION public.cmp_fornecedor_aplicar_receita(
  p_auditoria_id uuid,
  p_campos       text[] DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aud   cmp_fornecedores_receita_auditoria%ROWTYPE;
  v_nome  text;
  v_campo text;
  v_valor text;
  v_atual text;
  v_aplicados text[] := '{}';
BEGIN
  SELECT * INTO v_aud FROM cmp_fornecedores_receita_auditoria WHERE id = p_auditoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria nao encontrada'; END IF;

  SELECT nome INTO v_nome FROM sys_perfis WHERE auth_id = auth.uid() AND ativo LIMIT 1;

  FOR v_campo IN SELECT jsonb_object_keys(v_aud.divergencias)
  LOOP
    CONTINUE WHEN p_campos IS NOT NULL AND NOT (v_campo = ANY(p_campos));
    v_valor := v_aud.divergencias -> v_campo ->> 'receita';
    v_atual := v_aud.divergencias -> v_campo ->> 'atual';
    IF v_valor IS NULL OR TRIM(v_valor) = '' THEN CONTINUE; END IF;

    IF v_campo NOT IN ('razao_social','nome_fantasia','endereco','cidade','uf','cep') THEN
      CONTINUE;
    END IF;

    IF v_campo IN ('razao_social','nome_fantasia') THEN
      v_valor := fn_preservar_marcacao(v_atual, v_valor);
    END IF;

    EXECUTE format('UPDATE cmp_fornecedores SET %I = $1, updated_at = now() WHERE id = $2', v_campo)
      USING v_valor, v_aud.fornecedor_id;
    v_aplicados := array_append(v_aplicados, v_campo);
  END LOOP;

  IF v_aud.situacao IS NOT NULL AND upper(v_aud.situacao) <> 'ATIVA' THEN
    UPDATE cmp_fornecedores SET ativo = false, updated_at = now() WHERE id = v_aud.fornecedor_id;
    v_aplicados := array_append(v_aplicados, 'inativado');
  END IF;

  UPDATE cmp_fornecedores_receita_auditoria
     SET status = 'aplicado', aplicado_em = now(), aplicado_por = COALESCE(v_nome, 'Sistema')
   WHERE id = p_auditoria_id;

  RETURN jsonb_build_object('fornecedor_id', v_aud.fornecedor_id, 'campos', v_aplicados);
END;
$function$;

-- Reprocessa os ja aplicados a partir do payload guardado (idempotente)
UPDATE cmp_fornecedores f
SET razao_social = fn_preservar_marcacao(
      a.divergencias->'razao_social'->>'atual', a.divergencias->'razao_social'->>'receita'),
    updated_at = now()
FROM cmp_fornecedores_receita_auditoria a
WHERE a.fornecedor_id = f.id AND a.status = 'aplicado' AND a.divergencias ? 'razao_social';

UPDATE cmp_fornecedores f
SET nome_fantasia = fn_preservar_marcacao(
      a.divergencias->'nome_fantasia'->>'atual', a.divergencias->'nome_fantasia'->>'receita'),
    updated_at = now()
FROM cmp_fornecedores_receita_auditoria a
WHERE a.fornecedor_id = f.id AND a.status = 'aplicado' AND a.divergencias ? 'nome_fantasia';
