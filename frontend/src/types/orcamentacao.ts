// Tipos do módulo Orçamentação (Expansão) — estimativa paramétrica de LT via KMZ.

export type OrcStatus = 'rascunho' | 'processando' | 'concluido' | 'erro'

export type OrcArquivoTipo = 'kmz' | 'spec' | 'contrato' | 'outro'

export interface OrcPremissas {
  tensao_kv?: number
  n_circuitos?: number
  fundacao_tipo?: string
  terreno?: 'facil' | 'medio' | 'dificil' | 'severo'
  us_informado?: number
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
export interface OrcComposicao { natureza: string; pct: number; valor: number; rs_us?: number }
export interface OrcCurvaS { mes: number; valor: number; acumulado: number; pct_acumulado: number }
export interface OrcTipoTorre { familia: string; classe: string; qtd: number }

export interface OrcPlanoRecursos {
  fundacao?: { equipe_meses: number; equipes: number; pessoas_por_equipe: number; meses: number }
  montagem?: { dias: number; meses: number; pessoas: number; guindaste: boolean }
  lancamento?: { meses: number; pessoas: number }
  frota_necessaria?: Record<string, number>
  efetivo_pico_clt?: number
}

export interface OrcComparacao {
  frente_mais_proxima: string
  frente_custo_por_torre: number
  frente_aco_por_torre?: number
  frente_vol_fund_por_torre?: number
  desvio_vs_frente_pct: number
  media_carteira_custo_por_torre: number
  custo_us?: number
  custo_us_faixa_lote?: number[]
  aco_por_torre_carteira_faixa?: number[]
}

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
  valor_servico?: number
  us: number
  custo_total: number
  custo_us?: number
  custo_por_torre?: number
  custo_por_km?: number
  prazo_meses: number
  montagem_dias: number
  lancamento_mes: number
  efetivo_clt: number
  itens_eap: OrcItemEAP[]
  vol_fund_por_torre?: number
  vao_medio_m?: number | null
  tipos_torre?: OrcTipoTorre[]
  canteiro_dist_km?: number | null
  obs?: string
}

export interface OrcResumo {
  extensao_km: number
  torres: number
  us: number
  custo_total: number
  custo_us: number
  custo_por_torre: number
  custo_por_km: number
  valor_servico?: number
  prazo_meses: number
  efetivo_clt: number
  aco_por_torre?: number
  vol_fund_por_torre?: number
  vao_medio_m?: number | null
  canteiro_dist_km?: number | null
}

export interface OrcCenario {
  nome: string
  margem_pct: number
  preco_us: number
  preco_total: number
}

// Uma região (Norte/Triângulo/Sul) — mesma forma do agregado, com obras (lts) próprias
export interface OrcRegiao {
  regiao: string
  f_terreno?: number
  analise_md?: string
  resumo: OrcResumo
  lts: OrcLT[]
  itens_eap: OrcItemEAP[]
  composicao_custo: OrcComposicao[]
  cenarios_preco?: OrcCenario[]
  curva_s: OrcCurvaS[]
  tipos_torre?: OrcTipoTorre[]
  plano_recursos?: OrcPlanoRecursos
  comparacao?: OrcComparacao | null
}

export interface OrcResultado {
  resumo: OrcResumo
  lts: OrcLT[]
  itens_eap: OrcItemEAP[]
  composicao_custo: OrcComposicao[]
  cenarios_preco?: OrcCenario[]
  curva_s: OrcCurvaS[]
  regioes?: OrcRegiao[]
  tipos_torre?: OrcTipoTorre[]
  plano_recursos?: OrcPlanoRecursos
  comparacao?: OrcComparacao | null
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
