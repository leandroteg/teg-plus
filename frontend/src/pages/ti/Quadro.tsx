import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { listTickets, patchTicket } from './data/tickets'
import type { Ticket, Status } from './data/shapes'
import { STATUS_META, PRIORITY_META } from './lib/constants'
import { PageHeader, Spinner } from './components/ui'
import { Avatar } from './components/Avatar'
import { SlaBadge } from './components/SlaBadge'

// Drag-and-drop nativo do HTML5 (sem @dnd-kit, que não é dependência do TEG+).
// Observação: o drag nativo não funciona em telas de toque; para o admin desktop
// é suficiente — pode-se trocar o status pelo seletor no detalhe do chamado.
const COLUMNS: Status[] = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO']

function Card({ ticket }: { ticket: Ticket }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', ticket.id); e.dataTransfer.effectAllowed = 'move' }}
      className="card cursor-grab p-3"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] text-slate-400">{ticket.code}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_META[ticket.priority].badge}`}>
          {PRIORITY_META[ticket.priority].label}
        </span>
      </div>
      <Link
        to={`/ti/chamados/${ticket.id}`}
        draggable={false}
        className="line-clamp-2 block text-sm font-medium text-slate-700 hover:text-sky-600"
      >
        {ticket.title}
      </Link>
      <div className="mt-2"><SlaBadge dueAt={ticket.dueAt} status={ticket.status} size="sm" /></div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">{ticket.requester.name.split(' ')[0]}</span>
        {ticket.assignee ? <Avatar name={ticket.assignee.name} size="sm" /> : <span className="text-[11px] text-slate-300">sem resp.</span>}
      </div>
    </div>
  )
}

function Column({ status, tickets, onMove }: { status: Status; tickets: Ticket[]; onMove: (id: string, status: Status) => void }) {
  const [over, setOver] = useState(false)
  const meta = STATUS_META[status]
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className="text-sm font-semibold text-slate-700">{meta.label}</span>
        <span className="ml-auto rounded-full bg-slate-200 px-2 text-xs text-slate-500">{tickets.length}</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDragEnter={() => setOver(true)}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const id = e.dataTransfer.getData('text/plain')
          if (id) onMove(id, status)
        }}
        className={`flex min-h-[140px] flex-1 flex-col gap-2 rounded-xl p-2 transition ${
          over ? 'bg-sky-50 ring-2 ring-sky-200' : 'bg-slate-100/70'
        }`}
      >
        {tickets.map((t) => <Card key={t.id} ticket={t} />)}
      </div>
    </div>
  )
}

export default function Quadro() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'board'], queryFn: () => listTickets({}) })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => patchTicket(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ti', 'tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ti', 'stats'] })
    },
  })

  const grouped = useMemo(() => {
    const map: Record<string, Ticket[]> = {}
    for (const s of COLUMNS) map[s] = []
    for (const t of data ?? []) if (map[t.status]) map[t.status].push(t)
    return map
  }, [data])

  const onMove = (id: string, target: Status) => {
    const ticket = (data ?? []).find((t) => t.id === id)
    if (!ticket || ticket.status === target) return
    queryClient.setQueryData<Ticket[]>(['ti', 'board'], (old) =>
      (old ?? []).map((t) => (t.id === id ? { ...t, status: target } : t)))
    mutation.mutate({ id, status: target })
  }

  return (
    <div className="ti-scope">
      <PageHeader title="Quadro de atendimento" subtitle="Arraste para mudar o status" />
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((s) => <Column key={s} status={s} tickets={grouped[s] ?? []} onMove={onMove} />)}
        </div>
      )}
    </div>
  )
}
