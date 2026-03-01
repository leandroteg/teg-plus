import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, Clock, CheckCircle, DollarSign,
  AlertTriangle, Building2, Sparkles, RefreshCw,
  Settings, TrendingUp, User2,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useRequisicoes } from '../hooks/useRequisicoes'
import KpiCard from '../components/KpiCard'
import StatusBadge from '../components/StatusBadge'
import { isPlaceholder } from '../services/supabase'
import type { StatusRequisicao, DashboardData } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const EMPTY_KPIS: DashboardData['kpis'] = {
  total_mes: 0, aguardando_aprovacao: 0, aprovadas_mes: 0,
  rejeitadas_mes: 0, valor_total_mes: 0, tempo_medio_aprovacao_horas: 0,
}

// Initials avatar for comprador
function Avatar({ nome, size = 'sm' }: { nome: string; size?: 'sm' | 'md' }) {
  const initials = nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const colors = [
    'bg-violet-500', 'bg-indigo-500', 'bg-sky-500',
    'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  ]
  const color = colors[nome.charCodeAt(0) % colors.length]
  const cls = size === 'md'
    ? `w-9 h-9 text-sm font-bold`
    : `w-6 h-6 text-[10px] font-bold`
  return (
    <div className={`${cls} ${color} rounded-full flex items-center justify-center text-white flex-shrink-0`}>
      {initials}
    </div>
  )
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('mes')
  const { data, isLoading, isError, error, refetch } = useDashboard(periodo)
  const { data: todasReqs } = useRequisicoes()

  if (isPlaceholder) return <SetupRequired />
  if (isLoading) return <Loader />

  if (isError) {
    const errObj = error as Record<string, unknown> | null
    const errMsg =
      (errObj?.message as string) ||
      (errObj?.details as string) ||
      (typeof error === 'string' ? error : 'Erro desconhecido')
    const errCode = (errObj?.code as string) || (errObj?.hint as string) || ''
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-center max-w-xs">
          <p className="text-gray-700 font-semibold mb-1">Erro ao carregar dados</p>
          <p className="text-xs text-red-500 font-mono mb-1">{errMsg}</p>
          {errCode && <p className="text-xs text-gray-400 font-mono">{errCode}</p>}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-semibold"
        >
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    )
  }

  const kpis = data?.kpis ?? EMPTY_KPIS
  const por_obra = data?.por_obra ?? []
  const requisicoes_recentes = data?.requisicoes_recentes ?? []

  // Calcula stats por comprador a partir dos dados carregados
  const compradorStats = (() => {
    const reqs = todasReqs ?? []
    const map = new Map<string, { nome: string; total: number; pendentes: number; valor: number }>()
    for (const r of reqs) {
      if (!r.comprador_nome) continue
      const prev = map.get(r.comprador_nome) ?? { nome: r.comprador_nome, total: 0, pendentes: 0, valor: 0 }
      prev.total++
      if (['pendente', 'em_aprovacao', 'em_cotacao'].includes(r.status)) prev.pendentes++
      prev.valor += r.valor_estimado ?? 0
      map.set(r.comprador_nome, prev)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  })()

  return (
    <div className="space-y-4">

      {/* ApprovaAi Banner */}
      <Link
        to="/aprovaai"
        className="block rounded-2xl p-4 active:scale-[0.98] transition-all"
        style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', boxShadow: '0 8px 24px rgba(99,102,241,0.30)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm leading-none">ApprovaAi</h3>
              <p className="text-indigo-200 text-xs mt-0.5">Aprovações pendentes</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 inline-block">
              <span className="text-white text-lg font-extrabold leading-none">{kpis.aguardando_aprovacao}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Período */}
      <div className="flex gap-2">
        {['semana', 'mes', 'trimestre'].map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              periodo === p
                ? 'bg-navy text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {p === 'mes' ? 'Mês' : p === 'semana' ? 'Semana' : 'Trimestre'}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard titulo="Total RCs" valor={kpis.total_mes} icon={FileText} cor="text-primary" />
        <KpiCard titulo="Aguardando" valor={kpis.aguardando_aprovacao} icon={Clock} cor="text-warning" />
        <KpiCard titulo="Aprovadas" valor={kpis.aprovadas_mes} icon={CheckCircle} cor="text-success" />
        <KpiCard titulo="Valor Total" valor={fmt(kpis.valor_total_mes)} icon={DollarSign} cor="text-primary"
          subtitulo="no período" />
      </div>

      {/* Compradores */}
      {compradorStats.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <User2 className="w-3.5 h-3.5" /> Compradores
          </h2>
          <div className="space-y-2">
            {compradorStats.map(c => (
              <div key={c.nome} className="bg-white rounded-2xl p-3.5 shadow-card flex items-center gap-3">
                <Avatar nome={c.nome} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{c.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.total} {c.total === 1 ? 'requisição' : 'requisições'}
                    {c.pendentes > 0 && (
                      <span className="ml-1.5 text-amber-600 font-semibold">· {c.pendentes} pendente{c.pendentes > 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{fmt(c.valor)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Por Obra */}
      {por_obra.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Por Obra
          </h2>
          <div className="space-y-2">
            {por_obra.map((o, i) => {
              const maxValor = Math.max(...por_obra.map(x => x.valor), 1)
              const pct = Math.round((o.valor / maxValor) * 100)
              return (
                <div key={o.obra_nome} className="bg-white rounded-2xl p-3.5 shadow-card">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{o.obra_nome}</p>
                      <p className="text-xs text-gray-400">{o.total} RC{o.total !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{fmt(o.valor)}</p>
                      {o.pendentes > 0 && (
                        <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 justify-end mt-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> {o.pendentes} pend.
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Recentes */}
      <section>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Recentes
        </h2>
        <div className="space-y-2">
          {requisicoes_recentes.map(r => (
            <RecentCard key={r.id} r={r} />
          ))}
          {requisicoes_recentes.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Nenhuma requisição encontrada</p>
          )}
        </div>
      </section>
    </div>
  )
}

function RecentCard({ r }: { r: any }) {
  const STATUS_BORDER: Record<string, string> = {
    pendente: 'border-l-amber-400',
    em_aprovacao: 'border-l-blue-400',
    aprovada: 'border-l-emerald-400',
    rejeitada: 'border-l-red-400',
    em_cotacao: 'border-l-violet-400',
    comprada: 'border-l-green-400',
    cancelada: 'border-l-gray-300',
    rascunho: 'border-l-gray-300',
  }
  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  const fmtData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <div className={`bg-white rounded-2xl shadow-card border-l-4 ${STATUS_BORDER[r.status] ?? 'border-l-gray-200'} pl-3 pr-4 py-3`}>
      <div className="flex justify-between items-start gap-2">
        <span className="text-[10px] font-mono text-gray-400 mt-0.5">{r.numero}</span>
        <StatusBadge status={r.status as StatusRequisicao} />
      </div>
      <p className="text-sm font-semibold text-gray-800 mt-1 line-clamp-1">{r.descricao}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">{r.obra_nome}</span>
        <span className="text-sm font-bold text-primary">{fmt(r.valor_estimado)}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400">{r.solicitante_nome}</span>
        <span className="text-xs text-gray-400">{fmtData(r.created_at)}</span>
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function SetupRequired() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 px-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-amber-500 shrink-0" />
          <h2 className="font-bold text-gray-800">Configuração necessária</h2>
        </div>
        <p className="text-sm text-gray-600">
          As variáveis de ambiente do Supabase não foram configuradas no Vercel.
        </p>
        <div className="space-y-2 text-xs font-mono bg-gray-900 text-green-400 rounded-xl p-3">
          <p className="text-gray-400"># Vercel → Settings → Environment Variables</p>
          <p>VITE_SUPABASE_URL</p>
          <p className="text-gray-500 pl-2">https://uzfjfucrinokeuwpbeie.supabase.co</p>
          <p className="mt-2">VITE_SUPABASE_ANON_KEY</p>
          <p className="text-gray-500 pl-2">← copiar do Supabase Dashboard</p>
        </div>
        <a
          href="https://supabase.com/dashboard/project/uzfjfucrinokeuwpbeie/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs bg-primary text-white rounded-xl py-2.5 px-4 font-semibold"
        >
          1. Copiar Anon Key no Supabase →
        </a>
        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs bg-navy text-white rounded-xl py-2.5 px-4 font-semibold"
        >
          2. Configurar no Vercel →
        </a>
      </div>
    </div>
  )
}
