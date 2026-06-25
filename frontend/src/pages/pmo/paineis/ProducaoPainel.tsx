// Painel Produção — avanço físico e quantitativos (vivo, via useEAPFinal)
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, Ruler, Layers, Building2, Star, Filter, ChevronDown, Check } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEGPPortfolioId } from '../../../contexts/EGPContractContext'
import { useEAPFinal, aggregatePolos, fmtQtd } from '../../../hooks/usePMO'
import { Kpi, PanelCard, HBarRow } from '../../rh/paineis/_ui'

const fmtM = (v: number) => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k' : 'R$ ' + Math.round(v)
const LIMITE_PRIORITARIA = 1_000_000 // construção-escala (OSC/obra > R$ 1M)
const FIS_BANDS: [string, string, (p: number) => boolean][] = [
  ['0', '0%', p => p === 0], ['1-25', '1–25%', p => p >= 1 && p <= 25], ['26-50', '26–50%', p => p >= 26 && p <= 50],
  ['51-75', '51–75%', p => p >= 51 && p <= 75], ['76-100', '76–100%', p => p >= 76],
]
const VAL_BANDS: [string, string, (v: number) => boolean][] = [
  ['<1', '< 1M', v => v < 1e6], ['1-5', '1–5M', v => v >= 1e6 && v < 5e6], ['5-10', '5–10M', v => v >= 5e6 && v < 10e6], ['>=10', '≥ 10M', v => v >= 10e6],
]

// cor de ritmo: compara % produzido (físico) com % prazo decorrido
function ritmoCor(pctFis: number, pctPrazo: number | null): string {
  if (pctPrazo == null) return '#10b981'
  const d = pctFis - pctPrazo
  if (d >= 0) return '#10b981'      // no prazo / adiantado
  if (d >= -15) return '#f59e0b'    // levemente atrasado
  return '#ef4444'                   // atrasado
}

function ObraRow({ o, star, isDark }: { o: { nome: string; polo: string; valor: number; pctFis: number; pctFin: number; pctPrazo: number | null }; star?: boolean; isDark: boolean }) {
  const cor = ritmoCor(o.pctFis, o.pctPrazo)
  return (
    <div className="flex items-center gap-3">
      <div className="w-[42%] min-w-0">
        <div className="flex items-center gap-1.5">
          {star && <Star size={11} className="text-amber-500 shrink-0 fill-amber-500" />}
          <span className={`text-[13px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title={o.nome}>{o.nome}</span>
        </div>
        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{o.polo} · {fmtM(o.valor)} · {o.pctFin}% fat.{o.pctPrazo != null ? ` · ${o.pctPrazo}% prazo` : ''}</div>
      </div>
      <div className={`relative flex-1 h-5 rounded-md overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
        <div className="h-full rounded-md transition-all" style={{ width: `${Math.max(o.pctFis, 2)}%`, background: cor }} />
        {o.pctPrazo != null && (
          <div className="absolute top-0 bottom-0 w-[2px] z-10" style={{ left: `${Math.min(o.pctPrazo, 100)}%`, background: isDark ? '#e2e8f0' : '#0f172a' }}
            title={`Prazo decorrido: ${o.pctPrazo}%`}>
            <span className={`absolute -top-[1px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isDark ? 'bg-slate-100' : 'bg-slate-900'}`} />
          </div>
        )}
      </div>
      <span className="w-10 text-right text-[13px] font-extrabold tabular-nums" style={{ color: cor }}>{o.pctFis}%</span>
    </div>
  )
}

const POLO_COR = ['#0d9488', '#2563eb', '#7c3aed', '#e87b2a', '#16a34a', '#db2777', '#0891b2', '#ca8a04']
const PAC_COR: Record<string, string> = {
  'Serv. Preliminares': '#0284c7', 'Canteiro e Mobiliz.': '#0369a1', 'Fundações': '#92400e',
  'Montagem de Torres': '#374151', 'Lançamento de Cabos': '#3730a3', 'Administração Local': '#6d28d9', 'Outros': '#4b5563',
}
const PAC_ORD = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Fundações', 'Montagem de Torres', 'Lançamento de Cabos', 'Administração Local', 'Outros']

// dropdown multi-select elegante (caixa com checkboxes)
function MultiSelect({ label, icon, options, selected, onToggle, onClear, isDark }: {
  label: string; icon?: ReactNode; options: { value: string; label: string }[]
  selected: Set<string>; onToggle: (v: string) => void; onClear: () => void; isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const n = selected.size
  const resumo = n === 0 ? 'todas' : n === 1 ? (options.find(o => selected.has(o.value))?.label ?? `${n}`) : `${n} selecionadas`
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={`inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border text-[11px] font-semibold transition min-w-[130px] ${n > 0 ? (isDark ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-700') : (isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')}`}>
        {icon}<span className="opacity-70">{label}</span>
        <span className="flex-1 text-left truncate">{resumo}</span>
        <ChevronDown size={12} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (<>
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className={`absolute left-0 z-30 mt-1.5 min-w-full w-max max-w-[260px] max-h-72 overflow-auto rounded-xl border shadow-xl p-1 ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
          {n > 0 && <button onClick={onClear} className={`w-full text-left px-2 py-1 mb-0.5 text-[10px] font-semibold ${isDark ? 'text-slate-400 hover:text-rose-300' : 'text-slate-400 hover:text-rose-500'}`}>× limpar seleção</button>}
          {options.map(o => {
            const on = selected.has(o.value)
            return (
              <button key={o.value} onClick={() => onToggle(o.value)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left transition ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>
                <span className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition ${on ? 'bg-teal-600 border-teal-600 text-white' : (isDark ? 'border-white/25' : 'border-slate-300')}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                <span className={`truncate ${on ? (isDark ? 'text-white font-semibold' : 'text-slate-800 font-semibold') : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{o.label}</span>
              </button>
            )
          })}
        </div>
      </>)}
    </div>
  )
}

