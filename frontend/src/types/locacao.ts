// ── Status Unions ─────────────────────────────────────────────────────────────

export type StatusImovel = 'ativo' | 'inativo' | 'em_entrada' | 'em_saida'

export type StatusEntrada =
  | 'pendente'
  | 'aguardando_vistoria'
  | 'aguardando_assinatura'
  | 'liberado'

export type StatusSaida =
  | 'pendente'
  | 'aguardando_vistoria'
  | 'solucionando_pendencias'
  | 'encerramento_contratual'
  | 'encerrado'

export type StatusVistoria = 'pendente' | 'em_andamento' | 'concluida'

export type TipoVistoria = 'entrada' | 'saida'

export type EstadoItem = 'otimo' | 'bom' | 'regular' | 'ruim' | 'nao_se_aplica'

export type TipoFatura =
  | 'energia'
  | 'agua'
  | 'internet'
  | 'iptu'
  | 'condominio'
  | 'telefone'
  | 'limpeza'
  | 'seguro'
  | 'caucao'
  | 'outro'

export type StatusFatura = 'previsto' | 'lancado' | 'enviado_pagamento' | 'pago'

export type TipoSolicitacao = 'servico' | 'manutencao' | 'acordo' | 'renovacao'

export type UrgenciaSolicitacao = 'baixa' | 'normal' | 'alta' | 'urgente'

export type StatusSolicitacao = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'

export type TipoAcordo = 'benfeitoria' | 'abatimento' | 'multa' | 'negociacao' | 'outro'

export type TipoAditivo = 'renovacao' | 'reajuste' | 'alteracao_valor' | 'outro'

export type StatusAditivo = 'rascunho' | 'aguardando_assinatura' | 'assinado'

// ── Pipeline Stage Definitions ────────────────────────────────────────────────

export interface PipelineStage<T extends string> {
  key: T
  label: string
  color: string
  bgClass: string
  textClass: string
  dotClass: string
  badgeClass: string
  borderClass: string
}

export const ENTRADA_PIPELINE_STAGES: PipelineStage<StatusEntrada>[] = [
  {
    key: 'pendente',
    label: 'Pendente',
    color: 'slate',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-600',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700',
    borderClass: 'border-slate-300',
  },
  {
    key: 'aguardando_vistoria',
    label: 'Aguardando Vistoria',
    color: 'blue',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-100 text-blue-700',
    borderClass: 'border-blue-400',
  },
  {
    key: 'aguardando_assinatura',
    label: 'Aguardando Assinatura',
    color: 'violet',
    bgClass: 'bg-violet-50',
    textClass: 'text-violet-700',
    dotClass: 'bg-violet-500',
    badgeClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
  },
  {
    key: 'liberado',
    label: 'Liberado',
    color: 'green',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
    dotClass: 'bg-green-500',
    badgeClass: 'bg-green-100 text-green-700',
    borderClass: 'border-green-400',
  },
]

export const SAIDA_PIPELINE_STAGES: PipelineStage<StatusSaida>[] = [
  {
    key: 'pendente',
    label: 'Pendente',
    color: 'amber',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 text-amber-700',
    borderClass: 'border-amber-400',
  },
  {
    key: 'aguardando_vistoria',
    label: 'Aguardando Vistoria',
    color: 'blue',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-100 text-blue-700',
    borderClass: 'border-blue-400',
  },
  {
    key: 'solucionando_pendencias',
    label: 'Solucionando Pendencias',
    color: 'red',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-100 text-red-700',
    borderClass: 'border-red-400',
  },
  {
    key: 'encerramento_contratual',
    label: 'Encerramento Contratual',
    color: 'violet',
    bgClass: 'bg-violet-50',
    textClass: 'text-violet-700',
    dotClass: 'bg-violet-500',
    badgeClass: 'bg-violet-100 text-violet-700',
    borderClass: 'border-violet-400',
  },
  {
    key: 'encerrado',
    label: 'Encerrado',
    color: 'slate',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-200 text-slate-600',
    borderClass: 'border-slate-300',
  },
]

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface LocImovel {
  id: string
  empresa_id?: string
  codigo?: string
  descricao: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  cidade?: string
  uf?: string
  area_m2?: number
  valor_aluguel_mensal?: number
  dia_vencimento?: number
  locador_nome?: string
  locador_cpf_cnpj?: string
  locador_contato?: string
  centro_custo_id?: string
  obra_id?: string
  responsavel_id?: string
  contrato_id?: string
  status: StatusImovel
  created_at: string
  updated_at: string
}

export interface LocEntrada {
  id: string
  imovel_id?: string
  imovel?: LocImovel
  status: StatusEntrada
  responsavel_id?: string
  centro_custo_id?: string
  obra_id?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  cidade?: string
  uf?: string
  area_m2?: number
  valor_aluguel?: number
  dia_vencimento?: number
  locador_nome?: string
  locador_cpf_cnpj?: string
  locador_contato?: string
  data_prevista_inicio?: string
  observacoes?: string
  contrato_id?: string
  created_at: string
  updated_at: string
}

