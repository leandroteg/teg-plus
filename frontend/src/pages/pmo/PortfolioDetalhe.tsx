import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, GitBranch, CalendarDays, BarChart3,
  DollarSign, Activity, MapPin, Clock,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolio } from '../../hooks/usePMO'

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
        <button onClick={() => nav('/pmo/portfolio')}
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
      <button onClick={() => nav('/pmo/portfolio')}
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
        {tab === 'eap' && <TabLink isLight={isLight} nav={nav} to={`/pmo/eap/${portfolio.id}`} label="Abrir EAP completa" desc="Visualize a Estrutura Analitica do Projeto" />}
        {tab === 'cronograma' && <TabLink isLight={isLight} nav={nav} to={`/pmo/cronograma/${portfolio.id}`} label="Abrir Cronograma" desc="Visualize as tarefas e o progresso do projeto" />}
        {tab === 'medicoes' && <TabLink isLight={isLight} nav={nav} to={`/pmo/medicoes/${portfolio.id}`} label="Abrir Medicoes" desc="Visualize o resumo e itens de medicao" />}
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

function TabTAP({ portfolioId, isLight, nav }: { portfolioId: string; isLight: boolean; nav: ReturnType<typeof useNavigate> }) {
  // Inline TAP summary — users can navigate to a full TAP editor if needed
  return (
    <div className="space-y-4">
      <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        Termo de Abertura do Projeto (TAP) para este portfolio.
      </p>
      <button
        onClick={() => nav(`/pmo/status-report/${portfolioId}`)}
        className="text-sm text-blue-500 hover:underline"
      >
        Ver Status Reports deste portfolio
      </button>
    </div>
  )
}

function TabLink({ isLight, nav, to, label, desc }: {
  isLight: boolean; nav: ReturnType<typeof useNavigate>; to: string; label: string; desc: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{desc}</p>
      <button onClick={() => nav(to)}
        className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
        {label}
      </button>
    </div>
  )
}
