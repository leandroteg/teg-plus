-- 191_loc_faturas_seguro_caucao_e_orfas_enviadas.sql
--
-- (1) O front (visao Faturas) oferece os tipos 'seguro' e 'caucao' no "Lancar",
--     mas a check constraint (mig 171) nao os permitia -> violacao de check ao
--     salvar. Amplia a lista mantendo os tipos existentes.
--
-- (2) Reparo de dados: 9 faturas reais estavam com status 'enviado_pagamento'
--     definido MANUALMENTE pelo lapis da UI (sem passar pelo RPC
--     loc_enviar_faturas_financeiro), logo sem Conta a Pagar vinculada — nunca
--     chegaram ao Financeiro. Reverte para 'lancado' toda fatura
--     'enviado_pagamento' sem CP, para que possam ser enviadas de verdade.
--     (O front deixa de oferecer 'Enviado Pgto' como escolha manual.)

ALTER TABLE public.loc_faturas DROP CONSTRAINT IF EXISTS loc_faturas_tipo_check;
ALTER TABLE public.loc_faturas ADD CONSTRAINT loc_faturas_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'aluguel','energia','agua','internet','iptu','condominio','telefone',
    'limpeza','seguro','caucao','outro'
  ]));

UPDATE public.loc_faturas f
SET status = 'lancado', updated_at = now()
WHERE f.status = 'enviado_pagamento'
  AND NOT EXISTS (
    SELECT 1 FROM public.fin_contas_pagar cp WHERE cp.loc_fatura_id = f.id
  );
