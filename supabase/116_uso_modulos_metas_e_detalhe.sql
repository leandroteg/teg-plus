-- 116_uso_modulos_metas_e_detalhe.sql
-- Painel "Uso dos Módulos": metas de adoção por módulo + RPC de drill-down.
-- Aplicado em produção via MCP em 2026-07-22.

-- 1) Metas de adoção (% dos usuários ativos que deveria usar o módulo)
create table if not exists public.sys_uso_metas (
  modulo     varchar(30) primary key,
  meta_pct   int not null check (meta_pct between 1 and 100),
  updated_at timestamptz not null default now()
);

alter table public.sys_uso_metas enable row level security;

drop policy if exists sys_uso_metas_admin on public.sys_uso_metas;
create policy sys_uso_metas_admin on public.sys_uso_metas
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- 2) RPC de drill-down de um módulo
create or replace function public.get_admin_uso_modulo_detalhe(p_modulo text, p_dias int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio      timestamptz;
  v_inicio_prev timestamptz;
  v_base        int;
  v_result      jsonb;
begin
  if not is_admin() then
    raise exception 'Acesso negado: apenas administradores';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 365 then
    p_dias := 30;
  end if;

  v_inicio      := date_trunc('day', now()) - make_interval(days => p_dias - 1);
  v_inicio_prev := v_inicio - make_interval(days => p_dias);

  select count(*) into v_base from sys_perfis where ativo = true and auth_id is not null;

  with mapa(prefixo, modulo) as (
    values
      ('cmp','compras'), ('fin','financeiro'), ('con','contratos'), ('fro','frotas'),
      ('obr','obras'), ('orc','orcamentacao'), ('loc','locacoes'), ('rh','rh'),
      ('qsma','qsma'), ('sgi','sgi'), ('pmo','egp'), ('apr','aprovacoes'),
      ('log','logistica'), ('est','estoque'), ('pat','patrimonial'), ('fis','fiscal'),
      ('ctrl','controladoria'), ('desp','financeiro'), ('tel','frotas'), ('ti','ti')
  ),
  acessos_w as (
    select a.usuario_id, a.tela, a.created_at,
           a.created_at >= v_inicio as atual,
           (a.created_at at time zone 'America/Sao_Paulo') as ts_local
    from sys_acessos a
    where a.created_at >= v_inicio_prev
      and a.modulo = p_modulo
  ),
  acoes_w as (
    select l.usuario_id, l.entidade_tipo, l.tipo, l.created_at,
           l.created_at >= v_inicio as atual,
           (l.created_at at time zone 'America/Sao_Paulo') as ts_local
    from sys_log_atividades l
    left join mapa m on m.prefixo = l.modulo
    where l.created_at >= v_inicio_prev
      and l.usuario_id is not null
      and coalesce(m.modulo, l.modulo) = p_modulo
  ),
  uso_w as (
    select usuario_id, created_at, atual, ts_local, 'acesso' as fonte from acessos_w
    union all
    select usuario_id, created_at, atual, ts_local, 'acao' from acoes_w
  ),
  acessos_p as (select * from acessos_w where atual),
  acoes_p   as (select * from acoes_w where atual),
  uso_p     as (select * from uso_w where atual)
  select jsonb_build_object(
    'resumo', (
      select jsonb_build_object(
        'acessos',       (select count(*) from acessos_p),
        'acoes',         (select count(*) from acoes_p),
        'usuarios',      (select count(distinct usuario_id) from uso_p),
        'base_usuarios', v_base,
        'pct_adocao',    round(100.0 * (select count(distinct usuario_id) from uso_p) / greatest(v_base, 1), 1),
        'acessos_prev',  (select count(*) from acessos_w where not atual),
        'acoes_prev',    (select count(*) from acoes_w where not atual),
        'usuarios_prev', (select count(distinct usuario_id) from uso_w where not atual)
      )
    ),
    'evolucao', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'dia', to_char(d.dia, 'YYYY-MM-DD'),
        'acessos', coalesce(u.acessos, 0),
        'acoes', coalesce(u.acoes, 0)
      ) order by d.dia), '[]'::jsonb)
      from generate_series(v_inicio::date, now()::date, interval '1 day') as d(dia)
      left join (
        select ts_local::date as dia,
               count(*) filter (where fonte = 'acesso') as acessos,
               count(*) filter (where fonte = 'acao')   as acoes
        from uso_p
        group by ts_local::date
      ) u on u.dia = d.dia::date
    ),
    'telas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tela', t.tela,
        'acessos', t.acessos,
        'usuarios', t.usuarios
      ) order by t.acessos desc), '[]'::jsonb)
      from (
        select tela, count(*) as acessos, count(distinct usuario_id) as usuarios
        from acessos_p
        group by tela
        order by count(*) desc
        limit 50
      ) t
    ),
    'usuarios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'usuario_id', t.auth_id,
        'nome', t.nome,
        'role', t.role,
        'acessos', t.acessos,
        'acoes', t.acoes,
        'dias_ativos', t.dias_ativos,
        'ultimo_uso', t.ultimo_uso
      ) order by (t.acessos + t.acoes) desc, t.nome), '[]'::jsonb)
      from (
        select p.auth_id, p.nome, p.role,
               count(*) filter (where u.fonte = 'acesso') as acessos,
               count(*) filter (where u.fonte = 'acao')   as acoes,
               count(distinct u.ts_local::date) as dias_ativos,
               max(u.created_at) as ultimo_uso
        from uso_p u
        join sys_perfis p on p.auth_id = u.usuario_id
        group by p.auth_id, p.nome, p.role
      ) t
    ),
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'entidade_tipo', t.entidade_tipo,
        'tipo', t.tipo,
        'quantidade', t.quantidade
      ) order by t.quantidade desc), '[]'::jsonb)
      from (
        select entidade_tipo, tipo, count(*) as quantidade
        from acoes_p
        group by entidade_tipo, tipo
        order by count(*) desc
        limit 20
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_admin_uso_modulo_detalhe(text, int) from anon, public;
grant execute on function public.get_admin_uso_modulo_detalhe(text, int) to authenticated;
