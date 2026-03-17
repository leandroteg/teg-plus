// ── Enums ─────────────────────────────────────────────────────────────────────

export type TipoTransporte =
  | 'viagem'
  | 'mobilizacao'
  | 'transferencia_material'
  | 'transferencia_maquina'

export type ModalTransporte =
  | 'frota_propria'
  | 'frota_locada'
  | 'transportadora'
  | 'motoboy'
  | 'correios'

export type StatusSolicitacao =
  | 'solicitado'
  | 'validando'
  | 'planejado'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'romaneio_emitido'
  | 'nfe_emitida'
  | 'aguardando_coleta'
  | 'em_transito'
  | 'entregue'
  | 'confirmado'
  | 'concluido'
  | 'recusado'
  | 'cancelado'

export type TipoOcorrencia =
  | 'avaria_veiculo'
  | 'acidente'
  | 'atraso'
  | 'desvio_rota'
  | 'parada_nao_programada'
  | 'avaria_carga'
  | 'roubo'
  | 'outro'

export type StatusNFe =
  | 'pendente'
  | 'transmitida'
  | 'autorizada'
  | 'cancelada'
  | 'denegada'
  | 'rejeitada'

export type DocFiscalTipo = 'nenhum' | 'romaneio' | 'nf'

// ── Transportadora ────────────────────────────────────────────────────────────

export interface LogTransportadora {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  ie?: string
  email?: string
  telefone?: string
  endereco?: Record<string, string>
  modalidades?: string[]
  ativo: boolean
  avaliacao_media: number
  total_avaliacoes: number
  observacoes?: string
  criado_em: string
  updated_at: string
}

// ── Rota ──────────────────────────────────────────────────────────────────────

export interface LogRota {
  id: string
  nome: string
  origem: string
  destino: string
  distancia_km?: number
  tempo_estimado_h?: number
  custo_referencia?: number
  transportadora_id?: string
  transportadora?: LogTransportadora
  modal_preferencial?: ModalTransporte
  observacoes?: string
  ativo: boolean
  criado_em: string
}

// ── Item da Solicitação ───────────────────────────────────────────────────────

export interface LogItemSolicitacao {
  id: string
  solicitacao_id: string
  descricao: string
  quantidade: number
  unidade: string
  peso_kg?: number
  volume_m3?: number
  numero_serie?: string
  lote?: string
  observacao?: string
  criado_em: string
}

// ── Solicitação ───────────────────────────────────────────────────────────────

export interface LogSolicitacao {
  id: string
  numero: string
  tipo: TipoTransporte
  status: StatusSolicitacao

  solicitante_id?: string
  solicitante_nome?: string
  obra_nome?: string
  centro_custo?: string
  oc_numero?: string

  origem: string
  destino: string
  rota_id?: string
  rota?: LogRota

  descricao?: string
  peso_total_kg?: number
  volumes_total?: number
  carga_especial: boolean
  observacoes_carga?: string

  data_desejada?: string
  urgente: boolean
  justificativa_urgencia?: string

  validado_por?: string
  validado_em?: string
  restricoes_seguranca?: string
  motivo_recusa?: string

  modal?: ModalTransporte
  transportadora_id?: string
  transportadora?: LogTransportadora
  veiculo_placa?: string
  motorista_nome?: string
  motorista_telefone?: string
  data_prevista_saida?: string
  custo_estimado?: number
  rota_planejada_id?: string

  aprovado_por?: string
  aprovado_em?: string
  motivo_reprovacao?: string

  observacoes?: string
  criado_em: string
  updated_at: string

  romaneio_url?: string
  doc_fiscal_tipo?: DocFiscalTipo
  danfe_url?: string

  // Joined
  itens?: LogItemSolicitacao[]
  nfe?: LogNFe
  transporte?: LogTransporte
  recebimento?: LogRecebimento
}

// ── Checklist de Expedição ────────────────────────────────────────────────────

export interface LogChecklistExpedicao {
  id: string
  solicitacao_id: string
  itens_conferidos: boolean
  volumes_identificados: boolean
  embalagem_verificada: boolean
  documentacao_separada: boolean
  motorista_habilitado: boolean
  veiculo_vistoriado: boolean
  contato_destinatario: boolean
  conferido_por?: string
  conferido_em?: string
  observacoes?: string
  criado_em: string
}

// ── NF-e ──────────────────────────────────────────────────────────────────────

export interface LogNFe {
  id: string
  solicitacao_id: string
  tipo: string
  numero?: string
  serie: string
  chave_acesso?: string
  status: StatusNFe

  emitente_cnpj?: string
  emitente_nome?: string
  destinatario_cnpj?: string
  destinatario_nome?: string
  destinatario_uf?: string

  valor_total?: number
  valor_frete?: number
  cfop?: string
  natureza_operacao: string

  data_emissao?: string
  data_autorizacao?: string
  protocolo?: string
  danfe_url?: string
  xml_url?: string

  cancelada_em?: string
  motivo_cancelamento?: string

  ciot_numero?: string
  mdf_chave?: string

  emitida_por?: string
  criado_em: string
  updated_at: string
}

// ── Transporte ────────────────────────────────────────────────────────────────

export interface LogTransporte {
  id: string
  solicitacao_id: string

  hora_saida?: string
  placa?: string
  motorista_nome?: string
  motorista_cpf?: string
  motorista_telefone?: string
  peso_total_kg?: number
  volumes_total?: number

