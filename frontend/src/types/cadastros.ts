// ── Cadastros Types ────────────────────────────────────────────────────────

export type { Fornecedor } from './financeiro'
export type { EstItem } from './estoque'

// ── Hierarquia Pagante: Empresa > Centro de Custo > Obra ──────────────────

export interface Empresa {
  id: string
  codigo: string
  razao_social: string
  nome_fantasia?: string
  cnpjs: string[]
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface CentroCusto {
  id: string
  codigo: string
  descricao: string
  empresa_id?: string
  ativo: boolean
  created_at: string
  updated_at: string
  empresa?: { id: string; codigo: string; razao_social: string }
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
  centro_custo_id?: string
  created_at: string
  updated_at: string
  centro_custo?: { id: string; codigo: string; descricao: string }
}

// ── Hierarquia Natureza: Grupo > Categoria > Classe ───────────────────────

export interface GrupoFinanceiro {
  id: string
  codigo: string
  descricao: string
  tipo: 'receita' | 'despesa' | 'ambos'
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface CategoriaFinanceira {
  id: string
  codigo: string
  descricao: string
  grupo_id?: string
  ativo: boolean
  created_at: string
  updated_at: string
  grupo?: { id: string; codigo: string; descricao: string }
}

export interface ClasseFinanceira {
  id: string
  codigo: string
  descricao: string
  tipo: 'receita' | 'despesa' | 'ambos'
  categoria_id?: string
  ativo: boolean
  created_at: string
  updated_at: string
  categoria?: { id: string; codigo: string; descricao: string }
}

// ── Entidades ─────────────────────────────────────────────────────────────

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

// ── AI ────────────────────────────────────────────────────────────────────

export interface AiCadastroField {
  value: any
  confidence: number
}

export interface AiCadastroResult {
  fields: Record<string, AiCadastroField>
  detected_entity?: string
}
