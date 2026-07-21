// Conversores linha ti_* (snake_case PT, status/prioridade minúsculos) → shapes EN
// que as telas consomem. Centraliza toda a tradução; as telas nunca veem o banco cru.
import { STATUS_FROM_DB, PRIORITY_FROM_DB, formatCode } from './enums'
import type {
  Ticket, TicketUser, NamedRef, Category, Sector, AssetMini, Asset,
  Comment, Activity, Attachment, Role,
} from './shapes'

/* eslint-disable @typescript-eslint/no-explicit-any */

export function toTicketUser(p: any, role: Role = 'REQUERENTE'): TicketUser {
  return { id: p?.id ?? '', name: p?.nome ?? '—', email: p?.email ?? '', role }
}

export function toNamedRef(r: any): NamedRef {
  return { id: r?.id ?? '', name: r?.nome ?? '—' }
}

export function toCategory(r: any): Category {
  return { id: r.id, name: r.nome, active: r.ativo, sortOrder: r.ordem ?? 0 }
}
export const toSector = toCategory as (r: any) => Sector

export function toAssetMini(a: any): AssetMini {
  return { id: a.id, tag: a.patrimonio ?? null, type: String(a.tipo ?? 'outro').toUpperCase(), model: a.modelo ?? null, holderName: a.responsavel_nome ?? null }
}

export function toAsset(a: any): Asset {
  return {
    ...toAssetMini(a),
    serial: a.serial ?? null,
    status: String(a.status ?? 'em_uso').toUpperCase(),
    holderName: a.responsavel_nome ?? null,
    holderCpf: a.responsavel_cpf ?? null,
    holderCargo: a.responsavel_cargo ?? null,
    holderEmail: a.responsavel_email ?? null,
    phoneLine: a.linha_telefone ?? null,
    previousUser: a.usuario_anterior ?? null,
    mdm: a.mdm ?? null,
    matriz: a.matriz ?? null,
    location: a.localizacao ?? null,
    notes: a.observacoes ?? null,
    active: a.ativo,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }
}

export function toComment(c: any, author: TicketUser): Comment {
  return { id: c.id, body: c.mensagem, isInternal: c.interno, createdAt: c.created_at, author }
}

const ACTIVITY_TYPE_FROM_DB: Record<string, string> = {
  criado: 'CRIADO', status: 'STATUS', prioridade: 'PRIORIDADE', categoria: 'CATEGORIA',
  setor: 'SETOR', atribuido: 'ATRIBUIDO', comentou: 'COMENTOU', anexou: 'ANEXOU',
  ativo: 'ATIVO', reaberto: 'REABERTO',
}

export function toActivity(a: any, actor: TicketUser | null): Activity {
  const meta = a.meta == null ? null : (typeof a.meta === 'string' ? a.meta : JSON.stringify(a.meta))
  return {
    id: a.id,
    type: ACTIVITY_TYPE_FROM_DB[a.tipo] ?? String(a.tipo).toUpperCase(),
    meta,
    createdAt: a.created_at,
    actor,
  }
}

export function toAttachment(a: any, url: string, uploadedBy: TicketUser | null): Attachment {
  return {
    id: a.id,
    originalName: a.nome,
    mimeType: a.mime ?? '',
    size: a.tamanho_bytes ?? 0,
    createdAt: a.created_at,
    uploadedBy,
    url,
  }
}

export function toTicket(row: any): Ticket {
  // Contato externo (ex.: WhatsApp de número não cadastrado): o solicitante real
  // fica em contato_externo; o solicitante_id aponta p/ uma conta de sistema.
  const ext = row.contato_externo && typeof row.contato_externo === 'object' ? row.contato_externo : null
  const baseRequester = toTicketUser(row.solicitante, 'REQUERENTE')
  const requester = ext?.nome ? { ...baseRequester, name: ext.nome } : baseRequester
  return {
    id: row.id,
    number: row.numero,
    code: formatCode(row.numero),
    title: row.titulo,
    description: row.descricao,
    status: STATUS_FROM_DB[row.status as keyof typeof STATUS_FROM_DB] ?? 'ABERTO',
    priority: PRIORITY_FROM_DB[row.prioridade as keyof typeof PRIORITY_FROM_DB] ?? 'MEDIA',
    dueAt: row.due_at ?? null,
    escalatedAt: row.escalated_at ?? null,
    channel: row.canal ?? 'web',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? null,
    closedAt: row.closed_at ?? null,
    category: row.cat ? toNamedRef(row.cat) : { id: row.categoria_id ?? '', name: row.categoria ?? '—' },
    sector: row.setor ? toNamedRef(row.setor) : null,
    requester,
    assignee: row.atendente ? toTicketUser(row.atendente, 'AGENTE') : null,
    asset: row.ativo ? toAssetMini(row.ativo) : null,
    externalContact: ext ? { name: ext.nome ?? '—', phone: ext.telefone ?? '' } : null,
  }
}
