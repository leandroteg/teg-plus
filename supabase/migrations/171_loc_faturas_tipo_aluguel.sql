-- loc_gerar_faturas_mes insere tipo='aluguel', mas a check constraint nao o
-- permitia -> a geracao de faturas quebrava no primeiro item (bug que mantinha
-- o modulo com 0 faturas apesar de 45 imoveis). Inclui 'aluguel'.
ALTER TABLE public.loc_faturas DROP CONSTRAINT IF EXISTS loc_faturas_tipo_check;
ALTER TABLE public.loc_faturas ADD CONSTRAINT loc_faturas_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'aluguel','energia','agua','internet','iptu','condominio','telefone','limpeza','outro'
  ]));
