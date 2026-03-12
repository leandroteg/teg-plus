// ── Financeiro Types ─────────────────────────────────────────────────────────

export type StatusCP =
  | 'previsto' | 'confirmado' | 'em_lote'
  | 'aprovado_pgto' | 'em_pagamento'
  | 'pago' | 'conciliado' | 'cancelado'

// Pipeline stages in order (for Kanban columns)
export const CP_PIPELINE_STAGES: { status: StatusCP; label: string; color: string; borderColor: string }[] = [
  { status: 'previsto',       label: 'Previstos',           color: 'slate',   borderColor: 'border-t-slate-400' },
  { status: 'confirmado',     label: 'Confirmados',         color: 'blue',    borderColor: 'border-t-blue-500' },
  { status: 'em_lote',        label: 'Lote de Pagamento',   color: 'violet',  borderColor: 'border-t-violet-500' },
  { status: 'aprovado_pgto',  label: 'Aprovados',           color: 'emerald', borderColor: 'border-t-emerald-500' },
  { status: 'em_pagamento',   label: 'Painel de Pagamento', color: 'amber',   borderColor: 'border-t-amber-500' },
  { status: 'pago',           label: 'Realizados',          color: 'teal',    borderColor: 'border-t-teal-500' },
  { status: 'conciliado',     label: 'Conciliados',         color: 'green',   borderColor: 'border-t-green-500' },
]

export type StatusCR =
  | 'previsto' | 'autorizado' | 'faturamento' | 'nf_emitida'
  | 'aguardando' | 'recebido' | 'conciliado' | 'cancelado'

// Pipeline stages in order (for CR Kanban columns)
export const CR_PIPELINE_STAGES: { status: StatusCR; label: string; color: string; borderColor: string }[] = [
  { status: 'previsto',     label: 'Previstos',     color: 'slate',   borderColor: 'border-t-slate-400' },
  { status: 'autorizado',   label: 'Autorizados',   color: 'blue',    borderColor: 'border-t-blue-500' },
  { status: 'faturamento',  label: 'Faturamento',   color: 'violet',  borderColor: 'border-t-violet-500' },
  { status: 'nf_emitida',   label: 'NF Emitida',    color: 'amber',   borderColor: 'border-t-amber-500' },
  { status: 'aguardando',   label: 'Aguardando',    color: 'orange',  borderColor: 'border-t-orange-500' },
  { status: 'recebido',     label: 'Recebidos',     color: 'teal',    borderColor: 'border-t-teal-500' },
  { status: 'conciliado',   label: 'Conciliados',   color: 'green',   borderColor: 'border-t-green-500' },
]

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
  lote_id?: string
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
  serie_nf?: string
  chave_nfe?: string
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
  autorizado_por?: string
  autorizado_em?: string
  danfe_url?: string
  xml_url?: string
  email_compartilhado_em?: string
  email_compartilhado_para?: string
  descricao?: string
  observacoes?: string
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

// ── Lotes de Pagamento ──────────────────────────────────────────────────────

export type StatusLote =
  | 'montando' | 'enviado_aprovacao' | 'parcialmente_aprovado'
  | 'aprovado' | 'em_pagamento' | 'pago' | 'cancelado'

export type DecisaoLoteItem = 'pendente' | 'aprovado' | 'rejeitado'

export interface LotePagamento {
  id: string
  numero_lote: string
  criado_por: string
  criado_por_id?: string
  valor_total: number
  qtd_itens: number
  status: StatusLote
  observacao?: string
  created_at: string
  updated_at: string
  itens?: LoteItem[]
}

export interface LoteItem {
  id: string
  lote_id: string
  cp_id: string
  valor: number
  decisao: DecisaoLoteItem
  decidido_por?: string
  decidido_em?: string
  observacao?: string
  created_at: string
  cp?: ContaPagar
}
