export type StatusRequisicao =
  | 'rascunho' | 'pendente' | 'em_aprovacao'
  | 'aprovada' | 'rejeitada' | 'em_esclarecimento'
  | 'em_cotacao' | 'cotacao_enviada' | 'cotacao_aprovada' | 'cotacao_rejeitada'
  | 'pedido_emitido' | 'em_entrega' | 'entregue'
  | 'aguardando_pgto' | 'pago'
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
  // Dados reais (007_fluxo_real.sql)
  comprador_nome?: string
  alcada1_aprovador?: string
  alcada1_limite?: number
  cotacoes_regras?: { ate_500: number; '501_a_2k': number; acima_2k: number }
  politica_resumo?: string
}

export interface Pedido {
  id: string
  requisicao_id?: string
  cotacao_id?: string
  comprador_id?: string
  numero_pedido?: string
  fornecedor_nome: string
  valor_total?: number
  status: 'emitido' | 'confirmado' | 'em_entrega' | 'parcialmente_recebido' | 'entregue' | 'cancelado'
  data_pedido?: string
  data_prevista_entrega?: string
  data_entrega_real?: string
  nf_numero?: string
  observacoes?: string
  created_at: string
  // Recebimento tracking
  qtd_itens_total?: number
  qtd_itens_recebidos?: number
  // Payment flow fields
  status_pagamento?: 'liberado' | 'pago' | null
  liberado_pagamento_em?: string
  liberado_pagamento_por?: string
  pago_em?: string
  // Joins
  requisicao?: Pick<Requisicao, 'numero' | 'descricao' | 'obra_nome' | 'categoria'>
  comprador?: Pick<Comprador, 'nome'>
}

export interface Comprador {
  id: string
  nome: string
  email: string
  telefone?: string
  categorias: string[]
}

export interface RequisicaoItem {
  id?: string
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
  esclarecimento_msg?: string
  esclarecimento_por?: string
  esclarecimento_em?: string
}

export interface Aprovacao {
  id: string
  requisicao_id: string
  aprovador_nome: string
  aprovador_email: string
  nivel: number
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'expirada' | 'esclarecimento'
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
  fornecedor_selecionado_id?: string
  fornecedor_selecionado_nome?: string
  observacao?: string
  data_limite?: string
  data_conclusao?: string
  sem_cotacoes_minimas?: boolean
  justificativa_sem_cotacoes?: string
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
