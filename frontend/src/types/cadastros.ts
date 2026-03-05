// ── Cadastros Types ────────────────────────────────────────────────────────

export type { Fornecedor } from './financeiro'
export type { EstItem } from './estoque'

export interface ClasseFinanceira {
  id: string
  codigo: string
  descricao: string
  tipo: 'receita' | 'despesa' | 'ambos'
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface CentroCusto {
  id: string
  codigo: string
  descricao: string
  obra_id?: string
  ativo: boolean
  created_at: string
  updated_at: string
  obra?: { id: string; codigo: string; nome: string }
}

export interface Obra {
  id: string
  codigo: string
  nome: string
  municipio?: string
  uf?: string
  status?: string
  responsavel_nome?: string
  responsavel_email?: string
  created_at: string
  updated_at: string
}

export interface Colaborador {
  id: string
  nome: string
  cpf?: string
  cargo?: string
  departamento?: string
  obra_id?: string
  email?: string
  telefone?: string
  data_admissao?: string
  ativo: boolean
  foto_url?: string
  created_at: string
  updated_at: string
  obra?: { id: string; codigo: string; nome: string }
}

export interface AiCadastroField {
  value: any
  confidence: number
}

export interface AiCadastroResult {
  fields: Record<string, AiCadastroField>
  detected_entity?: string
}
