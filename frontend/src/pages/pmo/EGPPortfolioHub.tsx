import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, GitBranch, CalendarDays, BarChart3, Users, DollarSign } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolios } from '../../hooks/usePMO'

/**
 * Reusable hub page that shows portfolio cards and links to a specific EGP sub-screen.
 * Used for screens that require a portfolioId (EAP, Cronograma, Medições, Histograma, Custos).
 */

interface EGPPortfolioHubProps {
  /** Screen identifier - appended to /egp/{screen}/{portfolioId} */
  screen: string
  /** Page title */
  title: string
  /** Lucide icon component */
  icon: React.ElementType
  /** Accent color class */
  accent?: string
  /** Description shown under the title */
  description?: string
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

const STATUS_MAP: Record<string, { label: string; light: string; dark: string }> = {
  em_analise_ate:   { label: 'Em Análise ATE',  light: 'bg-amber-100 text-amber-700',    dark: 'bg-amber-500/15 text-amber-400' },
  revisao_cliente:  { label: 'Revisão Cliente',  light: 'bg-purple-100 text-purple-700',  dark: 'bg-purple-500/15 text-purple-400' },
  liberado_iniciar: { label: 'Liberado Iniciar', light: 'bg-blue-100 text-blue-700',      dark: 'bg-blue-500/15 text-blue-400' },
  obra_andamento:   { label: 'Em Andamento',     light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  obra_paralisada:  { label: 'Paralisada',       light: 'bg-red-100 text-red-700',        dark: 'bg-red-500/15 text-red-400' },
  obra_concluida:   { label: 'Concluída',        light: 'bg-slate-100 text-slate-600',    dark: 'bg-slate-500/15 text-slate-400' },
  cancelada:        { label: 'Cancelada',         light: 'bg-gray-100 text-gray-500',     dark: 'bg-gray-500/15 text-gray-400' },
}

export default function EGPPortfolioHub({
  screen, title, icon: Icon, accent = 'text-blue-500', description,
}: EGPPortfolioHubProps) {
  const { isLightSidebar: isLight } = useTheme()
  const nav = useNavigate()
  const [search, setSearch] = useState('')

  const { data: portfolios, isLoading } = usePortfolios()

  const filtered = (portfolios ?? []).filter(p =>
    p.nome_obra.toLowerCase().includes(search.toLowerCase()) ||
    p.numero_osc.toLowerCase().includes(search.toLowerCase())
  )

  const activePortfolios = filtered.filter(p => !['cancelada', 'obra_concluida'].includes(p.status))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Icon size={22} className={accent} />
            {title}
          </h1>
          {description && (
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {description}
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar contrato..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm transition-all ${
              isLight
                ? 'bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
                : 'bg-slate-800/60 border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-white'
            } focus:outline-none`}
          />
        </div>
      </div>

      {/* Info banner */}
      <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 text-sm ${
        isLight ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      }`}>
        <Icon size={16} />
        Selecione um contrato para acessar {title.toLowerCase()}
      </div>

      {/* Portfolio Grid */}
      {activePortfolios.length === 0 ? (
        <div className={`text-center py-12 rounded-2xl border ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-800/40 border-slate-700 text-slate-400'
        }`}>
          <Icon size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum contrato encontrado</p>
          <p className="text-sm mt-1 opacity-70">Cadastre um contrato no Painel EGP para começar</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activePortfolios.map(p => {
            const st = STATUS_MAP[p.status] ?? STATUS_MAP.obra_andamento
            const progresso = p.valor_total_osc > 0
              ? p.valor_faturado / p.valor_total_osc
              : 0

            return (
              <button
                key={p.id}
                onClick={() => nav(`/egp/${screen}/${p.id}`)}
                className={`group text-left rounded-2xl border p-4 transition-all duration-200 ${
                  isLight
                    ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10'
                    : 'bg-slate-800/50 border-slate-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
                }`}
              >
                {/* Top row: name + status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-sm truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {p.nome_obra}
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {p.numero_osc}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? st.light : st.dark}`}>
                    {st.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className={`h-1.5 rounded-full overflow-hidden mb-3 ${isLight ? 'bg-slate-100' : 'bg-slate-700'}`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                    style={{ width: `${Math.min(progresso * 100, 100)}%` }}
                  />
                </div>

                {/* Metrics */}
                <div className="flex items-center justify-between text-xs">
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    {fmtPct(progresso)} faturado
                  </span>
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    {fmt(p.valor_total_osc)}
                  </span>
                </div>

                {/* Arrow */}
                <div className={`flex items-center gap-1 mt-3 text-xs font-medium transition-colors ${
                  isLight
                    ? 'text-blue-500 group-hover:text-blue-600'
                    : 'text-blue-400 group-hover:text-blue-300'
                }`}>
                  Acessar {title} <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
