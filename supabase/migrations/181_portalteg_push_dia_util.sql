-- 181: Push do Portal TEG só em dia útil
-- Problema: lembretes de ponto (07h/13h/17h) disparavam todos os dias, inclusive
-- fim de semana e feriado. Crons (jobs 1,2,3) rodavam com schedule "* * *".
-- Correção em duas camadas:
--   1. cron restrito a seg-sex (alter_job)
--   2. funções checam dia útil (fim de semana + portalteg_feriados) antes de enviar

-- Tabela de feriados (RH pode incluir municipais/pontes depois)
create table if not exists public.portalteg_feriados (
  data date primary key,
  descricao text not null,
  criado_em timestamptz not null default now()
);

alter table public.portalteg_feriados enable row level security;

drop policy if exists "feriados_select" on public.portalteg_feriados;
create policy "feriados_select" on public.portalteg_feriados
  for select to authenticated using (true);

drop policy if exists "feriados_admin_write" on public.portalteg_feriados;
create policy "feriados_admin_write" on public.portalteg_feriados
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.portalteg_feriados to authenticated;

-- Feriados nacionais 2026 (inclui Carnaval e Corpus Christi, observados pela empresa)
insert into public.portalteg_feriados (data, descricao) values
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-02-16', 'Carnaval (segunda)'),
  ('2026-02-17', 'Carnaval (terça)'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-04', 'Corpus Christi'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Consciência Negra'),
  ('2026-12-25', 'Natal')
on conflict (data) do nothing;

-- Dia útil = seg-sex e não feriado (data no fuso de Brasília)
create or replace function public.portalteg_dia_util(p_data date default (now() at time zone 'America/Sao_Paulo')::date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select extract(isodow from p_data) between 1 and 5
     and not exists (select 1 from public.portalteg_feriados f where f.data = p_data);
$$;

revoke execute on function public.portalteg_dia_util(date) from public, anon;
grant execute on function public.portalteg_dia_util(date) to authenticated, service_role;

-- Lembrete de ponto: não envia em dia sem expediente
create or replace function public.portalteg_lembrete_ponto()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_msg portalteg_push_mensagens_ponto%rowtype;
  v_token text;
  v_req_id bigint;
begin
  if not public.portalteg_dia_util() then
    raise notice 'Dia sem expediente — lembrete de ponto não enviado';
    return null;
  end if;

  select * into v_msg from portalteg_push_mensagens_ponto where ativo = true order by random() limit 1;
  if not found then
    raise notice 'Nenhuma mensagem ativa para enviar';
    return null;
  end if;

  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'portalteg_service_role' limit 1;

  select net.http_post(
    url := 'https://uzfjfucrinokeuwpbeie.supabase.co/functions/v1/enviar-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object(
      'todos', true,
      'titulo', v_msg.titulo,
      'mensagem', v_msg.mensagem,
      'url', 'https://portal.teguniao.com.br/',
      'tag', 'portalteg-ponto'
    ),
    timeout_milliseconds := 15000
  ) into v_req_id;

  return v_req_id;
end $function$;

-- Push semanal de segurança (segunda 07h45): pula segunda que cai em feriado
create or replace function public.portalteg_push_seg_exc()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_msg portalteg_push_mensagens_seg_exc%rowtype;
  v_token text;
  v_req_id bigint;
begin
  if not public.portalteg_dia_util() then
    raise notice 'Dia sem expediente — push de segurança não enviado';
    return null;
  end if;

  select * into v_msg from portalteg_push_mensagens_seg_exc where ativo = true order by random() limit 1;
  if not found then
    raise notice 'Nenhuma mensagem ativa para enviar';
    return null;
  end if;

  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'portalteg_service_role' limit 1;

  select net.http_post(
    url := 'https://uzfjfucrinokeuwpbeie.supabase.co/functions/v1/enviar-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object(
      'todos', true,
      'titulo', v_msg.titulo,
      'mensagem', v_msg.mensagem,
      'url', 'https://portal.teguniao.com.br/',
      'tag', 'portalteg-seg-exc'
    ),
    timeout_milliseconds := 15000
  ) into v_req_id;

  return v_req_id;
end $function$;

-- Cron dos lembretes de ponto: só seg-sex (horários em UTC = 07h/13h/17h BRT)
select cron.alter_job(job_id := 1, schedule := '0 10 * * 1-5');
select cron.alter_job(job_id := 2, schedule := '0 16 * * 1-5');
select cron.alter_job(job_id := 3, schedule := '0 20 * * 1-5');
