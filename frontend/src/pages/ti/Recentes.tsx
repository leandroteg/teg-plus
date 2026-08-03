// Chamados recentes — últimos chamados abertos, em aba própria na fita da
// equipe (ao lado do Quadro de Chamados), mesmo fluxo do Quadro.
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTickets } from './data/tickets'
import type { Ticket } from './data/shapes'
import { PageHeader, Spinner } from './components/ui'
import { TiTabs } from './components/TiTabs'
import { StatusBadge, PriorityBadge } from './components/Badges'
import { SlaBadge } from './components/SlaBadge'
import { Avatar } from './components/Avatar'
import { timeAgo } from './lib/format'

const LIMITE_RECENTES = 15

function RecentList({ tickets, loading }: { tickets: Ticket[]; loading: boolean }) {
  if (loading) return <Spinner />
  if (tickets.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500">
        Nenhum chamado ainda — <Link to="/ti/chamados/novo" className="font-medium text-sky-600 hover:underline">abra o primeiro</Link>
      </div>
    )
  }
  return (
    <div className="card divide-y divide-slate-100">
      {tickets.map((t) => (
        <Link key={t.id} to={`/ti/chamados/${t.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50">
          <span className="font-mono text-xs text-slate-400">{t.code}</span>
          <span className="flex-1 truncate font-medium text-slate-700">{t.title}</span>
          {t.assignee && <Avatar name={t.assignee.name} size="sm" />}
          <span className="hidden sm:contents"><SlaBadge dueAt={t.dueAt} status={t.status} size="sm" /></span>
          <PriorityBadge priority={t.priority} />
          <StatusBadge status={t.status} />
          <span className="hidden w-24 text-right text-xs text-slate-400 sm:block">{timeAgo(t.createdAt)}</span>
        </Link>
      ))}
    </div>
  )
}

export default function Recentes() {
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'tickets', 'all'], queryFn: () => listTickets({}) })
  const recent = (data ?? []).slice(0, LIMITE_RECENTES)
  return (
    <div className="ti-scope">
      <PageHeader title="Chamados recentes" subtitle={`Últimos ${LIMITE_RECENTES} chamados abertos`} />
      <TiTabs />
      <RecentList tickets={recent} loading={isLoading} />
    </div>
  )
}
