import { STATUS_META, PRIORITY_META, ROLE_META } from '../lib/constants'
import type { Status, Priority, Role } from '../data/shapes'

export function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${m.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m.badge}`}>
      {m.label}
    </span>
  )
}

export function CategoryBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {name}
    </span>
  )
}

export function EscaladoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      ⚠ Escalado
    </span>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  const m = ROLE_META[role]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.badge}`}>
      {m.label}
    </span>
  )
}
