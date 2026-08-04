-- ─────────────────────────────────────────────────────────────────────────────
-- 20260803000001_fornecedor_auditoria_receita.sql
--
-- Auditoria de cadastro dos fornecedores contra a Receita Federal (cartão CNPJ).
-- Guarda o retorno da consulta e as divergências campo a campo para o usuário
-- revisar e aplicar — 1.281 CNPJs ativos não cabem numa tacada só, então a
-- tabela serve de checkpoint/cache entre execuções.
--
-- Regra definida com o Elton (03/ago):
--   • sincroniza razão social, fantasia, endereço, cidade, UF, CEP
--   • NÃO toca telefone/e-mail (contato do time é melhor que o da Receita)
--   • fornecedor BAIXADO/INAPTO/SUSPENSO na Receita é inativado
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cmp_fornecedores_receita_auditoria (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id  uuid NOT NULL REFERENCES public.cmp_fornecedores(id) ON DELETE CASCADE,
  cnpj           text NOT NULL,
  consultado_em  timestamptz NOT NULL DEFAULT now(),
  situacao       text,                      -- ATIVA / BAIXADA / INAPTA / SUSPENSA / NULA
  receita        jsonb,                     -- payload normalizado da consulta
  divergencias   jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {campo: {atual, receita}}
  qtd_divergencias int NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'pendente',    -- pendente|aplicado|ignorado|erro|ok
  erro           text,
  aplicado_em    timestamptz,
  aplicado_por   text,
  criado_por_nome     text,
  atualizado_por_nome text,
  CONSTRAINT cmp_forn_receita_aud_uniq UNIQUE (fornecedor_id)
);

CREATE INDEX IF NOT EXISTS idx_forn_receita_aud_status ON public.cmp_fornecedores_receita_auditoria(status);
CREATE INDEX IF NOT EXISTS idx_forn_receita_aud_situacao ON public.cmp_fornecedores_receita_auditoria(situacao);

ALTER TABLE public.cmp_fornecedores_receita_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forn_receita_aud_select ON public.cmp_fornecedores_receita_auditoria;
CREATE POLICY forn_receita_aud_select ON public.cmp_fornecedores_receita_auditoria
  FOR SELECT USING (can_access_modulo('compras', auth.uid()) OR can_access_modulo('financeiro', auth.uid()) OR is_admin());

DROP POLICY IF EXISTS forn_receita_aud_write ON public.cmp_fornecedores_receita_auditoria;
CREATE POLICY forn_receita_aud_write ON public.cmp_fornecedores_receita_auditoria
  FOR ALL USING (can_access_modulo('compras', auth.uid()) OR can_access_modulo('financeiro', auth.uid()) OR is_admin())
  WITH CHECK (can_access_modulo('compras', auth.uid()) OR can_access_modulo('financeiro', auth.uid()) OR is_admin());

-- Aplicação da correção passa por RPC: cmp_fornecedores tem RLS de escrita por
-- role (comprador+) e a auditoria pode ser aplicada pelo financeiro.
CREATE OR REPLACE FUNCTION public.cmp_fornecedor_aplicar_receita(
  p_auditoria_id uuid,
  p_campos       text[] DEFAULT NULL   -- NULL = todos os campos divergentes
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
  v_aplicados text[] := '{}';
BEGIN
  SELECT * INTO v_aud FROM cmp_fornecedores_receita_auditoria WHERE id = p_auditoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria nao encontrada'; END IF;

  SELECT nome INTO v_nome FROM sys_perfis WHERE auth_id = auth.uid() AND ativo LIMIT 1;

  FOR v_campo IN SELECT jsonb_object_keys(v_aud.divergencias)
  LOOP
    CONTINUE WHEN p_campos IS NOT NULL AND NOT (v_campo = ANY(p_campos));
    v_valor := v_aud.divergencias -> v_campo ->> 'receita';
    IF v_valor IS NULL OR TRIM(v_valor) = '' THEN CONTINUE; END IF;

    -- lista branca de colunas (evita update em coluna arbitraria)
    IF v_campo NOT IN ('razao_social','nome_fantasia','endereco','cidade','uf','cep') THEN
      CONTINUE;
    END IF;

    EXECUTE format('UPDATE cmp_fornecedores SET %I = $1, updated_at = now() WHERE id = $2', v_campo)
      USING v_valor, v_aud.fornecedor_id;
    v_aplicados := array_append(v_aplicados, v_campo);
  END LOOP;

  -- Situacao irregular na Receita: fornecedor sai de circulacao
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

REVOKE EXECUTE ON FUNCTION public.cmp_fornecedor_aplicar_receita(uuid, text[]) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.cmp_fornecedor_aplicar_receita(uuid, text[]) TO authenticated, service_role;

-- Inativa em massa os que a Receita aponta como irregulares (decisao do Elton)
CREATE OR REPLACE FUNCTION public.cmp_fornecedor_inativar_irregulares()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_qtd integer;
BEGIN
  WITH alvo AS (
    SELECT a.fornecedor_id
    FROM cmp_fornecedores_receita_auditoria a
    JOIN cmp_fornecedores f ON f.id = a.fornecedor_id
    WHERE a.situacao IS NOT NULL AND upper(a.situacao) <> 'ATIVA' AND f.ativo
  )
  UPDATE cmp_fornecedores f SET ativo = false, updated_at = now()
  FROM alvo WHERE f.id = alvo.fornecedor_id;
  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RETURN v_qtd;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cmp_fornecedor_inativar_irregulares() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.cmp_fornecedor_inativar_irregulares() TO authenticated, service_role;
