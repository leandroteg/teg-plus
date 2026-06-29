import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Lock, CircleDot } from 'lucide-react'
import { getTicket, patchTicket, addComment, type TicketPatch } from './data/tickets'
import { listAssignees } from './data/users'
import { listCategories, listSectors } from './data/meta'
import { listCanned } from './data/canned'
import { listAssets } from './data/assets'
import { uploadAttachments, deleteAttachment } from './data/attachments'
import { useTiAuth } from './data/auth'
import type { Activity, Attachment, Status, Priority } from './data/shapes'
import { STATUS_LABEL, PRIORITY_LABEL, type StatusDb, type PriorityDb } from './data/enums'
import { isStaff, STATUS_LIST, PRIORITY_LIST, STATUS_META, PRIORITY_META } from './lib/constants'
import { Spinner, ErrorNote } from './components/ui'
import { StatusBadge, PriorityBadge, CategoryBadge, EscaladoBadge } from './components/Badges'
import { SlaBadge } from './components/SlaBadge'
import { Avatar } from './components/Avatar'
import { FileUpload } from './components/FileUpload'
import { AttachmentList } from './components/AttachmentList'
import { formatDateTime, timeAgo } from './lib/format'

function parseMeta(meta: string | null): Record<string, string | number | null> {
  try { return meta ? JSON.parse(meta) : {} } catch { return {} }
}

function activityText(a: Activity): string {
  const m = parseMeta(a.meta)
  const who = a.actor?.name ?? 'Sistema'
  const st = (v: unknown) => (v ? STATUS_LABEL[v as StatusDb] ?? String(v) : '—')
  const pr = (v: unknown) => (v ? PRIORITY_LABEL[v as PriorityDb] ?? String(v) : '—')
  switch (a.type) {
    case 'CRIADO': return `${who} abriu o chamado`
    case 'STATUS': return `${who} alterou o status: ${st(m.de)} → ${st(m.para)}`
    case 'REABERTO': return `${who} reabriu o chamado`
    case 'PRIORIDADE': return `${who} mudou a prioridade: ${pr(m.de)} → ${pr(m.para)}`
    case 'CATEGORIA': return `${who} mudou a categoria: ${m.de ?? '—'} → ${m.para ?? '—'}`
    case 'SETOR': return `${who} mudou o setor: ${m.de ?? '—'} → ${m.para ?? '—'}`
    case 'ATRIBUIDO': return m.para ? `${who} atribuiu para ${m.para}` : `${who} removeu o responsável`
    case 'ANEXOU': return `${who} anexou ${m.qtd ?? ''} arquivo(s)`.replace('  ', ' ')
    case 'ATIVO': return m.para ? `${who} vinculou o equipamento ${m.para}` : `${who} removeu o equipamento vinculado`
    default: return `${who}: ${a.type}`
  }
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  )
}

