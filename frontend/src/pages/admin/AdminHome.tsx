// ─────────────────────────────────────────────────────────────────────────────
// pages/admin/AdminHome.tsx
// Painel do administrador (/admin). Estrutura orientada a ação:
//   1. KPIs com contexto (novos no mês, % da base, delta semanal, pendências)
//   2. Gráfico real de usuários ativos por dia (RPC get_admin_uso_modulos)
//   3. "Precisa de atenção": aprovações pendentes + categorias sem aprovador
//   4. Navegação agrupada (Gestão / Monitoramento / Sistema) com badges
//   5. Atividade humana recente agrupada (sys_log_atividades)
// Todos os números vêm de dados reais — nada mocado. Acesso via <AdminRoute>.
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users, ShieldCheck, ScrollText, BarChart3, Code2, Link2,
  ChevronRight, AlertTriangle, CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useUsoModulos } from '../../hooks/useUsoModulos'
import { useAprovacaoKPIs } from '../../hooks/useAprovacoes'
import { supabase } from '../../services/supabase'

// ── Navegação (mesmos grupos da sidebar do AdminLayout) ───────────────────────

interface AdminItem {
  to: string
  icon: LucideIcon
  title: string
  description: string
  badgeKey?: 'politicas'
}

interface AdminGroup {
  label: string
  items: AdminItem[]
}

