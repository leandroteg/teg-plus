-- 213_cr_desconto_juros.sql
-- Juros/multa e desconto em TODO lançamento financeiro (pedido do user 04/ago).
-- A mig 203 já tinha dado essas colunas ao Contas a Pagar; o Contas a Receber
-- ficou de fora. Mesma semântica da CP:
--   valor recebido = valor_original − valor_desconto + valor_juros_multa

ALTER TABLE public.fin_contas_receber
  ADD COLUMN IF NOT EXISTS valor_desconto    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_juros_multa numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.fin_contas_receber.valor_desconto IS
  'Desconto concedido ao cliente. valor_recebido = valor_original − desconto + juros/multa.';
COMMENT ON COLUMN public.fin_contas_receber.valor_juros_multa IS
  'Juros/multa cobrados do cliente por atraso. valor_recebido = valor_original − desconto + juros/multa.';
