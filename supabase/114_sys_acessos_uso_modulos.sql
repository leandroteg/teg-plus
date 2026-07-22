-- 114_sys_acessos_uso_modulos.sql
-- Painel admin "Uso dos Módulos": tabela de page views + RPC de métricas.
-- Aplicado em produção via MCP em 2026-07-22.

-- 1) Tabela de acessos (page views por navegação de rota, append-only)
create table if not exists public.sys_acessos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),   -- = sys_perfis.auth_id
  modulo     varchar(30) not null,               -- key do frontend: 'compras','financeiro',...
  tela       text not null,                      -- pathname normalizado: '/cotacoes/:id'
  created_at timestamptz not null default now()
);

create index if not exists sys_acessos_created_idx  on public.sys_acessos (created_at desc);
create index if not exists sys_acessos_mod_dia_idx  on public.sys_acessos (modulo, created_at);
create index if not exists sys_acessos_user_dia_idx on public.sys_acessos (usuario_id, created_at);

-- 2) RLS: autenticado insere em nome próprio; leitura só admin; sem update/delete
alter table public.sys_acessos enable row level security;

drop policy if exists sys_acessos_insert on public.sys_acessos;
create policy sys_acessos_insert on public.sys_acessos
  for insert to authenticated
  with check (usuario_id = auth.uid());

drop policy if exists sys_acessos_select_admin on public.sys_acessos;
create policy sys_acessos_select_admin on public.sys_acessos
  for select to authenticated
  using (is_admin());

-- 3) RPC única do painel (SECURITY DEFINER + is_admin())
create or replace function public.get_admin_uso_modulos(p_dias int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz;
  v_base   int;
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'Acesso negado: apenas administradores';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 365 then
    p_dias := 30;
  end if;

  v_inicio := date_trunc('day', now()) - make_interval(days => p_dias - 1);

  -- base de adoção: perfis ativos que podem logar (contas de integração têm auth_id null)
  select count(*) into v_base from sys_perfis where ativo = true and auth_id is not null;

  with mapa(prefixo, modulo) as (
    values
      ('cmp','compras'), ('fin','financeiro'), ('con','contratos'), ('fro','frotas'),
      ('obr','obras'), ('orc','orcamentacao'), ('loc','locacoes'), ('rh','rh'),
      ('qsma','qsma'), ('sgi','sgi'), ('pmo','egp'), ('apr','aprovacoes'),
      ('log','logistica'), ('est','estoque'), ('pat','patrimonial'), ('fis','fiscal'),
      ('ctrl','controladoria'), ('desp','financeiro'), ('tel','frotas'), ('ti','ti')
  ),
  acessos_p as (
    select a.usuario_id, a.modulo, a.tela, a.created_at
    from sys_acessos a
    where a.created_at >= v_inicio
  ),
  acoes_p as (
    select l.usuario_id, coalesce(m.modulo, l.modulo) as modulo,
           l.entidade_tipo, l.tipo, l.created_at
    from sys_log_atividades l
    left join mapa m on m.prefixo = l.modulo
    where l.created_at >= v_inicio
      and l.usuario_id is not null
  ),
  uso_p as (
    select usuario_id, modulo, created_at, 'acesso' as fonte from acessos_p
    union all
    select usuario_id, modulo, created_at, 'acao' from acoes_p
  )
  select jsonb_build_object(
    'resumo', (
      select jsonb_build_object(
        'total_acessos',       (select count(*) from acessos_p),
        'total_acoes',         (select count(*) from acoes_p),
        'usuarios_ativos_uso', (select count(distinct usuario_id) from uso_p),
        'base_usuarios',       v_base,
        'modulos_usados',      (select count(distinct modulo) from uso_p),
        'pct_adocao_geral',    round(100.0 * (select count(distinct usuario_id) from uso_p) / greatest(v_base, 1), 1)
      )
    ),
    'por_modulo', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'modulo', t.modulo,
        'acessos', t.acessos,
        'acoes', t.acoes,
        'usuarios_distintos', t.usuarios,
        'pct_adocao', round(100.0 * t.usuarios / greatest(v_base, 1), 1)
      ) order by (t.acessos + t.acoes) desc), '[]'::jsonb)
      from (
        select modulo,
               count(*) filter (where fonte = 'acesso') as acessos,
               count(*) filter (where fonte = 'acao')   as acoes,
               count(distinct usuario_id)               as usuarios
        from uso_p
        group by modulo
      ) t
    ),
    'evolucao_diaria', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'dia', to_char(d.dia, 'YYYY-MM-DD'),
        'modulo', m.modulo,
        'acessos', coalesce(u.acessos, 0),
        'acoes', coalesce(u.acoes, 0)
      ) order by d.dia, m.modulo), '[]'::jsonb)
      from generate_series(v_inicio::date, now()::date, interval '1 day') as d(dia)
      cross join (select distinct modulo from uso_p) m
      left join (
        select modulo, created_at::date as dia,
               count(*) filter (where fonte = 'acesso') as acessos,
               count(*) filter (where fonte = 'acao')   as acoes
        from uso_p
        group by modulo, created_at::date
      ) u on u.modulo = m.modulo and u.dia = d.dia::date
    ),
    'por_usuario', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'usuario_id', t.auth_id,
        'nome', t.nome,
        'role', t.role,
        'total_acessos', t.acessos,
        'total_acoes', t.acoes,
        'ultimo_uso', t.ultimo_uso,
        'modulos_usados', t.modulos
      ) order by (t.acessos + t.acoes) desc, t.nome), '[]'::jsonb)
      from (
        select p.auth_id, p.nome, p.role,
               count(u.usuario_id) filter (where u.fonte = 'acesso') as acessos,
               count(u.usuario_id) filter (where u.fonte = 'acao')   as acoes,
               max(u.created_at) as ultimo_uso,
               coalesce(array_agg(distinct u.modulo) filter (where u.modulo is not null), '{}') as modulos
        from sys_perfis p
        left join uso_p u on u.usuario_id = p.auth_id
        where p.ativo = true and p.auth_id is not null
        group by p.auth_id, p.nome, p.role
      ) t
    ),
    'ranking_telas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'modulo', t.modulo,
        'tela', t.tela,
        'acessos', t.acessos,
        'usuarios', t.usuarios
      ) order by t.acessos desc), '[]'::jsonb)
      from (
        select modulo, tela, count(*) as acessos, count(distinct usuario_id) as usuarios
        from acessos_p
        group by modulo, tela
        order by count(*) desc
        limit 20
      ) t
    ),
    'ranking_acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'modulo', t.modulo,
        'entidade_tipo', t.entidade_tipo,
        'tipo', t.tipo,
        'quantidade', t.quantidade
      ) order by t.quantidade desc), '[]'::jsonb)
      from (
        select modulo, entidade_tipo, tipo, count(*) as quantidade
        from acoes_p
        group by modulo, entidade_tipo, tipo
        order by count(*) desc
        limit 20
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_admin_uso_modulos(int) from anon, public;
grant execute on function public.get_admin_uso_modulos(int) to authenticated;
