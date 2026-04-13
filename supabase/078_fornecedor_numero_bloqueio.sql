-- Migration 078: numero interno e protecao de campos sensiveis de fornecedores
-- Mantem service_role/n8n liberado para integracoes externas.

ALTER TABLE public.cmp_fornecedores
  ADD COLUMN IF NOT EXISTS numero_cadastro text;

CREATE SEQUENCE IF NOT EXISTS public.cmp_fornecedores_numero_seq;

WITH numerados AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.cmp_fornecedores
  WHERE numero_cadastro IS NULL OR btrim(numero_cadastro) = ''
)
UPDATE public.cmp_fornecedores f
SET numero_cadastro = 'FOR-' || lpad(n.rn::text, 6, '0')
FROM numerados n
WHERE f.id = n.id;

SELECT setval(
  'public.cmp_fornecedores_numero_seq',
  GREATEST(
    COALESCE((
      SELECT max(substring(numero_cadastro from 'FOR-([0-9]+)')::bigint)
      FROM public.cmp_fornecedores
      WHERE numero_cadastro ~ '^FOR-[0-9]+$'
    ), 0),
    1
  ),
  true
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cmp_fornecedores_numero_cadastro
  ON public.cmp_fornecedores (numero_cadastro)
  WHERE numero_cadastro IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_cmp_fornecedores_numero_cadastro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_cadastro IS NULL OR btrim(NEW.numero_cadastro) = '' THEN
    NEW.numero_cadastro := 'FOR-' || lpad(nextval('public.cmp_fornecedores_numero_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cmp_fornecedores_numero_cadastro ON public.cmp_fornecedores;
CREATE TRIGGER trg_cmp_fornecedores_numero_cadastro
  BEFORE INSERT ON public.cmp_fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cmp_fornecedores_numero_cadastro();

CREATE OR REPLACE FUNCTION public.bloquear_cmp_fornecedores_campos_sensiveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Integracoes externas e manutencoes administrativas continuam livres.
  IF COALESCE(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.sys_perfis p
    WHERE p.auth_id = auth.uid()
      AND p.ativo = true
      AND p.role IN ('admin', 'administrador')
  )
  INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.numero_cadastro IS DISTINCT FROM OLD.numero_cadastro
    OR NEW.razao_social IS DISTINCT FROM OLD.razao_social
    OR NEW.nome_fantasia IS DISTINCT FROM OLD.nome_fantasia
    OR NEW.cnpj IS DISTINCT FROM OLD.cnpj
    OR NEW.inscricao_estadual IS DISTINCT FROM OLD.inscricao_estadual
    OR NEW.endereco IS DISTINCT FROM OLD.endereco
    OR NEW.cidade IS DISTINCT FROM OLD.cidade
    OR NEW.uf IS DISTINCT FROM OLD.uf
    OR NEW.cep IS DISTINCT FROM OLD.cep
    OR NEW.banco_codigo IS DISTINCT FROM OLD.banco_codigo
    OR NEW.banco_nome IS DISTINCT FROM OLD.banco_nome
    OR NEW.agencia IS DISTINCT FROM OLD.agencia
    OR NEW.conta IS DISTINCT FROM OLD.conta
    OR NEW.tipo_conta IS DISTINCT FROM OLD.tipo_conta
    OR NEW.boleto IS DISTINCT FROM OLD.boleto
    OR NEW.pix_chave IS DISTINCT FROM OLD.pix_chave
    OR NEW.pix_tipo IS DISTINCT FROM OLD.pix_tipo
    OR NEW.omie_id IS DISTINCT FROM OLD.omie_id
    OR NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    RAISE EXCEPTION 'Campos sensiveis do fornecedor exigem aprovacao de Admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_cmp_fornecedores_campos_sensiveis ON public.cmp_fornecedores;
CREATE TRIGGER trg_bloquear_cmp_fornecedores_campos_sensiveis
  BEFORE UPDATE ON public.cmp_fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_cmp_fornecedores_campos_sensiveis();
