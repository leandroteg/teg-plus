// Precisam de atenção — chamados atrasados ou sem responsável, em aba própria
// na fita da equipe (ao lado do Quadro de Chamados), mesmo fluxo do Quadro.
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { listTickets } from './data/tickets'
import type { Ticket, Status } from './data/shapes'
import { PageHeader, Spinner } from './components/ui'
import { TiTabs } from './components/TiTabs'
import { PriorityBadge } from './components/Badges'

const OPEN_STATUSES: Status[] = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO']

function AttentionQueue({ tickets }: { tickets: Ticket[] }) {
  const now = Date.now()
  const isOpen = (t: Ticket) => OPEN_STATUSES.includes(t.status)
  const overdue = tickets
    .filter((t) => isOpen(t) && t.dueAt && new Date(t.dueAt).getTime() < now)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
  const unassigned = tickets.filter((t) => isOpen(t) && !t.assignee && !overdue.some((o) => o.id === t.id))
  const rows = [...overdue, ...unassigned]

  return (
    <div className="card overflow-hidden">
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Tudo em dia — nada atrasado ou sem responsável. 🎉
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((t) => {
            const isOverdue = !!t.dueAt && new Date(t.dueAt).getTime() < now
            return (
              <li key={t.id}>
                <Link to={`/ti/chamados/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                  <span className="font-mono text-xs text-slate-400">{t.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{t.title}</span>
                  {isOverdue
                    ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Atrasado</span>
                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Sem responsável</span>}
                  <PriorityBadge priority={t.priority} />
                  <span className="hidden w-28 text-right text-xs text-slate-400 sm:block">{t.assignee ? t.assignee.name : '—'}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function Atencao() {
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'tickets', 'all'], queryFn: () => listTickets({}) })
  return (
    <div className="ti-scope">
      <PageHeader title="Precisam de atenção" subtitle="Chamados atrasados ou sem responsável" />
      <TiTabs />
      {isLoading ? <Spinner /> : <AttentionQueue tickets={data ?? []} />}
    </div>
  )
}