export interface LocSaida {
  id: string
  imovel_id?: string
  imovel?: LocImovel
  status: StatusSaida
  responsavel_id?: string
  data_aviso?: string
  data_limite_saida?: string
  caucao_valor?: number
  caucao_devolvido: boolean
  valores_em_aberto: Record<string, unknown>[]
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface LocVistoria {
  id: string
  imovel_id?: string
  imovel?: LocImovel
  tipo: TipoVistoria
  entrada_id?: string
  saida_id?: string
  responsavel_id?: string
  data_vistoria?: string
  status: StatusVistoria
  tem_pendencias: boolean
  observacoes_gerais?: string
  pdf_url?: string
  created_at: string
  itens?: LocVistoriaItem[]
}

export interface LocVistoriaItem {
  id: string
  vistoria_id: string
  ambiente: string
  item: string
  estado_entrada?: EstadoItem
  estado_saida?: EstadoItem
  divergencia: boolean
  observacao?: string
  ordem: number
}

export interface LocVistoriaFoto {
  id: string
  vistoria_id: string
  item_id?: string
  url: string
  descricao?: string
  tipo?: TipoVistoria
  created_at: string
}

export interface LocFatura {
  id: string
  imovel_id?: string
  imovel?: LocImovel
  tipo: TipoFatura
  descricao?: string
  competencia?: string
  vencimento?: string
  valor_previsto?: number
  valor_confirmado?: number
  status: StatusFatura
  boleto_url?: string
  comprovante_url?: string
  recorrente: boolean
  dia_recorrencia?: number
  centro_custo_id?: string
  obra_id?: string
  created_at: string
  updated_at: string
}

export interface LocSolicitacao {
  id: string
  imovel_id?: string
  imovel?: LocImovel
  tipo: TipoSolicitacao
  titulo: string
  descricao?: string
  responsavel_id?: string
  urgencia: UrgenciaSolicitacao
  status: StatusSolicitacao
  cmp_requisicao_id?: string
  con_contrato_id?: string
  created_at: string
  updated_at: string
}

export interface LocAcordo {
  id: string
  imovel_id?: string
  imovel?: LocImovel
  titulo: string
  tipo?: TipoAcordo
  descricao?: string
  valor?: number
  data_acordo?: string
  documento_url?: string
  responsavel_id?: string
  created_at: string
}

export interface LocAditivo {
  id: string
  imovel_id?: string
  imovel?: LocImovel
  con_contrato_id?: string
  tipo?: TipoAditivo
  descricao?: string
  data_inicio?: string
  data_fim?: string
  valor_anterior?: number
  valor_novo?: number
  indice_reajuste?: string
  status: StatusAditivo
  created_at: string
}

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface CriarEntradaPayload {
  imovel_id?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  cidade?: string
  uf?: string
  area_m2?: number
  valor_aluguel?: number
  dia_vencimento?: number
  locador_nome?: string
  locador_cpf_cnpj?: string
  locador_contato?: string
  data_prevista_inicio?: string
  observacoes?: string
  responsavel_id?: string
  centro_custo_id?: string
  obra_id?: string
}

export interface CriarSolicitacaoPayload {
  imovel_id?: string
  tipo: TipoSolicitacao
  titulo: string
  descricao?: string
  urgencia?: UrgenciaSolicitacao
  responsavel_id?: string
}

// ── Label Maps ────────────────────────────────────────────────────────────────

export const TIPO_FATURA_LABEL: Record<TipoFatura, string> = {
  energia: 'Energia',
  agua: 'Agua',
  internet: 'Internet',
  iptu: 'IPTU',
  condominio: 'Condominio',
  telefone: 'Telefone',
  limpeza: 'Limpeza',
  seguro: 'Seguro',
  caucao: 'Caucao',
  outro: 'Outro',
}

export const TIPO_SOLICITACAO_LABEL: Record<TipoSolicitacao, string> = {
  servico: 'Servico',
  manutencao: 'Manutencao',
  acordo: 'Acordo',
  renovacao: 'Renovacao',
}

export const URGENCIA_LABEL: Record<UrgenciaSolicitacao, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const STATUS_FATURA_LABEL: Record<StatusFatura, { label: string; dot: string; bg: string; text: string }> = {
  previsto:         { label: 'Previsto',         dot: 'bg-slate-400',  bg: 'bg-slate-50',  text: 'text-slate-600' },
  lancado:          { label: 'Lancado',           dot: 'bg-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  enviado_pagamento:{ label: 'Enviado Pgto',      dot: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  pago:             { label: 'Pago',              dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
}

export const STATUS_SOLICITACAO_LABEL: Record<StatusSolicitacao, { label: string; dot: string; bg: string; text: string }> = {
  aberta:      { label: 'Aberta',       dot: 'bg-blue-400',  bg: 'bg-blue-50',   text: 'text-blue-700' },
  em_andamento:{ label: 'Em Andamento', dot: 'bg-amber-400', bg: 'bg-amber-50',  text: 'text-amber-700' },
  concluida:   { label: 'Concluida',    dot: 'bg-green-500', bg: 'bg-green-50',  text: 'text-green-700' },
  cancelada:   { label: 'Cancelada',    dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-500' },
}

export const STATUS_ADITIVO_LABEL: Record<StatusAditivo, { label: string; dot: string; bg: string; text: string }> = {
  rascunho:              { label: 'Rascunho',              dot: 'bg-slate-400',  bg: 'bg-slate-50',   text: 'text-slate-600' },
  aguardando_assinatura: { label: 'Aguard. Assinatura',    dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700' },
  assinado:              { label: 'Assinado',              dot: 'bg-green-500',  bg: 'bg-green-50',   text: 'text-green-700' },
}
