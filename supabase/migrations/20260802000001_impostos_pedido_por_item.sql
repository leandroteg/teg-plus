-- Impostos da NF detalhados por ITEM do pedido (filha opcional de cmp_pedido_impostos).
-- O cabecalho continua guardando os totais da nota; quando o usuario detalha por item,
-- os totais de ICMS/ICMS ST/IPI/PIS/COFINS passam a ser a soma das linhas daqui.

create table if not exists public.cmp_pedido_impostos_itens (
  id                    uuid primary key default gen_random_uuid(),
  imposto_id            uuid not null references public.cmp_pedido_impostos(id) on delete cascade,
  pedido_id             uuid not null references public.cmp_pedidos(id) on delete cascade,
  requisicao_item_id    uuid references public.cmp_requisicao_itens(id) on delete set null,
  descricao             text not null,
  valor_item            numeric not null default 0,
  base_calculo_icms     numeric not null default 0,
  valor_icms            numeric not null default 0,
  base_calculo_icms_st  numeric not null default 0,
  valor_icms_st         numeric not null default 0,
  valor_ipi             numeric not null default 0,
  valor_pis             numeric not null default 0,
  valor_cofins          numeric not null default 0,
  valor_outros          numeric not null default 0,
  observacao            text,
  criado_por_nome       text,
  atualizado_por_nome   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_cmp_ped_imp_itens_imposto on public.cmp_pedido_impostos_itens(imposto_id);
create index if not exists idx_cmp_ped_imp_itens_pedido  on public.cmp_pedido_impostos_itens(pedido_id);

alter table public.cmp_pedido_impostos_itens enable row level security;

drop policy if exists cmp_pedido_impostos_itens_select on public.cmp_pedido_impostos_itens;
create policy cmp_pedido_impostos_itens_select on public.cmp_pedido_impostos_itens
  for select using (
    can_access_modulo('compras', auth.uid()) or can_access_modulo('financeiro', auth.uid()) or is_admin()
  );

drop policy if exists cmp_pedido_impostos_itens_write on public.cmp_pedido_impostos_itens;
create policy cmp_pedido_impostos_itens_write on public.cmp_pedido_impostos_itens
  for all using (
    can_access_modulo('compras', auth.uid()) or can_access_modulo('financeiro', auth.uid()) or is_admin()
  )
  with check (
    can_access_modulo('compras', auth.uid()) or can_access_modulo('financeiro', auth.uid()) or is_admin()
  );

-- Auditoria: mesmo padrao da tabela-mae (mig 121)
drop trigger if exists audit_cmp_pedido_impostos_itens on public.cmp_pedido_impostos_itens;
create trigger audit_cmp_pedido_impostos_itens
  after insert or delete or update on public.cmp_pedido_impostos_itens
  for each row execute function log_audit_changes();

drop trigger if exists tg_audit_user_cmp_pedido_impostos_itens on public.cmp_pedido_impostos_itens;
create trigger tg_audit_user_cmp_pedido_impostos_itens
  before insert or update on public.cmp_pedido_impostos_itens
  for each row execute function _tg_stamp_audit_user();

create or replace function public.tg_cmp_pedido_impostos_itens_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tg_cmp_pedido_impostos_itens_updated_at on public.cmp_pedido_impostos_itens;
create trigger tg_cmp_pedido_impostos_itens_updated_at
  before update on public.cmp_pedido_impostos_itens
  for each row execute function public.tg_cmp_pedido_impostos_itens_updated_at();
