create table if not exists public.desp_adiantamentos (
  id uuid primary key default gen_random_uuid(),
  numero varchar(30) not null unique,
  solicitante_id uuid references public.sys_perfis(id),
  solicitante_nome text not null,
  gestor_id uuid,
  gestor_nome text,
  gestor_email text,
  favorecido_nome text not null,
  favorecido_email text,
  centro_custo varchar(50),
  centro_custo_id uuid references public.sys_centros_custo(id),
  classe_financeira varchar(50),
  classe_financeira_id uuid references public.sys_classes_financeiras(id),
  valor_solicitado numeric(15,2) not null default 0,
  valor_aprovado numeric(15,2) not null default 0,
  finalidade text not null,
  justificativa text,
  data_solicitacao date not null default current_date,
  data_limite_prestacao date,
  status varchar(30) not null default 'solicitado'
    check (status in ('solicitado','aprovado','rejeitado','prestacao_pendente','prestacao_enviada','concluido')),
  aprovacao_id uuid references public.apr_aprovacoes(id),
  fin_conta_pagar_id uuid references public.fin_contas_pagar(id),
  aprovado_por text,
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_desp_adiantamentos_status on public.desp_adiantamentos(status);
create index if not exists idx_desp_adiantamentos_solicitante on public.desp_adiantamentos(solicitante_id);
create index if not exists idx_desp_adiantamentos_cp on public.desp_adiantamentos(fin_conta_pagar_id);

alter table public.desp_adiantamentos enable row level security;

drop policy if exists "auth_all_desp_adiantamentos" on public.desp_adiantamentos;
create policy "auth_all_desp_adiantamentos"
  on public.desp_adiantamentos
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "service_all_desp_adiantamentos" on public.desp_adiantamentos;
create policy "service_all_desp_adiantamentos"
  on public.desp_adiantamentos
  for all
  to service_role
  using (true)
  with check (true);
