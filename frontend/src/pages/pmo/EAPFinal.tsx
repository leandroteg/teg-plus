import { useState, useMemo } from 'react'
import { Printer, Pencil, Check, X, ChevronDown } from 'lucide-react'
import { useEAPFinal, aggregatePolos, useUpdatePoloTorres, fmtQtd, type EAPPolo, type EAPPacote } from '../../hooks/usePMO'

const SEC_COLOR: Record<string, string> = {
  'Serv. Preliminares': '#0284c7',
  'Canteiro e Mobiliz.': '#0369a1',
  'Fundações': '#92400e',
  'Montagem de Torres': '#374151',
  'Lançamento de Cabos': '#3730a3',
  'Administração Local': '#6d28d9',
  'Outros': '#4b5563',
}
const fmtM = (v: number) => {
  if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M'
  if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'k'
  return 'R$ ' + Math.round(v)
}

const PACOTES_ORD = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Fundações', 'Montagem de Torres', 'Lançamento de Cabos', 'Administração Local', 'Outros']

function poloId(label: string) {
  const m = label.match(/^(F[\d.\/]+)/)
  return m ? m[1] : label
}
function poloNome(label: string) {
  return label.replace(/^F[\d.\/]+\s*-\s*/, '')
}

// agrega todos os polos num bloco "Geral"
function buildGeral(polos: EAPPolo[]): EAPPolo {
  const contr = polos.reduce((s, p) => s + p.contr, 0)
  const fat = polos.reduce((s, p) => s + p.fat, 0)
  type Acc = { valor: number; fat: number; qC: number; qR: number; uni: string | null }
  const m = new Map<string, Acc>()
  for (const p of polos) for (const pac of p.pacotes) {
    let a = m.get(pac.n); if (!a) { a = { valor: 0, fat: 0, qC: 0, qR: 0, uni: null }; m.set(pac.n, a) }
    a.valor += pac.valor; a.fat += pac.faturado; a.qC += pac.qtdContr; a.qR += pac.qtdReal; a.uni = pac.unidade ?? a.uni
  }
  let montTon = 0
  const pacotes: EAPPacote[] = PACOTES_ORD.filter(n => m.has(n)).map(n => {
    const a = m.get(n)!
    if (n === 'Montagem de Torres') montTon = a.qC
    return { n, valor: a.valor, faturado: a.fat, pctFin: a.valor ? Math.round(a.fat / a.valor * 100) : 0, pctFis: a.qC > 0 ? Math.round(a.qR / a.qC * 100) : null, qtdContr: a.qC, qtdReal: a.qR, unidade: a.uni, isOutros: n === 'Outros' }
  })
  const wf = pacotes.filter(x => x.pctFis != null)
  const wsum = wf.reduce((s, x) => s + x.valor, 0)
  const pctFis = wsum ? Math.round(wf.reduce((s, x) => s + (x.pctFis as number) * x.valor, 0) / wsum) : 0
  return {
    id: '__geral__', label: 'Geral', codigo: null,
    contr, fat, saldo: contr - fat, pctFin: contr ? Math.round(fat / contr * 100) : 0, pctFis,
    qtdTorres: polos.reduce((s, p) => s + (p.qtdTorres ?? 0), 0) || null,
    montTon, nOscs: polos.reduce((s, p) => s + p.nOscs, 0), oscs: [],
    obras: polos.flatMap(p => p.obras), pacotes,
  }
}

