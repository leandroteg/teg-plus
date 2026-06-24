// Painel Faturamento — consolidação das medições mensais (pmo_medicao_mensal)
import { useMemo, useState } from 'react'
import { DollarSign, TrendingUp, Calendar, Award } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useMedicaoMensal } from '../../../hooks/usePMO'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'

const fmtM = (v: number) => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k' : 'R$ ' + Math.round(v)
const fmtFull = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const MES_ABR = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function listaMeses(de: string, ate: string): string[] {
  const out: string[] = []; let [y, m] = de.split('-').map(Number)
  const [ya, ma] = ate.split('-').map(Number)
  while (y < ya || (y === ya && m <= ma)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } }
  return out
}
const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_ABR[Number(m)]}/${y.slice(2)}` }

export default function FaturamentoPainel({ de = '2024-01', ate }: { de?: string; ate?: string }) {
  const { isDark } = useTheme()
  const { data: rows, isLoading } = useMedicaoMensal()
  const [hover, setHover] = useState<number | null>(null)
  const ateF = ate ?? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()

  const serie = useMemo(() => {
    const byM = new Map<string, { fat: number; oscs: Set<string> }>()
    for (const r of (rows ?? [])) {
      const v = Number(r.realizado ?? 0); if (v <= 0) continue
      const c = r.competencia
      let a = byM.get(c); if (!a) { a = { fat: 0, oscs: new Set() }; byM.set(c, a) }
      a.fat += v; a.oscs.add(r.numero_os)
    }
    const meses = listaMeses(de, ateF)
    return meses.map(ym => ({ ym, fat: byM.get(ym)?.fat ?? 0, oscs: byM.get(ym)?.oscs.size ?? 0 }))
  }, [rows, de, ateF])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>

  const ativos = serie.filter(s => s.fat > 0)
  const total = serie.reduce((s, x) => s + x.fat, 0)
  const media = ativos.length ? total / ativos.length : 0
  const melhor = serie.reduce((b, x) => x.fat > b.fat ? x : b, { ym: '', fat: 0, oscs: 0 })
  const max = Math.max(...serie.map(s => s.fat), 1)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Faturado no período" value={fmtM(total)} tone="emerald" isDark={isDark} note={`${ativos.length} mes(es)`} />
        <Kpi label="Média mensal" value={fmtM(media)} tone="violet" isDark={isDark} note="meses com medição" />
        <Kpi label="Melhor mês" value={fmtM(melhor.fat)} tone="sky" isDark={isDark} note={melhor.ym ? ymLabel(melhor.ym) : '—'} />
        <Kpi label="Run-rate anual" value={fmtM(media * 12)} tone="amber" isDark={isDark} note="média × 12" />
      </div>

      <PanelCard title="Faturamento mensal (medições consolidadas)" icon={<TrendingUp size={14} className="text-teal-500" />} isDark={isDark}>
        <div className="flex items-end gap-1 pt-6" style={{ height: 230 }}>
          {serie.map((s, i) => (
            <div key={s.ym} className="flex-1 flex flex-col items-center justify-end h-full relative" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && s.fat > 0 && (
                <div className={`absolute -top-1 z-30 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap ${i <= 1 ? 'left-0' : i >= serie.length - 2 ? 'right-0' : 'left-1/2 -translate-x-1/2'} ${isDark ? 'bg-slate-800 border border-white/10' : 'bg-white border border-slate-200'}`}>
                  <p className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{ymLabel(s.ym)}</p>
                  <p className={`text-[11px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtFull(s.fat)}</p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.oscs} OSCs</p>
                </div>
              )}
              <span className={`text-[9px] font-bold mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{s.fat > 0 ? (s.fat / 1e6).toFixed(1) : ''}</span>
              <div className={`w-full rounded-t transition-opacity ${hover !== null && hover !== i ? 'opacity-50' : ''}`} style={{ height: `${(s.fat / max) * 100}%`, minHeight: s.fat > 0 ? 2 : 0, background: '#10b981' }} />
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          {serie.map(s => <span key={s.ym} className={`flex-1 text-center text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{Number(s.ym.split('-')[1]) === 1 ? `'${s.ym.slice(2, 4)}` : MES_ABR[Number(s.ym.split('-')[1])][0]}</span>)}
        </div>
        <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Valores em R$ milhões. Faturamento = soma das medições realizadas no mês.</p>
      </PanelCard>

      <PanelCard title="Detalhamento mensal" icon={<Calendar size={14} className="text-teal-500" />} isDark={isDark} pad={false} bodyClassName="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className={`text-[11px] uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <th className="text-left px-4 py-2">Mês</th><th className="text-right px-4 py-2">Faturado</th><th className="text-right px-4 py-2">OSCs</th>
          </tr></thead>
          <tbody>
            {[...ativos].reverse().map(s => (
              <tr key={s.ym} className={`border-t ${isDark ? 'border-white/[0.05] text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                <td className="px-4 py-2 font-semibold">{ymLabel(s.ym)}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtFull(s.fat)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.oscs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PanelCard>
    </div>
  )
}
