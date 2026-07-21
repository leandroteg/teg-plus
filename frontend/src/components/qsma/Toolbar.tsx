// ─────────────────────────────────────────────────────────────────────────────
// components/qsma/Toolbar.tsx — linha de filtros padrão das subtelas QSMA
// Modelo combinado de EGP›Medições + DP›Ponto: contagem à esquerda, busca,
// multi-select com checkboxes ("Obras: n/N"), selects destacados quando ativos,
// quick-chips de ícone e ação primária à direita — tudo numa linha.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Search, X, Plus, ChevronDown, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function QsmaToolbar({
  isDark, contagem, busca, onBusca, placeholder = 'Buscar…', children, acoes,
}: {
  isDark: boolean
  contagem?: string            // ex.: "12 riscos" — à esquerda, padrão Medições
  busca?: string
  onBusca?: (v: string) => void
  placeholder?: string
  children?: React.ReactNode   // selects / pills / multi-selects
  acoes?: React.ReactNode      // botões à direita
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {contagem && (
        <p className={`text-sm font-semibold shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{contagem}</p>
      )}
      {onBusca && (
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 shrink-0 ${
          isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
        }`}>
          <Search size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <input
            value={busca ?? ''}
            onChange={e => onBusca(e.target.value)}
            placeholder={placeholder}
            className={`w-36 text-sm outline-none bg-transparent ${
              isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'
            }`}
          />
          {busca && (
            <button onClick={() => onBusca('')} className="text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
      )}
      {children}
      {acoes && <div className="ml-auto flex items-center gap-2">{acoes}</div>}
    </div>
  )
}

// select destacado quando o filtro está ativo (padrão Medições)
export function ToolbarSelect({
  isDark, value, onChange, options, allLabel,
}: {
  isDark: boolean
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  allLabel: string
}) {
  const ativo = value !== ''
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-sm rounded-xl border px-2.5 py-2 outline-none cursor-pointer shrink-0 ${
        ativo
          ? isDark ? 'border-red-500/40 text-red-300 bg-red-500/10 font-semibold [&>option]:bg-slate-900' : 'border-red-300 text-red-700 bg-red-50 font-semibold'
          : isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300 [&>option]:bg-slate-900' : 'bg-white border-slate-200 text-slate-600'
      }`}
    >
      <option value="">{allLabel}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// multi-select com checkboxes "Label: n/N" (padrão Projetos/Obras de Medições)
export function MultiCheck({
  isDark, label, options, excluded, setExcluded,
}: {
  isDark: boolean
  label: string
  options: { value: string; label: string }[]
  excluded: Set<string>
  setExcluded: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const [open, setOpen] = useState(false)
  const ativos = options.length - options.filter(o => excluded.has(o.value)).length
  const filtroAtivo = excluded.size > 0
  const toggle = (v: string) => setExcluded(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n })
  const toggleAll = () => setExcluded(excluded.size === 0 ? new Set(options.map(o => o.value)) : new Set())

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={!options.length}
        className={`inline-flex items-center gap-1.5 text-sm rounded-xl border px-2.5 py-2 outline-none cursor-pointer disabled:opacity-40 ${
          filtroAtivo
            ? isDark ? 'border-red-500/40 text-red-300 bg-red-500/10 font-semibold' : 'border-red-300 text-red-700 bg-red-50 font-semibold'
            : isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'bg-white border-slate-200 text-slate-600'
        }`}
      >
        {label}: {ativos}/{options.length}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute z-20 mt-1 left-0 w-64 rounded-xl border shadow-lg p-1.5 max-h-72 overflow-y-auto ${
            isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <button onClick={toggleAll} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-semibold ${
              isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-100'
            }`}>
              <span className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded border ${
                excluded.size === 0 ? 'bg-red-600 border-red-600 text-white' : isDark ? 'border-white/20' : 'border-slate-300'
              }`}>{excluded.size === 0 && <Check size={11} />}</span>
              Selecionar todos
            </button>
            <div className={`my-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`} />
            {options.map(o => {
              const on = !excluded.has(o.value)
              return (
                <button key={o.value} onClick={() => toggle(o.value)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${
                  isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-100'
                }`}>
                  <span className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded border ${
                    on ? 'bg-red-600 border-red-600 text-white' : isDark ? 'border-white/20' : 'border-slate-300'
                  }`}>{on && <Check size={11} />}</span>
                  <span className="truncate text-left">{o.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// filtro de período (De/Até) no mesmo padrão visual do ToolbarSelect/MultiCheck
export function ToolbarDateRange({
  isDark, de, ate, onDe, onAte,
}: {
  isDark: boolean
  de: string
  ate: string
  onDe: (v: string) => void
  onAte: (v: string) => void
}) {
  const ativo = !!de || !!ate
  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 shrink-0 ${
      ativo
        ? isDark ? 'border-red-500/40 bg-red-500/10' : 'border-red-300 bg-red-50'
        : isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
    }`}>
      <input
        type="date" value={de} onChange={e => onDe(e.target.value)}
        className={`text-sm bg-transparent outline-none w-[118px] cursor-pointer ${
          isDark ? 'text-slate-300 [color-scheme:dark]' : 'text-slate-600'
        }`}
      />
      <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>–</span>
      <input
        type="date" value={ate} onChange={e => onAte(e.target.value)}
        className={`text-sm bg-transparent outline-none w-[118px] cursor-pointer ${
          isDark ? 'text-slate-300 [color-scheme:dark]' : 'text-slate-600'
        }`}
      />
      {ativo && (
        <button onClick={() => { onDe(''); onAte('') }} className="text-slate-400 hover:text-red-500 shrink-0">
          <X size={12} />
        </button>
      )}
    </div>
  )
}

export function ToolbarPills({
  isDark, value, onChange, options,
}: {
  isDark: boolean
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className={`inline-flex rounded-xl border overflow-hidden shrink-0 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-2 text-xs font-semibold transition-all ${
            value === o.value
              ? isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700'
              : isDark ? 'bg-transparent text-slate-400 hover:bg-white/[0.05]' : 'bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// quick-chips só de ícone com tooltip (padrão DP›Ponto)
export function QuickChips({
  isDark, value, onChange, chips,
}: {
  isDark: boolean
  value: string
  onChange: (v: string) => void
  chips: { k: string; label: string; icon: LucideIcon }[]
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {chips.map(ch => (
        <button
          key={ch.k}
          onClick={() => onChange(value === ch.k ? 'todos' : ch.k)}
          title={ch.label}
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors ${
            value === ch.k
              ? isDark ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200'
              : isDark ? 'bg-white/[0.03] text-slate-400 border-white/10 hover:bg-white/[0.06]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ch.icon size={15} />
        </button>
      ))}
    </div>
  )
}

export function BotaoNovo({ label, onClick, secundario, isDark, icon: Icon = Plus }: {
  label: string
  onClick: () => void
  secundario?: boolean
  isDark?: boolean
  icon?: LucideIcon
}) {
  if (secundario) {
    return (
      <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
        isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}>
        <Icon size={13} /> {label}
      </button>
    )
  }
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm">
      <Icon size={13} /> {label}
    </button>
  )
}

// mantido p/ compatibilidade onde a contagem fica fora da toolbar
export function Contagem({ isDark, n, singular, plural }: { isDark: boolean; n: number; singular: string; plural: string }) {
  return (
    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
      {n} {n === 1 ? singular : plural}
    </p>
  )
}
