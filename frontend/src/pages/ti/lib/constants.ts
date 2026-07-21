// Constantes de exibição (status/prioridade/papel) — portado do helpdesk.
// Cores custom do helpdesk mapeadas para paletas padrão do Tailwind:
//   brand (azul) → sky · accent (teal) → teal.
import type { Status, Priority, Role } from '../data/shapes'

export const STATUS_LIST: Status[] = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO']
export const PRIORITY_LIST: Priority[] = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']

export const STATUS_META: Record<Status, { label: string; badge: string; dot: string }> = {
  ABERTO: { label: 'Aberto', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  EM_ANDAMENTO: { label: 'Em andamento', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  AGUARDANDO: { label: 'Aguardando', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  RESOLVIDO: { label: 'Resolvido', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  FECHADO: { label: 'Fechado', badge: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400' },
}

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  BAIXA: { label: 'Baixa', badge: 'bg-slate-100 text-slate-600' },
  MEDIA: { label: 'Média', badge: 'bg-sky-100 text-sky-700' },
  ALTA: { label: 'Alta', badge: 'bg-orange-100 text-orange-700' },
  URGENTE: { label: 'Urgente', badge: 'bg-red-100 text-red-700' },
}

export const ROLE_META: Record<Role, { label: string; badge: string }> = {
  REQUERENTE: { label: 'Requerente', badge: 'bg-slate-100 text-slate-600' },
  AGENTE: { label: 'Agente', badge: 'bg-teal-100 text-teal-700' },
  ADMIN: { label: 'Admin', badge: 'bg-sky-100 text-sky-700' },
}

export const isStaff = (role?: Role) => role === 'AGENTE' || role === 'ADMIN'
