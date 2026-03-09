// ── Controladoria Types ─────────────────────────────────────────────────────────

export type StatusOrcamento = 'rascunho' | 'aprovado' | 'revisado'
export type TipoKPISnapshot = 'semanal' | 'mensal' | 'trimestral'
export type TipoCenario = 'otimista' | 'base' | 'conservador' | 'personalizado'
export type TipoAlertaDesvio = 'custo_total' | 'custo_categoria' | 'margem' | 'prazo' | 'multa'
export type SeveridadeAlerta = 'amarelo' | 'vermelho' | 'critico'

export interface CtrlOrcamento {
  id: string
  obra_id: string
  ano: number
  valor_contrato: number
  valor_mao_obra: number
  valor_materiais: number
  valor_equipamentos: number
  valor_servicos_pj: number
  valor_indirect: number
  valor_gastos_campo: number
  margem_alvo: number
  status: StatusOrcamento
  aprovado_por?: string
  aprovado_em?: string
  observacoes?: string
  created_at: string
  updated_at: string
  obra?: { id: string; nome: string }
}

export interface CtrlOrcamentoLinha {
  id: string
  orcamento_id: string
  categoria: string
  mes: number
  valor_planejado: number
  valor_realizado: number
  observacao?: string
  created_at: string
}

export interface CtrlDRE {
  id: string
  obra_id: string
  ano: number
  mes: number
  receita_medida: number
  receita_faturada: number
  receita_recebida: number
  custo_mao_obra: number
  custo_materiais: number
  custo_equipamentos: number
  custo_servicos_pj: number
  custo_gastos_campo: number
  custo_outros: number
  custo_total: number
  margem_bruta: number
  observacoes?: string
  created_at: string
  updated_at: string
  obra?: { id: string; nome: string }
}

export interface CtrlKPISnapshot {
  id: string
  obra_id?: string
  data_snapshot: string
  tipo: TipoKPISnapshot
  idc?: number
  idp?: number
  eac?: number
  margem_real?: number
  faturamento_mes?: number
  producao_mes?: number
  dados_extras: Record<string, unknown>
  created_at: string
}

export interface CtrlCenario {
  id: string
  obra_id?: string
  nome: string
  tipo: TipoCenario
  premissas: Record<string, unknown>
  resultados: Record<string, unknown>
  criado_por?: string
  created_at: string
  updated_at: string
  obra?: { id: string; nome: string }
}

export interface CtrlAlertaDesvio {
  id: string
  obra_id: string
  tipo: TipoAlertaDesvio
  categoria?: string
  desvio_pct: number
  valor_orcado?: number
  valor_realizado?: number
  severidade: SeveridadeAlerta
  mensagem: string
  lido: boolean
  resolvido: boolean
  created_at: string
  obra?: { id: string; nome: string }
}
