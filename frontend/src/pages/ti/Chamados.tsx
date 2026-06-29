import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Inbox, AlertTriangle } from 'lucide-react'
import { listCategories, listSectors } from './data/meta'
import { listTickets, type TicketFilters } from './data/tickets'
import { useTiAuth } from './data/auth'
import type { Status, Priority } from './data/shapes'
import { STATUS_LIST, PRIORITY_LIST, STATUS_META, PRIORITY_META } from './lib/constants'
import { PageHeader, Spinner, EmptyState } from './components/ui'
import { StatusBadge, PriorityBadge, CategoryBadge, EscaladoBadge } from './components/Badges'
import { SlaBadge } from './components/SlaBadge'
import { Avatar } from './components/Avatar'
import { timeAgo } from './lib/format'

export default function Chamados() {
  const { user, isStaff: staff } = useTiAuth()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [scope, setScope] = useState('')
  const [overdue, setOverdue] = useState(false)

  const catQ = useQuery({ queryKey: ['ti', 'categories'], queryFn: listCategories })
  const secQ = useQuery({ queryKey: ['ti', 'sectors'], queryFn: listSectors })

  const filters: TicketFilters = {
    q: q || undefined,
    status: (status || undefined) as Status | undefined,
    priority: (priority || undefined) as Priority | undefined,
    categoryId: categoryId || undefined,
    sectorId: sectorId || undefined,
    assignee: scope || undefined,
    overdue: overdue || undefined,
    myPerfilId: user?.id,
  }
  const key = JSON.stringify({ q, status, priority, categoryId, sectorId, scope, overdue })
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'tickets', key], queryFn: () => listTickets(filters) })
  const tickets = data ?? []

  return (
    <div className="ti-scope">
      <PageHeader
        title="Chamados"
        subtitle="Todos os chamados da T.I."
        action={<Link to="/ti/chamados/novo" className="btn-primary"><Plus className="h-4 w-4" /> Novo chamado</Link>}
      />

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar por número ou título…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Status: todos</option>
          {STATUS_LIST.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Prioridade: todas</option>
          {PRIORITY_LIST.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>
        <select className="input w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Categoria: todas</option>
          {(catQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-auto" value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
          <option value="">Setor: todos</option>
          {(secQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {staff && (
          <select className="input w-auto" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">Atribuição: todos</option>
            <option value="me">Atribuídos a mim</option>
            <option value="unassigned">Não atribuídos</option>
          </select>
        )}
        <button
          type="button"
          onClick={() => setOverdue((v) => !v)}
          className={`btn ${overdue ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          <AlertTriangle className="h-4 w-4" /> Atrasados
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : tickets.length === 0 ? (
        <EmptyState icon={<Inbox className="h-10 w-10" />} title="Nenhum chamado encontrado" description="Ajuste os filtros ou abra um novo chamado" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Chamado</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Setor</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Aberto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/ti/chamados/${t.id}`} className="block">
                        <div className="font-mono text-xs text-slate-400">{t.code}</div>
                        <div className="font-medium text-slate-700">{t.title}</div>
                        <div className="text-xs text-slate-400">por {t.requester.name}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><CategoryBadge name={t.category.name} /></td>
                    <td className="px-4 py-3 text-slate-600">{t.sector?.name ?? '—'}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={t.status} />
                        <SlaBadge dueAt={t.dueAt} status={t.status} size="sm" />
                        {t.escalatedAt && <EscaladoBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={t.assignee.name} size="sm" />
                          <span className="text-slate-600">{t.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">{timeAgo(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
