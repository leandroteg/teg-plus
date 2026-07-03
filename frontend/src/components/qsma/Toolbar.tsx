// ─────────────────────────────────────────────────────────────────────────────
// components/qsma/Toolbar.tsx — linha de filtros padrão das subtelas QSMA
// Mesmo modelo das telas de Faturas/Locações: [busca] [selects/pills] [ação →]
// tudo compactado numa linha, seguido da contagem de registros.
// ─────────────────────────────────────────────────────────────────────────────
import { Search, X, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function QsmaToolbar({
  isDark, busca, onBusca, placeholder = 'Buscar…', children, acoes,
}: {
  isDark: boolean
  busca?: string
  onBusca?: (v: string) => void
  placeholder?: string
  children?: React.ReactNode   // selects / pills extras
  acoes?: React.ReactNode      // botões à direita
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onBusca && (
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca ?? ''}
            onChange={e => onBusca(e.target.value)}
            placeholder={placeholder}
            className={`w-full pl-9 pr-7 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-red-500/25 ${
              isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200 placeholder:text-slate-500' : 'border-slate-200 bg-white'
            }`}
          />
          {busca && (
            <button onClick={() => onBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
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

export function ToolbarSelect({
  isDark, value, onChange, options, allLabel,
}: {
  isDark: boolean
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  allLabel: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`rounded-xl border px-3 py-2 text-xs font-semibold outline-none ${
        isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200 [&>option]:bg-slate-900' : 'bg-white border-slate-200 text-slate-600'
      }`}
    >
      <option value="">{allLabel}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
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
    <div className="flex items-center gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            value === o.value
              ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
              : isDark ? 'text-slate-500' : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          {o.label}
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

export function Contagem({ isDark, n, singular, plural }: { isDark: boolean; n: number; singular: string; plural: string }) {
  return (
    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
      {n} {n === 1 ? singular : plural}
    </p>
  )
}
