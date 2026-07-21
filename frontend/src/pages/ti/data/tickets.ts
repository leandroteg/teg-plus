// Camada de dados de chamados (ti_chamados) — Supabase-nativo.
// As ESCRITAS são insert/update simples: os triggers do banco já cuidam de
// atividade, notificação, SLA (due_at) e numeração (sequence ti_chamado_numero_seq).
import { supabase } from './supabase'
import { STATUS_TO_DB, STATUS_FROM_DB, PRIORITY_TO_DB, type StatusDb, type PriorityDb } from './enums'
import { toTicket, toTicketUser, toComment, toActivity, toAttachment } from './mappers'
import { signedUrls } from './attachments'
import type { Ticket, TicketDetail, Status, Priority, Role, CustomFieldValue, Stats } from './shapes'

// ─── Painel (KPIs + recentes) — usado na Home ────────────────────────────────
export interface TiStats {
  total: number
  aberto: number
  em_atendimento: number
  aguardando_usuario: number
  resolvido: number
  fechado: number
  urgentes: number
  atrasados: number
  naoAtribuidos: number
}

export interface TicketListRow {
  id: string
  numero: number
  titulo: string
  status: StatusDb
  prioridade: PriorityDb
  created_at: string
  atendente_id: string | null
  solicitante: { nome: string } | null
  atendente: { nome: string } | null
}

const RECENT_SELECT = `
  id, numero, titulo, status, prioridade, created_at, atendente_id,
  solicitante:sys_perfis!ti_chamados_solicitante_id_fkey(nome),
  atendente:sys_perfis!ti_chamados_atendente_id_fkey(nome)
`

const ABERTOS: StatusDb[] = ['aberto', 'em_atendimento', 'aguardando_usuario']

export async function getStats(): Promise<TiStats> {
  const { data, error } = await supabase.from('ti_chamados').select('status, prioridade, atendente_id, due_at')
  if (error) throw error
  const rows = (data ?? []) as { status: StatusDb; prioridade: PriorityDb; atendente_id: string | null; due_at: string | null }[]
  const now = Date.now()
  const s: TiStats = {
    total: rows.length,
    aberto: 0, em_atendimento: 0, aguardando_usuario: 0, resolvido: 0, fechado: 0,
    urgentes: 0, atrasados: 0, naoAtribuidos: 0,
  }
  for (const r of rows) {
    s[r.status] += 1
    const emAberto = ABERTOS.includes(r.status)
    if (emAberto && r.prioridade === 'urgente') s.urgentes += 1
    if (emAberto && r.due_at && new Date(r.due_at).getTime() < now) s.atrasados += 1
    if (emAberto && !r.atendente_id) s.naoAtribuidos += 1
  }
  return s
}

// Estatísticas no shape EN do Dashboard (byStatus + contadores camelCase).
export async function getDashboardStats(): Promise<Stats> {
  const { data, error } = await supabase.from('ti_chamados').select('status, prioridade, atendente_id, due_at')
  if (error) throw error
  const rows = (data ?? []) as { status: StatusDb; prioridade: PriorityDb; atendente_id: string | null; due_at: string | null }[]
  const now = Date.now()
  const byStatus: Record<Status, number> = { ABERTO: 0, EM_ANDAMENTO: 0, AGUARDANDO: 0, RESOLVIDO: 0, FECHADO: 0 }
  let urgentes = 0, atrasados = 0, naoAtribuidos = 0
  for (const r of rows) {
    const en = STATUS_FROM_DB[r.status] ?? 'ABERTO'
    byStatus[en] += 1
    const emAberto = r.status === 'aberto' || r.status === 'em_atendimento' || r.status === 'aguardando_usuario'
    if (emAberto && r.prioridade === 'urgente') urgentes += 1
    if (emAberto && r.due_at && new Date(r.due_at).getTime() < now) atrasados += 1
    if (emAberto && !r.atendente_id) naoAtribuidos += 1
  }
  return {
    byStatus,
    total: rows.length,
    abertos: byStatus.ABERTO,
    emAndamento: byStatus.EM_ANDAMENTO,
    aguardando: byStatus.AGUARDANDO,
    resolvidos: byStatus.RESOLVIDO,
    fechados: byStatus.FECHADO,
    urgentes, atrasados, naoAtribuidos,
  }
}

