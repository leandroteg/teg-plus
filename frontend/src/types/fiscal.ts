// frontend/src/types/fiscal.ts

export type OrigemNF = 'pedido' | 'cp' | 'contrato' | 'avulso'

export interface NotaFiscal {
  id: string
  numero?: string
  serie: string
  chave_acesso?: string
  data_emissao: string
  data_entrada?: string

  fornecedor_id?: string
  fornecedor_cnpj?: string
  fornecedor_nome?: string

  valor_total: number
  valor_desconto: number
  valor_liquido: number

  classe_id?: string
  centro_custo_id?: string
  empresa_id?: string
  obra_id?: string

  origem: OrigemNF
  pedido_id?: string
  conta_pagar_id?: string
  contrato_id?: string

  pdf_path?: string
  pdf_url?: string
  xml_path?: string
  xml_url?: string

  observacoes?: string
  criado_por?: string
  criado_em: string
  updated_at: string

  // Joined data (from select with joins)
  classe?: { id: string; codigo: string; descricao: string }
  centro_custo?: { id: string; codigo: string; descricao: string }
  empresa?: { id: string; codigo: string; razao_social: string }
  obra?: { id: string; codigo: string; nome: string }
  fornecedor?: { id: string; razao_social: string; cnpj?: string }
}

export interface NotaFiscalFilters {
  mes?: number
  ano?: number
  centro_custo_id?: string
  empresa_id?: string
  classe_id?: string
  obra_id?: string
  fornecedor_id?: string
  origem?: OrigemNF
  busca?: string
}

export interface NfParseResult {
  numero?: string
  serie?: string
  chave_acesso?: string
  cnpj_emitente?: string
  nome_emitente?: string
  valor_total?: number
  data_emissao?: string
  confidence: number
}
