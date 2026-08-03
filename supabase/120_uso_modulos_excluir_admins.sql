-- 120_uso_modulos_excluir_admins.sql
-- Painel "Uso dos Módulos": opção de excluir os administradores dos dados.
-- As três RPCs ganham o parâmetro p_excluir_admins (default false, mantendo
-- o comportamento anterior para quem chama sem o argumento). Quando true:
--   * a base de usuários (denominador da adoção) desconsidera role='administrador';
--   * acessos e ações de administradores são descartados antes de qualquer agregação;
--   * a tabela/lista de usuários não traz perfis de administrador.

-- ── 1) Visão geral ────────────────────────────────────────────────────────────
create or replace function public.get_admin_uso_modulos(
  p_dias int default 30,
  p_excluir_admins boolean default false
)
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
  p_excluir_admins := coalesce(p_excluir_admins, false);

  v_inicio      := date_trunc('day', now()) - make_interval(days => p_dias - 1);
  v_inicio_prev := v_inicio - make_interval(days => p_dias);

  select count(*) into v_base
  from sys_perfis
  where ativo = true and auth_id is not null
    and (not p_excluir_admins or role <> 'administrador');

  with mapa(prefixo, modulo) as (
    values
      ('cmp','compras'), ('fin','financeiro'), ('con','contratos'), ('fro','frotas'),
      ('obr','obras'), ('orc','orcamentacao'), ('loc','locacoes'), ('rh','rh'),
      ('qsma','qsma'), ('sgi','sgi'), ('pmo','egp'), ('apr','aprovacoes'),
      ('log','logistica'), ('est','estoque'), ('pat','patrimonial'), ('fis','fiscal'),
      ('ctrl','controladoria'), ('desp','financeiro'), ('tel','frotas'), ('ti','ti')
  ),
  -- auth_ids a ignorar quando o filtro "sem administradores" está ligado
  admins as (
    select auth_id from sys_perfis
    where p_excluir_admins and role = 'administrador' and auth_id is not null
  ),
  -- janela ampla (período atual + anterior) para calcular deltas em uma passada
  acessos_w as (
    select a.usuario_id, a.modulo, a.tela, a.created_at,
           a.created_at >= v_inicio as atual,
           (a.created_at at time zone 'America/Sao_Paulo') as ts_local
    from sys_acessos a
    where a.created_at >= v_inicio_prev
      and not exists (select 1 from admins ad where ad.auth_id = a.usuario_id)
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
      and not exists (select 1 from admins ad where ad.auth_id = l.usuario_id)
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
          and (not p_excluir_admins or p.role <> 'administrador')
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

revoke execute on function public.get_admin_uso_modulos(int, boolean) from anon, public;
grant execute on function public.get_admin_uso_modulos(int, boolean) to authenticated, service_role;

-- ── 2) Drill-down de um módulo ────────────────────────────────────────────────
create or replace function public.get_admin_uso_modulo_detalhe(
  p_modulo text,
  p_dias int default 30,
  p_excluir_admins boolean default false
)
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
  p_excluir_admins := coalesce(p_excluir_admins, false);

  v_inicio      := date_trunc('day', now()) - make_interval(days => p_dias - 1);
  v_inicio_prev := v_inicio - make_interval(days => p_dias);

  select count(*) into v_base
  from sys_perfis
  where ativo = true and auth_id is not null
    and (not p_excluir_admins or role <> 'administrador');

  with mapa(prefixo, modulo) as (
    values
      ('cmp','compras'), ('fin','financeiro'), ('con','contratos'), ('fro','frotas'),
      ('obr','obras'), ('orc','orcamentacao'), ('loc','locacoes'), ('rh','rh'),
      ('qsma','qsma'), ('sgi','sgi'), ('pmo','egp'), ('apr','aprovacoes'),
      ('log','logistica'), ('est','estoque'), ('pat','patrimonial'), ('fis','fiscal'),
      ('ctrl','controladoria'), ('desp','financeiro'), ('tel','frotas'), ('ti','ti')
  ),
  admins as (
    select auth_id from sys_perfis
    where p_excluir_admins and role = 'administrador' and auth_id is not null
  ),
  acessos_w as (
    select a.usuario_id, a.tela, a.created_at,
           a.created_at >= v_inicio as atual,
           (a.created_at at time zone 'America/Sao_Paulo') as ts_local
    from sys_acessos a
    where a.created_at >= v_inicio_prev
      and a.modulo = p_modulo
      and not exists (select 1 from admins ad where ad.auth_id = a.usuario_id)
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
      and not exists (select 1 from admins ad where ad.auth_id = l.usuario_id)
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

revoke execute on function public.get_admin_uso_modulo_detalhe(text, int, boolean) from anon, public;
grant execute on function public.get_admin_uso_modulo_detalhe(text, int, boolean) to authenticated;

-- ── 3) Uso por usuário (período próprio da tabela) ────────────────────────────
create or replace function public.get_admin_uso_por_usuario(
  p_inicio date,
  p_fim date,
  p_excluir_admins boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini    timestamptz;
  v_fim    timestamptz;
  v_result jsonb;
begin
  if not is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso negado: apenas administradores';
  end if;

  -- saneamento: fim não passa de hoje; início padrão = 30 dias; máx. 1 ano
  if p_fim is null or p_fim > v_hoje then p_fim := v_hoje; end if;
  if p_inicio is null or p_inicio > p_fim then p_inicio := p_fim - 29; end if;
  if p_fim - p_inicio > 365 then p_inicio := p_fim - 365; end if;
  p_excluir_admins := coalesce(p_excluir_admins, false);

  -- limites dos dias locais convertidos para timestamptz (aproveita o índice de created_at)
  v_ini := p_inicio::timestamp at time zone 'America/Sao_Paulo';
  v_fim := (p_fim + 1)::timestamp at time zone 'America/Sao_Paulo';

  with mapa(prefixo, modulo) as (
    values
      ('cmp','compras'), ('fin','financeiro'), ('con','contratos'), ('fro','frotas'),
      ('obr','obras'), ('orc','orcamentacao'), ('loc','locacoes'), ('rh','rh'),
      ('qsma','qsma'), ('sgi','sgi'), ('pmo','egp'), ('apr','aprovacoes'),
      ('log','logistica'), ('est','estoque'), ('pat','patrimonial'), ('fis','fiscal'),
      ('ctrl','controladoria'), ('desp','financeiro'), ('tel','frotas'), ('ti','ti')
  ),
  admins as (
    select auth_id from sys_perfis
    where p_excluir_admins and role = 'administrador' and auth_id is not null
  ),
  uso_p as (
    select a.usuario_id, a.modulo, a.created_at,
           (a.created_at at time zone 'America/Sao_Paulo') as ts_local,
           'acesso' as fonte
    from sys_acessos a
    where a.created_at >= v_ini and a.created_at < v_fim
      and not exists (select 1 from admins ad where ad.auth_id = a.usuario_id)
    union all
    select l.usuario_id, coalesce(m.modulo, l.modulo), l.created_at,
           (l.created_at at time zone 'America/Sao_Paulo'),
           'acao'
    from sys_log_atividades l
    left join mapa m on m.prefixo = l.modulo
    where l.created_at >= v_ini and l.created_at < v_fim
      and l.usuario_id is not null
      and not exists (select 1 from admins ad where ad.auth_id = l.usuario_id)
  )
  select jsonb_build_object(
    'dias_periodo', (p_fim - p_inicio + 1),
    'usuarios', (
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
          and (not p_excluir_admins or p.role <> 'administrador')
        group by p.auth_id, p.nome, p.role
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_admin_uso_por_usuario(date, date, boolean) from anon, public;
grant execute on function public.get_admin_uso_por_usuario(date, date, boolean) to authenticated, service_role;

-- Remove as assinaturas antigas para não deixar sobrecargas ambíguas no PostgREST
drop function if exists public.get_admin_uso_modulos(int);
drop function if exists public.get_admin_uso_modulo_detalhe(text, int);
drop function if exists public.get_admin_uso_por_usuario(date, date);
