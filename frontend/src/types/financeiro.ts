// ── Financeiro Types ─────────────────────────────────────────────────────────

export type StatusCP =
  | 'previsto' | 'aprovado' | 'aguardando_docs'
  | 'aguardando_aprovacao' | 'aprovado_pgto'
  | 'em_remessa' | 'pago' | 'conciliado' | 'cancelado'

export type StatusCR =
  | 'previsto' | 'faturado' | 'parcial'
  | 'recebido' | 'conciliado' | 'vencido' | 'cancelado'

export type TipoDocumento =
  | 'ordem_compra' | 'contrato' | 'boleto' | 'fatura'
  | 'nota_fiscal' | 'recibo' | 'comprovante'
  | 'relatorio_pagamento' | 'extrato_bancario' | 'outro'

export interface Fornecedor {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  telefone?: string
  email?: string
  contato_nome?: string
  banco_nome?: string
  agencia?: string
  conta?: string
  pix_chave?: string
  pix_tipo?: string
  omie_id?: number
  ativo: boolean
  created_at: string
}

export interface ContaPagar {
  id: string
  pedido_id?: string
  requisicao_id?: string
  fornecedor_id?: string
  fornecedor_nome: string
  valor_original: number
  valor_pago: number
  data_emissao: string
  data_vencimento: string
  data_vencimento_orig: string
  data_pagamento?: string
  centro_custo?: string
  classe_financeira?: string
  projeto_id?: string
  natureza?: string
  forma_pagamento?: string
  numero_documento?: string
  status: StatusCP
  aprovado_por?: string
  aprovado_em?: string
  omie_cp_id?: number
  descricao?: string
  observacoes?: string
  created_at: string
  // Joined data from cmp_pedidos
  pedido?: {
    numero_pedido: string
    status: string
    data_pedido: string
    data_prevista_entrega?: string
    status_pagamento?: string
  } | null
  // Joined data from cmp_requisicoes
  requisicao?: {
    numero: string
    descricao: string
    obra_nome?: string
    categoria?: string
    centro_custo?: string
    classe_financeira?: string
    projeto_id?: string
  } | null
}

export interface ContaReceber {
  id: string
  cliente_nome: string
  cliente_cnpj?: string
  numero_nf?: string
  valor_original: number
  valor_recebido: number
  data_emissao: string
  data_vencimento: string
  data_recebimento?: string
  centro_custo?: string
  classe_financeira?: string
  projeto_id?: string
  natureza?: string
  status: StatusCR
  descricao?: string
  created_at: string
}

export interface DocumentoFinanceiro {
  id: string
  entity_type: 'cp' | 'cr' | 'pedido'
  entity_id: string
  tipo: TipoDocumento
  nome_arquivo: string
  arquivo_url: string
  uploaded_at: string
  observacao?: string
}

export interface FinanceiroKPIs {
  total_cp: number
  cp_a_vencer: number
  cp_vencidas: number
  cp_pagas_periodo: number
  valor_total_aberto: number
  valor_pago_periodo: number
  valor_a_vencer_7d: number
  aguardando_aprovacao: number
  total_cr: number
  valor_cr_aberto: number
}

export interface FinanceiroDashboardData {
  kpis: FinanceiroKPIs
  por_status: { status: string; total: number; valor: number }[]
  por_centro_custo: { centro_custo: string; total: number; valor: number; pago: number }[]
  vencimentos_proximos: ContaPagar[]
  recentes: ContaPagar[]
}
