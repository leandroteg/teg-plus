import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, GitBranch, CalendarDays, BarChart3,
  DollarSign, Activity, MapPin, Clock, CheckCircle, AlertTriangle,
  Users, Layers, ChevronRight, TrendingUp,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  usePortfolio, useTAP, useEAP, useTarefas,
  useMedicaoResumo, useMedicaoItens, useIndicadores,
} from '../../hooks/usePMO'
import type { PMOEAP, StatusTarefa, FaseEAP } from '../../types/pmo'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'

const STATUS_MAP: Record<string, { label: string; light: string; dark: string }> = {
  em_analise_ate:   { label: 'Em Analise ATE',   light: 'bg-amber-100 text-amber-700',    dark: 'bg-amber-500/15 text-amber-400' },
  revisao_cliente:  { label: 'Revisao Cliente',   light: 'bg-purple-100 text-purple-700',  dark: 'bg-purple-500/15 text-purple-400' },
  liberado_iniciar: { label: 'Liberado Iniciar',   light: 'bg-blue-100 text-blue-700',     dark: 'bg-blue-500/15 text-blue-400' },
  obra_andamento:   { label: 'Em Andamento',       light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  obra_paralisada:  { label: 'Paralisada',         light: 'bg-red-100 text-red-700',       dark: 'bg-red-500/15 text-red-400' },
  obra_concluida:   { label: 'Concluida',          light: 'bg-slate-100 text-slate-600',   dark: 'bg-slate-500/15 text-slate-400' },
  cancelada:        { label: 'Cancelada',           light: 'bg-gray-100 text-gray-500',     dark: 'bg-gray-500/15 text-gray-400' },
}

const TABS = [
  { key: 'tap',         label: 'TAP',         icon: FileText },
  { key: 'eap',         label: 'EAP',         icon: GitBranch },
  { key: 'cronograma',  label: 'Cronograma',  icon: CalendarDays },
  { key: 'medicoes',    label: 'Medicoes',    icon: BarChart3 },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function PortfolioDetalhe() {
  const { isLightSidebar: isLight } = useTheme()
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [tab, setTab] = useState<TabKey>('tap')

  const { data: portfolio, isLoading } = usePortfolio(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Portfolio nao encontrado</p>
        <button onClick={() => nav('/egp/portfolio')}
          className="text-sm text-blue-500 hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Voltar
        </button>
      </div>
    )
  }

  const sc = STATUS_MAP[portfolio.status] ?? STATUS_MAP.cancelada

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button onClick={() => nav('/egp/portfolio')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}>
        <ArrowLeft size={14} /> Voltar aos Portfolios
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {portfolio.nome_obra}
            </h1>
            <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${isLight ? sc.light : sc.dark}`}>
              {sc.label}
            </span>
          </div>
          <div className={`flex items-center gap-3 mt-1 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className="flex items-center gap-1"><FileText size={11} /> {portfolio.numero_osc}</span>
            {portfolio.cidade_estado && (
              <span className="flex items-center gap-1"><MapPin size={11} /> {portfolio.cidade_estado}</span>
            )}
            {portfolio.cluster && (
              <span className="flex items-center gap-1"><Activity size={11} /> {portfolio.cluster}</span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard isLight={isLight} label="Valor Total" value={fmt(portfolio.valor_total_osc)} icon={DollarSign} color="text-blue-500" />
        <SummaryCard isLight={isLight} label="Faturado" value={fmt(portfolio.valor_faturado)} icon={BarChart3} color="text-emerald-500" />
        <SummaryCard isLight={isLight} label="Custo Real" value={fmt(portfolio.custo_real)} icon={Activity} color="text-amber-500" />
        <SummaryCard isLight={isLight} label="Prazo" value={`${fmtData(portfolio.data_inicio_contratual)} - ${fmtData(portfolio.data_termino_contratual)}`} icon={Clock} color="text-violet-500" />
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 rounded-xl p-1 ${isLight ? 'bg-slate-100' : 'bg-white/[0.04]'}`}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                active
                  ? isLight ? 'bg-white text-slate-800 shadow-sm' : 'bg-white/[0.08] text-white'
                  : isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'
              }`}>
              <t.icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className={`rounded-2xl border p-6 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        {tab === 'tap' && <TabTAP portfolioId={portfolio.id} isLight={isLight} nav={nav} />}
        {tab === 'eap' && <TabEAPInline portfolioId={portfolio.id} isLight={isLight} nav={nav} />}
        {tab === 'cronograma' && <TabCronogramaInline portfolioId={portfolio.id} isLight={isLight} nav={nav} />}
        {tab === 'medicoes' && <TabMedicoesInline portfolioId={portfolio.id} isLight={isLight} nav={nav} />}
      </div>
    </div>
  )
}

function SummaryCard({ isLight, label, value, icon: Icon, color }: {
  isLight: boolean; label: string; value: string; icon: typeof DollarSign; color: string
}) {
  return (
    <div className={`rounded-xl border p-3 ${
      isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className={color} />
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
      </div>
      <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{value}</p>
    </div>
  )
}

const CLASSIFICACAO_LABEL: Record<string, string> = {
  baixo: 'Baixo', baixa: 'Baixa', medio: 'Medio', media: 'Media', alto: 'Alto', alta: 'Alta',
}
const TAP_STATUS_LABEL: Record<string, { label: string; light: string; dark: string }> = {
  rascunho:     { label: 'Rascunho',      light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' },
  em_aprovacao: { label: 'Em Aprovacao',   light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
  aprovado:     { label: 'Aprovado',       light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  rejeitado:    { label: 'Rejeitado',      light: 'bg-red-100 text-red-600', dark: 'bg-red-500/15 text-red-400' },
}

function TabTAP({ portfolioId, isLight, nav }: { portfolioId: string; isLight: boolean; nav: ReturnType<typeof useNavigate> }) {
  const { data: tap, isLoading } = useTAP(portfolioId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!tap) {
    return (
      <div className="text-center py-8 space-y-3">
        <FileText size={28} className={`mx-auto ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
        <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Nenhum TAP cadastrado para este portfolio
        </p>
      </div>
    )
  }

  const st = TAP_STATUS_LABEL[tap.status] ?? TAP_STATUS_LABEL.rascunho

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            {tap.nome_projeto}
          </h3>
          {tap.numero_projeto && (
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Projeto: {tap.numero_projeto}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-semibold rounded-full px-2.5 py-1 ${isLight ? st.light : st.dark}`}>
          {st.label}
        </span>
      </div>

      {/* Classification Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Urgencia', value: tap.classificacao_urgencia },
          { label: 'Complexidade', value: tap.classificacao_complexidade },
          { label: 'Faturamento', value: tap.classificacao_faturamento },
          { label: 'Duracao', value: tap.classificacao_duracao },
        ].map(c => (
          <div key={c.label} className={`rounded-lg p-2.5 ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              {c.label}
            </p>
            <p className={`text-sm font-bold mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              {CLASSIFICACAO_LABEL[c.value] ?? c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Key info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tap.cliente && (
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Cliente</p>
            <p className={`text-sm font-medium mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{tap.cliente}</p>
          </div>
        )}
        {tap.gerente_projeto && (
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Gerente do Projeto</p>
            <p className={`text-sm font-medium mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{tap.gerente_projeto}</p>
          </div>
        )}
        {tap.patrocinador_cliente && (
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Patrocinador</p>
            <p className={`text-sm font-medium mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{tap.patrocinador_cliente}</p>
          </div>
        )}
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Orcamento Total</p>
          <p className={`text-sm font-bold mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            {fmt(tap.orcamento_total)}
          </p>
        </div>
      </div>

      {/* Objetivo */}
      {tap.objetivo && (
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Objetivo</p>
          <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{tap.objetivo}</p>
        </div>
      )}

      {/* Escopo */}
      {(tap.escopo_inclui?.length ?? 0) > 0 && (
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Escopo (Inclui)</p>
          <ul className="space-y-1">
            {tap.escopo_inclui!.map((e, i) => (
              <li key={i} className={`text-sm flex items-start gap-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" /> {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(tap.escopo_nao_inclui?.length ?? 0) > 0 && (
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Escopo (Nao Inclui)</p>
          <ul className="space-y-1">
            {tap.escopo_nao_inclui!.map((e, i) => (
              <li key={i} className={`text-sm flex items-start gap-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" /> {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Approval info */}
      {tap.aprovado_por && (
        <div className={`rounded-lg p-3 flex items-center gap-3 ${isLight ? 'bg-emerald-50 border border-emerald-100' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
          <CheckCircle size={16} className="text-emerald-500" />
          <div>
            <p className={`text-sm font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              Aprovado por {tap.aprovado_por}
            </p>
            {tap.aprovado_data && (
              <p className={`text-xs ${isLight ? 'text-emerald-600' : 'text-emerald-400/70'}`}>
                {fmtData(tap.aprovado_data)} {tap.aprovado_cargo ? `- ${tap.aprovado_cargo}` : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Link to status reports */}
      <button
        onClick={() => nav(`/egp/status-report/${portfolioId}`)}
        className="text-sm text-blue-500 hover:underline flex items-center gap-1"
      >
        Ver Status Reports deste portfolio <ChevronRight size={14} />
      </button>
    </div>
  )
}

/* ── EAP Inline Summary ──────────────────────────────────────────────────── */

const FASE_COLORS: Record<FaseEAP, string> = {
  iniciacao: 'bg-blue-500', planejamento: 'bg-violet-500', execucao: 'bg-emerald-500',
  monitoramento: 'bg-amber-500', encerramento: 'bg-slate-500',
}

function TabEAPInline({ portfolioId, isLight, nav }: { portfolioId: string; isLight: boolean; nav: ReturnType<typeof useNavigate> }) {
  const { data: items, isLoading } = useEAP(portfolioId)

  const tree = useMemo(() => {
    const flat = items ?? []
    const roots = flat.filter(i => !i.parent_id)
    return roots
  }, [items])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const flat = items ?? []

  if (flat.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <GitBranch size={28} className={`mx-auto ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
        <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum item na EAP</p>
        <button onClick={() => nav(`/egp/eap/${portfolioId}`)}
          className="text-sm text-blue-500 hover:underline">Criar EAP</button>
      </div>
    )
  }

  // Phase distribution
  const faseCount: Record<string, number> = {}
  flat.forEach(i => { if (i.fase) faseCount[i.fase] = (faseCount[i.fase] ?? 0) + 1 })

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          <span className="font-bold">{flat.length}</span> itens na EAP
        </div>
        <div className="flex items-center gap-1.5">
          {Object.entries(faseCount).map(([fase, count]) => (
            <span key={fase} className="flex items-center gap-1 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${FASE_COLORS[fase as FaseEAP] ?? 'bg-slate-400'}`} />
              <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>{count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Top-level items preview */}
      <div className="space-y-1.5">
        {tree.slice(0, 8).map(node => (
          <div key={node.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
            <Layers size={13} className={isLight ? 'text-violet-500' : 'text-violet-400'} />
            {node.codigo && (
              <span className={`text-xs font-mono font-semibold ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>{node.codigo}</span>
            )}
            <span className={`text-sm font-medium flex-1 truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{node.titulo}</span>
            <span className={`text-xs font-semibold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{node.peso_percentual}%</span>
          </div>
        ))}
        {tree.length > 8 && (
          <p className={`text-xs text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            +{tree.length - 8} itens...
          </p>
        )}
      </div>

      <button onClick={() => nav(`/egp/eap/${portfolioId}`)}
        className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 mx-auto">
        Abrir EAP completa <ChevronRight size={14} />
      </button>
    </div>
  )
}

/* ── Cronograma Inline Summary ───────────────────────────────────────────── */

const STATUS_TAREFA_LABEL: Record<StatusTarefa, string> = {
  a_fazer: 'A Fazer', em_andamento: 'Em Andamento', concluido: 'Concluido',
  nao_iniciado: 'Nao Iniciado', cancelado: 'Cancelado',
}

function TabCronogramaInline({ portfolioId, isLight, nav }: { portfolioId: string; isLight: boolean; nav: ReturnType<typeof useNavigate> }) {
  const { data: tarefas, isLoading } = useTarefas(portfolioId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const items = tarefas ?? []

  if (items.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <CalendarDays size={28} className={`mx-auto ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
        <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma tarefa cadastrada</p>
        <button onClick={() => nav(`/egp/cronograma/${portfolioId}`)}
          className="text-sm text-blue-500 hover:underline">Criar tarefas</button>
      </div>
    )
  }

  // Summary stats
  const byStatus: Record<string, number> = {}
  items.forEach(t => { byStatus[t.status] = (byStatus[t.status] ?? 0) + 1 })
  const avgProgress = items.length > 0
    ? items.reduce((s, t) => s + t.percentual_concluido, 0) / items.length
    : 0

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            Progresso Geral
          </span>
          <span className={`text-sm font-bold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
            {avgProgress.toFixed(1)}%
          </span>
        </div>
        <div className={`h-2.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
            style={{ width: `${Math.min(avgProgress, 100)}%` }} />
        </div>
      </div>

      {/* Status counters */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className={`rounded-lg px-3 py-1.5 ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
            <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {STATUS_TAREFA_LABEL[status as StatusTarefa] ?? status}
            </span>
            <span className={`ml-1.5 text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{count}</span>
          </div>
        ))}
      </div>

      {/* Recent tasks */}
      <div className="space-y-1">
        {items.slice(0, 5).map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              t.status === 'concluido' ? 'bg-emerald-500'
              : t.status === 'em_andamento' ? 'bg-blue-500'
              : t.status === 'cancelado' ? 'bg-red-500'
              : 'bg-slate-400'
            }`} />
            <span className={`text-sm flex-1 truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{t.tarefa}</span>
            <span className={`text-xs font-semibold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{t.percentual_concluido}%</span>
          </div>
        ))}
        {items.length > 5 && (
          <p className={`text-xs text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            +{items.length - 5} tarefas...
          </p>
        )}
      </div>

      <button onClick={() => nav(`/egp/cronograma/${portfolioId}`)}
        className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 mx-auto">
        Abrir Cronograma <ChevronRight size={14} />
      </button>
    </div>
  )
}

/* ── Medicoes Inline Summary ─────────────────────────────────────────────── */

function TabMedicoesInline({ portfolioId, isLight, nav }: { portfolioId: string; isLight: boolean; nav: ReturnType<typeof useNavigate> }) {
  const { data: resumo, isLoading: lr } = useMedicaoResumo(portfolioId)
  const { data: itens, isLoading: li } = useMedicaoItens(portfolioId)

  if (lr || li) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const items = itens ?? []

  if (!resumo && items.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <BarChart3 size={28} className={`mx-auto ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
        <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma medicao cadastrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className={`rounded-lg p-2.5 ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Contrato</p>
            <p className={`text-sm font-bold mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{fmt(resumo.valor_contrato)}</p>
          </div>
          <div className={`rounded-lg p-2.5 ${isLight ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>Medido</p>
            <p className={`text-sm font-bold mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
              {fmt(resumo.total_medido_valor)} ({(resumo.total_medido_pct * 100).toFixed(1)}%)
            </p>
          </div>
          <div className={`rounded-lg p-2.5 ${isLight ? 'bg-amber-50' : 'bg-amber-500/10'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>A Medir</p>
            <p className={`text-sm font-bold mt-0.5 ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
              {fmt(resumo.total_a_medir_valor)} ({(resumo.total_a_medir_pct * 100).toFixed(1)}%)
            </p>
          </div>
          {resumo.prazo && (
            <div className={`rounded-lg p-2.5 ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Prazo</p>
              <p className={`text-sm font-bold mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{resumo.prazo}</p>
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {resumo && resumo.valor_contrato > 0 && (
        <div>
          <div className={`h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
              style={{ width: `${Math.min(resumo.total_medido_pct * 100, 100)}%` }} />
          </div>
        </div>
      )}

      <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        {items.length} iten{items.length !== 1 ? 's' : ''} de medicao
      </p>

      <button onClick={() => nav(`/egp/medicoes/${portfolioId}`)}
        className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 mx-auto">
        Abrir Medicoes <ChevronRight size={14} />
      </button>
    </div>
  )
}
