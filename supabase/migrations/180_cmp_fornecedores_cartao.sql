-- Fornecedor pago por cartao corporativo nao tinha como ser cadastrado: Dados de
-- pagamento so aceitava Boleto ou Banco/PIX como formas completas. Adiciona
-- cmp_fornecedores.cartao (mesmo padrao do campo boleto ja existente).
alter table cmp_fornecedores
  add column if not exists cartao boolean not null default false;
