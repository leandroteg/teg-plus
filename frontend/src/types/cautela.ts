// =============================================================================
// Cautela (Inventory Checkout) — Types
// =============================================================================

export type StatusCautela =
  | 'rascunho'
  | 'pendente_aprovacao'
  | 'aprovada'
  | 'em_separacao'
  | 'retirada'
  | 'parcial_devolvida'
  | 'devolvida'
  | 'vencida'
  | 'cancelada'

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
}> = [
  { status: 'rascunho',            label: 'Rascunho',       color: 'slate' },
  { status: 'pendente_aprovacao',  label: 'Pend. Aprovacao', color: 'amber' },
  { status: 'aprovada',            label: 'Aprovada',       color: 'blue' },
  { status: 'em_separacao',        label: 'Em Separacao',    color: 'violet' },
  { status: 'retirada',            label: 'Retirada',       color: 'teal' },
  { status: 'parcial_devolvida',   label: 'Parcial',        color: 'orange' },
  { status: 'devolvida',           label: 'Devolvida',      color: 'emerald' },
  { status: 'vencida',             label: 'Vencida',        color: 'red' },
  { status: 'cancelada',           label: 'Cancelada',      color: 'slate' },
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
