// ── Contratos Types ──────────────────────────────────────────────────────────

export type TipoContrato = 'receita' | 'despesa'

export type StatusContrato =
  | 'em_negociacao' | 'assinado' | 'vigente'
  | 'suspenso' | 'encerrado' | 'rescindido'

export type RecorrenciaContrato =
  | 'mensal' | 'bimestral' | 'trimestral'
  | 'semestral' | 'anual' | 'personalizado'

export type StatusParcela =
  | 'previsto' | 'pendente' | 'liberado' | 'pago' | 'cancelado'

export type TipoAnexoParcela =
  | 'nota_fiscal' | 'medicao' | 'recibo' | 'comprovante' | 'outro'

export interface ContratoCliente {
  id: string
  nome: string
  cnpj?: string
  tipo: 'publico' | 'privado' | 'governo'
  ativo: boolean
}

export interface ContratoItem {
  id: string
  contrato_id: string
  codigo?: string
  descricao: string
  unidade?: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  created_at: string
}

export interface Contrato {
  id: string
  numero: string
  // Tipo
  tipo_contrato: TipoContrato
  // Partes
  cliente_id: string
  fornecedor_id?: string
  obra_id?: string
  // Escopo
  objeto: string
  descricao?: string
  // Valores
  valor_total: number
  valor_aditivos: number
  valor_glosado: number
  valor_medido: number
  valor_a_medir: number
  // Datas
  data_assinatura?: string
  data_inicio: string
  data_fim_previsto: string
  data_fim_real?: string
  // Recorrência
  recorrencia: RecorrenciaContrato
  dia_vencimento?: number
  parcelas_geradas: boolean
  // Classificação
  centro_custo?: string
  classe_financeira?: string
  // Reajuste
  indice_reajuste?: string
  // Garantia
  garantia_tipo?: string
  garantia_valor?: number
  garantia_vencimento?: string
  // Status
  status: StatusContrato
  // Arquivo
  arquivo_url?: string
  // Audit
  created_at: string
  updated_at: string
  // Joins
  cliente?: ContratoCliente
  fornecedor?: {
    id: string
    razao_social: string
    nome_fantasia?: string
    cnpj?: string
  }
  obra?: {
    id: string
    codigo: string
    nome: string
  }
  itens?: ContratoItem[]
}

export interface Parcela {
  id: string
  contrato_id: string
  numero: number
  valor: number
  data_vencimento: string
  status: StatusParcela
  // Liberação
  liberado_em?: string
  liberado_por?: string
  // Pagamento
  data_pagamento?: string
  pago_em?: string
  // Documentos
  nf_numero?: string
  nf_url?: string
  medicao_url?: string
  recibo_url?: string
  observacoes?: string
  // Financeiro
  fin_cp_id?: string
  fin_cr_id?: string
  // Audit
  created_at: string
  updated_at: string
  // Joins
  contrato?: Pick<Contrato, 'numero' | 'objeto' | 'tipo_contrato' | 'status'>
}

export interface ParcelaAnexo {
  id: string
  parcela_id: string
  tipo: TipoAnexoParcela
  nome_arquivo: string
  url: string
  mime_type?: string
  tamanho_bytes?: number
  uploaded_at: string
  observacao?: string
}

export interface ContratosDashboardData {
  resumo: {
    total_contratos: number
    vigentes: number
    contratos_receita: number
    contratos_despesa: number
    valor_total_receita: number
    valor_total_despesa: number
  }
  parcelas: {
    previstas: number
    pendentes: number
    liberadas: number
    pagas: number
    valor_pendente: number
    valor_liberado: number
  }
  proximas_parcelas: (Parcela & {
    contrato_numero: string
    contrato_objeto: string
    tipo_contrato: TipoContrato
    contraparte: string
  })[]
  alertas_ativos: number
}

export interface NovoContratoPayload {
  numero: string
  tipo_contrato: TipoContrato
  cliente_id: string
  fornecedor_id?: string
  obra_id?: string
  objeto: string
  descricao?: string
  valor_total: number
  data_assinatura?: string
  data_inicio: string
  data_fim_previsto: string
  recorrencia: RecorrenciaContrato
  dia_vencimento?: number
  centro_custo?: string
  classe_financeira?: string
  indice_reajuste?: string
  status: StatusContrato
  itens?: Omit<ContratoItem, 'id' | 'contrato_id' | 'valor_total' | 'created_at'>[]
}

export interface NovaParcelaPayload {
  contrato_id: string
  numero: number
  valor: number
  data_vencimento: string
  observacoes?: string
}
