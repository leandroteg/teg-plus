// ── Obras Types ────────────────────────────────────────────────────────────────

export type CondicaoClimatica = 'sol' | 'nublado' | 'chuva' | 'chuva_forte' | 'tempestade'
export type StatusApontamento = 'rascunho' | 'confirmado' | 'validado'
export type StatusRDO = 'rascunho' | 'finalizado'
export type StatusAdiantamento = 'solicitado' | 'aprovado' | 'parcial' | 'prestado' | 'vencido'

export type CategoriaPrestacao =
  | 'combustivel' | 'alimentacao' | 'hospedagem' | 'transporte'
  | 'material_consumo' | 'manutencao_emergencial' | 'servico_terceiro'
  | 'locacao_equipamento' | 'telefonia_internet' | 'outro'

export type FormaPagamentoPrestacao =
  | 'dinheiro' | 'cartao_corporativo' | 'pix' | 'transferencia' | 'adiantamento'

export type StatusPrestacao = 'pendente' | 'em_analise' | 'aprovada' | 'rejeitada' | 'compensada'
export type TipoMobilizacao = 'mobilizacao' | 'desmobilizacao'
export type StatusMobilizacao = 'planejada' | 'em_andamento' | 'concluida'

export interface ObraFrente {
  id: string
  obra_id: string
  nome: string
  descricao?: string
  responsavel?: string
  ativo: boolean
  created_at: string
}

export interface ObraApontamento {
  id: string
  obra_id: string
  frente_id?: string
  data_apontamento: string
  atividade: string
  contrato_item_id?: string
  quantidade_executada: number
  unidade?: string
  equipe_responsavel?: string
  horas_trabalhadas: number
  observacoes?: string
  evidencia_fotos?: string[]
  status: StatusApontamento
  apontado_por?: string
  validado_por?: string
  validado_em?: string
  created_at: string
  updated_at: string
  // Joins
  frente?: Pick<ObraFrente, 'id' | 'nome'>
  obra?: { id: string; nome: string }
}

export interface ObraRDO {
  id: string
  obra_id: string
  data: string
  condicao_climatica: CondicaoClimatica
  efetivo_proprio: number
  efetivo_terceiro: number
  equipamentos_operando: number
  equipamentos_parados: number
  resumo_atividades?: string
  ocorrencias?: string
  horas_improdutivas: number
  motivo_improdutividade?: string
  fotos?: string[]
  responsavel?: string
  status: StatusRDO
  created_at: string
  updated_at: string
  obra?: { id: string; nome: string }
}

export interface ObraAdiantamento {
  id: string
  obra_id: string
  solicitante_id: string
  valor_solicitado: number
  valor_aprovado: number
  valor_prestado_contas: number
  saldo_pendente: number
  finalidade: string
  data_solicitacao: string
  data_limite_prestacao?: string
  status: StatusAdiantamento
  aprovado_por?: string
  aprovado_em?: string
  observacoes?: string
  created_at: string
  updated_at: string
  obra?: { id: string; nome: string }
  solicitante?: { id: string; nome: string }
}

export interface ObraPrestacaoContas {
  id: string
  obra_id: string
  centro_custo_id?: string
  classe_financeira_id?: string
  categoria: CategoriaPrestacao
  descricao: string
  valor: number
  data_gasto: string
  fornecedor_nome?: string
  fornecedor_cnpj_cpf?: string
  forma_pagamento: FormaPagamentoPrestacao
  numero_nf?: string
  comprovante_urls?: string[]
  adiantamento_id?: string
  solicitante_id: string
  solicitante_nome: string
  status: StatusPrestacao
  aprovador_id?: string
  aprovado_em?: string
  motivo_rejeicao?: string
  fin_conta_pagar_id?: string
  created_at: string
  updated_at: string
  obra?: { id: string; nome: string }
}

export interface ObraEquipe {
  id: string
  obra_id: string
  frente_id?: string
  colaborador_nome: string
  colaborador_id?: string
  funcao: string
  data_inicio?: string
  data_fim?: string
  ativo: boolean
  created_at: string
  frente?: Pick<ObraFrente, 'id' | 'nome'>
}

export interface ObraMobilizacao {
  id: string
  obra_id: string
  tipo: TipoMobilizacao
  colaboradores: unknown[]
  equipamentos: unknown[]
  status: StatusMobilizacao
  data_prevista?: string
  data_real?: string
  responsavel?: string
  observacoes?: string
  created_at: string
  updated_at: string
  obra?: { id: string; nome: string }
}
