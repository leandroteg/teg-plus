-- 242_loc_em_saida_envia_fatura.sql
-- Imovel em saida pode (e precisa) enviar faturas ao Financeiro.
--
-- loc_enviar_faturas_financeiro barrava 'inativo' E 'em_saida'. Mas imovel em
-- saida ainda recebe as ultimas contas de consumo — agua/energia do fechamento
-- — e sao exatamente as que precisam ser pagas antes da devolucao das chaves.
-- Caso real 06/08/2026: agua de R$ 91,72 vencendo NO DIA, imovel da Rua 24
-- (Ituiutaba) em saida, fatura pulada e sumida do Financeiro; em_saida somava 5
-- imoveis com 26 faturas abertas (R$ 242.604,60) sem caminho de pagamento.
--
-- Continua barrando 'inativo': encerrado de fato, sem conta nova legitima.

DO $mig$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='loc_enviar_faturas_financeiro';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'loc_enviar_faturas_financeiro nao encontrada';
  END IF;

  v_def := replace(v_def,
    $$IF v_f.imovel_status IN ('inativo', 'em_saida') THEN$$,
    $$IF v_f.imovel_status = 'inativo' THEN$$);
  EXECUTE v_def;
END
$mig$;