export async function listRecent(limit = 8): Promise<TicketListRow[]> {
  const { data, error } = await supabase
    .from('ti_chamados')
    .select(RECENT_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as unknown as TicketListRow[]) ?? []
}

// ─── Lista / detalhe / escrita (shapes EN para as telas) ─────────────────────
const TICKET_SELECT = `
  id, numero, titulo, descricao, status, prioridade, due_at, escalated_at, canal,
  created_at, updated_at, resolved_at, closed_at, categoria, categoria_id, setor_id, ativo_id, dados_personalizados, contato_externo,
  cat:ti_categorias!ti_chamados_categoria_id_fkey(id, nome),
  setor:ti_setores!ti_chamados_setor_id_fkey(id, nome),
  ativo:ti_ativos!ti_chamados_ativo_id_fkey(id, patrimonio, tipo, modelo, responsavel_nome),
  solicitante:sys_perfis!ti_chamados_solicitante_id_fkey(id, nome, email),
  atendente:sys_perfis!ti_chamados_atendente_id_fkey(id, nome, email)
`

export interface TicketFilters {
  q?: string
  status?: Status
  priority?: Priority
  categoryId?: string
  sectorId?: string
  /** 'me' | 'unassigned' | id do atendente */
  assignee?: string
  overdue?: boolean
  myPerfilId?: string
}

export async function listTickets(f: TicketFilters = {}): Promise<Ticket[]> {
  let query = supabase.from('ti_chamados').select(TICKET_SELECT).order('created_at', { ascending: false })
  if (f.status) query = query.eq('status', STATUS_TO_DB[f.status])
  if (f.priority) query = query.eq('prioridade', PRIORITY_TO_DB[f.priority])
  if (f.categoryId) query = query.eq('categoria_id', f.categoryId)
  if (f.sectorId) query = query.eq('setor_id', f.sectorId)
  if (f.assignee === 'unassigned') query = query.is('atendente_id', null)
  else if (f.assignee === 'me' && f.myPerfilId) query = query.eq('atendente_id', f.myPerfilId)
  else if (f.assignee && f.assignee !== 'all') query = query.eq('atendente_id', f.assignee)
  if (f.overdue) {
    query = query.lt('due_at', new Date().toISOString())
    if (!f.status) query = query.not('status', 'in', '(resolvido,fechado)')
  }
  if (f.q && f.q.trim()) {
    const term = f.q.trim().replace(/[%,()]/g, ' ')
    const digits = f.q.replace(/\D/g, '')
    const parts = [`titulo.ilike.%${term}%`, `descricao.ilike.%${term}%`]
    if (digits) parts.push(`numero.eq.${digits}`)
    query = query.or(parts.join(','))
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toTicket)
}

