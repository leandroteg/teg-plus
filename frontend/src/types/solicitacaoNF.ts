// frontend/src/types/solicitacaoNF.ts

export type StatusSolicitacaoNF =
  | 'pendente'
  | 'em_emissao'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'emitida'
  | 'rejeitada'

export type OrigemSolicitacaoNF = 'logistica' | 'compras' | 'manual'

export interface SolicitacaoNF {
  id: string
  status: StatusSolicitacaoNF

  fornecedor_id?: string
  fornecedor_cnpj?: string
  fornecedor_nome: string

  valor_total?: number
  cfop?: string
  natureza_operacao?: string
  descricao?: string
  observacoes?: string

  numero_nf?: string
  serie?: string
  chave_acesso?: string
  data_emissao?: string

  aprovado_por?: string
  aprovado_em?: string
  motivo_rejeicao?: string

  danfe_url?: string
  xml_url?: string

  nota_fiscal_id?: string
  solicitacao_log_id?: string
  origem?: OrigemSolicitacaoNF

  solicitado_por?: string
  solicitado_em: string
  emitido_por?: string
  emitido_em?: string
  updated_at: string

  // Joined data (from select with joins)
  fornecedor?: { id: string; razao_social: string; cnpj?: string }
}

export interface SolicitacaoNFFilters {
  status?: StatusSolicitacaoNF
  origem?: OrigemSolicitacaoNF
  mes?: number
  ano?: number
  fornecedor_id?: string
  busca?: string
}

export interface CriarSolicitacaoPayload {
  fornecedor_cnpj: string
  fornecedor_nome: string
  fornecedor_id?: string
  valor_total: number
  cfop?: string
  natureza_operacao?: string
  descricao?: string
  observacoes?: string
  solicitacao_log_id?: string
  origem?: OrigemSolicitacaoNF
}

export interface EmitirNFPayload {
  numero_nf: string
  serie?: string
  chave_acesso?: string
  data_emissao: string
}
