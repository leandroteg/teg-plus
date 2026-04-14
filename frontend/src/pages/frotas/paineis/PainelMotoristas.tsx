import { useState, useMemo } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useScoreMotoristas } from '../../../hooks/useFrotas'

// ── Helpers ──────────────────────────────────────────────────────────────────
function startOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function endOfMonth() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

function scoreBadge(score: number, isLight: boolean) {
  if (score <= 2) {
    return isLight
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  }
  if (score <= 5) {
    return isLight
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  }
  return isLight
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-red-500/15 text-red-300 border-red-500/30'
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PainelMotoristas() {
  const { isDark } = useTheme()
  const isLight = !isDark

  const [inicio, setInicio] = useState(startOfMonth)
  const [fim, setFim] = useState(endOfMonth)

  const { data: motoristas = [], isLoading } = useScoreMotoristas(inicio, fim)

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = motoristas.length
    const totalOcorrencias = motoristas.reduce((s, m) => s + m.total_ocorrencias, 0)
    const scoreMedio =
      total > 0
        ? motoristas.reduce((s, m) => s + m.ocorrencias_por_1000km, 0) / total
        : 0
    return { total, totalOcorrencias, scoreMedio }
  }, [motoristas])

  // ── Sorted ranking ──────────────────────────────────────────────────────
  const ranking = useMemo(
    () => [...motoristas].sort((a, b) => b.ocorrencias_por_1000km - a.ocorrencias_por_1000km),
    [motoristas],
  )

  const cardClass = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'
  const txt = isLight ? 'text-slate-800' : 'text-white'
  const txtMuted = isLight ? 'text-slate-500' : 'text-slate-400'

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

      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-7 h-7 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total Motoristas', value: kpis.total, accent: 'border-l-sky-500' },
              { label: 'Total Ocorrências', value: kpis.totalOcorrencias, accent: 'border-l-amber-500' },
              { label: 'Score Médio', value: kpis.scoreMedio.toFixed(2), accent: 'border-l-violet-500' },
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

          {/* Ranking table */}
          <div className={`rounded-2xl overflow-hidden ${cardClass}`}>
            <div className={`px-4 py-3 ${isLight ? 'border-b border-slate-100' : 'border-b border-white/[0.06]'}`}>
              <p className={`text-sm font-bold ${txt}`}>Ranking de Motoristas — Ocorrências por 1.000 km</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/[0.03] text-slate-400'}>
                    <th className="text-left px-4 py-2.5 font-semibold">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Motorista</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Ocorrências</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Score (por 1.000 km)</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.length === 0 && (
                    <tr>
                      <td colSpan={4} className={`px-4 py-6 text-center ${txtMuted}`}>
                        Nenhum dado para o período selecionado.
                      </td>
                    </tr>
                  )}
                  {ranking.map((m, i) => (
                    <tr
                      key={m.motorista_id}
                      className={isLight ? 'border-t border-slate-100 hover:bg-slate-50' : 'border-t border-white/[0.04] hover:bg-white/[0.03]'}
                    >
                      <td className={`px-4 py-2.5 font-semibold ${txtMuted}`}>{i + 1}</td>
                      <td className={`px-4 py-2.5 font-semibold ${txt}`}>{m.nome}</td>
                      <td className={`px-4 py-2.5 text-right ${txt}`}>{m.total_ocorrencias}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${scoreBadge(m.ocorrencias_por_1000km, isLight)}`}>
                          {m.ocorrencias_por_1000km.toFixed(2)}
                        </span>
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
