-- ─────────────────────────────────────────────────────────────────────────────
-- 215_locacao_caixa_alta.sql
--
-- Gestão de Imóveis aceitava cadastro em caixa baixa — no Contas a Pagar o
-- fornecedor saía "Cláudia Barreto Alves Mariconi" ao lado de
-- "CLEIDSON ANTONIO DE SOUZA". O front passou a usar UpperInput; aqui vai o
-- acerto do que já está gravado.
--
-- Mesma regra do toUpperNorm do front: caixa alta SEM acento.
-- Contato (telefone/e-mail) fica de fora — e-mail em caixa alta é ilegível.
-- Guarda o valor original antes de mexer.
-- ─────────────────────────────────────────────────────────────────────────────

-- Caixa alta sem acento, igual ao toUpperNorm de components/UpperInput.tsx
CREATE OR REPLACE FUNCTION public.fn_upper_norm(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(translate(
    txt,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ));
$$;

COMMENT ON FUNCTION public.fn_upper_norm(text) IS
  'Caixa alta sem acento — espelho SQL do toUpperNorm usado pelo UpperInput no front.';

-- ── Backup do que será alterado ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.backup_caixa_alta_locacao_20260804 AS
SELECT id, descricao, endereco, numero, complemento, bairro, cidade, uf, locador_nome
  FROM public.loc_imoveis
 WHERE false;

INSERT INTO public.backup_caixa_alta_locacao_20260804
SELECT id, descricao, endereco, numero, complemento, bairro, cidade, uf, locador_nome
  FROM public.loc_imoveis
 WHERE NOT EXISTS (
   SELECT 1 FROM public.backup_caixa_alta_locacao_20260804 b WHERE b.id = loc_imoveis.id
 );

CREATE TABLE IF NOT EXISTS public.backup_caixa_alta_cp_locacao_20260804 AS
SELECT id, fornecedor_nome, descricao
  FROM public.fin_contas_pagar
 WHERE false;

INSERT INTO public.backup_caixa_alta_cp_locacao_20260804
SELECT id, fornecedor_nome, descricao
  FROM public.fin_contas_pagar
 WHERE origem = 'locacao'
   AND NOT EXISTS (
     SELECT 1 FROM public.backup_caixa_alta_cp_locacao_20260804 b WHERE b.id = fin_contas_pagar.id
   );

-- ── Imóveis ─────────────────────────────────────────────────────────────────
UPDATE public.loc_imoveis SET
  descricao    = fn_upper_norm(descricao),
  endereco     = fn_upper_norm(endereco),
  numero       = fn_upper_norm(numero),
  complemento  = fn_upper_norm(complemento),
  bairro       = fn_upper_norm(bairro),
  cidade       = fn_upper_norm(cidade),
  uf           = fn_upper_norm(uf),
  locador_nome = fn_upper_norm(locador_nome)
WHERE fn_upper_norm(COALESCE(descricao,''))   IS DISTINCT FROM COALESCE(descricao,'')
   OR fn_upper_norm(COALESCE(endereco,''))    IS DISTINCT FROM COALESCE(endereco,'')
   OR fn_upper_norm(COALESCE(numero,''))      IS DISTINCT FROM COALESCE(numero,'')
   OR fn_upper_norm(COALESCE(complemento,'')) IS DISTINCT FROM COALESCE(complemento,'')
   OR fn_upper_norm(COALESCE(bairro,''))      IS DISTINCT FROM COALESCE(bairro,'')
   OR fn_upper_norm(COALESCE(cidade,''))      IS DISTINCT FROM COALESCE(cidade,'')
   OR fn_upper_norm(COALESCE(uf,''))          IS DISTINCT FROM COALESCE(uf,'')
   OR fn_upper_norm(COALESCE(locador_nome,''))IS DISTINCT FROM COALESCE(locador_nome,'');

-- ── Contas a Pagar já geradas pela locação ──────────────────────────────────
UPDATE public.fin_contas_pagar SET
  fornecedor_nome = fn_upper_norm(fornecedor_nome),
  descricao       = fn_upper_norm(descricao)
WHERE origem = 'locacao'
  AND (fn_upper_norm(COALESCE(fornecedor_nome,'')) IS DISTINCT FROM COALESCE(fornecedor_nome,'')
    OR fn_upper_norm(COALESCE(descricao,''))       IS DISTINCT FROM COALESCE(descricao,''));
