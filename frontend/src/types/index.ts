export type StatusRequisicao =
  | 'rascunho' | 'pendente' | 'em_aprovacao'
  | 'aprovada' | 'rejeitada' | 'em_cotacao'
  | 'comprada' | 'cancelada'

export type Urgencia = 'normal' | 'urgente' | 'critica'

export type StatusCotacao = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'

export interface Obra {
  id: string
  codigo: string
  nome: string
  municipio: string
}

export interface CategoriaMaterial {
  id: string
  codigo: string
  nome: string
  keywords: string[]
  cor: string
  icone: string
}

export interface Comprador {
  id: string
  nome: string
  email: string
  telefone?: string
  categorias: string[]
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
  categoria?: string
  comprador_nome?: string
  texto_original?: string
  ai_confianca?: number
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

export interface AprovacaoPendente extends Aprovacao {
  requisicao: Requisicao
  cotacao_resumo?: {
    fornecedor_nome: string
    valor: number
    prazo_dias: number
    total_cotados: number
  }
}

export interface CotacaoFornecedor {
  id: string
  cotacao_id: string
  fornecedor_nome: string
  fornecedor_contato?: string
  fornecedor_cnpj?: string
  valor_total: number
  prazo_entrega_dias?: number
  condicao_pagamento?: string
  itens_precos: { descricao: string; qtd: number; valor_unitario: number; valor_total: number }[]
  observacao?: string
  arquivo_url?: string
  selecionado: boolean
}

export interface Cotacao {
  id: string
  requisicao_id: string
  comprador_id: string
  comprador_nome?: string
  status: StatusCotacao
  valor_selecionado?: number
  fornecedor_selecionado_nome?: string
  observacao?: string
  data_limite?: string
  data_conclusao?: string
  created_at: string
  requisicao?: Requisicao
  fornecedores?: CotacaoFornecedor[]
}

export interface AiParseResult {
  itens: RequisicaoItem[]
  obra_sugerida?: string
  urgencia_sugerida?: Urgencia
  categoria_sugerida?: string
  comprador_sugerido?: { id: string; nome: string }
  justificativa_sugerida?: string
  confianca: number
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
  texto_original?: string
  comprador_id?: string
  ai_confianca?: number
}

export interface NovaCotacaoPayload {
  cotacao_id: string
  fornecedores: {
    fornecedor_nome: string
    fornecedor_contato?: string
    fornecedor_cnpj?: string
    valor_total: number
    prazo_entrega_dias?: number
    condicao_pagamento?: string
    itens_precos: { descricao: string; qtd: number; valor_unitario: number; valor_total: number }[]
    observacao?: string
  }[]
}
