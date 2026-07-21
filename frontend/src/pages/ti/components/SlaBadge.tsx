import { AlertTriangle, Clock } from 'lucide-react'
import { timeUntil } from '../lib/format'
import type { Status } from '../data/shapes'

// Mostra o prazo de SLA: "vence em 3h" ou "atrasado há 2 d".
// Some quando o chamado já foi resolvido/fechado ou não tem prazo.
export function SlaBadge({ dueAt, status, size = 'md' }: { dueAt: string | null; status: Status; size?: 'sm' | 'md' }) {
  if (!dueAt || status === 'RESOLVIDO' || status === 'FECHADO') return null
  const { overdue, label } = timeUntil(dueAt)
  const cls = overdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
  const Icon = overdue ? AlertTriangle : Clock
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
  const ic = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${cls} ${pad}`}>
      <Icon className={ic} />
      {label}
    </span>
  )
}