export default function ChamadoDetalhe() {
  const { id } = useParams()
  const { user, isStaff: staff } = useTiAuth()
  const queryClient = useQueryClient()

  const ticketQ = useQuery({ queryKey: ['ti', 'ticket', id], queryFn: () => getTicket(id!), enabled: !!id })
  const assigneesQ = useQuery({ queryKey: ['ti', 'assignees'], queryFn: listAssignees, enabled: staff })
  const catQ = useQuery({ queryKey: ['ti', 'categories'], queryFn: listCategories, enabled: staff })
  const secQ = useQuery({ queryKey: ['ti', 'sectors'], queryFn: listSectors, enabled: staff })
  const cannedQ = useQuery({ queryKey: ['ti', 'canned'], queryFn: listCanned, enabled: staff })
  const assetsQ = useQuery({ queryKey: ['ti', 'assets'], queryFn: listAssets, enabled: staff })

  const patchMut = useMutation({
    mutationFn: (patch: TicketPatch) => patchTicket(id!, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ti', 'ticket', id] })
      queryClient.invalidateQueries({ queryKey: ['ti', 'tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ti', 'stats'] })
    },
  })

  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [commentError, setCommentError] = useState('')
  const commentMut = useMutation({
    mutationFn: () => addComment({ chamadoId: id!, body: body.trim(), internal, autorId: user!.id }),
    onSuccess: () => {
      setBody(''); setInternal(false); setCommentError('')
      queryClient.invalidateQueries({ queryKey: ['ti', 'ticket', id] })
    },
    onError: (e) => setCommentError(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.'),
  })

  const [files, setFiles] = useState<File[]>([])
  const uploadMut = useMutation({
    mutationFn: () => uploadAttachments({ chamadoId: id!, files, autorId: user!.id }),
    onSuccess: () => { setFiles([]); queryClient.invalidateQueries({ queryKey: ['ti', 'ticket', id] }) },
  })
  const deleteAttMut = useMutation({
    mutationFn: (attId: string) => deleteAttachment(attId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ti', 'ticket', id] }),
  })

  if (ticketQ.isLoading) return <Spinner label="Carregando chamado…" />
  if (ticketQ.error || !ticketQ.data) {
    return (
      <div className="ti-scope mx-auto max-w-md">
        <div className="card p-8 text-center">
          <p className="text-slate-600">Chamado não encontrado ou você não tem acesso a ele.</p>
          <Link to="/ti/chamados" className="btn-primary mt-4 inline-flex">Voltar aos chamados</Link>
        </div>
      </div>
    )
  }

  const t = ticketQ.data
  const onSubmitComment = (e: FormEvent) => {
    e.preventDefault()
    if (body.trim()) commentMut.mutate()
  }
  const canDelete = (a: Attachment) => staff || a.uploadedBy?.id === user?.id

  const timeline = [
    ...t.comments.map((c) => ({ kind: 'comment' as const, at: c.createdAt, comment: c })),
    ...t.activities.filter((a) => a.type !== 'COMENTOU').map((a) => ({ kind: 'activity' as const, at: a.createdAt, activity: a })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  return (
    <div className="ti-scope">
      <Link to="/ti/chamados" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-sky-600">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-slate-400">{t.code}</span>
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
          <CategoryBadge name={t.category.name} />
          <SlaBadge dueAt={t.dueAt} status={t.status} />
          {t.escalatedAt && <EscaladoBadge />}
        </div>
        <h1 className="mt-2 text-xl font-bold text-slate-800">{t.title}</h1>
        <p className="mt-1 text-xs text-slate-400">Aberto por {t.requester.name} · {formatDateTime(t.createdAt)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Descrição</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{t.description}</p>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Anexos</h2>
            <AttachmentList attachments={t.attachments} canDelete={canDelete} onDelete={(a) => deleteAttMut.mutate(a.id)} />
            <div className="mt-4 border-t border-slate-100 pt-4">
              <FileUpload files={files} onChange={setFiles} />
              {files.length > 0 && (
                <button className="btn-accent mt-3" onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending}>
                  {uploadMut.isPending ? 'Enviando…' : `Enviar ${files.length} arquivo(s)`}
                </button>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Histórico</h2>
            <div className="space-y-5">
              {timeline.map((item, i) =>
                item.kind === 'comment' ? (
                  <div key={`c-${item.comment.id}`} className="flex gap-3">
                    <Avatar name={item.comment.author.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{item.comment.author.name}</span>
                        {isStaff(item.comment.author.role) && (
                          <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Equipe T.I.</span>
                        )}
                        <span className="text-xs text-slate-400">{formatDateTime(item.comment.createdAt)}</span>
                        {item.comment.isInternal && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <Lock className="h-3 w-3" /> Nota interna
                          </span>
                        )}
                      </div>
                      <div className={`mt-1 whitespace-pre-wrap rounded-lg border p-3 text-sm ${
                        item.comment.isInternal ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-100 bg-slate-50 text-slate-700'
                      }`}>
                        {item.comment.body}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={`a-${item.activity.id}-${i}`} className="flex items-center gap-2 pl-1 text-xs text-slate-400">
                    <CircleDot className="h-3.5 w-3.5 shrink-0" />
                    <span>{activityText(item.activity)}</span>
                    <span>·</span>
                    <span>{timeAgo(item.at)}</span>
                  </div>
                ),
              )}
            </div>

            <form onSubmit={onSubmitComment} className="mt-6 border-t border-slate-100 pt-4">
              {commentError && <div className="mb-2"><ErrorNote message={commentError} /></div>}
              {staff && (cannedQ.data?.length ?? 0) > 0 && (
                <select
                  className="input mb-2"
                  value=""
                  onChange={(e) => {
                    const c = cannedQ.data?.find((x) => x.id === e.target.value)
                    if (c) setBody((prev) => (prev ? `${prev}\n\n${c.body}` : c.body))
                    e.currentTarget.value = ''
                  }}
                >
                  <option value="">Inserir modelo de resposta…</option>
                  {cannedQ.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              )}
              <textarea className="input min-h-[90px] resize-y" placeholder="Escreva uma resposta…" value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="mt-2 flex items-center justify-between">
                {staff ? (
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                    Nota interna (só a equipe vê)
                  </label>
                ) : <span />}
                <button type="submit" className="btn-primary" disabled={commentMut.isPending || !body.trim()}>
                  <Send className="h-4 w-4" /> {commentMut.isPending ? 'Enviando…' : 'Responder'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold text-slate-700">Propriedades</h2>

            <SidebarField label="Status">
              {staff ? (
                <select className="input" value={t.status} disabled={patchMut.isPending} onChange={(e) => patchMut.mutate({ status: e.target.value as Status })}>
                  {STATUS_LIST.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              ) : <StatusBadge status={t.status} />}
            </SidebarField>

            <SidebarField label="Prioridade">
              {staff ? (
                <select className="input" value={t.priority} disabled={patchMut.isPending} onChange={(e) => patchMut.mutate({ priority: e.target.value as Priority })}>
                  {PRIORITY_LIST.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
              ) : <PriorityBadge priority={t.priority} />}
            </SidebarField>

            <SidebarField label="Categoria">
              {staff ? (
                <select className="input" value={t.category.id} disabled={patchMut.isPending} onChange={(e) => {
                  const cat = catQ.data?.find((c) => c.id === e.target.value)
                  patchMut.mutate({ categoryId: e.target.value, categoryName: cat?.name })
                }}>
                  {(catQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : <CategoryBadge name={t.category.name} />}
            </SidebarField>

            <SidebarField label="Setor">
              {staff ? (
                <select className="input" value={t.sector?.id ?? ''} disabled={patchMut.isPending} onChange={(e) => patchMut.mutate({ sectorId: e.target.value || null })}>
                  <option value="">— Não definido</option>
                  {(secQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : <span className="text-sm text-slate-700">{t.sector?.name ?? '—'}</span>}
            </SidebarField>

            <SidebarField label="Responsável">
              {staff ? (
                <select className="input" value={t.assignee?.id ?? ''} disabled={patchMut.isPending} onChange={(e) => patchMut.mutate({ assigneeId: e.target.value || null })}>
                  <option value="">Não atribuído</option>
                  {(assigneesQ.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : t.assignee ? (
                <div className="flex items-center gap-2"><Avatar name={t.assignee.name} size="sm" /><span className="text-sm text-slate-700">{t.assignee.name}</span></div>
              ) : <span className="text-sm text-slate-400">Não atribuído</span>}
            </SidebarField>

            <SidebarField label="Equipamento">
              {staff ? (
                <select className="input" value={t.asset?.id ?? ''} disabled={patchMut.isPending} onChange={(e) => patchMut.mutate({ assetId: e.target.value || null })}>
                  <option value="">— Nenhum</option>
                  {(assetsQ.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{(a.tag ? `${a.tag} · ` : '') + (a.model ?? a.type)}</option>
                  ))}
                </select>
              ) : t.asset ? (
                <span className="text-sm text-slate-700">{(t.asset.tag ? `${t.asset.tag} · ` : '') + (t.asset.model ?? t.asset.type)}</span>
              ) : <span className="text-sm text-slate-400">—</span>}
            </SidebarField>
          </div>

          {(t.customFields?.length ?? 0) > 0 && (
            <div className="card space-y-3 p-5">
              <h2 className="text-sm font-semibold text-slate-700">Informações adicionais</h2>
              {t.customFields!.map((f) => (
                <div key={f.id}>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{f.label}</div>
                  <div className="text-sm text-slate-700">{f.value || '—'}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card space-y-3 p-5 text-sm">
            <SidebarField label="Solicitante">
              <div className="flex items-center gap-2">
                <Avatar name={t.requester.name} size="sm" />
                <div>
                  <div className="text-slate-700">{t.requester.name}</div>
                  <div className="text-xs text-slate-400">{t.externalContact ? `WhatsApp: ${t.externalContact.phone}` : t.requester.email}</div>
                  {t.externalContact && <div className="text-[11px] font-medium text-emerald-600">Contato externo · via WhatsApp</div>}
                </div>
              </div>
            </SidebarField>
            <div className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div>Aberto em {formatDateTime(t.createdAt)}</div>
              {t.dueAt && <div>Prazo (SLA): {formatDateTime(t.dueAt)}</div>}
              <div>Atualizado {timeAgo(t.updatedAt)}</div>
              {t.resolvedAt && <div>Resolvido em {formatDateTime(t.resolvedAt)}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
