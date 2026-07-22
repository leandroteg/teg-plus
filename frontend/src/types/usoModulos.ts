// Payload da RPC get_admin_uso_modulos (painel admin "Uso dos Módulos")

export interface UsoModulosResumo {
  total_acessos: number
  total_acoes: number
  usuarios_ativos_uso: number
  base_usuarios: number
  modulos_usados: number
  pct_adocao_geral: number
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
  modulos_usados: string[]
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

export interface UsoModulosPayload {
  resumo: UsoModulosResumo
  por_modulo: UsoPorModulo[]
  evolucao_diaria: EvolucaoDiariaPonto[]
  por_usuario: UsoPorUsuario[]
  ranking_telas: RankingTela[]
  ranking_acoes: RankingAcao[]
}
