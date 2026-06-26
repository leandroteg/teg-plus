// Filtros compartilhados dos painéis EGP (Cronograma/Histograma/Custos/Riscos):
// caixas elegantes de seleção múltipla — Frente / Obra / % Físico.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, ChevronDown, Filter } from 'lucide-react'
import type { Frente } from './cronogramaEngine'

export const PROD_BANDS: [string, string, (p: number) => boolean][] = [
  ['0', '0%', p => p === 0], ['1-25', '1–25%', p => p >= 1 && p <= 25], ['26-50', '26–50%', p => p >= 26 && p <= 50], ['51-75', '51–75%', p => p >= 51 && p <= 75], ['75-85', '75–85%', p => p > 75 && p <= 85], ['85-95', '85–95%', p => p > 85 && p <= 95], ['95+', '>95%', p => p > 95],
]

export function MultiSelect({ label, icon, options, selected, onToggle, onClear, isDark }: { label: string; icon?: ReactNode; options: { value: string; label: string }[]; selected: Set<string>; onToggle: (v: string) => void; onClear: () => void; isDark: boolean }) {
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

// estado dos filtros (frente / obra / % físico)
export function useFiltrosTree(pctInicial?: Set<string>) {
  const [fFrente, setFFrente] = useState<Set<string>>(new Set())
  const [fObra, setFObra] = useState<Set<string>>(new Set())
  const [fPct, setFPct] = useState<Set<string>>(pctInicial ?? new Set())
  return { fFrente, setFFrente, fObra, setFObra, fPct, setFPct }
}
export type FiltrosTree = ReturnType<typeof useFiltrosTree>

export const togFiltro = (k: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) =>
  set(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

// barra com as 3 caixas (Frente / Obra / % Físico). `extra` = controles adicionais à direita.
export function FiltrosFrenteObra({ tree, f, isDark, comPct = true, extra }: { tree: Frente[]; f: FiltrosTree; isDark: boolean; comPct?: boolean; extra?: ReactNode }) {
  const obraOptions = [...new Set((f.fFrente.size ? tree.filter(x => f.fFrente.has(x.label)) : tree).flatMap(x => x.obras.map(o => o.nome)))].sort()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelect label="Frente" icon={<Filter size={12} className="opacity-70" />} options={tree.map(x => ({ value: x.label, label: x.label }))} selected={f.fFrente} onToggle={v => { togFiltro(v, f.setFFrente); f.setFObra(new Set()) }} onClear={() => { f.setFFrente(new Set()); f.setFObra(new Set()) }} isDark={isDark} />
      <MultiSelect label="Obra" options={obraOptions.map(o => ({ value: o, label: o }))} selected={f.fObra} onToggle={v => togFiltro(v, f.setFObra)} onClear={() => f.setFObra(new Set())} isDark={isDark} />
      {comPct && <MultiSelect label="% Físico" options={PROD_BANDS.map(b => ({ value: b[0], label: b[1] }))} selected={f.fPct} onToggle={v => togFiltro(v, f.setFPct)} onClear={() => f.setFPct(new Set())} isDark={isDark} />}
      {extra}
    </div>
  )
}

// aplica os filtros à árvore (frente → obra)
export function filtrarTree(tree: Frente[], f: { fFrente: Set<string>; fObra: Set<string>; fPct: Set<string> }): Frente[] {
  return tree.filter(fr => f.fFrente.size === 0 || f.fFrente.has(fr.label))
    .map(fr => ({ ...fr, obras: fr.obras.filter(o => (f.fObra.size === 0 || f.fObra.has(o.nome)) && (f.fPct.size === 0 || PROD_BANDS.some(b => f.fPct.has(b[0]) && b[2](o.pctFis)))) }))
    .filter(fr => fr.obras.length > 0)
}
