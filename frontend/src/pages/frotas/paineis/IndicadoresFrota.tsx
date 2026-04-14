import { useState, useMemo } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useFrotasCustoKm, useFrotasConsumoReal } from '../../../hooks/useFrotas'

// ── Helpers ──────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(v)

function startOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function endOfMonth() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

// ── Component ────────────────────────────────────────────────────────────────
export default function IndicadoresFrota() {
  const { isDark } = useTheme()
  const isLight = !isDark

  const [inicio, setInicio] = useState(startOfMonth)
  const [fim, setFim] = useState(endOfMonth)

  const { data: custoKm = [], isLoading: loadCusto } = useFrotasCustoKm(inicio, fim)
  const { data: consumo = [], isLoading: loadConsumo } = useFrotasConsumoReal(inicio, fim)

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const custoMedio =
      custoKm.length > 0
        ? custoKm.reduce((s, v) => s + v.custo_por_km, 0) / custoKm.length
        : 0
    const consumoMedio =
      consumo.length > 0
        ? consumo.reduce((s, v) => s + v.km_por_litro, 0) / consumo.length
        : 0
    const kmTotal = custoKm.reduce((s, v) => s + v.km_percorrido, 0)
    const veiculosAnalisados = new Set([
      ...custoKm.map(v => v.veiculo_id),
      ...consumo.map(v => v.veiculo_id),
    ]).size
    return { custoMedio, consumoMedio, kmTotal, veiculosAnalisados }
  }, [custoKm, consumo])

  // ── Sorted table ─────────────────────────────────────────────────────────
  const tabelaCusto = useMemo(
    () => [...custoKm].sort((a, b) => b.custo_por_km - a.custo_por_km),
    [custoKm],
  )

  const cardClass = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'
  const txt = isLight ? 'text-slate-800' : 'text-white'
  const txtMuted = isLight ? 'text-slate-500' : 'text-slate-400'

  const loading = loadCusto || loadConsumo

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`text-xs font-semibold ${txtMuted}`}>Período:</label>
        <input
          type="date"
          value={inicio}
          onChange={e => setInicio(e.target.value)}
          className={`text-xs rounded-lg px-3 py-1.5 border ${
            isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/[0.06] border-white/[0.1] text-slate-300'
          }`}
        />
        <span className={`text-xs ${txtMuted}`}>a</span>
        <input
          type="date"
          value={fim}
          onChange={e => setFim(e.target.value)}
          className={`text-xs rounded-lg px-3 py-1.5 border ${
            isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/[0.06] border-white/[0.1] text-slate-300'
          }`}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-7 h-7 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Custo/km Médio', value: BRL(kpis.custoMedio), accent: 'border-l-violet-500' },
              { label: 'Consumo Médio', value: `${kpis.consumoMedio.toFixed(2)} km/l`, accent: 'border-l-emerald-500' },
              { label: 'KM Total', value: kpis.kmTotal.toLocaleString('pt-BR'), accent: 'border-l-sky-500' },
              { label: 'Veículos Analisados', value: kpis.veiculosAnalisados, accent: 'border-l-amber-500' },
            ].map(kpi => (
              <div
                key={kpi.label}
                className={`rounded-2xl border-l-4 p-4 ${kpi.accent} ${cardClass}`}
              >
                <p className={`text-[10px] uppercase tracking-wide font-bold mb-1 ${txtMuted}`}>{kpi.label}</p>
                <p className={`text-2xl font-black leading-none ${txt}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Vehicle table */}
          <div className={`rounded-2xl overflow-hidden ${cardClass}`}>
            <div className={`px-4 py-3 ${isLight ? 'border-b border-slate-100' : 'border-b border-white/[0.06]'}`}>
              <p className={`text-sm font-bold ${txt}`}>Custo por KM — Detalhamento por Veículo</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/[0.03] text-slate-400'}>
                    <th className="text-left px-4 py-2.5 font-semibold">Placa</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Marca / Modelo</th>
                    <th className="text-right px-4 py-2.5 font-semibold">KM Percorrido</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Custo Total</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Custo/km</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelaCusto.length === 0 && (
                    <tr>
                      <td colSpan={5} className={`px-4 py-6 text-center ${txtMuted}`}>
                        Nenhum dado para o período selecionado.
                      </td>
                    </tr>
                  )}
                  {tabelaCusto.map(v => (
                    <tr
                      key={v.veiculo_id}
                      className={isLight ? 'border-t border-slate-100 hover:bg-slate-50' : 'border-t border-white/[0.04] hover:bg-white/[0.03]'}
                    >
                      <td className={`px-4 py-2.5 font-semibold ${txt}`}>{v.placa}</td>
                      <td className={`px-4 py-2.5 ${txtMuted}`}>{v.marca} {v.modelo}</td>
                      <td className={`px-4 py-2.5 text-right ${txt}`}>{v.km_percorrido.toLocaleString('pt-BR')}</td>
                      <td className={`px-4 py-2.5 text-right ${txt}`}>{BRL(v.custo_total)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${
                        v.custo_por_km > 2 ? 'text-red-500' : v.custo_por_km > 1 ? 'text-amber-500' : isLight ? 'text-emerald-600' : 'text-emerald-400'
                      }`}>
                        {BRL(v.custo_por_km)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
