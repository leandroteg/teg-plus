// Painel do módulo TI — port fiel do Dashboard do helpdesk (versão admin/equipe).
// KPIs operacionais, destaques de 30 dias, 5 gráficos, fila "Precisam de atenção"
// e chamados recentes. (Banner de WhatsApp omitido — depende do worker, fase 11.)
import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Inbox, Clock, PauseCircle, CheckCircle2, AlarmClock, UserX, Plus,
  Gauge, Timer, BarChart3, AlertTriangle, ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { getDashboardStats, listTickets } from './data/tickets'
import { getReportSummary } from './data/reports'
import { useTiAuth } from './data/auth'
import type { Ticket, Status, Priority } from './data/shapes'
import { STATUS_LIST, STATUS_META, PRIORITY_LIST, PRIORITY_META } from './lib/constants'
import { PageHeader, Spinner } from './components/ui'
import { StatusBadge, PriorityBadge } from './components/Badges'
import { SlaBadge } from './components/SlaBadge'
import { Avatar } from './components/Avatar'
import { timeAgo } from './lib/format'

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const OPEN_STATUSES: Status[] = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO']

const STATUS_HEX: Record<Status, string> = {
  ABERTO: '#3b82f6', EM_ANDAMENTO: '#f59e0b', AGUARDANDO: '#8b5cf6', RESOLVIDO: '#10b981', FECHADO: '#94a3b8',
}
const PRIORITY_HEX: Record<Priority, string> = {
  BAIXA: '#94a3b8', MEDIA: '#0ea5e9', ALTA: '#f97316', URGENTE: '#ef4444',
}

type Tone = 'brand' | 'good' | 'warn' | 'bad' | 'neutral'
const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-sky-600', good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', neutral: 'text-slate-800',
}
const TONE_ICON: Record<Tone, string> = {
  brand: 'text-sky-500', good: 'text-emerald-500', warn: 'text-amber-500', bad: 'text-red-500', neutral: 'text-slate-400',
}

function Kpi({ label, value, icon: Icon, color }: { label: string; value: number; icon: ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  )
}

