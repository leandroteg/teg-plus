// Painel Produção — avanço físico e quantitativos (vivo, via useEAPFinal)
import { useMemo } from 'react'
import { Activity, Ruler, Layers } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEGPPortfolioId } from '../../../contexts/EGPContractContext'
import { useEAPFinal, aggregatePolos, fmtQtd } from '../../../hooks/usePMO'
import { Kpi, PanelCard, HBarRow } from '../../rh/paineis/_ui'

const POLO_COR = ['#0d9488', '#2563eb', '#7c3aed', '#e87b2a', '#16a34a', '#db2777', '#0891b2', '#ca8a04']
const PAC_COR: Record<string, string> = {
  'Serv. Preliminares': '#0284c7', 'Canteiro e Mobiliz.': '#0369a1', 'Fundações': '#92400e',
  'Montagem de Torres': '#374151', 'Lançamento de Cabos': '#3730a3', 'Administração Local': '#6d28d9', 'Outros': '#4b5563',
}
const PAC_ORD = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Fundações', 'Montagem de Torres', 'Lançamento de Cabos', 'Administração Local', 'Outros']

export default function ProducaoPainel() {
  const { isDark } = useTheme()
  const portfolioId = useEGPPortfolioId()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const polos = useMemo(() => aggregatePolos(raw ?? [], new Set()), [raw])

  const ag = useMemo(() => {
    const pac = new Map<string, { valor: number; qC: number; qR: number; uni: string | null }>()
    for (const p of polos) for (const x of p.pacotes) {
      const a = pac.get(x.n) ?? { valor: 0, qC: 0, qR: 0, uni: null }
      a.valor += x.valor; a.qC += x.qtdContr; a.qR += x.qtdReal; if (x.unidade) a.uni = x.unidade
      pac.set(x.n, a)
    }
    const porPacote = PAC_ORD.filter(n => pac.has(n)).map(n => { const a = pac.get(n)!; return { n, pct: a.qC > 0 ? Math.round(a.qR / a.qC * 100) : null, valor: a.valor } })
    const wf = porPacote.filter(x => x.pct != null)
    const ws = wf.reduce((s, x) => s + x.valor, 0)
    const fisicoGeral = ws ? Math.round(wf.reduce((s, x) => s + (x.pct as number) * x.valor, 0) / ws) : 0
    const torres = polos.reduce((s, p) => s + (p.qtdTorres ?? 0), 0)
    return { pac, porPacote, fisicoGeral, torres }
  }, [polos])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!polos.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados.</p>

  const drv = (n: string) => ag.pac.get(n)
  const driverKpi = (n: string) => { const a = drv(n); return a && a.qC ? `${fmtQtd(a.qR, a.uni)} / ${fmtQtd(a.qC, a.uni)}` : '—' }
  const polosOrd = [...polos].sort((a, b) => b.pctFis - a.pctFis)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <Kpi label="Físico Geral" value={`${ag.fisicoGeral}%`} tone="emerald" isDark={isDark} note="realizado / contratado" />
        <Kpi label="Topografia" value={driverKpi('Serv. Preliminares')} tone="sky" isDark={isDark} note="km" />
        <Kpi label="Tubulões" value={driverKpi('Fundações')} tone="amber" isDark={isDark} note="m³" />
        <Kpi label="Montagem" value={driverKpi('Montagem de Torres')} tone="slate" isDark={isDark} note="toneladas" />
        <Kpi label="Torres" value={ag.torres || '—'} tone="violet" isDark={isDark} note="cadastradas" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PanelCard title="Avanço físico por polo" icon={<Activity size={14} className="text-teal-500" />} isDark={isDark}>
          <div className="space-y-2.5">
            {polosOrd.map((p, i) => <HBarRow key={p.id} label={p.label} value={p.pctFis} max={100} color={POLO_COR[i % POLO_COR.length]} suffix={`${p.pctFis}%`} isDark={isDark} />)}
          </div>
        </PanelCard>

        <PanelCard title="Avanço físico por pacote" icon={<Layers size={14} className="text-teal-500" />} isDark={isDark}>
          <div className="space-y-2.5">
            {ag.porPacote.filter(x => x.pct != null).map(x => <HBarRow key={x.n} label={x.n} value={x.pct as number} max={100} color={PAC_COR[x.n] ?? '#475569'} suffix={`${x.pct}%`} isDark={isDark} />)}
          </div>
        </PanelCard>
      </div>

      <PanelCard title="Quantitativos — contratado vs. realizado" icon={<Ruler size={14} className="text-teal-500" />} isDark={isDark} pad={false} bodyClassName="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-[11px] uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <th className="text-left px-4 py-2">Polo</th>
              <th className="text-right px-3 py-2">Topo (km)</th>
              <th className="text-right px-3 py-2">Tubulões (m³)</th>
              <th className="text-right px-3 py-2">Montagem (t)</th>
              <th className="text-right px-4 py-2">% Físico</th>
            </tr>
          </thead>
          <tbody>
            {polos.map(p => {
              const get = (n: string) => p.pacotes.find(x => x.n === n)
              const cell = (n: string) => { const a = get(n); return a && a.qtdContr ? `${fmtQtd(a.qtdReal, a.unidade)} / ${fmtQtd(a.qtdContr, a.unidade)}` : '—' }
              return (
                <tr key={p.id} className={`border-t ${isDark ? 'border-white/[0.05] text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                  <td className="px-4 py-2 font-semibold">{p.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cell('Serv. Preliminares')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cell('Fundações')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cell('Montagem de Torres')}</td>
                  <td className={`px-4 py-2 text-right font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{p.pctFis}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </PanelCard>
    </div>
  )
}