export default function EAPFinal({ portfolioId, excluded, excludedOscs, setExcludedOscs, isLight }: { portfolioId?: string; excluded?: Set<string>; excludedOscs: Set<string>; setExcludedOscs: React.Dispatch<React.SetStateAction<Set<string>>>; isLight: boolean }) {
  const { data, isLoading } = useEAPFinal(portfolioId)
  const polos = useMemo(() => aggregatePolos(data ?? [], excludedOscs).filter(p => !excluded?.has(p.id)), [data, excludedOscs, excluded])

  if (isLoading) return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>
  if (!polos.length) return <div className={`rounded-2xl border p-12 text-center text-sm ${isLight ? 'bg-white border-slate-200 text-slate-400' : 'bg-white/[0.03] border-white/[0.06] text-slate-500'}`}>Nenhum projeto selecionado.</div>

  return (
    <div className="space-y-3 print:space-y-2">
      {/* Geral + colunas por polo (máx 3 por linha) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
        {[buildGeral(polos), ...polos].map(p => <PoloCol key={p.id} polo={p} portfolioId={portfolioId} excludedOscs={excludedOscs} setExcludedOscs={setExcludedOscs} isLight={isLight} isGeral={p.id === '__geral__'} />)}
      </div>
    </div>
  )
}

// KPIs compactos (Contratado · Faturado · OSCs·Polos · Imprimir) — entram na linha do filtro
export function EAPKpis({ portfolioId, excluded, excludedOscs, isLight }: { portfolioId?: string; excluded?: Set<string>; excludedOscs: Set<string>; isLight: boolean }) {
  const { data } = useEAPFinal(portfolioId)
  const polos = useMemo(() => aggregatePolos(data ?? [], excludedOscs).filter(p => !excluded?.has(p.id)), [data, excludedOscs, excluded])
  if (!polos.length) return null
  const totContr = polos.reduce((s, p) => s + p.contr, 0)
  const totFat = polos.reduce((s, p) => s + p.fat, 0)
  const totOscs = polos.reduce((s, p) => s + p.nOscs, 0)
  const kpis: [string, string, boolean][] = [
    ['Contratado', fmtM(totContr), false],
    ['Faturado', fmtM(totFat) + ` · ${totContr ? Math.round(totFat / totContr * 100) : 0}%`, true],
    ['OSCs · Polos', `${totOscs} · ${polos.length}`, false],
  ]
  return (
    <div className="flex flex-wrap items-center gap-2 ml-auto">
      {kpis.map(([k, v, hi]) => (
        <div key={k} className={`px-2.5 py-1 rounded-lg text-center leading-tight ${hi ? 'bg-[#e87b2a] text-white' : (isLight ? 'bg-[#0f2a4a] text-white' : 'bg-white/[0.06] text-white')}`}>
          <div className="text-[8px] uppercase tracking-wide opacity-70">{k}</div>
          <div className="text-[13px] font-bold">{v}</div>
        </div>
      ))}
      <button onClick={() => window.print()} className={`print:hidden inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-semibold ${isLight ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/[0.08]'}`}>
        <Printer size={14} /> Imprimir
      </button>
    </div>
  )
}

function PoloCol({ polo, portfolioId, excludedOscs, setExcludedOscs, isLight, isGeral }: { polo: EAPPolo; portfolioId?: string; excludedOscs: Set<string>; setExcludedOscs: React.Dispatch<React.SetStateAction<Set<string>>>; isLight: boolean; isGeral?: boolean }) {
  return (
    <div className={`w-full flex flex-col gap-2 ${isGeral ? 'ring-2 ring-[#e87b2a]/40 rounded-2xl p-2' : ''}`}>
      {/* head */}
      {isGeral ? (
        <div className="rounded-xl px-3 py-2.5 bg-[#e87b2a] border-l-4 border-[#0f2a4a] flex items-center gap-2">
          <span className="text-white font-bold text-base uppercase tracking-wide shrink-0">Geral</span>
          <ObrasOscsBox polo={polo} excludedOscs={excludedOscs} setExcludedOscs={setExcludedOscs} isLight={isLight} />
        </div>
      ) : (
        <div className="rounded-xl px-3 py-2.5 bg-[#0f2a4a] border-l-4 border-[#e87b2a] flex items-center gap-2">
          <span className="text-[#e87b2a] font-bold text-sm uppercase shrink-0">{poloId(polo.label)}</span>
          <span className="text-white font-semibold text-base leading-none truncate">{poloNome(polo.label)}</span>
          <ObrasOscsBox polo={polo} excludedOscs={excludedOscs} setExcludedOscs={setExcludedOscs} isLight={isLight} />
        </div>
      )}

      {/* resumo: físico / financeiro */}
      <div className={`rounded-xl border-l-4 border-[#e87b2a] p-2.5 space-y-1.5 ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
        <ResumoBar label="Físico" pct={polo.pctFis} valor={fmtM(polo.contr)} color="#374151" isLight={isLight} />
        <ResumoBar label="Financeiro" pct={polo.pctFin} valor={fmtM(polo.fat)} color="#0f2a4a" isLight={isLight} />
      </div>

      {/* pacotes */}
      {polo.pacotes.map(pac => <PacoteCard key={pac.n} pac={pac} polo={polo} portfolioId={portfolioId} isLight={isLight} isGeral={isGeral} />)}
    </div>
  )
}

function ObrasOscsBox({ polo, excludedOscs, setExcludedOscs, isLight }: { polo: EAPPolo; excludedOscs: Set<string>; setExcludedOscs: React.Dispatch<React.SetStateAction<Set<string>>>; isLight: boolean }) {
  const [open, setOpen] = useState(false)
  const allIds = polo.obras.flatMap(ob => ob.oscs.map(o => o.id))
  const selCount = allIds.filter(id => !excludedOscs.has(id)).length
  const toggleOsc = (id: string) => setExcludedOscs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleObra = (ids: string[]) => setExcludedOscs(s => {
    const n = new Set(s); const allOn = ids.every(id => !n.has(id))
    ids.forEach(id => allOn ? n.add(id) : n.delete(id)); return n
  })
  const Chk = ({ on }: { on: boolean }) => (
    <span className={`shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded border ${on ? 'bg-teal-600 border-teal-600 text-white' : (isLight ? 'border-slate-300' : 'border-white/25')}`}>{on && <Check size={9} />}</span>
  )
  return (
    <div className="relative ml-auto shrink-0">
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/90 bg-white/15 hover:bg-white/25 rounded-md px-1.5 py-1">
        {polo.obras.length} obras · {selCount}/{allIds.length} OSCs
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute z-20 right-0 mt-1 w-72 rounded-xl border shadow-lg p-1.5 max-h-80 overflow-y-auto text-left ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
            {polo.obras.length === 0 ? <div className={`text-xs px-1 py-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Sem obras.</div> :
              polo.obras.map((ob, i) => {
                const ids = ob.oscs.map(o => o.id)
                const obraOn = ids.every(id => !excludedOscs.has(id))
                return (
                  <div key={i} className={`mb-1 last:mb-0 pb-1 last:pb-0 border-b last:border-0 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                    <button onClick={() => toggleObra(ids)} className={`w-full flex items-center gap-1.5 px-1 py-0.5 rounded-md text-xs font-semibold ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-white/[0.06]'}`}>
                      <Chk on={obraOn} /> <span className="truncate text-left">{ob.nome}</span>
                    </button>
                    <div className="pl-5 flex flex-wrap gap-x-2 gap-y-0.5 py-0.5">
                      {ob.oscs.map(o => {
                        const on = !excludedOscs.has(o.id)
                        return (
                          <button key={o.id} onClick={() => toggleOsc(o.id)} className={`inline-flex items-center gap-1 text-[10px] font-mono ${on ? (isLight ? 'text-teal-700' : 'text-teal-300') : (isLight ? 'text-slate-300 line-through' : 'text-slate-600 line-through')}`}>
                            <Chk on={on} />{o.numero_os.replace('OSC-', '')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </div>
  )
}

function ResumoBar({ label, pct, valor, color, isLight }: { label: string; pct: number; valor: string; color: string; isLight: boolean }) {
  return (
    <div className="grid grid-cols-[64px_1fr_70px] gap-2 items-center">
      <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
      <div className={`h-5 rounded-full overflow-hidden relative ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}>
        <div className="h-full rounded-full flex items-center justify-center" style={{ width: `${Math.min(pct, 100)}%`, background: color, minWidth: pct > 0 ? '1.5rem' : 0 }}>
          <span className="text-[10px] font-bold text-white px-1">{pct}%</span>
        </div>
      </div>
      <span className="text-xs font-bold text-right tabular-nums" style={{ color: isLight ? '#0f2a4a' : '#cbd5e1' }}>{valor}</span>
    </div>
  )
}

function PacoteCard({ pac, polo, portfolioId, isLight, isGeral }: { pac: EAPPacote; polo: EAPPolo; portfolioId?: string; isLight: boolean; isGeral?: boolean }) {
  const color = SEC_COLOR[pac.n] ?? '#374151'
  const isMont = pac.n === 'Montagem de Torres'
  const badge = isMont
    ? [(polo.qtdTorres ? `${polo.qtdTorres} torres` : null), fmtQtd(pac.qtdContr, pac.unidade)].filter(Boolean).join(' · ')
    : fmtQtd(pac.qtdContr, pac.unidade)

  if (pac.isOutros) {
    return (
      <div className={`rounded-xl border border-dashed p-2.5 flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.02] border-white/10'}`}>
        <span className="font-semibold text-sm" style={{ color }}>{pac.n}</span>
        <span className={`text-sm font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{fmtM(pac.valor)}</span>
      </div>
    )
  }

  const barPct = pac.pctFis ?? pac.pctFin
  return (
    <div className={`rounded-xl p-2.5 relative ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-sm leading-tight" style={{ color: isLight ? '#0f2a4a' : '#e2e8f0' }}>{pac.n}</span>
        {isMont
          ? (isGeral
            ? <span className="ml-auto text-[11px] font-semibold text-white px-2 py-0.5 rounded-full shrink-0" style={{ background: color }}>{badge || '—'}</span>
            : <TorresBadge polo={polo} pac={pac} portfolioId={portfolioId} color={color} isLight={isLight} />)
          : (badge && <span className="ml-auto text-[11px] font-semibold text-white px-2 py-0.5 rounded-full shrink-0" style={{ background: color }}>{badge}</span>)}
      </div>
      {/* barra */}
      <div className={`h-4 rounded-full overflow-hidden relative ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(barPct, 100)}%`, background: color }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {pac.pctFis != null ? `Físico ${pac.pctFis}%` : `Faturado ${pac.pctFin}%`}
          {pac.pctFis != null && fmtQtd(pac.qtdReal, pac.unidade) ? ` · ${fmtQtd(pac.qtdReal, pac.unidade)}` : ''}
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color: isLight ? '#0f2a4a' : '#cbd5e1' }}>{fmtM(pac.valor)}</span>
      </div>
    </div>
  )
}

function TorresBadge({ polo, pac, portfolioId, color, isLight }: { polo: EAPPolo; pac: EAPPacote; portfolioId?: string; color: string; isLight: boolean }) {
  const upd = useUpdatePoloTorres(portfolioId)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(polo.qtdTorres != null ? String(polo.qtdTorres) : '')
  const ton = fmtQtd(pac.qtdContr, pac.unidade)
  const save = async () => { await upd.mutateAsync({ poloId: polo.id, torres: val.trim() === '' ? null : Number(val) }); setEditing(false) }

  if (editing) {
    return (
      <span className="ml-auto inline-flex items-center gap-1 shrink-0">
        <input autoFocus type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="torres"
          className={`w-16 text-[11px] rounded-lg border px-1.5 py-0.5 outline-none ${isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-slate-800 border-white/20 text-white'}`} />
        <button onClick={save} className="text-emerald-500" title="Salvar"><Check size={14} /></button>
        <button onClick={() => { setEditing(false); setVal(polo.qtdTorres != null ? String(polo.qtdTorres) : '') }} className="text-slate-400" title="Cancelar"><X size={14} /></button>
      </span>
    )
  }
  return (
    <button onClick={() => setEditing(true)} title="Editar nº de torres" className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-white px-2 py-0.5 rounded-full shrink-0 hover:opacity-90" style={{ background: color }}>
      {polo.qtdTorres ? `${polo.qtdTorres} torres` : 'torres?'}{ton ? ` · ${ton}` : ''}
      <Pencil size={10} className="opacity-70" />
    </button>
  )
}
