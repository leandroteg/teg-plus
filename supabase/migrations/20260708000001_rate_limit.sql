-- Rate limiting para Edge Functions (janela deslizante, backed em Postgres).
-- Cada invocacao chama check_rate_limit() que registra o hit e decide se estoura o limite.

create table if not exists public.rate_limit_hits (
  id          bigint generated always as identity primary key,
  bucket      text        not null,  -- ex: "parse-extrato:user:<uuid>"
  hit_at      timestamptz not null default now()
);

-- Consulta quente: contar hits recentes por bucket.
create index if not exists idx_rate_limit_hits_bucket_time
  on public.rate_limit_hits (bucket, hit_at desc);

-- Sem acesso direto de clientes: so a service role (Edge Functions) usa esta tabela.
alter table public.rate_limit_hits enable row level security;

-- check_rate_limit: registra o hit atual e retorna o estado da janela.
--   p_bucket    identificador do solicitante (funcao + user/ip)
--   p_limit     maximo de requisicoes permitidas na janela
--   p_window_s  tamanho da janela em segundos
-- Retorna: allowed (bool), remaining (int), retry_after_s (int)
create or replace function public.check_rate_limit(
  p_bucket   text,
  p_limit    int,
  p_window_s int
)
returns table (allowed boolean, remaining int, retry_after_s int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := now() - make_interval(secs => p_window_s);
  v_count        int;
  v_oldest       timestamptz;
begin
  -- Limpeza oportunista: remove hits fora da janela deste bucket.
  delete from public.rate_limit_hits
   where bucket = p_bucket
     and hit_at < v_window_start;

  select count(*), min(hit_at)
    into v_count, v_oldest
    from public.rate_limit_hits
   where bucket = p_bucket
     and hit_at >= v_window_start;

  if v_count >= p_limit then
    -- Estourou: NAO registra o hit; informa quando a vaga mais antiga expira.
    return query select
      false,
      0,
      greatest(1, ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_s) - now())))::int);
    return;
  end if;

  -- Dentro do limite: registra o hit e devolve o saldo.
  insert into public.rate_limit_hits (bucket) values (p_bucket);

  return query select
    true,
    (p_limit - v_count - 1),
    0;
end;
$$;

comment on function public.check_rate_limit(text, int, int) is
  'Sliding-window rate limiter para Edge Functions. Registra o hit e retorna allowed/remaining/retry_after_s.';
