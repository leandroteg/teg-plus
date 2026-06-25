// Painel Cronograma — projeta o SALDO da EAP mês a mês por produtividade, agrupado por frente → obra
import { useMemo, useState, useEffect } from 'react'
import { CalendarDays, Gauge, Filter, ChevronDown, ChevronRight, Check, Flag } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal, type EAPPoloRaw } from '../../../hooks/usePMO'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
const DRV = [
  { pac: 'Serv. Preliminares', label: 'Topografia', uni: 'km', cor: '#0284c7' },
  { pac: 'Fundações', label: 'Tubulões', uni: 'm³', cor: '#92400e' },
  { pac: 'Montagem de Torres', label: 'Montagem', uni: 'ton', cor: '#374151' },
  { pac: 'Lançamento de Cabos', label: 'Lançamento', uni: 'km', cor: '#3730a3' },
]
const MES_ABR = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_ABR[+m]}/${y.slice(2)}` }
const shiftYM = (ym: string, d: number) => { let [y, m] = ym.split('-').map(Number); m += d; while (m > 12) { m -= 12; y++ } while (m < 1) { m += 12; y-- } return `${y}-${String(m).padStart(2, '0')}` }
const startYM = () => { const d = new Date(); return shiftYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 1) }
const fmtM = (v: number) => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k' : 'R$ ' + Math.round(v)
const fmtQ = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : (Number.isInteger(v) ? String(v) : v.toFixed(1))
const poloNm = (s: string) => s.replace(/^F[\d.\/]+\s*-\s*/, '')

type Drv = { label: string; uni: string; cor: string; pac: string; contr: number; real: number; saldoQ: number; saldoR: number; pctFis: number }
function emptyDrivers(): Drv[] { return DRV.map(d => ({ ...d, contr: 0, real: 0, saldoQ: 0, saldoR: 0, pctFis: 0 })) }
function accDriver(arr: Drv[], pac: string, qC: number, qR: number, valor: number, fat: number) {
  const d = arr.find(x => x.pac === pac); if (!d) return
  d.contr += qC; d.real += qR; d.saldoR += Math.max(0, valor - fat)
}

function MultiSelect({ label, icon, options, selected, onToggle, onClear, isDark }: { label: string; icon?: ReactNode; options: { value: string; label: string }[]; selected: Set<string>; onToggle: (v: string) => void; onClear: () => void; isDark: boolean }) {
  const [open, setOpen] = useState(false); const n = selected.size
  const resumo = n === 0 ? 'todas' : n === 1 ? (options.find(o => selected.has(o.value))?.label ?? `${n}`) : `${n} selecionadas`
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={`inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border text-[11px] font-semibold transition min-w-[160px] ${n > 0 ? (isDark ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-700') : (isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300' : 'bg-white border-slate-200 text-slate-600')}`}>
        {icon}<span className="opacity-70">{label}</span><span className="flex-1 text-left truncate">{resumo}</span><ChevronDown size={12} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (<><div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className={`absolute left-0 z-30 mt-1.5 min-w-full w-max max-w-[300px] max-h-72 overflow-auto rounded-xl border shadow-xl p-1 ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
          {options.length === 0 && <p className="px-2 py-1.5 text-[11px] text-slate-400">—</p>}
          {n > 0 && <button onClick={onClear} className={`w-full text-left px-2 py-1 mb-0.5 text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>× limpar</button>}
          {options.map(o => { const on = selected.has(o.value); return (
            <button key={o.value} onClick={() => onToggle(o.value)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>
              <span className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${on ? 'bg-teal-600 border-teal-600 text-white' : (isDark ? 'border-white/25' : 'border-slate-300')}`}>{on && <Check size={11} strokeWidth={3} />}</span>
              <span className={`truncate ${on ? 'font-semibold' : ''} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{o.label}</span>
            </button>) })}
        </div></>)}
    </div>
  )
}

export default function CronogramaPainel({ portfolioId = CONTRATO_CEMIG }: { portfolioId?: string } = {}) {
  const { isDark } = useTheme()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const [fFrente, setFFrente] = useState<Set<string>>(new Set())
  const [fObra, setFObra] = useState<Set<string>>(new Set())
  const [prod, setProd] = useState<Record<string, number>>({})
  const [horizonte, setHorizonte] = useState(12)
  const [openF, setOpenF] = useState<Set<string>>(new Set())
  const [openO, setOpenO] = useState<Set<string>>(new Set())

  // árvore frente → obra → drivers (saldo)
  const tree = useMemo(() => {
    const frentes = new Map<string, { label: string; obras: Map<string, Drv[]> }>()
    for (const polo of (raw ?? []) as EAPPoloRaw[]) {
      let fr = frentes.get(polo.label); if (!fr) { fr = { label: polo.label, obras: new Map() }; frentes.set(polo.label, fr) }
      for (const o of polo.oscs) {
        if (o.etapa_atual === 'cancelada') continue
        let od = fr.obras.get(o.obra_nome); if (!od) { od = emptyDrivers(); fr.obras.set(o.obra_nome, od) }
        for (const [pn, pa] of Object.entries(o.pacotes)) {
          const valor = pa.valor; const fat = pa.fat
          accDriver(od, pn, pa.qC, pa.qR, valor, fat)
        }
      }
    }
    const arr = [...frentes.values()].map(fr => ({
      label: fr.label,
      obras: [...fr.obras.entries()].map(([nome, ds]) => {
        ds.forEach(d => { d.saldoQ = Math.max(0, d.contr - d.real); d.pctFis = d.contr ? Math.round(d.real / d.contr * 100) : 0 })
        return { nome, drivers: ds, saldoR: ds.reduce((s, d) => s + d.saldoR, 0) }
      }).filter(o => o.drivers.some(d => d.contr > 0)).sort((a, b) => b.saldoR - a.saldoR),
    })).filter(fr => fr.obras.length > 0).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    return arr
  }, [raw])

  // saldo global por driver (p/ semear a produtividade)
  const saldoGlobal = useMemo(() => {
    const m: Record<string, number> = {}; DRV.forEach(d => m[d.label] = 0)
    for (const fr of tree) for (const o of fr.obras) for (const d of o.drivers) m[d.label] += d.saldoQ
    return m
  }, [tree])

  useEffect(() => {
    const seed: Record<string, number> = {}
    for (const d of DRV) seed[d.label] = saldoGlobal[d.label] > 0 ? Math.max(0.1, Math.round(saldoGlobal[d.label] / horizonte * 10) / 10) : 0
    setProd(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRV.map(d => Math.round(saldoGlobal[d.label] || 0)).join(','), horizonte])

  const mesesDriver = (d: Drv) => { const r = prod[d.label] || 0; return (r > 0 && d.saldoQ > 0) ? Math.ceil(d.saldoQ / r) : 0 }
  const start = startYM()

  // aplica filtros + projeta
  const view = useMemo(() => {
    const frentesF = tree.filter(fr => fFrente.size === 0 || fFrente.has(fr.label))
      .map(fr => ({ ...fr, obras: fr.obras.filter(o => fObra.size === 0 || fObra.has(o.nome)) }))
      .filter(fr => fr.obras.length > 0)
    let maxMeses = 0, saldoRtot = 0
    for (const fr of frentesF) for (const o of fr.obras) { saldoRtot += o.saldoR; for (const d of o.drivers) maxMeses = Math.max(maxMeses, mesesDriver(d)) }
    return { frentesF, maxMeses, saldoRtot, terminoGeral: maxMeses > 0 ? shiftYM(start, maxMeses - 1) : null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, fFrente, fObra, prod])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!tree.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados da EAP.</p>

  const obraOptions = (fFrente.size ? tree.filter(f => fFrente.has(f.label)) : tree).flatMap(f => f.obras.map(o => o.nome))
  const togF = (k: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) => set(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const obraTermino = (o: { drivers: Drv[] }) => { const mx = Math.max(0, ...o.drivers.map(mesesDriver)); return mx > 0 ? shiftYM(start, mx - 1) : null }
  const obraSaldoQ = (o: { drivers: Drv[] }) => o.drivers.reduce((s, d) => s + d.saldoQ, 0)
  const barW = (meses: number) => view.maxMeses ? Math.max(3, meses / view.maxMeses * 100) : 0

  return (
    <div className="space-y-3">
      {/* filtros em caixas */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect label="Frente" icon={<Filter size={12} className="opacity-70" />} options={tree.map(f => ({ value: f.label, label: f.label }))} selected={fFrente} onToggle={v => { togF(v, setFFrente); setFObra(new Set()) }} onClear={() => { setFFrente(new Set()); setFObra(new Set()) }} isDark={isDark} />
        <MultiSelect label="Obra" options={[...new Set(obraOptions)].sort().map(o => ({ value: o, label: o }))} selected={fObra} onToggle={v => togF(v, setFObra)} onClear={() => setFObra(new Set())} isDark={isDark} />
        <div className="flex items-center gap-1.5 ml-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Semear p/ terminar em</span>
          {[6, 12, 18, 24].map(h => <button key={h} onClick={() => setHorizonte(h)} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${horizonte === h ? 'bg-teal-600 text-white border-teal-600' : (isDark ? 'border-white/15 text-slate-400' : 'border-slate-300 text-slate-500')}`}>{h}m</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Saldo a faturar" value={fmtM(view.saldoRtot)} tone="amber" isDark={isDark} note="R$ restante (filtro)" />
        <Kpi label="Término previsto" value={view.terminoGeral ? ymLabel(view.terminoGeral) : '—'} tone="violet" isDark={isDark} note={`${view.maxMeses} mes(es) no ritmo`} />
        <Kpi label="Início" value={ymLabel(start)} tone="sky" isDark={isDark} note="próximo mês" />
        <Kpi label="Frentes · Obras" value={`${view.frentesF.length} · ${view.frentesF.reduce((s, f) => s + f.obras.length, 0)}`} tone="teal" isDark={isDark} note="no filtro" />
      </div>

      {/* Produtividade global (editável) */}
      <PanelCard title="Produtividade por driver (editável) — ritmo mensal por obra" icon={<Gauge size={14} className="text-teal-500" />} isDark={isDark}
        right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>cada obra projeta o próprio saldo no ritmo</span>}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {DRV.map(d => (
            <div key={d.label} className={`rounded-xl p-3 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50/70 border-slate-100'}`}>
              <div className="flex items-center gap-2 mb-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.cor }} /><span className={`text-[12px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{d.label}</span></div>
              <p className={`text-[10px] mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Saldo total: <b>{fmtQ(saldoGlobal[d.label] || 0)} {d.uni}</b></p>
              <div className="flex items-center gap-1.5">
                <input type="number" min="0" step="0.5" value={prod[d.label] ?? 0} onChange={e => setProd(p => ({ ...p, [d.label]: Number(e.target.value) }))}
                  className={`w-20 text-sm font-bold rounded-lg border px-2 py-1 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.uni}/mês</span>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      {/* Árvore frente → obra → drivers (colapsável) */}
      <PanelCard title="Cronograma por frente e obra" icon={<CalendarDays size={14} className="text-teal-500" />} isDark={isDark}
        right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>barra = duração até o término</span>}>
        <div className="space-y-1.5">
          {view.frentesF.map(fr => {
            const fOpen = openF.has(fr.label)
            const frMaxMes = Math.max(0, ...fr.obras.flatMap(o => o.drivers.map(mesesDriver)))
            const frTerm = frMaxMes > 0 ? shiftYM(start, frMaxMes - 1) : null
            const frSaldoR = fr.obras.reduce((s, o) => s + o.saldoR, 0)
            return (
              <div key={fr.label} className={`rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                <button onClick={() => togF(fr.label, setOpenF)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  {fOpen ? <ChevronDown size={14} className="shrink-0 text-teal-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                  <span className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fr.label}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fr.obras.length} obra(s)</span>
                  <span className="ml-auto flex items-center gap-3 text-[11px]">
                    <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>{fmtM(frSaldoR)}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-violet-500"><Flag size={11} />{frTerm ? ymLabel(frTerm) : '—'}</span>
                  </span>
                </button>
                {fOpen && (
                  <div className={`px-2 pb-2 space-y-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    {fr.obras.map(o => {
                      const okey = fr.label + '|' + o.nome; const oOpen = openO.has(okey)
                      const oTerm = obraTermino(o)
                      return (
                        <div key={o.nome} className="mt-1">
                          <button onClick={() => togF(okey, setOpenO)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                            {oOpen ? <ChevronDown size={12} className="shrink-0 text-teal-500" /> : <ChevronRight size={12} className="shrink-0 text-slate-400" />}
                            <span className={`text-[12px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title={o.nome}>{o.nome}</span>
                            <span className="ml-auto flex items-center gap-3 text-[10px]">
                              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{fmtM(o.saldoR)}</span>
                              <span className="inline-flex items-center gap-1 font-semibold text-violet-500"><Flag size={10} />{oTerm ? ymLabel(oTerm) : '—'}</span>
                            </span>
                          </button>
                          {oOpen && (
                            <div className="pl-6 pr-2 py-1 space-y-1.5">
                              {o.drivers.filter(d => d.contr > 0).map(d => {
                                const meses = mesesDriver(d)
                                return (
                                  <div key={d.label} className="flex items-center gap-2">
                                    <span className={`w-[22%] text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.label}</span>
                                    <span className={`w-[20%] text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtQ(d.saldoQ)}/{fmtQ(d.contr)} {d.uni}</span>
                                    <div className={`flex-1 h-4 rounded-md overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                                      {meses > 0 && <div className="h-full rounded-md flex items-center px-1.5" style={{ width: `${barW(meses)}%`, background: d.cor }}><span className="text-[9px] font-bold text-white whitespace-nowrap">{meses}m</span></div>}
                                    </div>
                                    <span className="w-14 text-right text-[10px] font-semibold tabular-nums" style={{ color: d.cor }}>{meses > 0 ? ymLabel(shiftYM(start, meses - 1)) : (d.saldoQ <= 0 ? '✓' : '—')}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </PanelCard>

      <p className={`text-[10px] px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        * Cada obra projeta o próprio saldo (contratado − executado) no ritmo definido por driver, a partir de {ymLabel(start)}. A barra mostra a duração até o término; o término da frente/obra é o do driver mais demorado. Ajuste a produtividade pra simular cenários.
      </p>
    </div>
  )
}