  latitude_atual?: number
  longitude_atual?: number
  ultima_atualizacao_gps?: string
  codigo_rastreio?: string

  eta_original?: string
  eta_atual?: string
  hora_chegada?: string

  despachado_por?: string
  criado_em: string
  updated_at: string

  // Joined
  solicitacao?: LogSolicitacao
  ocorrencias?: LogOcorrencia[]
}

// ── Ocorrência ────────────────────────────────────────────────────────────────

export interface LogOcorrencia {
  id: string
  transporte_id: string
  solicitacao_id: string
  tipo: TipoOcorrencia
  descricao: string
  localizacao?: string
  latitude?: number
  longitude?: number
  fotos: { url: string; descricao: string }[]
  registrado_por?: string
  registrado_em: string
  resolvido: boolean
  resolucao?: string
  resolvido_em?: string
}

// ── Recebimento ───────────────────────────────────────────────────────────────

export interface LogRecebimento {
  id: string
  solicitacao_id: string

  entregue_em?: string

  quantidades_conferidas: boolean
  estado_verificado: boolean
  seriais_conferidos: boolean
  temperatura_verificada: boolean

  status: 'pendente' | 'confirmado' | 'parcial' | 'recusado'
  divergencias?: string
  fotos: { url: string; descricao: string }[]

  confirmado_por?: string
  confirmado_nome?: string
  confirmado_em?: string
  assinatura_digital?: string

  prazo_cumprido?: boolean
  avaliacao_qualidade?: number
  observacoes?: string

  criado_em: string
  updated_at: string

  // Joined
  solicitacao?: LogSolicitacao
}

// ── Avaliação ─────────────────────────────────────────────────────────────────

export interface LogAvaliacao {
  id: string
  transportadora_id: string
  solicitacao_id?: string
  prazo?: number
  qualidade?: number
  comunicacao?: number
  media?: number
  avaliado_por?: string
  comentario?: string
  criado_em: string
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export interface LogisticaKPIs {
  total_solicitacoes: number
  abertas: number          // solicitado/planejado/aguardando_aprovacao/aprovado
  em_transito: number
  entregues_hoje: number
  confirmadas_hoje: number
  urgentes_pendentes: number
  nfe_emitidas_mes: number
  custo_total_mes: number
  taxa_entrega_prazo: number       // % no prazo
  taxa_avarias: number             // % com ocorrência de avaria
  tempo_medio_confirmacao_h: number // horas entre entrega e confirmação
}

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface CriarSolicitacaoPayload {
  tipo: TipoTransporte
  origem: string
  destino: string
  descricao?: string
  obra_nome?: string
  centro_custo?: string
  oc_numero?: string
  data_desejada?: string
  urgente?: boolean
  justificativa_urgencia?: string
  peso_total_kg?: number
  volumes_total?: number
  carga_especial?: boolean
  observacoes_carga?: string
  observacoes?: string
  itens?: Omit<LogItemSolicitacao, 'id' | 'solicitacao_id' | 'criado_em'>[]
}

export interface EmitirNFePayload {
  solicitacao_id: string
  emitente_cnpj: string
  emitente_nome: string
  destinatario_cnpj?: string
  destinatario_nome: string
  destinatario_uf: string
  valor_total: number
  valor_frete?: number
  cfop: string
  natureza_operacao?: string
  tipo?: string
}

export interface IniciarTransportePayload {
  solicitacao_id: string
  placa: string
  motorista_nome: string
  motorista_telefone?: string
  eta_original: string
  codigo_rastreio?: string
  peso_total_kg?: number
  volumes_total?: number
}

// ── Pipeline Stages ──────────────────────────────────────────────────────────

export type StatusSolicitacaoPipeline = 'solicitado' | 'planejado' | 'aguardando_aprovacao'
export type StatusExpedicaoPipeline = 'aprovado' | 'romaneio_emitido' | 'nfe_emitida'
export type StatusTransportePipeline = 'nfe_emitida' | 'aguardando_coleta' | 'em_transito' | 'entregue' | 'concluido'

export const SOLICITACAO_PIPELINE_STAGES: { status: StatusSolicitacaoPipeline; label: string; color: string }[] = [
  { status: 'solicitado',            label: 'Pendentes',      color: 'slate' },
  { status: 'planejado',             label: 'Planejadas',     color: 'violet' },
  { status: 'aguardando_aprovacao',  label: 'Em Aprovação',   color: 'amber' },
]

export const EXPEDICAO_PIPELINE_STAGES: { status: StatusExpedicaoPipeline; label: string; color: string }[] = [
  { status: 'aprovado',          label: 'Pendentes',       color: 'slate' },
  { status: 'romaneio_emitido',  label: 'Preparadas',      color: 'blue' },
  { status: 'nfe_emitida',       label: 'Em Emissão NF',   color: 'violet' },
]

export const TRANSPORTE_PIPELINE_STAGES: { status: StatusTransportePipeline; label: string; color: string }[] = [
  { status: 'nfe_emitida',       label: 'Pendentes',          color: 'slate' },
  { status: 'aguardando_coleta', label: 'Aguardando Coleta',  color: 'blue' },
  { status: 'em_transito',       label: 'Em Transporte',      color: 'amber' },
  { status: 'entregue',          label: 'Entregues',          color: 'teal' },
  { status: 'concluido',         label: 'Concluídos',         color: 'green' },
]