export default function ProducaoPainel({ de, ate }: { de?: string; ate?: string }) {
  const { isDark } = useTheme()
  const portfolioId = useEGPPortfolioId()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  // físico é CUMULATIVO (acum do contrato) — não filtra por período (senão sobram só OSCs do período e zera)
  void de; void ate
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

  // produção por OBRA DE CONSTRUÇÃO em andamento (fat < 95%); + % de prazo decorrido
  const obras = useMemo(() => {
    type O = { nome: string; polo: string; valor: number; fat: number; ini: string | null; fim: string | null; pac: Map<string, { valor: number; qC: number; qR: number; uni: string | null }> }
    const m = new Map<string, O>()
    for (const polo of (raw ?? [])) for (const o of polo.oscs) {
      if (o.etapa_atual === 'cancelada') continue
      if (o.tipo !== 'construcao') continue // só obras de construção
      let a = m.get(o.obra_nome); if (!a) { a = { nome: o.obra_nome, polo: polo.label, valor: 0, fat: 0, ini: null, fim: null, pac: new Map() }; m.set(o.obra_nome, a) }
      a.valor += o.valor; a.fat += (o.saldo_reais != null ? Math.max(0, o.valor - o.saldo_reais) : 0)
      const di = o.data_osc?.slice(0, 10); if (di && (!a.ini || di < a.ini)) a.ini = di
      const dv = o.vencimento?.slice(0, 10); if (dv && (!a.fim || dv > a.fim)) a.fim = dv
      for (const [pn, pa] of Object.entries(o.pacotes)) {
        let x = a.pac.get(pn); if (!x) { x = { valor: 0, qC: 0, qR: 0, uni: null }; a.pac.set(pn, x) }
        x.valor += pa.valor; x.qC += pa.qC; x.qR += pa.qR; if (pa.uni) x.uni = pa.uni
      }
    }
    const hoje = new Date().getTime()
    return [...m.values()].map(a => {
      const wf = [...a.pac.values()].filter(x => x.qC > 0).map(x => ({ pct: Math.round(x.qR / x.qC * 100), valor: x.valor }))
      const ws = wf.reduce((s, x) => s + x.valor, 0)
      const pctFis = ws ? Math.round(wf.reduce((s, x) => s + x.pct * x.valor, 0) / ws) : 0
      const ini = a.ini ? Date.parse(a.ini) : NaN; const fim = a.fim ? Date.parse(a.fim) : NaN
      const pctPrazo = (a.ini && a.fim && fim > ini) ? Math.round(Math.min(100, Math.max(0, (hoje - ini) / (fim - ini) * 100))) : null
      const drv = (n: string) => { const x = a.pac.get(n); return x && x.qC ? `${fmtQtd(x.qR, x.uni) ?? '0'}/${fmtQtd(x.qC, x.uni) ?? '—'}` : '—' }
      return { nome: a.nome, polo: a.polo, valor: a.valor, pctFin: a.valor ? Math.round(a.fat / a.valor * 100) : 0, pctFis, pctPrazo, drv }
    }).filter(o => o.pctFin < 95).sort((x, y) => y.valor - x.valor)
  }, [raw])

  const [fFrente, setFFrente] = useState<Set<string>>(new Set())
  const [fFis, setFFis] = useState<Set<string>>(new Set())
  const [fVal, setFVal] = useState<Set<string>>(new Set())
  const toggle = (s: Set<string>, set: (v: Set<string>) => void, k: string) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); set(n) }

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!polos.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados.</p>

  const drv = (n: string) => ag.pac.get(n)
  const driverKpi = (n: string) => { const a = drv(n); return a && a.qC ? `${fmtQtd(a.qR, a.uni) ?? '0'} / ${fmtQtd(a.qC, a.uni) ?? '—'}` : '—' }
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
        const frentes = [...new Set(obras.map(o => o.polo))].sort()
        const obrasF = obras.filter(o =>
          (fFrente.size === 0 || fFrente.has(o.polo)) &&
          (fFis.size === 0 || FIS_BANDS.some(b => fFis.has(b[0]) && b[2](o.pctFis))) &&
          (fVal.size === 0 || VAL_BANDS.some(b => fVal.has(b[0]) && b[2](o.valor))))
        const prioritarias = obrasF.filter(o => o.valor >= LIMITE_PRIORITARIA)
        const demais = obrasF.filter(o => o.valor < LIMITE_PRIORITARIA)
        const limpar = fFrente.size || fFis.size || fVal.size
        return (
          <PanelCard title="Produção por obra — construção em andamento" icon={<Building2 size={14} className="text-teal-500" />} isDark={isDark}
            right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>│ prazo decorrido · cor = ritmo (<span className="text-emerald-500">no prazo</span>/<span className="text-amber-500">atenção</span>/<span className="text-red-500">atrasado</span>) · ★ &gt; R$ 1M</span>}>
            {/* filtros: caixas multi-select (frente · % físico · valor) */}
            <div className={`flex flex-wrap items-center gap-2 mb-3 pb-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              <MultiSelect label="Frente" icon={<Filter size={12} className="shrink-0 opacity-70" />} options={frentes.map(f => ({ value: f, label: f }))} selected={fFrente} onToggle={v => toggle(fFrente, setFFrente, v)} onClear={() => setFFrente(new Set())} isDark={isDark} />
              <MultiSelect label="% Físico" options={FIS_BANDS.map(b => ({ value: b[0], label: b[1] }))} selected={fFis} onToggle={v => toggle(fFis, setFFis, v)} onClear={() => setFFis(new Set())} isDark={isDark} />
              <MultiSelect label="Valor" options={VAL_BANDS.map(b => ({ value: b[0], label: b[1] }))} selected={fVal} onToggle={v => toggle(fVal, setFVal, v)} onClear={() => setFVal(new Set())} isDark={isDark} />
              {limpar ? <button onClick={() => { setFFrente(new Set()); setFFis(new Set()); setFVal(new Set()) }} className={`text-[10px] underline ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>limpar tudo</button> : null}
              <span className={`ml-auto text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{obrasF.length} de {obras.length} obras</span>
            </div>
            {obrasF.length === 0 ? (
              <p className={`text-center py-8 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma obra no filtro.</p>
            ) : (
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
            )}
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
