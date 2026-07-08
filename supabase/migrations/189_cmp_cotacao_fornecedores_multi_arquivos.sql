-- Cotacao: fornecedor pode anexar mais de 1 arquivo (antes so 1, arquivo_url text).
-- Migra dados existentes pro array e remove a coluna antiga.
alter table cmp_cotacao_fornecedores add column arquivo_urls text[] not null default '{}';

update cmp_cotacao_fornecedores
set arquivo_urls = array[arquivo_url]
where arquivo_url is not null and arquivo_url <> '';

alter table cmp_cotacao_fornecedores drop column arquivo_url;