export async function getTicket(id: string): Promise<TicketDetail | null> {
  const [tRes, comRes, actRes, attRes, atendRes] = await Promise.all([
    supabase.from('ti_chamados').select(TICKET_SELECT).eq('id', id).maybeSingle(),
    supabase.from('ti_chamado_comentarios')
      .select('id, mensagem, interno, created_at, autor:sys_perfis!ti_chamado_comentarios_autor_id_fkey(id, nome, email)')
      .eq('chamado_id', id).order('created_at', { ascending: true }),
    supabase.from('ti_chamado_atividades')
      .select('id, tipo, meta, created_at, ator:sys_perfis!ti_chamado_atividades_ator_id_fkey(id, nome, email)')
      .eq('chamado_id', id).order('created_at', { ascending: true }),
    supabase.from('ti_chamado_anexos')
      .select('id, nome, mime, tamanho_bytes, created_at, storage_path, autor:sys_perfis!ti_chamado_anexos_autor_id_fkey(id, nome, email)')
      .eq('chamado_id', id).order('created_at', { ascending: true }),
    supabase.from('ti_atendentes').select('perfil_id'),
  ])
  if (tRes.error) throw tRes.error
  const t = tRes.data as Record<string, unknown> | null
  if (!t) return null

  const atendenteSet = new Set((atendRes.data ?? []).map((r: { perfil_id: string }) => r.perfil_id))
  const roleFor = (pid?: string): Role => (pid && atendenteSet.has(pid) ? 'AGENTE' : 'REQUERENTE')

  // Campos personalizados: defs da categoria × valores guardados em dados_personalizados
  const { data: defs } = await supabase
    .from('ti_campos_personalizados')
    .select('id, label, tipo')
    .eq('categoria_id', t.categoria_id as string)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
  const values = (t.dados_personalizados && typeof t.dados_personalizados === 'object'
    ? t.dados_personalizados
    : {}) as Record<string, unknown>
  const customFields: CustomFieldValue[] = (defs ?? []).map((d: { id: string; label: string; tipo: string }) => ({
    id: d.id, label: d.label, type: String(d.tipo ?? '').toUpperCase(),
    value: values[d.id] != null ? String(values[d.id]) : null,
  }))

  const anexos = (attRes.data ?? []) as Array<Record<string, unknown>>
  const urls = await signedUrls(anexos.map((a) => a.storage_path as string))
  const attachments = anexos.map((a, i) =>
    toAttachment(a, urls[i] ?? '', a.autor ? toTicketUser(a.autor, roleFor((a.autor as { id: string }).id)) : null))

  // supabase-js infere os embeds autor/ator como array (mesmo sendo to-one); em
  // runtime vêm como objeto. Tipamos o callback como any e o mapper lida com isso.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const comments = (comRes.data ?? []).map((c: any) =>
    toComment(c, toTicketUser(c.autor, roleFor(c.autor?.id))))
  const activities = (actRes.data ?? []).map((a: any) =>
    toActivity(a, a.ator ? toTicketUser(a.ator, roleFor(a.ator.id)) : null))
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { ...toTicket(t), comments, activities, attachments, customFields }
}

export interface CreateTicketInput {
  title: string
  description: string
  categoryId: string
  categoryName: string
  sectorId?: string | null
  assetId?: string | null
  priority: Priority
  customData?: Record<string, string>
  solicitanteId: string
}

export async function createTicket(input: CreateTicketInput): Promise<{ id: string; numero: number }> {
  const { data, error } = await supabase
    .from('ti_chamados')
    .insert({
      titulo: input.title,
      descricao: input.description,
      categoria_id: input.categoryId,
      categoria: input.categoryName, // coluna legada NOT NULL
      setor_id: input.sectorId || null,
      ativo_id: input.assetId || null,
      prioridade: PRIORITY_TO_DB[input.priority],
      dados_personalizados: input.customData && Object.keys(input.customData).length ? input.customData : null,
      solicitante_id: input.solicitanteId,
      canal: 'web',
    })
    .select('id, numero')
    .single()
  if (error) throw error
  return { id: data.id, numero: data.numero }
}

export interface TicketPatch {
  status?: Status
  priority?: Priority
  categoryId?: string
  categoryName?: string
  sectorId?: string | null
  assigneeId?: string | null
  assetId?: string | null
}

export async function patchTicket(id: string, patch: TicketPatch): Promise<void> {
  const db: Record<string, unknown> = {}
  if (patch.status) db.status = STATUS_TO_DB[patch.status]
  if (patch.priority) db.prioridade = PRIORITY_TO_DB[patch.priority]
  if (patch.categoryId) { db.categoria_id = patch.categoryId; if (patch.categoryName) db.categoria = patch.categoryName }
  if (patch.sectorId !== undefined) db.setor_id = patch.sectorId || null
  if (patch.assigneeId !== undefined) db.atendente_id = patch.assigneeId || null
  if (patch.assetId !== undefined) db.ativo_id = patch.assetId || null
  if (Object.keys(db).length === 0) return
  const { error } = await supabase.from('ti_chamados').update(db).eq('id', id)
  if (error) throw error
}

export async function addComment(input: { chamadoId: string; body: string; internal: boolean; autorId: string }): Promise<void> {
  const { error } = await supabase.from('ti_chamado_comentarios').insert({
    chamado_id: input.chamadoId,
    autor_id: input.autorId,
    mensagem: input.body,
    interno: input.internal,
  })
  if (error) throw error
}
