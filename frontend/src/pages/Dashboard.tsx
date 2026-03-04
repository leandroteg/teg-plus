import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText, Clock, CheckCircle, DollarSign, Sparkles,
  RefreshCw, Settings, TrendingUp, AlertTriangle,
  ShoppingCart, Package, ChevronRight,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useRequisicoes } from '../hooks/useRequisicoes'
import StatusBadge from '../components/StatusBadge'
import FluxoTimeline from '../components/FluxoTimeline'
import { isPlaceholder } from '../services/supabase'
import type { StatusRequisicao, DashboardData, Aprovacao } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const EMPTY_KPIS: DashboardData['kpis'] = {
  total_mes: 0, aguardando_aprovacao: 0, aprovadas_mes: 0,
  rejeitadas_mes: 0, valor_total_mes: 0, tempo_medio_aprovacao_horas: 0,
}

// ── Funil pipeline — 7 etapas ──────────────────────────────────────────────
const PIPELINE_ETAPAS = [
  { label: 'Pendentes',  statuses: ['rascunho', 'pendente'],                color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200'   },
  { label: 'Aprovação',  statuses: ['em_aprovacao'],                        color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'    },
  { label: 'Cotação',    statuses: ['aprovada', 'em_cotacao', 'cotacao_enviada'], color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { label: 'Aprov. Fin.',statuses: ['cotacao_aprovada'],                    color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200'   },
  { label: 'Pedido',     statuses: ['pedido_emitido'],                      color: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200'    },
  { label: 'Entrega',    statuses: ['em_entrega', 'entregue'],              color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200'    },
  { label: 'Pagamento',  statuses: ['aguardando_pgto', 'pago'],             color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200' },
]

// ── Avatar helpers ──────────────────────────────────────────────────────────
const AVATAR_COLORS: Record<string, string> = {
  Lauany:  'bg-violet-500',
  Fernando:'bg-amber-500',
  Aline:   'bg-emerald-500',
}

function Avatar({ nome, size = 'sm' }: { nome: string; size?: 'sm' | 'md' }) {
  const initials = nome.slice(0, 2).toUpperCase()
  const bg = AVATAR_COLORS[nome.split(' ')[0]] ?? `bg-slate-500`
  const cls = size === 'md' ? 'w-9 h-9 text-sm font-bold' : 'w-6 h-6 text-[10px] font-bold'
  return (
    <div className={`${cls} ${bg} rounded-full flex items-center justify-center text-white flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ titulo, valor, icon: Icon, cor, subtitulo }: {
  titulo: string; valor: number | string; icon: typeof FileText;
  cor: string; subtitulo?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={cor} />
        <span className="text-[11px] text-slate-500 font-semibold">{titulo}</span>
      </div>
      <p className={`text-2xl font-extrabold ${cor} leading-none`}>{valor}</p>
      {subtitulo && <p className="text-[10px] text-slate-400 mt-1">{subtitulo}</p>}
    </div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const [periodo, setPeriodo] = useState('trimestre')
  const [pipelineFilter, setPipelineFilter] = useState<number | null>(null)
  const { data, isLoading, isError, error, refetch } = useDashboard(periodo)
  const { data: todasReqs } = useRequisicoes()

  if (isPlaceholder) return <SetupRequired />
  if (isLoading)    return <Loader />

  if (isError) {
    const errObj = error as unknown as Record<string, unknown>
    const errMsg = (errObj?.message as string) || (errObj?.details as string) || 'Erro desconhecido'
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-center max-w-xs">
          <p className="text-slate-700 font-semibold mb-1">Erro ao carregar dados</p>
          <p className="text-xs text-red-500 font-mono mb-1">{errMsg}</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 text-teal-700 rounded-xl text-sm font-semibold">
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    )
  }

  const kpis                  = data?.kpis ?? EMPTY_KPIS
  const por_obra              = data?.por_obra ?? []
  const requisicoes_recentes  = data?.requisicoes_recentes ?? []
  const aprovacoes_pendentes  = data?.aprovacoes_pendentes ?? []
  const reqs                  = todasReqs ?? requisicoes_recentes

  // Mapa: requisicao_id → aprovação pendente (para mostrar aprovador no card)
  const aprovacaoMap = new Map<string, Aprovacao>(
    aprovacoes_pendentes.map(a => [a.requisicao_id, a])
  )

  // Contagem por etapa do pipeline
  const pipelineContagens = PIPELINE_ETAPAS.map(etapa =>
    reqs.filter(r => etapa.statuses.includes(r.status)).length
  )

  // Filtro de recentes baseado no pipeline selecionado
  const recentes = pipelineFilter !== null
    ? reqs.filter(r => PIPELINE_ETAPAS[pipelineFilter].statuses.includes(r.status))
    : reqs.slice(0, 10)

  // Compradores stats
  const compradorStats = (() => {
    const map = new Map<string, { nome: string; total: number; pendentes: number; valor: number }>()
    for (const r of reqs) {
      if (!r.comprador_nome) continue
      const prev = map.get(r.comprador_nome) ?? { nome: r.comprador_nome, total: 0, pendentes: 0, valor: 0 }
      prev.total++
      if (['pendente', 'em_aprovacao', 'em_cotacao', 'cotacao_enviada'].includes(r.status)) prev.pendentes++
      prev.valor += r.valor_estimado ?? 0
      map.set(r.comprador_nome, prev)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  })()

  return (
    <div className="space-y-5">

      {/* ── AprovAi Banner ─────────────────────────────────────────────── */}
      <Link to="/aprovaai"
        className="block rounded-2xl p-4 active:scale-[0.98] transition-all"
        style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', boxShadow: '0 8px 24px rgba(99,102,241,0.25)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm leading-none">AprovAi</h3>
              <p className="text-indigo-200 text-xs mt-0.5">Aprovações pendentes com 1 toque</p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <span className="text-white text-xl font-extrabold">{kpis.aguardando_aprovacao}</span>
            <span className="text-indigo-200 text-xs">pendente{kpis.aguardando_aprovacao !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </Link>

      {/* ── Período ────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {[['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre'], ['tudo', 'Tudo']].map(([val, lbl]) => (
          <button key={val} onClick={() => setPeriodo(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              periodo === val ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard titulo="Total RCs"    valor={kpis.total_mes}              icon={FileText}    cor="text-teal-600"    />
        <KpiCard titulo="Aguardando"   valor={kpis.aguardando_aprovacao}   icon={Clock}       cor="text-amber-600"   />
        <KpiCard titulo="Aprovadas"    valor={kpis.aprovadas_mes}          icon={CheckCircle} cor="text-emerald-600" />
        <KpiCard titulo="Valor Total"  valor={fmt(kpis.valor_total_mes)}   icon={DollarSign}  cor="text-teal-600"    subtitulo="no período" />
      </div>

      {/* ── Funil Pipeline ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp size={12} /> Pipeline
          </h2>
          {pipelineFilter !== null && (
            <button onClick={() => setPipelineFilter(null)} className="text-[10px] text-teal-600 font-semibold">
              Ver todos ×
            </button>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {PIPELINE_ETAPAS.map((etapa, i) => {
            const count  = pipelineContagens[i]
            const active = pipelineFilter === i
            return (
              <button key={etapa.label} onClick={() => setPipelineFilter(active ? null : i)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                  active ? `${etapa.bg} ${etapa.border} shadow-sm` : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                <span className={`text-base font-extrabold leading-none ${active ? etapa.color : count > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                  {count}
                </span>
                <span className={`text-[8px] font-semibold text-center leading-tight ${active ? etapa.color : 'text-slate-400'}`}>
                  {etapa.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Compradores ────────────────────────────────────────────────── */}
      {compradorStats.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <ShoppingCart size={12} /> Compradores
          </h2>
          <div className="space-y-2">
            {compradorStats.map(c => (
              <div key={c.nome} className="bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-sm flex items-center gap-3">
                <Avatar nome={c.nome} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{c.nome}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {c.total} {c.total === 1 ? 'requisição' : 'requisições'}
                    {c.pendentes > 0 && (
                      <span className="ml-1.5 text-amber-600 font-semibold">· {c.pendentes} em andamento</span>
                    )}
                  </p>
                </div>
                <p className="text-sm font-extrabold text-teal-600 flex-shrink-0">{fmt(c.valor)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Por Obra ───────────────────────────────────────────────────── */}
      {por_obra.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Package size={12} /> Por Obra
          </h2>
          <div className="space-y-2">
            {por_obra.map(o => {
              const maxValor = Math.max(...por_obra.map(x => x.valor), 1)
              const pct = Math.round((o.valor / maxValor) * 100)
              return (
                <div key={o.obra_nome} className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{o.obra_nome}</p>
                      <p className="text-xs text-slate-400">{o.total} RC{o.total !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-teal-600">{fmt(o.valor)}</p>
                      {o.pendentes > 0 && (
                        <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 justify-end mt-0.5">
                          <AlertTriangle size={9} /> {o.pendentes} pend.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Recentes ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp size={12} />
            {pipelineFilter !== null ? PIPELINE_ETAPAS[pipelineFilter].label : 'Recentes'}
          </h2>
          <button onClick={() => nav('/requisicoes')}
            className="flex items-center gap-0.5 text-[10px] text-teal-600 font-semibold">
            Ver todas <ChevronRight size={11} />
          </button>
        </div>
        <div className="space-y-2">
          {recentes.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">Nenhuma requisição encontrada</p>
          ) : (
            recentes.slice(0, 8).map(r => (
              <RecentCard key={r.id} r={r} aprovacao={aprovacaoMap.get(r.id)} />
            ))
          )}
        </div>
      </section>
    </div>
  )
}

// ── Helpers de aprovação ─────────────────────────────────────────────────────
const NIVEL_LABEL: Record<number, string> = {
  1: 'Coordenador',
  2: 'Gerente',
  3: 'Diretor',
  4: 'CEO',
}

/** Retorna label específico do passo de aprovação, ou undefined se não aplicável */
function getApprovalStatusLabel(status: string): string | undefined {
  if (status === 'pendente')      return 'Aguard. Valid. Técnica'
  if (status === 'em_aprovacao')  return 'Em Validação Técnica'
  if (status === 'cotacao_aprovada') return 'Aguard. Aprov. Financeira'
  return undefined
}

function RecentCard({ r, aprovacao }: { r: any; aprovacao?: Aprovacao }) {
  const approvalLabel = getApprovalStatusLabel(r.status)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      {/* Linha 1: número + status */}
      <div className="flex justify-between items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-slate-400">{r.numero}</span>
        <StatusBadge status={r.status as StatusRequisicao} size="sm" customLabel={approvalLabel} />
      </div>

      {/* Descrição */}
      <p className="text-sm font-semibold text-slate-800 line-clamp-1 mb-2">{r.descricao}</p>

      {/* Info do aprovador pendente */}
      {aprovacao && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
          <Clock size={11} className="text-amber-500 flex-shrink-0" />
          <span className="text-[10px] text-amber-700 font-medium truncate">
            Aguardando {aprovacao.aprovador_nome}
            {aprovacao.nivel ? ` (${NIVEL_LABEL[aprovacao.nivel] ?? `Nível ${aprovacao.nivel}`})` : ''}
          </span>
        </div>
      )}

      {/* FluxoTimeline compact */}
      <FluxoTimeline status={r.status} compact className="mb-2" />

      {/* Rodapé */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
        <span className="text-xs text-slate-400 truncate max-w-[60%]">{r.obra_nome}</span>
        <span className="text-sm font-extrabold text-teal-600">
          {r.valor_estimado?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) ?? '—'}
        </span>
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function SetupRequired() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 px-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-amber-500 shrink-0" />
          <h2 className="font-bold text-slate-800">Configuração necessária</h2>
        </div>
        <p className="text-sm text-slate-600">Configure as variáveis de ambiente do Supabase no Vercel.</p>
        <div className="space-y-2 text-xs font-mono bg-slate-900 text-emerald-400 rounded-xl p-3">
          <p className="text-slate-400"># Vercel → Settings → Environment Variables</p>
          <p>VITE_SUPABASE_URL</p>
          <p>VITE_SUPABASE_ANON_KEY</p>
        </div>
        <a href="https://supabase.com/dashboard/project/uzfjfucrinokeuwpbeie/settings/api"
          target="_blank" rel="noopener noreferrer"
          className="block text-center text-xs bg-teal-500 text-white rounded-xl py-2.5 px-4 font-semibold">
          Copiar Anon Key no Supabase →
        </a>
      </div>
    </div>
  )
}
