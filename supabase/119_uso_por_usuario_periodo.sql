-- 119_uso_por_usuario_periodo.sql
-- Filtro de período próprio da tabela "Uso por usuário" do painel admin.
-- A RPC aceita um intervalo de datas (últimos N dias OU um mês-calendário,
-- interpretado no fuso America/Sao_Paulo) e devolve as mesmas colunas do
-- bloco por_usuario da get_admin_uso_modulos, mais dias_periodo — usado no
-- frontend para exibir "dias ativos: X/Y" e "acessos no período".
create or replace function public.get_admin_uso_por_usuario(p_inicio date, p_fim date)
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
  uso_p as (
    select a.usuario_id, a.modulo, a.created_at,
           (a.created_at at time zone 'America/Sao_Paulo') as ts_local,
           'acesso' as fonte
    from sys_acessos a
    where a.created_at >= v_ini and a.created_at < v_fim
    union all
    select l.usuario_id, coalesce(m.modulo, l.modulo), l.created_at,
           (l.created_at at time zone 'America/Sao_Paulo'),
           'acao'
    from sys_log_atividades l
    left join mapa m on m.prefixo = l.modulo
    where l.created_at >= v_ini and l.created_at < v_fim
      and l.usuario_id is not null
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
        group by p.auth_id, p.nome, p.role
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;
