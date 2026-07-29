// Payload da RPC get_admin_uso_modulos (painel admin "Uso dos Módulos")

export interface UsoModulosResumo {
  total_acessos: number
  total_acoes: number
  usuarios_ativos_uso: number
  base_usuarios: number
  modulos_usados: number
  pct_adocao_geral: number
  // período anterior de mesma duração, para os deltas dos KPIs
  acessos_prev: number
  acoes_prev: number
  usuarios_prev: number
}

export interface UsuariosPorDiaPonto {
  dia: string // 'YYYY-MM-DD'
  usuarios: number
}

export interface PorHoraPonto {
  hora: number // 0-23 (America/Sao_Paulo)
  acessos: number
  acoes: number
}

export interface UsoPorModulo {
  modulo: string
  acessos: number
  acoes: number
  usuarios_distintos: number
  pct_adocao: number
}

export interface EvolucaoDiariaPonto {
  dia: string // 'YYYY-MM-DD'
  modulo: string
  acessos: number
  acoes: number
}

export interface UsoPorUsuario {
  usuario_id: string
  nome: string
  role: string
  total_acessos: number
  total_acoes: number
  ultimo_uso: string | null
  dias_ativos: number
  modulos_usados: string[]
}

// Payload da RPC get_admin_uso_por_usuario (tabela "Uso por usuário" com
// período próprio: últimos N dias ou mês-calendário)
export interface UsoPorUsuarioPeriodoPayload {
  dias_periodo: number
  usuarios: UsoPorUsuario[]
}

export interface RankingTela {
  modulo: string
  tela: string
  acessos: number
  usuarios: number
}

export interface RankingAcao {
  modulo: string
  entidade_tipo: string
  tipo: string // INSERT | UPDATE | DELETE
  quantidade: number
}

// ── Drill-down de um módulo (RPC get_admin_uso_modulo_detalhe) ────────────────

export interface ModuloDetalheResumo {
  acessos: number
  acoes: number
  usuarios: number
  base_usuarios: number
  pct_adocao: number
  acessos_prev: number
  acoes_prev: number
  usuarios_prev: number
}

export interface ModuloDetalheUsuario {
  usuario_id: string
  nome: string
  role: string
  acessos: number
  acoes: number
  dias_ativos: number
  ultimo_uso: string | null
}

export interface ModuloDetalhePayload {
  resumo: ModuloDetalheResumo
  evolucao: { dia: string; acessos: number; acoes: number }[]
  telas: { tela: string; acessos: number; usuarios: number }[]
  usuarios: ModuloDetalheUsuario[]
  acoes: { entidade_tipo: string; tipo: string; quantidade: number }[]
}

// ── Análise de IA (edge function uso-modulos-insights) ────────────────────────

export interface UsoInsightDestaque {
  tipo: 'positivo' | 'negativo' | 'neutro'
  titulo: string
  detalhe: string
}

export interface UsoInsights {
  resumo_executivo: string
  destaques: UsoInsightDestaque[]
  alertas: string[]
  recomendacoes: string[]
}

export interface UsoModulosPayload {
  resumo: UsoModulosResumo
  por_modulo: UsoPorModulo[]
  evolucao_diaria: EvolucaoDiariaPonto[]
  usuarios_por_dia: UsuariosPorDiaPonto[]
  por_hora: PorHoraPonto[]
  por_usuario: UsoPorUsuario[]
  ranking_telas: RankingTela[]
  ranking_acoes: RankingAcao[]
}
