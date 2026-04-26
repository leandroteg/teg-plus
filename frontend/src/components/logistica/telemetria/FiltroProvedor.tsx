// ─────────────────────────────────────────────────────────────────────────────
// FiltroProvedor.tsx — Select reutilizavel: Todos / Cobli / Mobi7
// Usado nas 3 abas de Telemetria (Mapa, Alertas, Utilizacao)
// ─────────────────────────────────────────────────────────────────────────────
import type { TelProvider } from '../../../types/telemetria'

export type ProviderFilter = TelProvider | 'todos'

interface Props {
  value: ProviderFilter
  onChange: (v: ProviderFilter) => void
  className?: string
  isLight?: boolean
  size?: 'sm' | 'md'
}

export function FiltroProvedor({ value, onChange, className = '', isLight = true, size = 'md' }: Props) {
  const sizeCls = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
  const cls = `${sizeCls} rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
      : 'bg-white/[0.04] border border-white/[0.08] text-white [&>option]:bg-slate-900'
  } ${className}`
  return (
    <select
      className={cls}
      value={value}
      onChange={e => onChange(e.target.value as ProviderFilter)}
      title="Provedor de telemetria"
    >
      <option value="todos">Todos provedores</option>
      <option value="cobli">Cobli</option>
      <option value="mobi7">Mobi7</option>
    </select>
  )
}
