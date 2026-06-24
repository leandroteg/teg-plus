// Painel Produção — avanço físico e quantitativos (vivo, via useEAPFinal)
import { useMemo } from 'react'
import { Activity, Ruler, Layers, Building2, Star } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEGPPortfolioId } from '../../../contexts/EGPContractContext'
import { useEAPFinal, aggregatePolos, fmtQtd } from '../../../hooks/usePMO'
import { Kpi, PanelCard, HBarRow } from '../../rh/paineis/_ui'

const fmtM = (v: number) => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k' : 'R$ ' + Math.round(v)
const poloCurto = (s: string) => { const m = s.match(/^(F[\d.\/]+)/); return m ? m[1] : s }
const LIMITE_PRIORITARIA = 1_000_000 // construção-escala (OSC/obra > R$ 1M)

function ObraRow({ o, star, isDark }: { o: { nome: string; polo: string; valor: number; pctFis: number; pctFin: number }; star?: boolean; isDark: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-[42%] min-w-0">
        <div className="flex items-center gap-1.5">
          {star && <Star size={11} className="text-amber-500 shrink-0 fill-amber-500" />}
          <span className={`text-[13px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title={o.nome}>{o.nome}</span>
        </div>
        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{o.polo} · {fmtM(o.valor)} · {o.pctFin}% fat.</div>
      </div>
      <div className={`flex-1 h-5 rounded-md overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
        <div className="h-full rounded-md bg-emerald-500 transition-all" style={{ width: `${Math.max(o.pctFis, 2)}%` }} />
      </div>
      <span className={`w-10 text-right text-[13px] font-extrabold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{o.pctFis}%</span>
    </div>
  )
}

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

  // agrega físico por OBRA (a partir dos dados crus) → ranqueado por valor (prioritárias primeiro)
  const obras = useMemo(() => {
    type O = { nome: string; polo: string; valor: number; fat: number; pac: Map<string, { valor: number; qC: number; qR: number; uni: string | null }> }
    const m = new Map<string, O>()
    for (const polo of (raw ?? [])) for (const o of polo.oscs) {
      if (o.etapa_atual === 'cancelada') continue
      let a = m.get(o.obra_nome); if (!a) { a = { nome: o.obra_nome, polo: poloCurto(polo.label), valor: 0, fat: 0, pac: new Map() }; m.set(o.obra_nome, a) }
      a.valor += o.valor; a.fat += (o.saldo_reais != null ? Math.max(0, o.valor - o.saldo_reais) : 0)
      for (const [pn, pa] of Object.entries(o.pacotes)) {
        let x = a.pac.get(pn); if (!x) { x = { valor: 0, qC: 0, qR: 0, uni: null }; a.pac.set(pn, x) }
        x.valor += pa.valor; x.qC += pa.qC; x.qR += pa.qR; if (pa.uni) x.uni = pa.uni
      }
    }
    return [...m.values()].map(a => {
      const wf = [...a.pac.values()].filter(x => x.qC > 0).map(x => ({ pct: Math.round(x.qR / x.qC * 100), valor: x.valor }))
      const ws = wf.reduce((s, x) => s + x.valor, 0)
      const pctFis = ws ? Math.round(wf.reduce((s, x) => s + x.pct * x.valor, 0) / ws) : 0
      const drv = (n: string) => { const x = a.pac.get(n); return x && x.qC ? `${fmtQtd(x.qR, x.uni)}/${fmtQtd(x.qC, x.uni)}` : '—' }
      return { nome: a.nome, polo: a.polo, valor: a.valor, pctFin: a.valor ? Math.round(a.fat / a.valor * 100) : 0, pctFis, drv }
    }).sort((x, y) => y.valor - x.valor)
  }, [raw])

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

      {obras.length > 0 && (() => {
        const prioritarias = obras.filter(o => o.valor >= LIMITE_PRIORITARIA)
        const demais = obras.filter(o => o.valor < LIMITE_PRIORITARIA)
        return (
          <PanelCard title="Produção por obra" icon={<Building2 size={14} className="text-teal-500" />} isDark={isDark}
            right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>★ prioritária = obra &gt; R$ 1M</span>}>
            <div className="space-y-4">
              {prioritarias.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Prioritárias · {prioritarias.length}</p>
                  {prioritarias.map(o => <ObraRow key={o.nome} o={o} star isDark={isDark} />)}
                </div>
              )}
              {demais.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Demais obras · {demais.length}</p>
                  {demais.map(o => <ObraRow key={o.nome} o={o} isDark={isDark} />)}
                </div>
              )}
            </div>
          </PanelCard>
        )
      })()}

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
