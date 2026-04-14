// =============================================================================
// Cautela (Inventory Checkout) — Types
// =============================================================================

export type StatusCautela =
  | 'pendente'
  | 'aprovada'
  | 'em_aberto'
  | 'em_devolucao'
  | 'encerrada'

export type UrgenciaCautela = 'normal' | 'urgente' | 'emergencia'

export type CondicaoItem = 'novo' | 'bom' | 'usado' | 'danificado'

// ── Main cautela record ─────────────────────────────────────────────────────
export interface Cautela {
  id: string
  numero: string
  solicitante_id?: string
  solicitante_nome?: string
  obra_id?: string
  obra_nome?: string
  base_id?: string
  centro_custo?: string
  status: StatusCautela
  urgencia: UrgenciaCautela
  data_retirada?: string
  data_devolucao_prevista?: string
  data_devolucao_real?: string
  aprovador_id?: string
  aprovador_nome?: string
  aprovado_em?: string
  motivo_rejeicao?: string
  assinatura_retirada_url?: string
  assinatura_devolucao_url?: string
  foto_retirada_url?: string[]
  foto_devolucao_url?: string[]
  termo_url?: string
  observacao?: string
  criado_em: string
  atualizado_em: string
  // joined
  itens?: CautelaItem[]
}

// ── Cautela item ────────────────────────────────────────────────────────────
export interface CautelaItem {
  id: string
  cautela_id: string
  item_id?: string
  descricao_livre?: string
  quantidade: number
  quantidade_devolvida: number
  condicao_retirada?: string
  condicao_devolucao?: string
  observacao?: string
  criado_em: string
  // joined
  item?: {
    codigo: string
    descricao: string
    unidade: string
  }
}

// ── Favoritos ───────────────────────────────────────────────────────────────
export interface CautelaFavorito {
  id: string
  usuario_id: string
  item_id: string
  frequencia: number
  ultimo_uso: string
  // joined
  item?: {
    codigo: string
    descricao: string
    unidade: string
  }
}

// ── Templates ───────────────────────────────────────────────────────────────
export interface CautelaTemplate {
  id: string
  nome: string
  descricao?: string
  itens: Array<{
    item_id?: string
    descricao: string
    quantidade: number
    unidade?: string
  }>
  ativo: boolean
  criado_por?: string
  criado_em: string
}

// ── Pipeline stages ─────────────────────────────────────────────────────────
export const CAUTELA_PIPELINE_STAGES: Array<{
  status: StatusCautela
  label: string
  color: string
  bgClass: string
  textClass: string
  dotClass: string
  badgeClass: string
  borderClass: string
}> = [
  { status: 'pendente',      label: 'Pendente',       color: 'amber',   bgClass: 'bg-amber-50',   textClass: 'text-amber-700',   dotClass: 'bg-amber-500',   badgeClass: 'bg-amber-100 text-amber-700',   borderClass: 'border-amber-200' },
  { status: 'aprovada',      label: 'Aprovada',       color: 'blue',    bgClass: 'bg-blue-50',    textClass: 'text-blue-700',    dotClass: 'bg-blue-500',    badgeClass: 'bg-blue-100 text-blue-700',     borderClass: 'border-blue-200' },
  { status: 'em_aberto',     label: 'Em Aberto',      color: 'teal',    bgClass: 'bg-teal-50',    textClass: 'text-teal-700',    dotClass: 'bg-teal-500',    badgeClass: 'bg-teal-100 text-teal-700',     borderClass: 'border-teal-200' },
  { status: 'em_devolucao',  label: 'Em Devolução',   color: 'violet',  bgClass: 'bg-violet-50',  textClass: 'text-violet-700',  dotClass: 'bg-violet-500',  badgeClass: 'bg-violet-100 text-violet-700', borderClass: 'border-violet-200' },
  { status: 'encerrada',     label: 'Encerrada',      color: 'slate',   bgClass: 'bg-slate-100',  textClass: 'text-slate-600',   dotClass: 'bg-slate-400',   badgeClass: 'bg-slate-200 text-slate-600',   borderClass: 'border-slate-300' },
]

// ── Payload for creating cautela ────────────────────────────────────────────
export interface NovaCautelaPayload {
  solicitante_id?: string
  solicitante_nome?: string
  obra_id?: string
  obra_nome?: string
  base_id?: string
  centro_custo?: string
  urgencia?: UrgenciaCautela
  data_devolucao_prevista?: string
  observacao?: string
  itens: Array<{
    item_id?: string
    descricao_livre?: string
    quantidade: number
    condicao_retirada?: string
  }>
}

// ── KPIs ────────────────────────────────────────────────────────────────────
export interface CautelaKPIs {
  itens_comigo: number
  vencidas: number
  devolver_hoje: number
}
