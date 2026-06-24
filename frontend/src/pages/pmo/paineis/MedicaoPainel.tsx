// Painel Medição — faturamento, saldo e % por polo/pacote (vivo, via useEAPFinal)
import { useMemo } from 'react'
import { DollarSign, TrendingUp, PieChart, Wallet } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEGPPortfolioId } from '../../../contexts/EGPContractContext'
import { useEAPFinal, aggregatePolos, filtrarRawPorPeriodo } from '../../../hooks/usePMO'
import { Kpi, PanelCard, HBarRow, ProporcaoBar, Legenda } from '../../rh/paineis/_ui'

const POLO_COR = ['#0d9488', '#2563eb', '#7c3aed', '#e87b2a', '#16a34a', '#db2777', '#0891b2', '#ca8a04']
const PAC_COR: Record<string, string> = {
  'Serv. Preliminares': '#0284c7', 'Canteiro e Mobiliz.': '#0369a1', 'Fundações': '#92400e',
  'Montagem de Torres': '#374151', 'Lançamento de Cabos': '#3730a3', 'Administração Local': '#6d28d9', 'Outros': '#4b5563',
}
const PAC_ORD = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Fundações', 'Montagem de Torres', 'Lançamento de Cabos', 'Administração Local', 'Outros']
const fmtM = (v: number) => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k' : 'R$ ' + Math.round(v)

export default function MedicaoPainel({ de, ate }: { de?: string; ate?: string }) {
  const { isDark } = useTheme()
  const portfolioId = useEGPPortfolioId()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const polos = useMemo(() => aggregatePolos(filtrarRawPorPeriodo(raw ?? [], de, ate), new Set()), [raw, de, ate])

  const ag = useMemo(() => {
    const contr = polos.reduce((s, p) => s + p.contr, 0)
    const fat = polos.reduce((s, p) => s + p.fat, 0)
    const saldo = contr - fat
    const nOscs = polos.reduce((s, p) => s + p.nOscs, 0)
    const pac = new Map<string, { valor: number; fat: number }>()
    for (const p of polos) for (const x of p.pacotes) { const a = pac.get(x.n) ?? { valor: 0, fat: 0 }; a.valor += x.valor; a.fat += x.faturado; pac.set(x.n, a) }
    const porPacote = PAC_ORD.filter(n => pac.has(n)).map(n => { const a = pac.get(n)!; return { n, pct: a.valor ? Math.round(a.fat / a.valor * 100) : 0, valor: a.valor } })
    const wf = polos.filter(p => p.pctFis)
    const fisGeral = wf.reduce((s, p) => s + p.pctFis * p.contr, 0) / (wf.reduce((s, p) => s + p.contr, 0) || 1)
    return { contr, fat, saldo, nOscs, porPacote, fisGeral: Math.round(fisGeral) }
  }, [polos])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!polos.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados.</p>

  const polosFat = [...polos].sort((a, b) => b.pctFin - a.pctFin)
  const polosSaldo = [...polos].sort((a, b) => b.saldo - a.saldo)
  const maxSaldo = Math.max(...polos.map(p => p.saldo), 1)
  const seg = polos.map((p, i) => ({ label: p.label.replace(/^F[\d.\/]+\s*-\s*/, ''), value: Math.round(p.contr), color: POLO_COR[i % POLO_COR.length] }))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <Kpi label="Contratado" value={fmtM(ag.contr)} tone="slate" isDark={isDark} note={`${ag.nOscs} OSCs`} />
        <Kpi label="Faturado" value={fmtM(ag.fat)} tone="emerald" isDark={isDark} note={`${ag.contr ? Math.round(ag.fat / ag.contr * 100) : 0}% do contrato`} />
        <Kpi label="Saldo" value={fmtM(ag.saldo)} tone="amber" isDark={isDark} note="a faturar" />
        <Kpi label="% Físico" value={`${ag.fisGeral}%`} tone="sky" isDark={isDark} note="avanço físico" />
        <Kpi label="Polos" value={polos.length} tone="violet" isDark={isDark} note="frentes ativas" />
      </div>

      <PanelCard title="Carteira por polo" icon={<PieChart size={14} className="text-teal-500" />} isDark={isDark}
        right={<Legenda items={seg.map(s => ({ label: s.label, color: s.color }))} isDark={isDark} />}>
        <ProporcaoBar segments={seg} isDark={isDark} />
      </PanelCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PanelCard title="% Faturado por polo" icon={<TrendingUp size={14} className="text-teal-500" />} isDark={isDark}>
          <div className="space-y-2.5">
            {polosFat.map((p, i) => <HBarRow key={p.id} label={p.label} value={p.pctFin} max={100} color={POLO_COR[i % POLO_COR.length]} suffix={`${p.pctFin}%`} isDark={isDark} />)}
          </div>
        </PanelCard>

        <PanelCard title="Saldo a faturar por polo" icon={<Wallet size={14} className="text-amber-500" />} isDark={isDark}>
          <div className="space-y-2.5">
            {polosSaldo.map(p => <HBarRow key={p.id} label={p.label} value={p.saldo} max={maxSaldo} color="#f59e0b" suffix={fmtM(p.saldo)} isDark={isDark} />)}
          </div>
        </PanelCard>
      </div>

      <PanelCard title="% Faturado por pacote" icon={<DollarSign size={14} className="text-teal-500" />} isDark={isDark}>
        <div className="space-y-2.5">
          {ag.porPacote.map(x => <HBarRow key={x.n} label={`${x.n} · ${fmtM(x.valor)}`} value={x.pct} max={100} color={PAC_COR[x.n] ?? '#475569'} suffix={`${x.pct}%`} isDark={isDark} />)}
        </div>
      </PanelCard>
    </div>
  )
}
