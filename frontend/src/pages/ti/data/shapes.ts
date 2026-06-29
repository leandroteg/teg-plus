// Shapes "EN" que as telas portadas do helpdesk consomem (camelCase).
// A camada de dados (data/*.ts) converte as linhas das tabelas ti_* (snake_case PT)
// para estes tipos via data/mappers.ts. Mantê-los iguais ao helpdesk minimiza a
// reescrita das telas.
export type Status = 'ABERTO' | 'EM_ANDAMENTO' | 'AGUARDANDO' | 'RESOLVIDO' | 'FECHADO'
export type Priority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'
export type Role = 'REQUERENTE' | 'AGENTE' | 'ADMIN'

export interface TicketUser {
  id: string
  name: string
  email: string
  role: Role
}

/** Usuário do TEG+ (sys_perfis) para a tela de gestão de Usuários do /ti. */
export interface ManagedUser {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: string
}

export interface NamedRef {
  id: string
  name: string
}

export interface Category {
  id: string
  name: string
  active: boolean
  sortOrder: number
}
export type Sector = Category

export interface AssetMini {
  id: string
  tag: string | null
  type: string
  model: string | null
  holderName?: string | null
}

export interface Attachment {
  id: string
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  uploadedBy: TicketUser | null
  /** signed URL do Storage (bucket ti-chamados) — gerado na camada de dados */
  url: string
}

export interface Comment {
  id: string
  body: string
  isInternal: boolean
  createdAt: string
  author: TicketUser
}

export interface Activity {
  id: string
  type: string
  meta: string | null
  createdAt: string
  actor: TicketUser | null
}

export interface Ticket {
  id: string
  number: number
  code: string
  title: string
  description: string
  status: Status
  priority: Priority
  dueAt: string | null
  escalatedAt: string | null
  channel: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
  category: NamedRef
  sector: NamedRef | null
  requester: TicketUser
  assignee: TicketUser | null
  asset: AssetMini | null
  /** Preenchido quando o chamado veio de um contato externo (ex.: WhatsApp não cadastrado). */
  externalContact?: { name: string; phone: string } | null
  _count?: { comments: number; attachments: number }
}

export interface CustomFieldValue {
  id: string
  label: string
  type: string
  value: string | null
}

export interface TicketDetail extends Ticket {
  comments: Comment[]
  activities: Activity[]
  attachments: Attachment[]
  customFields?: CustomFieldValue[]
}

export interface Stats {
  byStatus: Record<Status, number>
  total: number
  abertos: number
  emAndamento: number
  aguardando: number
  resolvidos: number
  fechados: number
  urgentes: number
  atrasados: number
  naoAtribuidos: number
}

export interface CannedResponse {
  id: string
  title: string
  body: string
  active: boolean
  sortOrder: number
  createdAt: string
}

export interface CustomField {
  id: string
  categoryId?: string
  label: string
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'DATE'
  options: string[] | null
  required: boolean
  sortOrder: number
  active: boolean
}

export type AssetType = 'CELULAR' | 'COMPUTADOR' | 'MONITOR' | 'OUTRO'
export type AssetStatus = 'EM_USO' | 'ESTOQUE' | 'MANUTENCAO' | 'AGUARDANDO' | 'BAIXADO'

export interface Asset extends AssetMini {
  serial: string | null
  status: string
  holderName: string | null
  holderCpf: string | null
  holderCargo: string | null
  holderEmail: string | null
  phoneLine: string | null
  previousUser: string | null
  mdm: string | null
  matriz: string | null
  location: string | null
  notes: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AssetDetail extends Asset {
  tickets: { id: string; number: number; code: string; title: string; status: Status; priority: Priority; createdAt: string }[]
}

export interface DeliveryTermAsset {
  type?: string | null
  model?: string | null
  tag?: string | null
  serial?: string | null
}

export interface DeliveryTerm {
  id: string
  type: 'ENTREGA' | 'DEVOLUCAO'
  collaboratorName: string
  cpf: string | null
  funcao: string | null
  assets: DeliveryTermAsset[]
  notes: string | null
  createdByName: string | null
  createdAt: string
}

export interface TermTemplates {
  entrega: string
  devolucao: string
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  ticketId: string | null
  read: boolean
  createdAt: string
}

export interface ArticleListItem {
  id: string
  title: string
  published: boolean
  createdAt: string
  updatedAt: string
  author: NamedRef
}

export interface Article extends ArticleListItem {
  content: string
}
