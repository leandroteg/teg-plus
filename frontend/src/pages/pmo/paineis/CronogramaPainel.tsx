// Painel Cronograma — modal de config (produtividade total + alocação por obra) → Aplicar gera; versões salvas
import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Filter, ChevronDown, ChevronRight, Check, Flag, Settings2, Save, Trash2, X, Sparkles, Gauge } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal, type EAPPoloRaw } from '../../../hooks/usePMO'
import { supabase } from '../../../services/supabase'
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

type Drv = { label: string; uni: string; cor: string; pac: string; contr: number; real: number; saldoQ: number; saldoR: number; pctFis: number }
type Obra = { nome: string; frente: string; drivers: Drv[]; saldoR: number }
type Config = { prod: Record<string, number>; modo: 'saldo' | 'manual'; pesos: Record<string, number>; horizonte: number }
type Versao = { id: string; nome: string; config: Config; updated_at: string }

function emptyDrivers(): Drv[] { return DRV.map(d => ({ ...d, contr: 0, real: 0, saldoQ: 0, saldoR: 0, pctFis: 0 })) }

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
  const qc = useQueryClient()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const [fFrente, setFFrente] = useState<Set<string>>(new Set())
  const [fObra, setFObra] = useState<Set<string>>(new Set())
  const [openF, setOpenF] = useState<Set<string>>(new Set())
  const [openO, setOpenO] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [applied, setApplied] = useState<Config | null>(null)

  // árvore frente → obra → drivers (saldo)
  const tree = useMemo(() => {
    const frentes = new Map<string, { label: string; obras: Map<string, Drv[]> }>()
    for (const polo of (raw ?? []) as EAPPoloRaw[]) {
      let fr = frentes.get(polo.label); if (!fr) { fr = { label: polo.label, obras: new Map() }; frentes.set(polo.label, fr) }
      for (const o of polo.oscs) {
        if (o.etapa_atual === 'cancelada') continue
        let od = fr.obras.get(o.obra_nome); if (!od) { od = emptyDrivers(); fr.obras.set(o.obra_nome, od) }
        for (const [pn, pa] of Object.entries(o.pacotes)) { const d = od.find(x => x.pac === pn); if (d) { d.contr += pa.qC; d.real += pa.qR; d.saldoR += Math.max(0, pa.valor - pa.fat) } }
      }
    }
    return [...frentes.values()].map(fr => ({
      label: fr.label,
      obras: [...fr.obras.entries()].map(([nome, ds]) => { ds.forEach(d => { d.saldoQ = Math.max(0, d.contr - d.real); d.pctFis = d.contr ? Math.round(d.real / d.contr * 100) : 0 }); return { nome, frente: fr.label, drivers: ds, saldoR: ds.reduce((s, d) => s + d.saldoR, 0) } as Obra })
        .filter(o => o.drivers.some(d => d.contr > 0)).sort((a, b) => b.saldoR - a.saldoR),
    })).filter(fr => fr.obras.length > 0).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  }, [raw])

  const allObras = useMemo(() => tree.flatMap(f => f.obras), [tree])
  const saldoGlobal = useMemo(() => { const m: Record<string, number> = {}; DRV.forEach(d => m[d.label] = 0); for (const o of allObras) for (const d of o.drivers) m[d.label] += d.saldoQ; return m }, [allObras])

  // config default (capacidade p/ terminar em 12m, alocação proporcional ao saldo)
  const defaultConfig = useMemo<Config>(() => {
    const prod: Record<string, number> = {}; DRV.forEach(d => prod[d.label] = saldoGlobal[d.label] > 0 ? Math.max(0.1, Math.round(saldoGlobal[d.label] / 12 * 10) / 10) : 0)
    const pesos: Record<string, number> = {}; allObras.forEach(o => pesos[o.nome] = Math.round(o.saldoR / 1000))
    return { prod, modo: 'saldo', pesos, horizonte: 12 }
  }, [saldoGlobal, allObras])

  // aplica o default automaticamente na 1ª carga (não fica vazio)
  useEffect(() => { if (!applied && allObras.length) setApplied(defaultConfig) }, [applied, allObras.length, defaultConfig])

  // versões salvas
  const { data: versoes = [] } = useQuery<Versao[]>({
    queryKey: ['crono-versoes', portfolioId],
    queryFn: async () => { const { data } = await supabase.from('pmo_cronograma_versao').select('id, nome, config, updated_at').eq('portfolio_id', portfolioId).order('updated_at', { ascending: false }); return (data ?? []) as Versao[] },
  })

  const start = startYM()
  // rate por (obra, driver) a partir da capacidade + alocação
  const rateOf = (o: Obra, d: Drv, cfg: Config) => {
    const C = cfg.prod[d.label] || 0; if (C <= 0 || d.saldoQ <= 0) return 0
    if (cfg.modo === 'saldo') { const tot = saldoGlobal[d.label] || 0; return tot > 0 ? C * d.saldoQ / tot : 0 }
    // manual: divide a capacidade pelas obras (peso), só entre as que têm saldo nesse driver
    let denom = 0; for (const ob of allObras) { const dd = ob.drivers.find(x => x.label === d.label); if (dd && dd.saldoQ > 0) denom += (cfg.pesos[ob.nome] ?? 0) }
    return denom > 0 ? C * (cfg.pesos[o.nome] ?? 0) / denom : 0
  }
  const mesesOf = (o: Obra, d: Drv, cfg: Config) => { const r = rateOf(o, d, cfg); return r > 0 ? Math.ceil(d.saldoQ / r) : 0 }

  const view = useMemo(() => {
    if (!applied) return { frentesF: [] as typeof tree, maxMeses: 0, saldoRtot: 0, terminoGeral: null as string | null }
    const frentesF = tree.filter(fr => fFrente.size === 0 || fFrente.has(fr.label))
      .map(fr => ({ ...fr, obras: fr.obras.filter(o => fObra.size === 0 || fObra.has(o.nome)) })).filter(fr => fr.obras.length > 0)
    let maxMeses = 0, saldoRtot = 0
    for (const fr of frentesF) for (const o of fr.obras) { saldoRtot += o.saldoR; for (const d of o.drivers) maxMeses = Math.max(maxMeses, mesesOf(o, d, applied)) }
    return { frentesF, maxMeses, saldoRtot, terminoGeral: maxMeses > 0 ? shiftYM(start, maxMeses - 1) : null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, fFrente, fObra, applied])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!tree.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados da EAP.</p>

  const obraOptions = (fFrente.size ? tree.filter(f => fFrente.has(f.label)) : tree).flatMap(f => f.obras.map(o => o.nome))
  const togF = (k: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) => set(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const barW = (meses: number) => view.maxMeses ? Math.max(3, meses / view.maxMeses * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold bg-teal-600 text-white hover:bg-teal-700"><Settings2 size={14} /> Configurar / Gerar</button>
        <MultiSelect label="Frente" icon={<Filter size={12} className="opacity-70" />} options={tree.map(f => ({ value: f.label, label: f.label }))} selected={fFrente} onToggle={v => { togF(v, setFFrente); setFObra(new Set()) }} onClear={() => { setFFrente(new Set()); setFObra(new Set()) }} isDark={isDark} />
        <MultiSelect label="Obra" options={[...new Set(obraOptions)].sort().map(o => ({ value: o, label: o }))} selected={fObra} onToggle={v => togF(v, setFObra)} onClear={() => setFObra(new Set())} isDark={isDark} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Saldo a faturar" value={fmtM(view.saldoRtot)} tone="amber" isDark={isDark} note="R$ restante (filtro)" />
        <Kpi label="Término previsto" value={view.terminoGeral ? ymLabel(view.terminoGeral) : '—'} tone="violet" isDark={isDark} note={`${view.maxMeses} mes(es)`} />
        <Kpi label="Início" value={ymLabel(start)} tone="sky" isDark={isDark} note="próximo mês" />
        <Kpi label="Alocação" value={applied?.modo === 'manual' ? 'Manual' : 'Proporcional'} tone="teal" isDark={isDark} note="recursos por obra" />
      </div>

      <PanelCard title="Cronograma por frente e obra" icon={<CalendarDays size={14} className="text-teal-500" />} isDark={isDark}
        right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>barra = duração até o término</span>}>
        {!applied ? <p className={`text-center py-8 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Use <b>Configurar / Gerar</b> pra montar o cronograma.</p> : (
          <div className="space-y-1.5">
            {view.frentesF.map(fr => {
              const fOpen = openF.has(fr.label)
              const frMaxMes = Math.max(0, ...fr.obras.flatMap(o => o.drivers.map(d => mesesOf(o, d, applied))))
              const frTerm = frMaxMes > 0 ? shiftYM(start, frMaxMes - 1) : null
              const frSaldoR = fr.obras.reduce((s, o) => s + o.saldoR, 0)
              return (
                <div key={fr.label} className={`rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                  <button onClick={() => togF(fr.label, setOpenF)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                    {fOpen ? <ChevronDown size={14} className="shrink-0 text-teal-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                    <span className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fr.label}</span>
                    <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fr.obras.length} obra(s)</span>
                    <span className="ml-auto flex items-center gap-3 text-[11px]"><span className={isDark ? 'text-amber-400' : 'text-amber-600'}>{fmtM(frSaldoR)}</span><span className="inline-flex items-center gap-1 font-semibold text-violet-500"><Flag size={11} />{frTerm ? ymLabel(frTerm) : '—'}</span></span>
                  </button>
                  {fOpen && (
                    <div className={`px-2 pb-2 space-y-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                      {fr.obras.map(o => {
                        const okey = fr.label + '|' + o.nome; const oOpen = openO.has(okey)
                        const oMax = Math.max(0, ...o.drivers.map(d => mesesOf(o, d, applied))); const oTerm = oMax > 0 ? shiftYM(start, oMax - 1) : null
                        return (
                          <div key={o.nome} className="mt-1">
                            <button onClick={() => togF(okey, setOpenO)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                              {oOpen ? <ChevronDown size={12} className="shrink-0 text-teal-500" /> : <ChevronRight size={12} className="shrink-0 text-slate-400" />}
                              <span className={`text-[12px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title={o.nome}>{o.nome}</span>
                              <span className="ml-auto flex items-center gap-3 text-[10px]"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{fmtM(o.saldoR)}</span><span className="inline-flex items-center gap-1 font-semibold text-violet-500"><Flag size={10} />{oTerm ? ymLabel(oTerm) : '—'}</span></span>
                            </button>
                            {oOpen && (
                              <div className="pl-6 pr-2 py-1 space-y-1.5">
                                {o.drivers.filter(d => d.contr > 0).map(d => { const meses = mesesOf(o, d, applied); return (
                                  <div key={d.label} className="flex items-center gap-2">
                                    <span className={`w-[22%] text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.label}</span>
                                    <span className={`w-[20%] text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtQ(d.saldoQ)}/{fmtQ(d.contr)} {d.uni}</span>
                                    <div className={`flex-1 h-4 rounded-md overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>{meses > 0 && <div className="h-full rounded-md flex items-center px-1.5" style={{ width: `${barW(meses)}%`, background: d.cor }}><span className="text-[9px] font-bold text-white whitespace-nowrap">{meses}m</span></div>}</div>
                                    <span className="w-14 text-right text-[10px] font-semibold tabular-nums" style={{ color: d.cor }}>{meses > 0 ? ymLabel(shiftYM(start, meses - 1)) : (d.saldoQ <= 0 ? '✓' : '—')}</span>
                                  </div>) })}
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
        )}
      </PanelCard>

      {modalOpen && <ConfigModal isDark={isDark} portfolioId={portfolioId} allObras={allObras} saldoGlobal={saldoGlobal}
        inicial={applied ?? defaultConfig} defaultConfig={defaultConfig} versoes={versoes} qc={qc}
        onAplicar={c => { setApplied(c); setModalOpen(false) }} onClose={() => setModalOpen(false)} />}
    </div>
  )
}

// ── Modal de configuração ────────────────────────────────────────────────────
function ConfigModal({ isDark, portfolioId, allObras, saldoGlobal, inicial, defaultConfig, versoes, qc, onAplicar, onClose }: {
  isDark: boolean; portfolioId: string; allObras: Obra[]; saldoGlobal: Record<string, number>
  inicial: Config; defaultConfig: Config; versoes: Versao[]; qc: ReturnType<typeof useQueryClient>
  onAplicar: (c: Config) => void; onClose: () => void
}) {
  const [cfg, setCfg] = useState<Config>(inicial)
  const [nome, setNome] = useState('')
  const setProd = (k: string, v: number) => setCfg(c => ({ ...c, prod: { ...c.prod, [k]: v } }))
  const setPeso = (o: string, v: number) => setCfg(c => ({ ...c, pesos: { ...c.pesos, [o]: v } }))
  const semear = (h: number) => setCfg(c => { const prod: Record<string, number> = {}; DRV.forEach(d => prod[d.label] = saldoGlobal[d.label] > 0 ? Math.max(0.1, Math.round(saldoGlobal[d.label] / h * 10) / 10) : 0); return { ...c, prod, horizonte: h } })
  const propPesos = () => setCfg(c => ({ ...c, pesos: Object.fromEntries(allObras.map(o => [o.nome, Math.round(o.saldoR / 1000)])) }))
  const totPeso = allObras.reduce((s, o) => s + (cfg.pesos[o.nome] ?? 0), 0) || 1

  const salvar = useMutation({
    mutationFn: async () => {
      const ex = versoes.find(v => v.nome.toLowerCase() === nome.trim().toLowerCase())
      if (ex) await supabase.from('pmo_cronograma_versao').update({ config: cfg, updated_at: new Date().toISOString() }).eq('id', ex.id)
      else await supabase.from('pmo_cronograma_versao').insert({ portfolio_id: portfolioId, nome: nome.trim(), config: cfg })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crono-versoes', portfolioId] }); setNome('') },
  })
  const excluir = useMutation({
    mutationFn: async (id: string) => { await supabase.from('pmo_cronograma_versao').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crono-versoes', portfolioId] }),
  })

  const inp = `w-20 text-sm font-bold rounded-lg border px-2 py-1 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`
  const lbl = `text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-3 border-b sticky top-0 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
          <h2 className="text-sm font-bold flex items-center gap-2"><Settings2 size={16} className="text-teal-500" /> Configurar cronograma</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-500/10"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* Versões */}
          {versoes.length > 0 && (
            <div>
              <p className={`${lbl} mb-1.5`}>Versões salvas</p>
              <div className="flex flex-wrap gap-1.5">
                {versoes.map(v => (
                  <span key={v.id} className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[11px] font-semibold border ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'}`}>
                    <button onClick={() => { setCfg(v.config); setNome(v.nome) }} className="hover:text-teal-500">{v.nome}</button>
                    <button onClick={() => excluir.mutate(v.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={11} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Produtividade total */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={lbl}><Gauge size={11} className="inline mr-1 text-teal-500" />Capacidade total (produtividade/mês)</p>
              <div className="flex items-center gap-1">{[6, 12, 18, 24].map(h => <button key={h} onClick={() => semear(h)} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.horizonte === h ? 'bg-teal-600 text-white border-teal-600' : (isDark ? 'border-white/15 text-slate-400' : 'border-slate-300 text-slate-500')}`}>{h}m</button>)}</div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {DRV.map(d => (
                <div key={d.label} className={`rounded-xl p-2.5 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50/70 border-slate-100'}`}>
                  <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full" style={{ background: d.cor }} /><span className="text-[11px] font-bold">{d.label}</span></div>
                  <p className={`text-[9px] mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>saldo {fmtQ(saldoGlobal[d.label] || 0)} {d.uni}</p>
                  <div className="flex items-center gap-1"><input type="number" min="0" step="0.5" value={cfg.prod[d.label] ?? 0} onChange={e => setProd(d.label, Number(e.target.value))} className={inp} /><span className="text-[10px] text-slate-400">{d.uni}/mês</span></div>
                </div>
              ))}
            </div>
          </div>

          {/* Alocação por obra */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={lbl}>Alocação dos recursos por obra</p>
              <div className={`inline-flex rounded-lg border overflow-hidden text-[10px] ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                {(['saldo', 'manual'] as const).map(m => <button key={m} onClick={() => setCfg(c => ({ ...c, modo: m }))} className={`px-2.5 py-1 font-semibold ${cfg.modo === m ? 'bg-teal-600 text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{m === 'saldo' ? 'Proporcional ao saldo' : 'Manual'}</button>)}
              </div>
            </div>
            {cfg.modo === 'saldo' ? (
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>A capacidade é distribuída automaticamente entre as obras na proporção do saldo de cada uma — todas avançam juntas.</p>
            ) : (
              <div>
                <button onClick={propPesos} className="text-[10px] font-semibold text-teal-500 mb-1.5 inline-flex items-center gap-1"><Sparkles size={11} /> preencher proporcional ao saldo</button>
                <div className={`max-h-56 overflow-auto rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {allObras.map(o => { const peso = cfg.pesos[o.nome] ?? 0; const share = Math.round(peso / totPeso * 100); return (
                    <div key={o.nome} className={`flex items-center gap-2 px-2.5 py-1.5 border-b last:border-0 ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
                      <span className={`flex-1 text-[11px] truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`} title={o.nome}>{o.nome}</span>
                      <div className={`w-20 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}><div className="h-full bg-teal-500" style={{ width: `${share}%` }} /></div>
                      <span className="w-8 text-right text-[10px] tabular-nums text-slate-400">{share}%</span>
                      <input type="number" min="0" value={peso} onChange={e => setPeso(o.nome, Number(e.target.value))} className={`w-16 text-[12px] font-semibold rounded-lg border px-1.5 py-0.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
                    </div>
                  ) })}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className={`flex items-center gap-2 px-5 py-3 border-t sticky bottom-0 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="nome da versão" className={`flex-1 text-sm rounded-lg border px-3 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`} />
          <button onClick={() => salvar.mutate()} disabled={!nome.trim() || salvar.isPending} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border disabled:opacity-40 ${isDark ? 'border-white/15 text-slate-200 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Save size={14} /> Salvar versão</button>
          <button onClick={() => onAplicar(cfg)} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold bg-teal-600 text-white hover:bg-teal-700"><Sparkles size={14} /> Aplicar</button>
        </div>
      </div>
    </div>
  )
}