function StatHighlight({ label, value, hint, icon: Icon, tone = 'neutral' }: { label: string; value: string | number; hint?: string; icon: ComponentType<{ className?: string }>; tone?: Tone }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon className={`h-4 w-4 ${TONE_ICON[tone]}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold ${TONE_TEXT[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

function ChartCard({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, title, to, toLabel }: { icon: ComponentType<{ className?: string }>; title: string; to?: string; toLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
        <Icon className="h-4 w-4 text-slate-400" /> {title}
      </h2>
      {to && <Link to={to} className="flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline">{toLabel ?? 'Ver todos'} <ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  )
}

function AttentionQueue({ tickets }: { tickets: Ticket[] }) {
  const now = Date.now()
  const isOpen = (t: Ticket) => OPEN_STATUSES.includes(t.status)
  const overdue = tickets
    .filter((t) => isOpen(t) && t.dueAt && new Date(t.dueAt).getTime() < now)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
  const unassigned = tickets.filter((t) => isOpen(t) && !t.assignee && !overdue.some((o) => o.id === t.id))
  const rows = [...overdue, ...unassigned].slice(0, 7)

  return (
    <div className="card overflow-hidden">
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Tudo em dia — nada atrasado ou sem responsável. 🎉
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((t) => {
            const isOverdue = !!t.dueAt && new Date(t.dueAt).getTime() < now
            return (
              <li key={t.id}>
                <Link to={`/ti/chamados/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                  <span className="font-mono text-xs text-slate-400">{t.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{t.title}</span>
                  {isOverdue
                    ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Atrasado</span>
                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Sem responsável</span>}
                  <PriorityBadge priority={t.priority} />
                  <span className="hidden w-28 text-right text-xs text-slate-400 sm:block">{t.assignee ? t.assignee.name : '—'}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function TiHome() {
  const { user } = useTiAuth()
  const statsQ = useQuery({ queryKey: ['ti', 'stats'], queryFn: getDashboardStats })
  const ticketsQ = useQuery({ queryKey: ['ti', 'tickets', 'all'], queryFn: () => listTickets({}) })
  const summaryQ = useQuery({
    queryKey: ['ti', 'dashboard-summary'],
    queryFn: () => getReportSummary(isoDaysAgo(30), isoDaysAgo(0)),
  })

  const stats = statsQ.data
  const summary = summaryQ.data
  const tickets = ticketsQ.data ?? []
  const recent = tickets.slice(0, 6)
  const firstName = user?.name?.split(' ')[0] ?? ''

  const kpis = [
    { label: 'Abertos', value: stats?.abertos ?? 0, icon: Inbox, color: 'bg-blue-100 text-blue-600' },
    { label: 'Em andamento', value: stats?.emAndamento ?? 0, icon: Clock, color: 'bg-amber-100 text-amber-600' },
    { label: 'Aguardando', value: stats?.aguardando ?? 0, icon: PauseCircle, color: 'bg-violet-100 text-violet-600' },
    { label: 'Atrasados', value: stats?.atrasados ?? 0, icon: AlarmClock, color: 'bg-rose-100 text-rose-600' },
    { label: 'Não atribuídos', value: stats?.naoAtribuidos ?? 0, icon: UserX, color: 'bg-slate-100 text-slate-600' },
    { label: 'Resolvidos', value: stats?.resolvidos ?? 0, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  ]

  const slaTone: Tone = summary?.slaCompliance == null ? 'neutral'
    : summary.slaCompliance >= 90 ? 'good' : summary.slaCompliance >= 70 ? 'warn' : 'bad'

  const statusData = summary
    ? STATUS_LIST.map((s) => ({ key: s, name: STATUS_META[s].label, value: summary.byStatus[s] ?? 0 })).filter((d) => d.value > 0)
    : []
  const priorityData = summary
    ? PRIORITY_LIST.map((p) => ({ key: p, name: PRIORITY_META[p].label, value: summary.byPriority[p] ?? 0 }))
    : []
  const categoryData = summary ? summary.byCategory.slice(0, 8) : []
  const agentData = summary ? summary.byAgent.slice(0, 6) : []

  return (
    <div className="ti-scope">
      <PageHeader
        title={`Olá, ${firstName} 👋`}
        subtitle="Visão geral dos chamados de T.I."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/ti/relatorios" className="btn-outline"><BarChart3 className="h-4 w-4" /> Relatórios</Link>
            <Link to="/ti/chamados/novo" className="btn-primary"><Plus className="h-4 w-4" /> Novo chamado</Link>
          </div>
        }
      />

      {/* KPIs operacionais */}
      {statsQ.isLoading || !stats ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => <Kpi key={k.label} {...k} />)}
        </div>
      )}

      {/* Destaques do período (30 dias) */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatHighlight label="Chamados (30 dias)" value={summary?.total ?? '—'} icon={BarChart3} tone="brand" />
        <StatHighlight label="Resolvidos (30 dias)" value={summary?.resolvedCount ?? '—'} icon={CheckCircle2} tone="good" />
        <StatHighlight label="Tempo médio de resolução" value={summary ? `${summary.avgResolutionHours} h` : '—'} icon={Timer} tone="neutral" hint="da abertura até resolver" />
        <StatHighlight label="SLA cumprido (30 dias)" value={summary?.slaCompliance == null ? '—' : `${summary.slaCompliance}%`} icon={Gauge} tone={slaTone} hint="resolvidos no prazo" />
      </div>

      {/* Gráficos */}
      {summaryQ.isLoading || !summary ? (
        <div className="mt-6"><Spinner /></div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Volume de chamados (últimos 30 dias)" className="lg:col-span-2">
            <AreaChart data={summary.series}>
              <defs>
                <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 11 }} minTickGap={20} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(d) => `Dia ${fmtDay(String(d))}`} />
              <Area type="monotone" dataKey="count" name="Chamados" stroke="#0ea5e9" strokeWidth={2} fill="url(#vol)" />
            </AreaChart>
          </ChartCard>

          <ChartCard title="Por status">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {statusData.map((d) => <Cell key={d.key} fill={STATUS_HEX[d.key]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ChartCard>

          <ChartCard title="Por prioridade">
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Chamados" radius={[4, 4, 0, 0]}>
                {priorityData.map((d) => <Cell key={d.key} fill={PRIORITY_HEX[d.key]} />)}
              </Bar>
            </BarChart>
          </ChartCard>

          <ChartCard title="Por categoria">
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Chamados" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Carga por responsável">
            {agentData.length ? (
              <BarChart data={agentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="Em aberto" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem dados no período</div>
            )}
          </ChartCard>
        </div>
      )}

      <section className="mt-8">
        <SectionTitle icon={AlertTriangle} title="Precisam de atenção" to="/ti/chamados" toLabel="Ver chamados" />
        {ticketsQ.isLoading ? <Spinner /> : <AttentionQueue tickets={tickets} />}
      </section>

      <section className="mt-8">
        <SectionTitle icon={Inbox} title="Chamados recentes" to="/ti/chamados" />
        {ticketsQ.isLoading ? (
          <Spinner />
        ) : recent.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            Nenhum chamado ainda — <Link to="/ti/chamados/novo" className="font-medium text-sky-600 hover:underline">abra o primeiro</Link>
          </div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {recent.map((t) => (
              <Link key={t.id} to={`/ti/chamados/${t.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50">
                <span className="font-mono text-xs text-slate-400">{t.code}</span>
                <span className="flex-1 truncate font-medium text-slate-700">{t.title}</span>
                {t.assignee && <Avatar name={t.assignee.name} size="sm" />}
                <SlaBadge dueAt={t.dueAt} status={t.status} size="sm" />
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
                <span className="hidden w-24 text-right text-xs text-slate-400 sm:block">{timeAgo(t.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
