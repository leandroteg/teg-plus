export type StatusRequisicao =
  | 'rascunho' | 'pendente' | 'em_aprovacao'
  | 'aprovada' | 'rejeitada' | 'em_cotacao'
  | 'comprada' | 'cancelada'

export type Urgencia = 'normal' | 'urgente' | 'critica'

export interface Obra {
  id: string
  codigo: string
  nome: string
  municipio: string
}

export interface RequisicaoItem {
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario_estimado: number
}

export interface Requisicao {
  id: string
  numero: string
  solicitante_nome: string
  obra_nome: string
  obra_id?: string
  descricao: string
  justificativa?: string
  valor_estimado: number
  urgencia: Urgencia
  status: StatusRequisicao
  alcada_nivel: number
  created_at: string
}

export interface Aprovacao {
  id: string
  requisicao_id: string
  aprovador_nome: string
  aprovador_email: string
  nivel: number
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'expirada'
  observacao?: string
  token: string
  data_limite?: string
}

export interface KPIs {
  total_mes: number
  aguardando_aprovacao: number
  aprovadas_mes: number
  rejeitadas_mes: number
  valor_total_mes: number
  tempo_medio_aprovacao_horas: number
}

export interface DashboardData {
  kpis: KPIs
  por_status: { status: string; total: number; valor: number }[]
  por_obra: { obra_nome: string; total: number; valor: number; pendentes: number }[]
  requisicoes_recentes: Requisicao[]
  aprovacoes_pendentes?: Aprovacao[]
}

export interface NovaRequisicaoPayload {
  solicitante_nome: string
  obra_nome: string
  obra_id?: string
  descricao: string
  justificativa?: string
  categoria?: string
  urgencia: Urgencia
  data_necessidade?: string
  itens: RequisicaoItem[]
}
