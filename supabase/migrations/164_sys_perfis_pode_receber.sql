-- Allowlist nominal de recebimento de pedidos.
-- Antes: qualquer perfil lotado na base de destino podia "Receber".
-- Agora: precisa do flag pode_receber=true (admin segue podendo, CD com faz_triagem tambem).
-- Default true para preservar o comportamento atual; o admin revoga depois.

alter table public.sys_perfis
  add column if not exists pode_receber boolean not null default true;

comment on column public.sys_perfis.pode_receber is
  'Se true, o perfil pode confirmar recebimento de pedidos cuja base_destino_id == sys_perfis.base_id. Admin e bases faz_triagem ignoram este flag.';
