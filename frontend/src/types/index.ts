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
  fornecedor_id?: string
  classe_financeira_id?: string
  centro_custo_id?: string
  numero_pedido?: string
  fornecedor_nome: string
  valor_total?: number
  status: 'emitido' | 'confirmado' | 'em_entrega' | 'parcialmente_recebido' | 'entregue' | 'cancelado'
  data_pedido?: string
  data_prevista_entrega?: string
  data_entrega_real?: string
  nf_numero?: string
  observacoes?: string
  centro_custo?: string
  classe_financeira?: string
  condicao_pagamento?: string
  parcelas_preview?: Array<{ numero: number; valor: number; data_vencimento: string; descricao?: string }>
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
  requisicao?: Pick<Requisicao, 'numero' | 'descricao' | 'obra_nome' | 'categoria'> & {
    itens?: Pick<RequisicaoItem, 'descricao' | 'quantidade' | 'unidade' | 'valor_unitario_estimado'>[]
  }
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
  est_item_id?: string
  est_item_codigo?: string
  classe_financeira_id?: string
  classe_financeira_codigo?: string
  classe_financeira_descricao?: string
  categoria_financeira_codigo?: string
  categoria_financeira_descricao?: string
  destino_operacional?: 'estoque' | 'patrimonio' | 'nenhum'
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
  centro_custo?: string
  centro_custo_id?: string
  classe_financeira?: string
  classe_financeira_id?: string
  texto_original?: string
  ai_confianca?: number
  arquivo_url?: string
  created_at: string
  justificativa_urgencia?: string
  esclarecimento_msg?: string
  esclarecimento_por?: string
  esclarecimento_em?: string
}

export type TipoAprovacao = 'requisicao_compra' | 'cotacao' | 'autorizacao_pagamento' | 'minuta_contratual' | 'aprovacao_transporte'

export interface Aprovacao {
  id: string
  requisicao_id: string
  entidade_id: string
  entidade_numero?: string
  modulo: string
  tipo_aprovacao: TipoAprovacao
  aprovador_nome: string
  aprovador_email: string
  nivel: number
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'expirada' | 'esclarecimento'
  observacao?: string
  token: string
  data_limite?: string
  data_decisao?: string
  created_at: string
}

export interface AprovacaoPendente extends Aprovacao {
  requisicao: Requisicao
  cotacao_resumo?: {
    fornecedor_nome: string
    valor: number
    prazo_dias: number
    total_cotados: number
  }
  minuta_resumo?: {
    objeto: string
    contraparte: string
    tipo_contrato: string
    vigencia_inicio: string
    vigencia_fim: string
    valor_estimado: number
    minuta_titulo: string
    arquivo_url: string
    arquivo_nome: string
    ai_resumo: string | null
    ai_score: number | null
  }
  pagamento_detalhes?: {
    is_lote?: boolean
    lote_numero?: string
    lote_data?: string
    qtd_itens?: number
    aprovados?: number
    excluidos?: number
    resumo_fornecedores?: string
    fornecedor_nome: string
    valor_original: number
    valor_pago: number
    numero_documento: string
    descricao: string
    data_vencimento: string
    data_emissao: string
    centro_custo: string
    classe_financeira: string
    natureza: string
    forma_pagamento: string
    status_cp: string
    itens?: {
      id: string
      fornecedor_nome: string
      numero_documento: string
      descricao: string
      valor_original: number
      data_vencimento: string
      decisao?: string
      requisicao_numero?: string
      requisicao_descricao?: string
      requisicao_justificativa?: string
      solicitante_nome?: string
      anexos?: { nome: string, url: string, tipo: string, mime_type?: string }[]
    }[]
  }
  transporte_detalhes?: {
    origem: string
    destino: string
    tipo: string
    data_desejada?: string
    modal?: string
    motorista_nome?: string
    motorista_telefone?: string
    veiculo_placa?: string
    custo_estimado?: number
    descricao?: string
    solicitante_nome?: string
    obra_nome?: string
    centro_custo?: string
    oc_numero?: string
    urgente?: boolean
    justificativa_urgencia?: string
    peso_total_kg?: number
    volumes_total?: number
    carga_especial?: boolean
    observacoes_carga?: string
    restricoes_seguranca?: string
    // Campos de viagem (consolidada)
    is_viagem?: boolean
    viagem_numero?: string
    qtd_paradas?: number
    distancia_total_km?: number
    tempo_estimado_h?: number
    solicitacoes?: Record<string, unknown>[]
  }
}

export interface AprovacaoHistorico {
  id: string
  modulo: string
  tipo_aprovacao: TipoAprovacao
  entidade_id: string
  entidade_numero?: string
  aprovador_nome: string
  aprovador_email: string
  nivel: number
  status: 'aprovada' | 'rejeitada' | 'expirada' | 'esclarecimento'
  observacao?: string
  data_decisao?: string
  created_at: string
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
  justificativa_urgencia?: string
  data_necessidade?: string
  itens: RequisicaoItem[]
  texto_original?: string
  comprador_id?: string
  ai_confianca?: number
  arquivo_referencia?: File
  rascunho?: boolean
  compra_recorrente?: boolean
  valor_mensal?: number
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
