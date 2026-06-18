// pages/rh/paineis/EvolucaoHeadcount.tsx — evolução do efetivo (CLT/PJ), entradas, saídas e turnover.
import { useMemo } from 'react'
import { TrendingUp, Table2 } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useHeadcountDataset } from '../../../hooks/useRH'
import { serieMensal, ymKey } from '../../../lib/headcountAnalytics'
import { PanelCard, Kpi, StackedMonthChart, Legenda } from './_ui'

const COR_CLT = '#7c3aed', COR_PJ = '#f59e0b', COR_OUTROS = '#94a3b8'

export default function EvolucaoHeadcount() {
  const { isDark } = useTheme()
  const { data: rows = [], isLoading } = useHeadcountDataset()

  const { serie, kpis } = useMemo(() => {
    const toYM = ymKey(new Date())
    const s = serieMensal(rows, '2025-01', toYM)
    const ultimo = s[s.length - 1]
    const primeiro = s.find(m => m.total > 0) ?? s[0]
    const pico = s.reduce((mx, m) => Math.max(mx, m.total), 0)
    const entradas = s.reduce((a, m) => a + m.entradas, 0)
    const saidas = s.reduce((a, m) => a + m.saidas, 0)
    const atual = rows.filter(r => r.ativo).length
    const cresc = primeiro?.total ? ((ultimo.total - primeiro.total) / primeiro.total) * 100 : 0
    return {
      serie: s,
      kpis: { atual, pico, cresc, entradas, saidas, turnover: atual ? (saidas / atual) * 100 : 0, ultimo },
    }
  }, [rows])

  if (isLoading) return <Spinner />

  const series = [
    { label: 'CLT', color: COR_CLT, valores: serie.map(m => m.clt) },
    { label: 'PJ', color: COR_PJ, valores: serie.map(m => m.pj) },
    { label: 'Outros', color: COR_OUTROS, valores: serie.map(m => m.outros) },
  ].filter(s => s.valores.some(v => v > 0))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Kpi label="Headcount" value={kpis.atual} tone="violet" note="ativos hoje" isDark={isDark} />
        <Kpi label="Pico" value={kpis.pico} tone="sky" note="no período" isDark={isDark} />
        <Kpi label="Crescimento" value={`${kpis.cresc >= 0 ? '+' : ''}${kpis.cresc.toFixed(0)}%`} tone={kpis.cresc >= 0 ? 'emerald' : 'red'} note="vs início 2025" isDark={isDark} />
        <Kpi label="Entradas" value={kpis.entradas} tone="emerald" note="Jan/25→hoje" isDark={isDark} />
        <Kpi label="Saídas" value={kpis.saidas} tone="amber" note="Jan/25→hoje" isDark={isDark} />
        <Kpi label="Turnover" value={`${kpis.turnover.toFixed(0)}%`} tone={kpis.turnover >= 50 ? 'red' : 'emerald'} note="acumulado" isDark={isDark} />
      </div>

      <PanelCard title="Evolução do Efetivo" icon={<TrendingUp size={14} className="text-violet-500" />} isDark={isDark}
        right={<Legenda items={series} isDark={isDark} />}>
        {series.length === 0 ? <Vazio isDark={isDark} /> : <StackedMonthChart meses={serie.map(m => m.label)} series={series} isDark={isDark} height={210} />}
      </PanelCard>

      <PanelCard title="Detalhamento Mensal" icon={<Table2 size={14} className="text-violet-500" />} isDark={isDark} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                {['Mês', 'CLT', 'PJ', 'Total', 'Entradas', 'Saídas', 'Saldo', 'Turnover'].map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-bold uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {serie.map(m => (
                <tr key={m.ym} className={`border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
                  <td className={`px-3 py-1.5 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{m.label}</td>
                  <td className={`px-3 py-1.5 text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{m.clt}</td>
                  <td className={`px-3 py-1.5 text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{m.pj || '—'}</td>
                  <td className={`px-3 py-1.5 text-right font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.total}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-500 font-semibold">{m.entradas || '—'}</td>
                  <td className="px-3 py-1.5 text-right text-amber-500 font-semibold">{m.saidas || '—'}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${m.saldo > 0 ? 'text-emerald-500' : m.saldo < 0 ? 'text-red-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.saldo > 0 ? `+${m.saldo}` : m.saldo}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${m.turnover >= 8 ? 'text-red-500' : isDark ? 'text-slate-400' : 'text-slate-600'}`}>{m.turnover.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`px-3 py-2 text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Entradas/saídas por mês de admissão/demissão. Turnover = saídas ÷ efetivo do mês.</p>
      </PanelCard>
    </div>
  )
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
}
function Vazio({ isDark }: { isDark: boolean }) {
  return <div className={`h-40 rounded-xl flex items-center justify-center text-xs ${isDark ? 'bg-white/[0.03] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Sem dados no período</div>
}
