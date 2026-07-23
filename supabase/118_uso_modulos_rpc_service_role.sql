-- 118_uso_modulos_rpc_service_role.sql
-- Permite que o service role (edge functions / cron do n8n) chame a RPC do
-- painel de uso. Usuários comuns continuam bloqueados (is_admin()).
-- Aplicado em produção via MCP em 2026-07-22. Corpo idêntico ao 115, exceto o guard.
create or replace function public.get_admin_uso_modulos(p_dias int default 30)
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
  if not is_admin() and coalesce(auth.role(), '') <> 'service_role' then
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
  -- janela ampla (período atual + anterior) para calcular deltas em uma passada
  acessos_w as (
    select a.usuario_id, a.modulo, a.tela, a.created_at,
           a.created_at >= v_inicio as atual,
           (a.created_at at time zone 'America/Sao_Paulo') as ts_local
    from sys_acessos a
    where a.created_at >= v_inicio_prev
  ),
  acoes_w as (
    select l.usuario_id, coalesce(m.modulo, l.modulo) as modulo,
           l.entidade_tipo, l.tipo, l.created_at,
           l.created_at >= v_inicio as atual,
           (l.created_at at time zone 'America/Sao_Paulo') as ts_local
    from sys_log_atividades l
    left join mapa m on m.prefixo = l.modulo
    where l.created_at >= v_inicio_prev
      and l.usuario_id is not null
  ),
  uso_w as (
    select usuario_id, modulo, created_at, atual, ts_local, 'acesso' as fonte from acessos_w
    union all
    select usuario_id, modulo, created_at, atual, ts_local, 'acao' from acoes_w
  ),
  acessos_p as (select * from acessos_w where atual),
  acoes_p   as (select * from acoes_w where atual),
  uso_p     as (select * from uso_w where atual)
  select jsonb_build_object(
    'resumo', (
      select jsonb_build_object(
        'total_acessos',       (select count(*) from acessos_p),
        'total_acoes',         (select count(*) from acoes_p),
        'usuarios_ativos_uso', (select count(distinct usuario_id) from uso_p),
        'base_usuarios',       v_base,
        'modulos_usados',      (select count(distinct modulo) from uso_p),
        'pct_adocao_geral',    round(100.0 * (select count(distinct usuario_id) from uso_p) / greatest(v_base, 1), 1),
        'acessos_prev',        (select count(*) from acessos_w where not atual),
        'acoes_prev',          (select count(*) from acoes_w where not atual),
        'usuarios_prev',       (select count(distinct usuario_id) from uso_w where not atual)
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
        select modulo, ts_local::date as dia,
               count(*) filter (where fonte = 'acesso') as acessos,
               count(*) filter (where fonte = 'acao')   as acoes
        from uso_p
        group by modulo, ts_local::date
      ) u on u.modulo = m.modulo and u.dia = d.dia::date
    ),
    'usuarios_por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'dia', to_char(d.dia, 'YYYY-MM-DD'),
        'usuarios', coalesce(u.usuarios, 0)
      ) order by d.dia), '[]'::jsonb)
      from generate_series(v_inicio::date, now()::date, interval '1 day') as d(dia)
      left join (
        select ts_local::date as dia, count(distinct usuario_id) as usuarios
        from uso_p
        group by ts_local::date
      ) u on u.dia = d.dia::date
    ),
    'por_hora', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'hora', h.hora,
        'acessos', coalesce(u.acessos, 0),
        'acoes', coalesce(u.acoes, 0)
      ) order by h.hora), '[]'::jsonb)
      from generate_series(0, 23) as h(hora)
      left join (
        select extract(hour from ts_local)::int as hora,
               count(*) filter (where fonte = 'acesso') as acessos,
               count(*) filter (where fonte = 'acao')   as acoes
        from uso_p
        group by extract(hour from ts_local)::int
      ) u on u.hora = h.hora
    ),
    'por_usuario', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'usuario_id', t.auth_id,
        'nome', t.nome,
        'role', t.role,
        'total_acessos', t.acessos,
        'total_acoes', t.acoes,
        'ultimo_uso', t.ultimo_uso,
        'dias_ativos', t.dias_ativos,
        'modulos_usados', t.modulos
      ) order by (t.acessos + t.acoes) desc, t.nome), '[]'::jsonb)
      from (
        select p.auth_id, p.nome, p.role,
               count(u.usuario_id) filter (where u.fonte = 'acesso') as acessos,
               count(u.usuario_id) filter (where u.fonte = 'acao')   as acoes,
               max(u.created_at) as ultimo_uso,
               count(distinct u.ts_local::date) as dias_ativos,
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
