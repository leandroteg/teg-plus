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

  destinatario_cnpj?: string
  destinatario_nome?: string
  destinatario_uf?: string
  emitente_cnpj?: string
  emitente_nome?: string
  items?: Array<{ descricao: string; quantidade: number; unidade: string; valor_unitario?: number }>
  valor_frete?: number
  valor_seguro?: number
  valor_desconto_nf?: number
  icms_base?: number
  icms_valor?: number
  info_complementar?: string
  obra_id?: string
  empresa_id?: string

  emissao_tipo?: 'sistema' | 'externa'

  // Joined data (from select with joins)
  fornecedor?: { id: string; razao_social: string; cnpj?: string }
  obra?: { id: string; codigo: string; nome: string; municipio?: string; uf?: string }
  empresa?: { id: string; codigo: string; razao_social: string }
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
  destinatario_cnpj?: string
  destinatario_nome?: string
  destinatario_uf?: string
  emitente_cnpj?: string
  emitente_nome?: string
  items?: Array<{ descricao: string; quantidade: number; unidade: string; valor_unitario?: number }>
  valor_frete?: number
  valor_seguro?: number
  valor_desconto_nf?: number
  icms_base?: number
  icms_valor?: number
  info_complementar?: string
  obra_id?: string
  empresa_id?: string
}

export interface EmitirNFPayload {
  numero_nf: string
  serie?: string
  chave_acesso?: string
  data_emissao: string
  danfe_url?: string
  cfop?: string
  natureza_operacao?: string
  emitente_cnpj?: string
  emitente_nome?: string
  destinatario_cnpj?: string
  destinatario_nome?: string
  destinatario_uf?: string
  items?: Array<{ descricao: string; quantidade: number; unidade: string; valor_unitario?: number }>
  valor_total?: number
  valor_frete?: number
  valor_seguro?: number
  valor_desconto_nf?: number
  icms_base?: number
  icms_valor?: number
  info_complementar?: string
}

// ── Pipeline Stages ──────────────────────────────────────────────────────────

export type StatusFiscalPipeline = 'pendente' | 'em_emissao' | 'aguardando_aprovacao' | 'emitida'

export const FISCAL_PIPELINE_STAGES: { status: StatusFiscalPipeline; label: string; color: string }[] = [
  { status: 'pendente',              label: 'Pendentes',          color: 'slate' },
  { status: 'em_emissao',            label: 'Em Emissão',         color: 'blue' },
  { status: 'aguardando_aprovacao',  label: 'Aguard. Aprovação',  color: 'amber' },
  { status: 'emitida',               label: 'Emitidas',           color: 'green' },
]

// ── Anexar NF Externa Payload ────────────────────────────────────────────────

export interface AnexarNFExternaPayload {
  numero_nf: string
  serie?: string
  data_emissao: string
  valor_total?: number
  chave_acesso?: string
  danfe_url?: string
}
