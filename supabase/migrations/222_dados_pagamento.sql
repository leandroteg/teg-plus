-- 222_dados_pagamento.sql
-- Dados para pagamento (favorecido, banco/agência/conta, PIX) estruturados nos
-- lançamentos financeiros — pedido do user 04/ago.
--
-- Antes disso só o Pagamento Extraordinário coletava esses dados, e gravava
-- como TEXTO concatenado em observacoes ("Dados bancarios: Favorecido: ... |
-- Banco: ..."). O card do CPPipeline lia de remessa_payload.manual_request
-- .dados_bancarios, que nenhum caminho gravava — ou seja, o bloco "Dados
-- bancários informados" nunca aparecia para lançamento novo.
--
-- Agora Previsão de Pagamento, Pagamento Extraordinário e Lançar NF de
-- Recebimento gravam no mesmo lugar, consultável:
--   {"favorecido","banco_nome","agencia","conta","pix_tipo","pix_chave"}
-- Na CP são os dados de QUEM RECEBE (beneficiário); na CR, os dados bancários
-- do CLIENTE que está pagando.

ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS dados_pagamento jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.fin_contas_receber
  ADD COLUMN IF NOT EXISTS dados_pagamento jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.fin_contas_pagar.dados_pagamento IS
  'Dados para pagamento do beneficiário: favorecido, banco_nome, agencia, conta, pix_tipo, pix_chave.';

COMMENT ON COLUMN public.fin_contas_receber.dados_pagamento IS
  'Dados bancários do cliente pagador: favorecido, banco_nome, agencia, conta, pix_tipo, pix_chave.';

-- Backfill dos extraordinários já lançados: recupera o que ficou preso no texto
-- de observacoes ("Dados bancarios: Favorecido: X | Banco: Y | ...").
UPDATE public.fin_contas_pagar cp
SET dados_pagamento = COALESCE(bloco.dados, '{}'::jsonb)
FROM (
  SELECT
    id,
    jsonb_strip_nulls(jsonb_build_object(
      'favorecido',  NULLIF(btrim(substring(observacoes FROM 'Favorecido: ([^|\n]+)')), ''),
      'banco_nome',  NULLIF(btrim(substring(observacoes FROM 'Banco: ([^|\n]+)')), ''),
      'agencia',     NULLIF(btrim(substring(observacoes FROM 'Agencia: ([^|\n]+)')), ''),
      'conta',       NULLIF(btrim(substring(observacoes FROM 'Conta: ([^|\n]+)')), ''),
      'pix_tipo',    NULLIF(btrim(substring(observacoes FROM 'PIX Tipo: ([^|\n]+)')), ''),
      'pix_chave',   NULLIF(btrim(substring(observacoes FROM 'PIX Chave: ([^|\n]+)')), '')
    )) AS dados
  FROM public.fin_contas_pagar
  WHERE observacoes LIKE '%Dados bancarios:%'
) AS bloco
WHERE cp.id = bloco.id
  AND cp.dados_pagamento = '{}'::jsonb
  AND bloco.dados <> '{}'::jsonb;
