-- 236_fornecedor_exterior.sql
-- Fornecedor do exterior não tem CNPJ.
--
-- O cadastro passa a validar o DÍGITO VERIFICADOR de CPF/CNPJ (antes só conferia
-- se tinha 11 ou 14 dígitos, então qualquer número passava — foi assim que
-- entrou um "59.033.426/0001-04" duplicando fornecedor existente e um
-- "12.345.678/0001-90" de teste). Sem uma saída explícita, essa validação
-- barraria fornecedor estrangeiro, que legitimamente não tem CNPJ — hoje o
-- SHOPPING CHINA PY está cadastrado com 00.000.000/0000-00 só para driblar
-- a exigência.
--
-- A flag dispensa CNPJ, validação de DV e a regra do Cartão CNPJ. Idempotente.

ALTER TABLE public.cmp_fornecedores
  ADD COLUMN IF NOT EXISTS exterior boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cmp_fornecedores.exterior IS
  'Fornecedor estrangeiro: dispensa CNPJ, validação de dígito verificador e Cartão CNPJ.';

-- Backfill do caso conhecido: CNPJ zerado é placeholder de fornecedor estrangeiro.
UPDATE public.cmp_fornecedores
   SET exterior = true,
       cnpj = NULL
 WHERE regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = '00000000000000';
