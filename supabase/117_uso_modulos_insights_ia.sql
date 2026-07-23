-- 117_uso_modulos_insights_ia.sql
-- Cache das análises de IA do painel "Uso dos Módulos".
-- Aplicado em produção via MCP em 2026-07-22.
-- Inserção feita pela edge function uso-modulos-insights (service role);
-- leitura restrita a admins. A edge function exige o secret ANTHROPIC_API_KEY.
create table if not exists public.sys_uso_insights (
  id           uuid primary key default gen_random_uuid(),
  periodo_dias int not null,
  payload      jsonb not null,
  modelo       text,
  gerado_por   uuid,
  created_at   timestamptz not null default now()
);

create index if not exists sys_uso_insights_periodo_idx
  on public.sys_uso_insights (periodo_dias, created_at desc);

alter table public.sys_uso_insights enable row level security;

drop policy if exists sys_uso_insights_select_admin on public.sys_uso_insights;
create policy sys_uso_insights_select_admin on public.sys_uso_insights
  for select to authenticated
  using (is_admin());
