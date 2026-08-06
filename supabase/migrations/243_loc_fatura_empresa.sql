-- 243_loc_fatura_empresa.sql
-- Empresa pagadora escolhida no lancamento da fatura de Locacao.
--
-- A CP gerada pelo envio ao Financeiro saia sem empresa_id (aparecia "—" na
-- lista e ficava fora do filtro por empresa). Regra vigente: tudo paga pela
-- TEG - CG (EMP-001), entao ela e o default; o campo na fatura permite decidir
-- diferente caso a caso, no proprio lancamento.
--
-- Emenda a loc_enviar_faturas_financeiro por replace na definicao corrente
-- (mesma tecnica das migs 240/242, que ja emendaram esta funcao):
--   1. SELECT do loop passa a trazer f.empresa_id;
--   2. INSERT na CP grava empresa_id;
--   3. valor = coalesce(fatura.empresa_id, EMP-001).
-- Backfill: CPs existentes sem empresa recebem EMP-001.

ALTER TABLE public.loc_faturas
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.sys_empresas(id);

COMMENT ON COLUMN public.loc_faturas.empresa_id IS
  'Empresa pagadora da CP gerada. NULL = default EMP-001 (TEG - CG) no envio.';

DO $mig$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='loc_enviar_faturas_financeiro';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'loc_enviar_faturas_financeiro nao encontrada';
  END IF;

  -- Idempotencia: se ja emendada, os replaces nao acham o texto e recriam igual.
  v_def := replace(v_def,
    $$      f.fornecedor_id,$$,
    $$      f.fornecedor_id, f.empresa_id,$$);

  v_def := replace(v_def,
    $$    INSERT INTO fin_contas_pagar (
      fornecedor_id, fornecedor_nome, valor_original, valor_pago, data_emissao,
      data_vencimento, data_vencimento_orig,
      centro_custo, descricao, natureza, origem, status, loc_fatura_id, observacoes
    ) VALUES (
      v_fornecedor_id, v_favorecido,$$,
    $$    INSERT INTO fin_contas_pagar (
      fornecedor_id, fornecedor_nome, valor_original, valor_pago, data_emissao,
      data_vencimento, data_vencimento_orig,
      centro_custo, descricao, natureza, origem, status, loc_fatura_id, observacoes, empresa_id
    ) VALUES (
      v_fornecedor_id, v_favorecido,$$);

  v_def := replace(v_def,
    $$        case when v_f.fornecedor_id IS NOT NULL then ' | Favorecido: concessionaria informada na fatura' else '' end)
    );$$,
    $$        case when v_f.fornecedor_id IS NOT NULL then ' | Favorecido: concessionaria informada na fatura' else '' end),
      coalesce(v_f.empresa_id, (SELECT id FROM sys_empresas WHERE codigo = 'EMP-001'))
    );$$);

  EXECUTE v_def;
END
$mig$;

UPDATE public.fin_contas_pagar
   SET empresa_id = (SELECT id FROM sys_empresas WHERE codigo='EMP-001')
 WHERE empresa_id IS NULL;
