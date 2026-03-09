import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, BarChart3,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolio } from '../../hooks/usePMO'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

export default function ControleCustos() {
  const { isLightSidebar: isLight } = useTheme()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()

  const { data: portfolio, isLoading } = usePortfolio(portfolioId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const p = portfolio
  const valorOSC = p?.valor_total_osc ?? 0
  const faturado = p?.valor_faturado ?? 0
  const custoOrcado = p?.custo_orcado ?? 0
  const custoPlanejado = p?.custo_planejado ?? 0
  const custoReal = p?.custo_real ?? 0
  const multaEstimada = p?.multa_valor_estimado ?? 0

  const margemBruta = valorOSC > 0 ? (valorOSC - custoReal) / valorOSC : 0
  const margemPlanejada = valorOSC > 0 ? (valorOSC - custoPlanejado) / valorOSC : 0
  const desvioOrcamento = custoOrcado > 0 ? (custoReal - custoOrcado) / custoOrcado : 0
  const custoPerformance = custoPlanejado > 0 ? custoReal / custoPlanejado : 0
  const idc = custoPlanejado > 0 ? custoPlanejado / custoReal : 0 // IDC > 1 = bom

  const kpis = [
    {
      label: 'Valor Total OSC',
      value: fmt(valorOSC),
      icon: DollarSign,
      color: 'text-blue-500',
      bg: isLight ? 'bg-blue-50 border-blue-100' : 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Faturado',
      value: fmt(faturado),
      sub: valorOSC > 0 ? fmtPct(faturado / valorOSC) : '-',
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: isLight ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Custo Real',
      value: fmt(custoReal),
      sub: custoOrcado > 0 ? `${fmtPct(custoReal / custoOrcado)} do orçado` : '-',
      icon: BarChart3,
      color: desvioOrcamento > 0.05 ? 'text-red-500' : 'text-slate-500',
      bg: desvioOrcamento > 0.05
        ? (isLight ? 'bg-red-50 border-red-100' : 'bg-red-500/10 border-red-500/20')
        : (isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700'),
    },
    {
      label: 'IDC (Índice Desempenho Custo)',
      value: idc > 0 ? idc.toFixed(2) : '-',
      sub: idc >= 1 ? 'Dentro do orçamento' : idc > 0 ? 'Acima do orçamento' : '',
      icon: idc >= 1 ? CheckCircle : AlertTriangle,
      color: idc >= 1 ? 'text-emerald-500' : 'text-amber-500',
      bg: idc >= 1
        ? (isLight ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20')
        : (isLight ? 'bg-amber-50 border-amber-100' : 'bg-amber-500/10 border-amber-500/20'),
    },
    {
      label: 'Margem Bruta Real',
      value: fmtPct(margemBruta),
      sub: `Planejada: ${fmtPct(margemPlanejada)}`,
      icon: margemBruta >= margemPlanejada ? TrendingUp : TrendingDown,
      color: margemBruta >= margemPlanejada ? 'text-emerald-500' : 'text-red-500',
      bg: margemBruta >= margemPlanejada
        ? (isLight ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20')
        : (isLight ? 'bg-red-50 border-red-100' : 'bg-red-500/10 border-red-500/20'),
    },
    {
      label: 'Multas Estimadas',
      value: fmt(multaEstimada),
      sub: p?.multa_previsao ? `Risco: ${p.multa_previsao}` : '',
      icon: AlertTriangle,
      color: multaEstimada > 0 ? 'text-red-500' : 'text-slate-400',
      bg: multaEstimada > 0
        ? (isLight ? 'bg-red-50 border-red-100' : 'bg-red-500/10 border-red-500/20')
        : (isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700'),
    },
  ]

  // Cost breakdown table rows
  const custoRows = [
    { label: 'Custo Orçado (baseline)', value: custoOrcado, pct: 1 },
    { label: 'Custo Planejado (projetado)', value: custoPlanejado, pct: custoOrcado > 0 ? custoPlanejado / custoOrcado : 0 },
    { label: 'Custo Real (executado)', value: custoReal, pct: custoOrcado > 0 ? custoReal / custoOrcado : 0 },
    { label: 'Desvio (Real - Orçado)', value: custoReal - custoOrcado, pct: desvioOrcamento },
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button
        onClick={() => nav(portfolioId ? `/egp/portfolio/${portfolioId}` : '/egp/custos')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <DollarSign size={20} className="text-emerald-500" />
          Controle de Custos
        </h1>
        {p && (
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {p.nome_obra} — {p.numero_osc}
          </p>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map(k => (
          <div
            key={k.label}
            className={`rounded-2xl border p-4 ${k.bg}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <k.icon size={16} className={k.color} />
              <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {k.label}
              </span>
            </div>
            <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {k.value}
            </p>
            {k.sub && (
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                {k.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Cost breakdown table */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700'
      }`}>
        <div className={`px-4 py-3 border-b ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
          <h2 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            <BarChart3 size={15} />
            Decomposição de Custos
          </h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {custoRows.map((r, i) => {
            const isNeg = r.value < 0
            const isDesvio = i === custoRows.length - 1
            return (
              <div
                key={r.label}
                className={`flex items-center justify-between px-4 py-3 ${
                  isDesvio
                    ? isLight ? 'bg-slate-50' : 'bg-slate-800/40'
                    : ''
                }`}
              >
                <span className={`text-sm ${
                  isDesvio
                    ? `font-semibold ${isNeg ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : r.value > 0 ? (isLight ? 'text-red-700' : 'text-red-400') : (isLight ? 'text-slate-700' : 'text-slate-300')}`
                    : isLight ? 'text-slate-600' : 'text-slate-300'
                }`}>
                  {r.label}
                </span>
                <div className="flex items-center gap-3">
                  {/* Bar */}
                  {!isDesvio && (
                    <div className={`w-20 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-700'}`}>
                      <div
                        className={`h-full rounded-full transition-all ${
                          i === 2 && r.pct > 1
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(r.pct * 100, 100)}%` }}
                      />
                    </div>
                  )}
                  <span className={`text-sm font-mono font-semibold min-w-[100px] text-right ${
                    isDesvio
                      ? isNeg ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : r.value > 0 ? (isLight ? 'text-red-600' : 'text-red-400') : (isLight ? 'text-slate-600' : 'text-slate-300')
                      : isLight ? 'text-slate-700' : 'text-white'
                  }`}>
                    {isDesvio && r.value > 0 ? '+' : ''}{fmt(r.value)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Multa details (if any) */}
      {multaEstimada > 0 && p?.multa_motivo && (
        <div className={`rounded-2xl border p-4 ${
          isLight ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/20'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className={`text-sm font-semibold ${isLight ? 'text-red-700' : 'text-red-400'}`}>
              Risco de Multa
            </span>
          </div>
          <p className={`text-sm ${isLight ? 'text-red-600' : 'text-red-300'}`}>
            {p.multa_motivo}
          </p>
          <p className={`text-xs mt-1.5 ${isLight ? 'text-red-500' : 'text-red-400'}`}>
            Valor estimado: {fmt(multaEstimada)} · Nível: {p.multa_previsao ?? 'N/A'}
          </p>
        </div>
      )}
    </div>
  )
}
