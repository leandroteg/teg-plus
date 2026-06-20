// Tipos do módulo Orçamentação (Expansão) — estimativa paramétrica de LT via KMZ.

export type OrcStatus = 'rascunho' | 'processando' | 'concluido' | 'erro'

export type OrcArquivoTipo = 'kmz' | 'spec' | 'contrato' | 'outro'

export interface OrcPremissas {
  tensao_kv?: number
  n_circuitos?: number
  fundacao_tipo?: string
  terreno?: 'facil' | 'medio' | 'dificil' | 'severo'
  observacoes?: string
}

export interface OrcItemEAP {
  cod: string
  nome: string
  un: string
  qtd: number
  preco_unit: number
  total: number
}

export interface OrcSecaoEAP { secao: string; pct: number; valor: number }
export interface OrcComposicao { natureza: string; pct: number; valor: number }
export interface OrcCurvaS { mes: number; valor: number; acumulado: number; pct_acumulado: number }

export interface OrcLT {
  nome: string
  extensao_km: number
  n_deflexoes: number
  torres: number
  f_terreno: number
  aco_t: number
  fundacao_m3: number
  faixa_ha: number
  nucleo_fisico: number
  faturamento: number
  custo_total: number
  custo_direto: number
  lucro_operacional: number
  preco_por_torre: number
  prazo_meses: number
  montagem_dias: number
  lancamento_mes: number
  efetivo_clt: number
  itens_eap: OrcItemEAP[]
  obs?: string
}

export interface OrcResumo {
  extensao_km: number
  torres: number
  faturamento_total: number
  custo_total: number
  custo_direto: number
  lucro_operacional: number
  margem_operacional_pct: number
  preco_por_torre: number
  preco_por_km: number
  prazo_meses: number
  efetivo_clt: number
}

export interface OrcResultado {
  resumo: OrcResumo
  lts: OrcLT[]
  itens_eap: OrcItemEAP[]
  secoes_eap: OrcSecaoEAP[]
  composicao_custo: OrcComposicao[]
  curva_s: OrcCurvaS[]
  premissas_usadas?: Record<string, unknown>
  geometria_kmz?: Array<Record<string, unknown>>
  classe_precisao?: string
  fonte?: string
  nivel_confianca?: string
}

export interface OrcArquivo {
  id: string
  orcamento_id: string
  nome: string
  tipo: OrcArquivoTipo
  storage_path: string
  mime: string | null
  tamanho: number | null
  geometria: Record<string, unknown> | null
  created_at: string
}

export interface Orcamento {
  id: string
  numero: string | null
  nome: string
  descricao: string | null
  premissas: OrcPremissas
  status: OrcStatus
  resultado: OrcResultado | null
  analise_md: string | null
  nivel_confianca: string | null
  erro: string | null
  job_id: string | null
  criado_por: string | null
  criado_por_nome: string | null
  created_at: string
  updated_at: string
  concluido_em: string | null
}
