// ── Financeiro Types ─────────────────────────────────────────────────────────

export type StatusCP =
  | 'previsto' | 'confirmado' | 'em_lote'
  | 'aprovado_pgto' | 'em_pagamento'
  | 'pago' | 'conciliado' | 'cancelado'

export type RemessaCPStatus =
  | 'nao_enviada'
  | 'enviada'
  | 'processando'
  | 'confirmada'
  | 'confirmada_manual'
  | 'erro'

// Pipeline stages in order (for Kanban columns)
export const CP_PIPELINE_STAGES: { status: StatusCP; label: string; color: string; borderColor: string }[] = [
  { status: 'previsto',       label: 'Previstos',           color: 'slate',   borderColor: 'border-t-slate-400' },
  { status: 'confirmado',     label: 'Confirmados',         color: 'blue',    borderColor: 'border-t-blue-500' },
  { status: 'em_lote',        label: 'Lote de Pagamento',   color: 'violet',  borderColor: 'border-t-violet-500' },
  { status: 'aprovado_pgto',  label: 'Aprovados',           color: 'emerald', borderColor: 'border-t-emerald-500' },
  { status: 'em_pagamento',   label: 'Painel de Pagamento', color: 'amber',   borderColor: 'border-t-amber-500' },
  { status: 'pago',           label: 'Realizados',          color: 'teal',    borderColor: 'border-t-teal-500' },
  { status: 'conciliado',     label: 'Conciliados',         color: 'green',   borderColor: 'border-t-green-500' },
  { status: 'cancelado',      label: 'Cancelados',          color: 'rose',    borderColor: 'border-t-rose-500' },
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

export type OrigemCP = 'compras' | 'logistica' | 'manual'

export interface ContaPagar {
  id: string
  pedido_id?: string
  requisicao_id?: string
  solicitacao_logistica_id?: string
  fornecedor_id?: string
  fornecedor_nome: string
  origem?: OrigemCP
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
  remessa_status?: RemessaCPStatus
  remessa_id?: string
  remessa_enviada_em?: string
  remessa_retorno_em?: string
  remessa_sync_em?: string
  remessa_payload?: Record<string, unknown> | null
  remessa_retorno?: Record<string, unknown> | null
  remessa_erro?: string
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

// ── Cartões de Crédito ───────────────────────────────────────────────────────

export type BandeiraCartao = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outro'

export type StatusApontamentoCartao = 'rascunho' | 'enviado' | 'conciliado' | 'rejeitado'

export type StatusFaturaCartao = 'processando' | 'disponivel' | 'paga' | 'erro'

export interface CartaoCredito {
  id: string
  nome: string
  bandeira: BandeiraCartao
  ultimos4?: string
  limite?: number
  ativo: boolean
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface PortadorCartao {
  id: string
  cartao_id: string
  user_id: string
  nome: string
  ativo: boolean
  created_at: string
}

export interface ApontamentoCartao {
  id: string
  numero?: number
  cartao_id: string
  portador_id?: string
  user_id: string
  data_lancamento: string
  descricao: string
  estabelecimento?: string
  valor: number
  centro_custo?: string
  classe_financeira?: string
  projeto_id?: string
  comprovante_url?: string
  comprovante_nome?: string
  status: StatusApontamentoCartao
  item_fatura_id?: string
  observacoes?: string
  created_at: string
  updated_at: string
  // Joins
  cartao?: CartaoCredito
}

export interface FaturaCartao {
  id: string
  cartao_id: string
  mes_referencia: string   // "2026-03"
  data_vencimento?: string
  valor_total?: number
  arquivo_url?: string
  arquivo_nome?: string
  status: StatusFaturaCartao
  processado_em?: string
  erro_msg?: string
  created_at: string
  // Joins
  cartao?: CartaoCredito
  itens?: ItemFaturaCartao[]
}

export interface ItemFaturaCartao {
  id: string
  fatura_id: string
  cartao_id: string
  data_lancamento: string
  descricao: string
  valor: number
  categoria_banco?: string
  conciliado: boolean
  apontamento_id?: string
  created_at: string
  // Joins
  apontamento?: ApontamentoCartao
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
  aprovador_nome?: string
  aprovacao_status?: string
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

// ── Tesouraria ────────────────────────────────────────────
export interface ContaBancaria {
  id: string
  nome: string
  banco_codigo?: string
  banco_nome?: string
  agencia?: string
  conta?: string
  tipo: 'corrente' | 'poupanca' | 'investimento'
  saldo_atual: number
  saldo_atualizado_em?: string
  cor: string
  ativo: boolean
}

export interface MovimentacaoTesouraria {
  id: string
  conta_id: string
  conta_destino_id?: string
  tipo: 'entrada' | 'saida' | 'transferencia'
  valor: number
  data_movimentacao: string
  data_competencia?: string
  descricao?: string
  categoria: string
  cp_id?: string
  cr_id?: string
  conciliado: boolean
  conciliado_em?: string
  origem: 'manual' | 'import_ofx' | 'import_csv' | 'auto_cp' | 'auto_cr'
  conta_nome?: string
  conta_cor?: string
  conta_destino_nome?: string
  conta_destino_cor?: string
  created_at?: string
  criado_em?: string
}

export interface ExtratoImport {
  id: string
  conta_id: string
  arquivo_url?: string
  nome_arquivo?: string
  formato: 'ofx' | 'csv'
  periodo_inicio?: string
  periodo_fim?: string
  total_registros: number
  importados: number
  duplicados: number
  status: 'processando' | 'concluido' | 'erro'
}

export interface TesourariaDashboardData {
  saldo_total: number
  saldo_inicial_periodo: number
  saldo_final_periodo: number
  entradas_periodo: number
  saidas_periodo: number
  entradas_periodo_anterior: number
  saidas_periodo_anterior: number
  contas: ContaBancaria[]
  movimentacoes_recentes: MovimentacaoTesouraria[]
  fluxo_diario: Array<{ data: string; entradas: number; saidas: number }>
  previsao_cp: number
  previsao_cr: number
  aging_cp: { hoje: number; d7: number; d30: number; d60: number }
  aging_cr: { hoje: number; d7: number; d30: number; d60: number }
  comparativos: {
    entradas_percentual: number
    saidas_percentual: number
  }
  indicadores: {
    saldo_disponivel: number
    saldo_projetado_30d: number
    queima_media_diaria: number
    cobertura_dias: number | null
  }
  alertas: Array<{
    id: string
    tipo: 'critico' | 'alto' | 'medio' | 'baixo'
    titulo: string
    descricao: string
  }>
}

export type CategoriaMovimentacao =
  | 'pagamento_fornecedor' | 'recebimento_cliente' | 'transferencia'
  | 'taxa_bancaria' | 'rendimento' | 'imposto' | 'folha' | 'outros'
