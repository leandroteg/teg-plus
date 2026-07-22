import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// Filtro multi-seleção genérico (popover que abre ao clicar) com "Selecionar todos".
// Convenção: seleção VAZIA = todos (sem filtro). Reutilizável em qualquer tela.
export default function MultiSelectPopover({
  label, options, selected, onChange, isLight, minWidth = 200,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (s: Set<string>) => void
  isLight: boolean
  minWidth?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const todos = selected.size === 0
  const toggle = (o: string) => {
    const n = new Set(selected)
    n.has(o) ? n.delete(o) : n.add(o)
    onChange(n)
  }
  const resumo = selected.size === 0 ? label : selected.size === 1 ? [...selected][0] : `${selected.size} selecionados`
  const box = (on: boolean) => `w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-rose-500 border-rose-500' : isLight ? 'border-slate-300' : 'border-white/20'}`

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold outline-none max-w-[220px] ${isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/[0.04] border-white/[0.06] text-slate-200'}`}>
        <span className="truncate">{resumo}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border shadow-lg p-1 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`} style={{ minWidth }}>
          <button type="button" onClick={() => onChange(new Set())}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold text-left border-b ${isLight ? 'hover:bg-slate-50 text-slate-700 border-slate-100' : 'hover:bg-white/5 text-slate-200 border-white/10'}`}>
            <span className={box(todos)}>{todos && <Check size={10} className="text-white" />}</span>
            Selecionar todos
          </button>
          {options.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Sem opções</p>}
          {options.map(o => {
            const on = selected.has(o)
            return (
              <button key={o} type="button" onClick={() => toggle(o)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left ${isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-white/5 text-slate-200'}`}>
                <span className={box(on)}>{on && <Check size={10} className="text-white" />}</span>
                <span className="truncate">{o}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
