import { useState, useMemo } from 'react'
import { Activity, Filter, BarChart3, AlertCircle, TrendingUp, FolderKanban } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolios, useStatusReports, useIndicadores } from '../../hooks/usePMO'
import type { PMOPortfolio, PMOStatusReport, PMOIndicadoresSnapshot } from '../../types/pmo'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtPct = (v?: number | null) =>
  v != null ? v.toFixed(1) + '%' : '-'

const fmtIdx = (v?: number | null) =>
  v != null ? v.toFixed(2) : '-'

function healthColor(idx?: number | null): { light: string; dark: string; dot: string } {
  if (idx == null) return { light: 'bg-slate-50 text-slate-500', dark: 'bg-white/[0.02] text-slate-500', dot: 'bg-slate-400' }
  if (idx >= 1.0)  return { light: 'bg-emerald-50 text-emerald-700', dark: 'bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-500' }
  if (idx >= 0.8)  return { light: 'bg-amber-50 text-amber-700',     dark: 'bg-amber-500/10 text-amber-400',     dot: 'bg-amber-500' }
  return { light: 'bg-red-50 text-red-700', dark: 'bg-red-500/10 text-red-400', dot: 'bg-red-500' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StatusReportList() {
  const { isLightSidebar: isLight } = useTheme()
  const [filterPortfolio, setFilterPortfolio] = useState('')

  const { data: portfolios = [], isLoading: loadingPortfolios } = usePortfolios()

  // For the overview we need to iterate portfolios and get latest reports/indicadores
  // Since hooks require a portfolioId, we use the selected one or show all
  const selectedPortfolio = filterPortfolio || undefined
  const { data: statusReports = [] } = useStatusReports(selectedPortfolio)
  const { data: indicadores = [] } = useIndicadores(selectedPortfolio)

  // Compute KPI strip from indicadores
  const kpiStrip = useMemo(() => {
    const count = portfolios.length
    const spiValues = indicadores.filter(i => i.idp != null).map(i => i.idp!)
    const cpiValues = indicadores.filter(i => i.idc != null).map(i => i.idc!)
    const alertas = indicadores.filter(i =>
      (i.idp != null && i.idp < 0.8) || (i.idc != null && i.idc < 0.8)
    ).length

    const avgSPI = spiValues.length ? spiValues.reduce((a, b) => a + b, 0) / spiValues.length : null
    const avgCPI = cpiValues.length ? cpiValues.reduce((a, b) => a + b, 0) / cpiValues.length : null

    return { count, avgSPI, avgCPI, alertas }
  }, [portfolios, indicadores])

  // Latest status report per portfolio
  const latestReports = useMemo(() => {
    if (selectedPortfolio) {
      // Single portfolio selected
      const latest = statusReports[0]
      if (!latest) return []
      const p = portfolios.find(pp => pp.id === selectedPortfolio)
      return p ? [{ portfolio: p, report: latest }] : []
    }
    // No filter: show placeholder cards for each portfolio
    return portfolios.map(p => ({
      portfolio: p,
      report: null as PMOStatusReport | null,
    }))
  }, [portfolios, statusReports, selectedPortfolio])

  // Latest indicador snapshot per portfolio
  const latestIndicador = useMemo(() => {
    if (!selectedPortfolio) return new Map<string, PMOIndicadoresSnapshot>()
    const map = new Map<string, PMOIndicadoresSnapshot>()
    for (const ind of indicadores) {
      const key = ind.portfolio_id ?? '__global__'
      if (!map.has(key)) map.set(key, ind)
    }
    return map
  }, [indicadores, selectedPortfolio])

  const isLoading = loadingPortfolios

  const kpiCards = [
    { label: 'Portfolios', value: String(kpiStrip.count), icon: FolderKanban, color: 'text-blue-500' },
    { label: 'SPI Medio', value: fmtIdx(kpiStrip.avgSPI), icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'CPI Medio', value: fmtIdx(kpiStrip.avgCPI), icon: BarChart3, color: 'text-violet-500' },
    { label: 'Alertas Ativos', value: String(kpiStrip.alertas), icon: AlertCircle, color: 'text-red-500' },
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Activity size={20} className="text-blue-500" />
          Indicadores
        </h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Saude dos projetos e indicadores de performance
        </p>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className={`rounded-2xl border p-5 shadow-sm ${
            isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={16} className={card.color} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}>{card.label}</span>
            </div>
            <p className={`text-lg font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filter ──────────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />

        <select
          value={filterPortfolio}
          onChange={e => setFilterPortfolio(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-slate-800 border-slate-600 text-white'
          }`}
        >
          <option value="">Todos os Portfolios</option>
          {portfolios.map(p => (
            <option key={p.id} value={p.id}>{p.nome_obra}</option>
          ))}
        </select>
      </div>

      {/* ── Portfolio Health Cards ──────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-2xl h-40 animate-pulse ${
              isLight ? 'bg-slate-100' : 'bg-white/[0.04]'
            }`} />
          ))}
        </div>
      ) : latestReports.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Activity size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum indicador registrado
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestReports.map(({ portfolio, report }) => {
            const ind = latestIndicador.get(portfolio.id)
            return (
              <PortfolioHealthCard
                key={portfolio.id}
                portfolio={portfolio}
                report={report}
                indicador={ind}
                isLight={isLight}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Health Card ──────────────────────────────────────────────────────────────

function PortfolioHealthCard({ portfolio, report, indicador, isLight }: {
  portfolio: PMOPortfolio
  report: PMOStatusReport | null
  indicador?: PMOIndicadoresSnapshot
  isLight: boolean
}) {
  const spiHealth = healthColor(indicador?.idp)
  const cpiHealth = healthColor(indicador?.idc)

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${
      isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
            {portfolio.nome_obra}
          </p>
          <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            OSC {portfolio.numero_osc}
          </p>
        </div>
        {/* Traffic light */}
        <div className="flex items-center gap-1 ml-2">
          <span className={`w-2.5 h-2.5 rounded-full ${spiHealth.dot}`} title="SPI" />
          <span className={`w-2.5 h-2.5 rounded-full ${cpiHealth.dot}`} title="CPI" />
        </div>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`rounded-xl p-2.5 text-center ${isLight ? spiHealth.light : spiHealth.dark}`}>
          <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>IDP</p>
          <p className="text-base font-black">{fmtIdx(indicador?.idp)}</p>
        </div>
        <div className={`rounded-xl p-2.5 text-center ${isLight ? cpiHealth.light : cpiHealth.dark}`}>
          <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>IDC</p>
          <p className="text-base font-black">{fmtIdx(indicador?.idc)}</p>
        </div>
      </div>

      {/* Report summary */}
      {report ? (
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>OS Total</span>
            <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{report.os_total}</span>
          </div>
          <div className="flex justify-between">
            <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Faturamento</span>
            <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              {fmtPct(report.faturamento_atual > 0 && report.meta_faturamento > 0
                ? (report.faturamento_atual / report.meta_faturamento) * 100
                : null)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Execucao</span>
            <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              {fmtPct(indicador?.pct_valor_executado)}
            </span>
          </div>
        </div>
      ) : (
        <p className={`text-[10px] text-center py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Sem status report
        </p>
      )}
    </div>
  )
}