const GROUPS: AdminGroup[] = [
  {
    label: 'Gestão',
    items: [
      {
        to: '/admin/usuarios', icon: Users, title: 'Usuários',
        description: 'Contas, permissões e módulos de cada colaborador',
      },
      {
        to: '/admin/politicas-aprovacao', icon: ShieldCheck, title: 'Políticas de Aprovação',
        description: 'Alçadas e fluxos de aprovação por categoria',
        badgeKey: 'politicas',
      },
    ],
  },
  {
    label: 'Monitoramento',
    items: [
      {
        to: '/admin/logs', icon: ScrollText, title: 'Logs de Auditoria',
        description: 'Quem fez o quê, quando e o que mudou no sistema',
      },
      {
        to: '/admin/uso-modulos', icon: BarChart3, title: 'Uso de Módulos',
        description: 'Acessos, adoção e engajamento por módulo',
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        to: '/admin/integracoes', icon: Link2, title: 'Integrações',
        description: 'Conexões com sistemas externos e configurações',
      },
      {
        to: '/admin/desenvolvimento', icon: Code2, title: 'Desenvolvimento',
        description: 'Roadmap, backlog e melhorias em andamento',
      },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_META: Record<string, { verbo: string; dot: string }> = {
  INSERT: { verbo: 'criou',   dot: 'bg-emerald-500' },
  UPDATE: { verbo: 'alterou', dot: 'bg-amber-500' },
  DELETE: { verbo: 'excluiu', dot: 'bg-rose-500' },
}

/** 'fin_contas_pagar' → 'Contas Pagar' */
function entidadeLabel(tipo: string | null): string {
  if (!tipo) return 'registro'
  return tipo
    .replace(/^[a-z]+_/, '')
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  return `${d} d`
}

/** 'TEMPORARIO' → 'Temporario' */
function primeiroNome(nome: string | null | undefined): string {
  const raw = (nome ?? '').trim().split(/\s+/)[0] || 'Admin'
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

function diaSemanaCurto(diaISO: string): string {
  return new Date(`${diaISO}T12:00:00`)
    .toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace('.', '')
}

function diaLongo(diaISO: string): string {
  return new Date(`${diaISO}T12:00:00`)
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

interface LogRecente {
  id: string
  modulo: string
  entidade_tipo: string | null
  tipo: string
  usuario_nome: string | null
  created_at: string
}

interface FeedGrupo {
  id: string
  nome: string
  tipo: string
  entidade: string | null
  count: number
  created_at: string
}

/** Colapsa ações consecutivas iguais (mesma pessoa, verbo e entidade). */
function agruparFeed(rows: LogRecente[]): FeedGrupo[] {
  const grupos: FeedGrupo[] = []
  for (const log of rows) {
    const nome = log.usuario_nome ?? 'Sistema'
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.nome === nome && ultimo.tipo === log.tipo && ultimo.entidade === log.entidade_tipo) {
      ultimo.count += 1
      continue
    }
    grupos.push({
      id: log.id, nome, tipo: log.tipo,
      entidade: log.entidade_tipo, count: 1, created_at: log.created_at,
    })
  }
  return grupos
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AdminHome() {
  const { isLightSidebar: isLight } = useTheme()
  const { perfil } = useAuth()

  // Uso (7 dias): KPIs + série diária. Mesma RPC admin-only do Uso de Módulos.
  const { data: uso, isLoading: usoLoading } = useUsoModulos(7)
  const resumo = uso?.resumo
  const serieDias = (uso?.usuarios_por_dia ?? []).map(p => ({
    dia: p.dia,
    label: diaSemanaCurto(p.dia),
    usuarios: p.usuarios,
  }))

  // Aprovações pendentes — mesma query do sininho do header (cache compartilhado)
  const { data: aprovacoes } = useAprovacaoKPIs()
  const pendentes = aprovacoes?.totalPendentes ?? 0

  // Usuários ativos + novos no mês
  const { data: usuarios, isLoading: usuariosLoading } = useQuery({
    queryKey: ['admin-home-usuarios'],
    queryFn: async () => {
      const mesAtras = new Date()
      mesAtras.setDate(mesAtras.getDate() - 30)
      const [ativos, novos] = await Promise.all([
        supabase.from('sys_perfis').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('sys_perfis').select('id', { count: 'exact', head: true }).eq('ativo', true)
          .gte('created_at', mesAtras.toISOString()),
      ])
      if (ativos.error) throw ativos.error
      if (novos.error) throw novos.error
      return { ativos: ativos.count ?? 0, novosMes: novos.count ?? 0 }
    },
    staleTime: 5 * 60_000,
  })

  // Categorias de compra sem aprovador de alçada 1 — pendência de configuração
  const { data: semAprovador = 0 } = useQuery({
    queryKey: ['admin-home-categorias-sem-aprovador'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('cmp_categorias')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true)
        .is('alcada1_aprovador_id', null)
      if (error) throw error
      return count ?? 0
    },
    staleTime: 5 * 60_000,
  })

  // Atividade humana recente (usuario_id nulo = integrações/robôs — fora)
  const { data: recentes = [], isLoading: recentesLoading } = useQuery({
    queryKey: ['admin-home-logs-recentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_log_atividades')
        .select('id, modulo, entidade_tipo, tipo, usuario_nome, created_at')
        .not('usuario_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(40)
      if (error) throw error
      return (data ?? []) as LogRecente[]
    },
    staleTime: 30_000,
  })
  const feed = agruparFeed(recentes).slice(0, 8)

  const deltaAcessos = resumo && resumo.acessos_prev > 0
    ? Math.round(((resumo.total_acessos - resumo.acessos_prev) / resumo.acessos_prev) * 100)
    : null
  const pctBase = resumo && resumo.base_usuarios > 0
    ? Math.round((resumo.usuarios_ativos_uso / resumo.base_usuarios) * 100)
    : null

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const dataLonga = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // ── Tokens de tema (indigo = accent da sidebar do módulo) ───────────────────
  const heading  = isLight ? 'text-slate-900' : 'text-slate-100'
  const body     = isLight ? 'text-slate-600' : 'text-slate-300'
  const muted    = isLight ? 'text-slate-500' : 'text-slate-400'
  const hairline = isLight ? 'border-slate-200/80' : 'border-white/[0.07]'
  const divide   = isLight ? 'divide-slate-200/80' : 'divide-white/[0.07]'
  const surface  = isLight ? 'bg-white' : 'bg-white/[0.02]'
  const rowHover = isLight ? 'hover:bg-indigo-50/40' : 'hover:bg-indigo-500/[0.06]'
  const iconBox  = isLight
    ? 'bg-indigo-50 text-indigo-600'
    : 'bg-indigo-500/10 text-indigo-300'
  const skeleton = isLight ? 'bg-slate-100' : 'bg-white/[0.06]'
  const amber    = isLight ? 'text-amber-600' : 'text-amber-400'
  const emerald  = isLight ? 'text-emerald-600' : 'text-emerald-400'
  const chartLine = isLight ? '#6366F1' : '#818CF8'
  const chartGrid = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.07)'
  const chartTick = isLight ? '#94a3b8' : '#64748b'

  const atencao: { icon: LucideIcon; tone: string; texto: string; to: string; count: number }[] = []
  if (pendentes > 0) {
    atencao.push({
      icon: AlertTriangle, tone: amber, count: pendentes, to: '/aprovaai',
      texto: `${pendentes} aprovaç${pendentes === 1 ? 'ão' : 'ões'} aguardando decisão`,
    })
  }
  if (semAprovador > 0) {
    atencao.push({
      icon: AlertTriangle, tone: amber, count: semAprovador, to: '/admin/politicas-aprovacao',
      texto: `${semAprovador} categoria${semAprovador === 1 ? '' : 's'} sem aprovador de alçada 1`,
    })
  }

  const kpis = [
    {
      label: 'Usuários ativos',
      value: usuarios?.ativos?.toLocaleString('pt-BR'),
      note: usuarios && usuarios.novosMes > 0 ? `+${usuarios.novosMes} no último mês` : 'contas habilitadas',
      noteTone: usuarios && usuarios.novosMes > 0 ? emerald : undefined,
      loading: usuariosLoading,
    },
    {
      label: 'Ativos na semana',
      value: resumo?.usuarios_ativos_uso?.toLocaleString('pt-BR'),
      note: pctBase != null ? `${pctBase}% da base de ${resumo!.base_usuarios}` : '—',
      loading: usoLoading,
    },
    {
      label: 'Acessos · 7 dias',
      value: resumo?.total_acessos?.toLocaleString('pt-BR'),
      note: deltaAcessos == null
        ? 'coleta iniciada recentemente'
        : `${deltaAcessos >= 0 ? '+' : ''}${deltaAcessos}% vs. semana anterior`,
      noteTone: deltaAcessos == null ? undefined : deltaAcessos >= 0 ? emerald : (isLight ? 'text-rose-600' : 'text-rose-400'),
      loading: usoLoading,
    },
    {
      label: 'Aprovações pendentes',
      value: pendentes.toLocaleString('pt-BR'),
      note: pendentes > 0 ? 'aguardando decisão' : 'nenhuma pendência',
      noteTone: pendentes > 0 ? amber : emerald,
      loading: aprovacoes === undefined,
      alerta: pendentes > 0,
    },
  ]

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-end justify-between gap-2 pb-5">
        <h1 className={`text-xl font-semibold tracking-tight ${heading}`}>
          {saudacao}, {primeiroNome(perfil?.nome)}
        </h1>
        <p className={`text-[12.5px] first-letter:uppercase ${muted}`}>{dataLonga}</p>
      </div>

      {/* ── KPIs ── */}
      <div className={`rounded-xl border ${hairline} ${surface} grid grid-cols-2 lg:grid-cols-4`}>
        {kpis.map(({ label: kLabel, value, note, noteTone, loading, alerta }, i) => (
          <div
            key={kLabel}
            className={`relative px-5 py-4 ${hairline} ${
              ['', 'border-l', 'max-lg:border-t lg:border-l', 'border-l max-lg:border-t'][i]
            }`}
          >
            {alerta && (
              <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-amber-400" />
            )}
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>{kLabel}</p>
            {loading ? (
              <div className={`mt-2 h-6 w-14 rounded ${skeleton} animate-pulse`} />
            ) : (
              <p className={`mt-1.5 text-[1.45rem] font-semibold leading-none tabular-nums tracking-tight ${heading}`}>
                {value ?? '—'}
              </p>
            )}
            <p className={`mt-1.5 text-[11.5px] font-medium ${noteTone ?? muted}`}>{note}</p>
          </div>
        ))}
      </div>

      {/* ── Gráfico + Atenção ── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-5 items-stretch">

        {/* Atividade dos usuários — últimos 7 dias */}
        <section className={`rounded-xl border ${hairline} ${surface} px-5 pt-4 pb-2`}>
          <div className="flex items-baseline justify-between">
            <h2 className={`text-[13px] font-semibold ${heading}`}>Atividade dos usuários</h2>
            <span className={`text-[11.5px] ${muted}`}>usuários distintos por dia · 7 dias</span>
          </div>
          {usoLoading ? (
            <div className={`mt-3 mb-2 h-[170px] rounded-lg ${skeleton} animate-pulse`} />
          ) : serieDias.length === 0 ? (
            <div className={`mt-3 mb-2 h-[170px] flex items-center justify-center text-[12px] ${muted}`}>
              Ainda não há dados de acesso — a coleta começou recentemente.
            </div>
          ) : (
            <div className="mt-2 h-[180px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serieDias} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="adminUsuariosDia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartLine} stopOpacity={0.16} />
                      <stop offset="100%" stopColor={chartLine} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={chartGrid} strokeWidth={1} />
                  <XAxis
                    dataKey="label" tickLine={false} axisLine={false}
                    tick={{ fontSize: 10.5, fill: chartTick }} dy={4}
                  />
                  <YAxis
                    allowDecimals={false} tickLine={false} axisLine={false} width={28}
                    tick={{ fontSize: 10.5, fill: chartTick }}
                  />
                  <Tooltip
                    cursor={{ stroke: chartTick, strokeDasharray: '3 3', strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as typeof serieDias[number]
                      return (
                        <div className={`rounded-lg border px-3 py-2 text-[11.5px] shadow-sm ${
                          isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-[#0f172a] border-white/10 text-slate-200'
                        }`}>
                          <p className="font-medium first-letter:uppercase">{diaLongo(p.dia)}</p>
                          <p className={muted}>{p.usuarios} usuário{p.usuarios === 1 ? '' : 's'}</p>
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone" dataKey="usuarios"
                    stroke={chartLine} strokeWidth={2}
                    fill="url(#adminUsuariosDia)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: isLight ? '#ffffff' : '#0c1222' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Precisa de atenção */}
        <aside className={`rounded-xl border ${hairline} ${surface} flex flex-col`}>
          <div className={`px-4 py-3 border-b ${hairline}`}>
            <h2 className={`text-[12px] font-semibold uppercase tracking-wider ${muted}`}>
              Precisa de atenção
            </h2>
          </div>
          {atencao.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <CheckCircle2 size={20} className={emerald} />
              <p className={`text-[12.5px] font-medium ${body}`}>Nenhuma pendência no momento</p>
              <p className={`text-[11.5px] ${muted}`}>Aprovações e políticas em dia.</p>
            </div>
          ) : (
            <ul className={`divide-y ${divide}`}>
              {atencao.map(({ icon: Icon, tone, texto, to }) => (
                <li key={to}>
                  <Link to={to} className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${rowHover}`}>
                    <Icon size={15} className={`shrink-0 ${tone}`} />
                    <span className={`flex-1 text-[12.5px] font-medium leading-snug ${body}`}>{texto}</span>
                    <ChevronRight size={14} className={`shrink-0 ${muted}`} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* ── Navegação + Atividade recente ── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-x-5 gap-y-6 items-start">

        {/* Navegação agrupada */}
        <div className="space-y-5">
          {GROUPS.map((group) => (
            <section key={group.label}>
              <h2 className={`mb-2 text-[11.5px] font-bold uppercase tracking-[0.12em] ${muted}`}>
                {group.label}
              </h2>
              <div className={`rounded-xl border overflow-hidden ${hairline} ${surface} divide-y ${divide}`}>
                {group.items.map(({ to, icon: Icon, title, description, badgeKey }) => {
                  const badge = badgeKey === 'politicas' && semAprovador > 0 ? semAprovador : null
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`group flex items-center gap-3.5 px-4 py-3 transition-colors ${rowHover}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBox}`}>
                        <Icon size={15} strokeWidth={1.9} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[13.5px] font-semibold leading-tight ${heading}`}>{title}</span>
                        <span className={`block text-[12px] leading-tight mt-0.5 ${muted}`}>{description}</span>
                      </span>
                      {badge != null && (
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold
                          ${isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/10 text-amber-300'}`}>
                          <AlertTriangle size={10} /> {badge}
                        </span>
                      )}
                      <ChevronRight
                        size={14}
                        className={`shrink-0 transition-colors ${muted} ${isLight ? 'group-hover:text-indigo-600' : 'group-hover:text-indigo-300'}`}
                      />
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Atividade recente */}
        <aside className={`rounded-xl border ${hairline} ${surface}`}>
          <div className={`px-4 py-3 border-b ${hairline}`}>
            <h2 className={`text-[12px] font-semibold uppercase tracking-wider ${muted}`}>
              Atividade recente
            </h2>
          </div>

          {recentesLoading ? (
            <div className="px-4 py-3 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5 py-1">
                  <div className={`h-2.5 w-3/5 rounded ${skeleton} animate-pulse`} />
                  <div className={`h-2 w-2/5 rounded ${skeleton} animate-pulse`} />
                </div>
              ))}
            </div>
          ) : feed.length === 0 ? (
            <p className={`px-4 py-10 text-center text-[12px] ${muted}`}>
              Nenhuma atividade de usuários registrada.
            </p>
          ) : (
            <ul className={`divide-y ${divide}`}>
              {feed.map((g) => {
                const meta = TIPO_META[g.tipo] ?? TIPO_META.UPDATE
                return (
                  <li key={g.id} className="flex gap-2.5 px-4 py-2.5">
                    <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`truncate text-[12.5px] font-semibold ${heading}`}>{g.nome}</p>
                        <span className={`shrink-0 text-[11px] tabular-nums ${muted}`}>
                          {tempoRelativo(g.created_at)}
                        </span>
                      </div>
                      <p className={`text-[12px] leading-snug ${muted}`}>
                        {meta.verbo} {entidadeLabel(g.entidade)}{g.count > 1 ? ` · ${g.count}×` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className={`border-t px-4 py-2.5 ${hairline}`}>
            <Link
              to="/admin/logs"
              className={`text-[12px] font-semibold transition-colors ${
                isLight ? 'text-indigo-600 hover:text-indigo-700' : 'text-indigo-300 hover:text-indigo-200'
              }`}
            >
              Ver todos os logs →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
