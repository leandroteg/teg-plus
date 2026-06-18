-- 152_tel_sync_log.sql
-- Log de execucoes de sincronizacao de telemetria (Mobi7, Cobli, ...).
-- Alimentado pelos workflows n8n; lido pelo indicador discreto de saude na
-- tela de Operacao de Frotas (/frotas/operacao).

create table if not exists public.tel_sync_log (
  id          bigint generated always as identity primary key,
  provider    text        not null,
  endpoint    text        not null,           -- positions | behaviors
  ok          boolean     not null default false,
  veiculos    integer,
  inseridos   integer     default 0,
  falhas      integer     default 0,
  erro        text,                            -- mensagem resumida quando ha falha
  detalhe     jsonb,                           -- payload extra (ex.: amostra do erro)
  created_at  timestamptz not null default now()
);

create index if not exists idx_tel_sync_log_created  on public.tel_sync_log (created_at desc);
create index if not exists idx_tel_sync_log_prov_end on public.tel_sync_log (provider, endpoint, created_at desc);

alter table public.tel_sync_log enable row level security;

-- Qualquer usuario autenticado pode ler o status de sincronizacao.
drop policy if exists tel_sync_log_read on public.tel_sync_log;
create policy tel_sync_log_read on public.tel_sync_log
  for select to authenticated using (true);

comment on table public.tel_sync_log is 'Resumo por execucao dos syncs de telemetria (n8n). Exibido discretamente na Operacao de Frotas.';
