import { useState } from 'react'
import type { ComponentType } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Inbox, AlertTriangle, ArrowRight, ChevronLeft, Headset, CheckCircle2, Package, X } from 'lucide-react'
import { NovoChamadoForm } from './NovoChamado'
import { listCategories, listSectors } from './data/meta'
import { listTickets, type TicketFilters } from './data/tickets'
import { useTiAuth } from './data/auth'
import type { Ticket, Status, Priority } from './data/shapes'
import { STATUS_LIST, PRIORITY_LIST, STATUS_META, PRIORITY_META } from './lib/constants'
import { PageHeader, Spinner, EmptyState } from './components/ui'
import { TiTabs } from './components/TiTabs'
import { StatusBadge, PriorityBadge, CategoryBadge, EscaladoBadge } from './components/Badges'
import { SlaBadge } from './components/SlaBadge'
import { Avatar } from './components/Avatar'
import { timeAgo } from './lib/format'

// ─── Seções movidas do Painel (Home) — ficam junto do quadro de chamados ─────
const OPEN_STATUSES: Status[] = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO']

function SectionTitle({ icon: Icon, title, to, toLabel }: { icon: ComponentType<{ className?: string }>; title: string; to?: string; toLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
        <Icon className="h-4 w-4 text-slate-400" /> {title}
      </h2>
      {to && <Link to={to} className="flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline">{toLabel ?? 'Ver todos'} <ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  )
}

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

function AttentionQueue({ tickets }: { tickets: Ticket[] }) {
  const now = Date.now()
  const isOpen = (t: Ticket) => OPEN_STATUSES.includes(t.status)
  const overdue = tickets
    .filter((t) => isOpen(t) && t.dueAt && new Date(t.dueAt).getTime() < now)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
  const unassigned = tickets.filter((t) => isOpen(t) && !t.assignee && !overdue.some((o) => o.id === t.id))
  const rows = [...overdue, ...unassigned].slice(0, 7)

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

function ChamadosStaff() {
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

  // Seções "Precisam de atenção" / "Chamados recentes" (movidas do Painel):
  // usam a lista completa, independente dos filtros do quadro acima.
  const allQ = useQuery({ queryKey: ['ti', 'tickets', 'all'], queryFn: () => listTickets({}) })
  const allTickets = allQ.data ?? []
  const recent = allTickets.slice(0, 6)

  return (
    <div className="ti-scope">
      {/* Sem botão de ação: abrir chamado é pelo item "Nova Solicitação" do menu lateral */}
      <PageHeader
        title={staff ? 'Chamados' : 'Meus Chamados'}
        subtitle={staff ? 'Todos os chamados da T.I.' : 'Chamados que você abriu'}
      />

      <TiTabs />

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
                  {staff && <th className="px-4 py-3">Setor</th>}
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
                        {staff && <div className="text-xs text-slate-400">por {t.requester.name}</div>}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><CategoryBadge name={t.category.name} /></td>
                    {staff && <td className="px-4 py-3 text-slate-600">{t.sector?.name ?? '—'}</td>}
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

      {/* Precisam de atenção — atrasados e sem responsável (movido do Painel) */}
      <section className="mt-8">
        <SectionTitle icon={AlertTriangle} title="Precisam de atenção" />
        {allQ.isLoading ? <Spinner /> : <AttentionQueue tickets={allTickets} />}
      </section>

      {/* Chamados recentes (movido do Painel) */}
      <section className="mt-8">
        <SectionTitle icon={Inbox} title="Chamados recentes" />
        <RecentList tickets={recent} loading={allQ.isLoading} />
      </section>
    </div>
  )
}

// ─── Visão do COLABORADOR — padrão Compras/"Minhas Solicitações" ──────────────
// Cabeçalho com ícone + "N em aberto · M encerrados" e abas sublinhadas
// Abertos/Encerrados (copiado de MinhasSolicitacoes.tsx, accent sky do Helpdesk).
// `home`: quando é a própria home do módulo (/ti), sem a seta de voltar.
const ABERTOS_EN = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO']

export function MeusChamados({ home = false }: { home?: boolean }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'abertos' | 'encerrados'>('abertos')
  // Modal "Nova Solicitação" (padrão Estoque): o botão do menu navega para
  // /ti?nova=1 e o parâmetro abre o formulário sobre a tela com fundo embaçado.
  const [searchParams, setSearchParams] = useSearchParams()
  const novaOpen = searchParams.has('nova')
  const closeNova = () => setSearchParams({}, { replace: true })
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'tickets', 'meus'], queryFn: () => listTickets({}) })
  const tickets = data ?? []
  const abertos = tickets.filter((t) => ABERTOS_EN.includes(t.status))
  const encerrados = tickets.filter((t) => !ABERTOS_EN.includes(t.status))
  const rows = tab === 'abertos' ? abertos : encerrados

  return (
    <div className="ti-scope">
      {/* Cabeçalho no padrão Minhas Solicitações */}
      <div className="mb-4 flex items-center gap-3">
        {!home && (
          <button
            onClick={() => navigate('/ti')}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Voltar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100">
          <Headset size={16} className="text-sky-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-slate-800">Meus Chamados</h1>
          <p className="text-[11px] text-slate-400">
            {isLoading ? 'Carregando…' : `${abertos.length} em aberto · ${encerrados.length} encerrado${encerrados.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Abas Abertos/Encerrados (sublinhado + chip de contagem) */}
      <div className="mb-4 flex border-b border-slate-200">
        {(['abertos', 'encerrados'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2.5 text-[13px] font-semibold transition-colors ${
              tab === t ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t === 'abertos' ? 'Abertos' : 'Encerrados'}
            {t === 'abertos' && abertos.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-600">
                {abertos.length}
              </span>
            )}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-sky-500" />}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10">
          {tab === 'abertos' ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-600">Tudo em dia!</p>
                <p className="mt-0.5 text-xs text-slate-400">Nenhum chamado em aberto.</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Package size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Nenhum chamado encerrado ainda.</p>
            </>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Chamado</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Aberto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/ti/chamados/${t.id}`} className="block">
                        <div className="font-mono text-xs text-slate-400">{t.code}</div>
                        <div className="font-medium text-slate-700">{t.title}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><CategoryBadge name={t.category.name} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={t.status} />
                        <SlaBadge dueAt={t.dueAt} status={t.status} size="sm" />
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

      {/* Modal Nova Solicitação — mesmo padrão do Estoque (Nova Movimentação) */}
      {novaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-extrabold text-slate-800">Nova Solicitação</h2>
              <button
                onClick={closeNova}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <NovoChamadoForm plain onCancel={closeNova} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Chamados() {
  const { isStaff: staff } = useTiAuth()
  return staff ? <ChamadosStaff /> : <MeusChamados />
}
