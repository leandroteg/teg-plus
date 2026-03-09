import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, DollarSign, CalendarDays } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useMedicaoResumo, useMedicaoItens, useMedicaoPeriodos, usePortfolio } from '../../hooks/usePMO'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

export default function Medicoes() {
  const { isLightSidebar: isLight } = useTheme()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()

  const { data: portfolio } = usePortfolio(portfolioId)
  const { data: resumo, isLoading: loadingResumo } = useMedicaoResumo(portfolioId)
  const { data: itens, isLoading: loadingItens } = useMedicaoItens(portfolioId)
  const { data: periodos, isLoading: loadingPeriodos } = useMedicaoPeriodos(resumo?.id)

  const isLoading = loadingResumo || loadingItens || loadingPeriodos

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const items = itens ?? []

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button onClick={() => nav(portfolioId ? `/egp/portfolio/${portfolioId}` : '/egp/portfolio')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <BarChart3 size={20} className="text-emerald-500" />
          Medicoes
        </h1>
        {portfolio && (
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {portfolio.nome_obra} - {portfolio.numero_osc}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard isLight={isLight} label="Valor Contrato" value={fmt(resumo.valor_contrato)} icon={DollarSign} color="text-blue-500" />
          <SummaryCard isLight={isLight} label="Total Medido" value={`${fmt(resumo.total_medido_valor)} (${fmtPct(resumo.total_medido_pct)})`} icon={TrendingUp} color="text-emerald-500" />
          <SummaryCard isLight={isLight} label="A Medir" value={`${fmt(resumo.total_a_medir_valor)} (${fmtPct(resumo.total_a_medir_pct)})`} icon={TrendingDown} color="text-amber-500" />
          <SummaryCard isLight={isLight} label="Prazo" value={resumo.prazo ?? '-'} icon={BarChart3} color="text-violet-500" />
        </div>
      )}

      {!resumo && (
        <div className={`rounded-2xl border p-6 text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum resumo de medicao disponivel
          </p>
        </div>
      )}

      {/* Periodos */}
      {(periodos ?? []).length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className={`px-4 py-3 border-b flex items-center gap-2 ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
            <CalendarDays size={14} className="text-blue-500" />
            <h2 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
              Periodos de Medicao ({periodos!.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'}>
                  <th className="text-left font-semibold px-4 py-3">Periodo</th>
                  <th className="text-right font-semibold px-4 py-3">Previsto</th>
                  <th className="text-right font-semibold px-4 py-3">Realizado</th>
                  <th className="text-right font-semibold px-4 py-3">Delta</th>
                  <th className="text-left font-semibold px-4 py-3 w-32">Variacao</th>
                </tr>
              </thead>
              <tbody>
                {periodos!.map(p => {
                  const deltaPct = p.valor_previsto > 0 ? ((p.valor_realizado - p.valor_previsto) / p.valor_previsto) * 100 : 0
                  const isPositive = p.delta >= 0
                  return (
                    <tr key={p.id} className={`border-t transition-colors ${
                      isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'
                    }`}>
                      <td className={`px-4 py-3 font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {p.periodo}
                      </td>
                      <td className={`px-4 py-3 text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {fmt(p.valor_previsto)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {fmt(p.valor_realizado)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        isPositive
                          ? (isLight ? 'text-emerald-600' : 'text-emerald-400')
                          : (isLight ? 'text-red-600' : 'text-red-400')
                      }`}>
                        {isPositive ? '+' : ''}{fmt(p.delta)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                            <div
                              className={`h-full rounded-full transition-all ${
                                p.valor_previsto > 0 && p.valor_realizado >= p.valor_previsto
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(p.valor_previsto > 0 ? (p.valor_realizado / p.valor_previsto) * 100 : 0, 100)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-semibold w-12 text-right ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                            {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          <h2 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Itens de Medicao ({items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'}>
                <th className="text-left font-semibold px-4 py-3">#</th>
                <th className="text-left font-semibold px-4 py-3">Item</th>
                <th className="text-left font-semibold px-4 py-3">Unidade</th>
                <th className="text-right font-semibold px-4 py-3">Qtd Prevista</th>
                <th className="text-right font-semibold px-4 py-3">Preco Unit.</th>
                <th className="text-right font-semibold px-4 py-3">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`text-center py-12 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nenhum item de medicao encontrado
                  </td>
                </tr>
              ) : (
                items.map(it => (
                  <tr key={it.id} className={`border-t transition-colors ${
                    isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'
                  }`}>
                    <td className={`px-4 py-3 font-mono text-xs ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
                      {it.numero_medicao}
                    </td>
                    <td className={`px-4 py-3 font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {it.item_descricao}
                    </td>
                    <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {it.unidade ?? '-'}
                    </td>
                    <td className={`px-4 py-3 text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      {it.quantidade_prevista.toLocaleString('pt-BR')}
                    </td>
                    <td className={`px-4 py-3 text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      {fmt(it.preco_unitario)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {fmt(it.valor_total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className={`border-t-2 ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>
                  <td colSpan={5} className={`px-4 py-3 text-right font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                    Total
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    {fmt(items.reduce((s, it) => s + it.valor_total, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
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
