// ── Contratos Types ──────────────────────────────────────────────────────────

export type TipoContrato = 'receita' | 'despesa'

export type StatusContrato =
  | 'em_negociacao' | 'assinado' | 'vigente'
  | 'suspenso' | 'encerrado' | 'rescindido'

export type RecorrenciaContrato =
  | 'mensal' | 'bimestral' | 'trimestral'
  | 'semestral' | 'anual' | 'personalizado'

export type StatusParcela =
  | 'previsto' | 'pendente' | 'liberado' | 'pago' | 'cancelado'

export type TipoAnexoParcela =
  | 'nota_fiscal' | 'medicao' | 'recibo' | 'comprovante' | 'outro'

export interface ContratoCliente {
  id: string
  nome: string
  cnpj?: string
  tipo: 'publico' | 'privado' | 'governo'
  ativo: boolean
}

export interface ContratoItem {
  id: string
  contrato_id: string
  codigo?: string
  descricao: string
  unidade?: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  created_at: string
}

export interface Contrato {
  id: string
  numero: string
  // Tipo
  tipo_contrato: TipoContrato
  // Partes
  cliente_id: string
  fornecedor_id?: string
  solicitacao_id?: string
  obra_id?: string
  // Escopo
  objeto: string
  descricao?: string
  // Valores
  valor_total: number
  valor_aditivos: number
  valor_glosado: number
  valor_medido: number
  valor_a_medir: number
  // Datas
  data_assinatura?: string
  data_inicio: string
  data_fim_previsto: string
  data_fim_real?: string
  // Recorrência
  recorrencia: RecorrenciaContrato
  dia_vencimento?: number
  parcelas_geradas: boolean
  // Classificação
  centro_custo?: string
  classe_financeira?: string
  // Reajuste
  indice_reajuste?: string
  // Garantia
  garantia_tipo?: string
  garantia_valor?: number
  garantia_vencimento?: string
  // Status
  status: StatusContrato
  // Arquivo
  arquivo_url?: string
  // Audit
  created_at: string
  updated_at: string
  // Joins
  cliente?: ContratoCliente
  fornecedor?: {
    id: string
    razao_social: string
    nome_fantasia?: string
    cnpj?: string
  }
  obra?: {
    id: string
    codigo: string
    nome: string
  }
  solicitacao?: {
    id: string
    contraparte_nome?: string
  }
  itens?: ContratoItem[]
}

export interface Parcela {
  id: string
  contrato_id: string
  numero: number
  valor: number
  data_vencimento: string
  status: StatusParcela
  // Liberação
  liberado_em?: string
  liberado_por?: string
  // Pagamento
  data_pagamento?: string
  pago_em?: string
  // Documentos
  nf_numero?: string
  nf_url?: string
  medicao_url?: string
  recibo_url?: string
  observacoes?: string
  // Financeiro
  fin_cp_id?: string
  fin_cr_id?: string
  // Audit
  created_at: string
  updated_at: string
  // Joins
  contrato?: Pick<Contrato, 'numero' | 'objeto' | 'tipo_contrato' | 'status'>
}

export interface ParcelaPlanejada {
  numero: number
  valor: number
  data_vencimento: string
}

export interface ParcelaAnexo {
  id: string
  parcela_id: string
  tipo: TipoAnexoParcela
  nome_arquivo: string
  url: string
  mime_type?: string
  tamanho_bytes?: number
  uploaded_at: string
  observacao?: string
}

export interface ContratosDashboardData {
  resumo: {
    total_contratos: number
    vigentes: number
    contratos_receita: number
    contratos_despesa: number
    valor_total_receita: number
    valor_total_despesa: number
  }
  parcelas: {
    previstas: number
    pendentes: number
    liberadas: number
    pagas: number
    valor_pendente: number
    valor_liberado: number
  }
  proximas_parcelas: (Parcela & {
    contrato_numero: string
    contrato_objeto: string
    tipo_contrato: TipoContrato
    contraparte: string
  })[]
  alertas_ativos: number
}

export interface NovoContratoPayload {
  numero: string
  tipo_contrato: TipoContrato
  cliente_id: string
  fornecedor_id?: string
  obra_id?: string
  objeto: string
  descricao?: string
  valor_total: number
  data_assinatura?: string
  data_inicio: string
  data_fim_previsto: string
  recorrencia: RecorrenciaContrato
  dia_vencimento?: number
  centro_custo?: string
  classe_financeira?: string
  indice_reajuste?: string
  status: StatusContrato
  itens?: Omit<ContratoItem, 'id' | 'contrato_id' | 'valor_total' | 'created_at'>[]
}

export interface NovaParcelaPayload {
  contrato_id: string
  numero: number
  valor: number
  data_vencimento: string
  observacoes?: string
}

// ── Contratos Expansion Types ───────────────────────────────────────────────

export type StatusMedicao = 'rascunho' | 'em_aprovacao' | 'aprovado' | 'rejeitado' | 'faturado'
export type TipoAditivo = 'escopo' | 'prazo' | 'valor' | 'misto'
export type StatusAditivo = 'rascunho' | 'em_aprovacao' | 'aprovado' | 'rejeitado'
export type StatusCronograma = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'atrasada'

export interface ContratoMedicao {
  id: string
  contrato_id: string
  numero_bm: string
  periodo_inicio: string
  periodo_fim: string
  valor_medido: number
  valor_retencao: number
  valor_liquido: number
  status: StatusMedicao
  aprovado_por?: string
  aprovado_em?: string
  observacoes?: string
  created_at: string
  updated_at: string
  contrato?: Pick<Contrato, 'numero' | 'objeto'>
}

export interface ContratoMedicaoItem {
  id: string
  medicao_id: string
  contrato_item_id?: string
  quantidade_medida: number
  valor_unitario: number
  valor_total: number
  percentual_acumulado: number
  created_at: string
}

export interface ContratoAditivo {
  id: string
  contrato_id: string
  numero_aditivo: string
  tipo: TipoAditivo
  descricao: string
  valor_acrescimo: number
  nova_data_fim?: string
  status: StatusAditivo
  aprovado_por?: string
  aprovado_em?: string
  documento_url?: string
  created_at: string
  updated_at: string
  contrato?: Pick<Contrato, 'numero' | 'objeto'>
}

export interface ContratoReajuste {
  id: string
  contrato_id: string
  data_base: string
  indice_nome: string
  percentual_aplicado: number
  valor_antes: number
  valor_depois: number
  aplicado_em: string
  aplicado_por?: string
  observacoes?: string
  created_at: string
  contrato?: Pick<Contrato, 'numero' | 'objeto'>
}

export interface ContratoCronograma {
  id: string
  contrato_id: string
  etapa: string
  peso_percentual: number
  data_inicio_prevista?: string
  data_fim_prevista?: string
  data_inicio_real?: string
  data_fim_real?: string
  valor_previsto: number
  valor_realizado: number
  percentual_fisico: number
  status: StatusCronograma
  ordem: number
  created_at: string
  updated_at: string
}

// ── Contratos V2: Fluxo de Assinatura ───────────────────────────────

export type EtapaSolicitacao =
  | 'solicitacao' | 'preparar_minuta' | 'resumo_executivo'
  | 'aprovacao_diretoria' | 'enviar_assinatura' | 'arquivar'
  | 'liberar_execucao' | 'concluido' | 'cancelado'

export type StatusSolicitacao =
  | 'rascunho' | 'em_andamento' | 'aguardando_aprovacao'
  | 'aprovado' | 'rejeitado' | 'cancelado' | 'concluido'

export type TipoContraparte = 'fornecedor' | 'cliente' | 'pj'
export type TipoContratoV2 = 'receita' | 'despesa' | 'pj'
export type TipoSolicitacao = 'novo_contrato' | 'aditivo_contratual' | 'distrato_rescisao'

export type CategoriaContrato =
  | 'alimentacao_restaurante' | 'aquisicao_equipamentos' | 'aquisicao_ferramental'
  | 'aquisicao_imovel' | 'aquisicao_veiculos' | 'arrendamento_comodato'
  | 'contabilidade' | 'frete_transportes' | 'hospedagem'
  | 'internet_telefonia' | 'juridico_advocacia'
  | 'locacao_equipamentos' | 'locacao_ferramental'
  | 'locacao_imovel_alojamento' | 'locacao_imovel_canteiro' | 'locacao_imovel_deposito'
  | 'locacao_veiculos' | 'prestacao_servico' | 'seguros'
  | 'servicos_medicos' | 'software_ti' | 'subcontratacao'
  | 'vigilancia_monitoramento'
  | 'fornecimento' | 'locacao' | 'empreitada'
  | 'consultoria' | 'pj_pessoa_fisica' | 'outro'

export type GrupoContrato =
  | 'locacao_imovel' | 'locacao_veiculos' | 'locacao_equipamentos'
  | 'equipe_pj' | 'prestacao_servicos' | 'servico_recorrente'
  | 'aquisicao' | 'subcontratacao_empreitada' | 'consultoria_juridico'
  | 'apoio_operacional' | 'seguros' | 'outro'

export type UrgenciaSolicitacao = 'baixa' | 'normal' | 'alta' | 'critica'

export type TipoMinuta = 'modelo' | 'rascunho' | 'revisado' | 'final' | 'assinado'
export type StatusMinuta = 'rascunho' | 'em_revisao' | 'aprovado' | 'obsoleto'
export type StatusResumo = 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado'

export interface MinutaAiRisco {
  titulo: string
  severidade: 'baixo' | 'medio' | 'alto' | 'critico'
  descricao: string
  clausula_ref?: string
  sugestao_mitigacao?: string
}

export interface MinutaAiSugestao {
  titulo: string
  prioridade: 'baixa' | 'media' | 'alta'
  categoria?: 'importante' | 'recomendada' | 'opcional'
  descricao: string
  texto_sugerido?: string
  beneficio_teg?: string
}

export interface MinutaAiOportunidade {
  titulo: string
  descricao: string
  impacto?: 'alto' | 'medio' | 'baixo'
  texto_sugerido?: string
}

export interface MinutaAiClausula {
  nome: string
  status: 'ok' | 'atencao' | 'risco' | 'ausente'
  comentario: string
}

export interface MinutaAiConformidade {
  clausulas_obrigatorias?: boolean
  penalidades_adequadas?: boolean
  prazos_razoaveis?: boolean
  garantias_previstas?: boolean
  seguro_previsto?: boolean
  ssma_previsto?: boolean
  anticorrupcao_previsto?: boolean
  reajuste_definido?: boolean
}

export interface MinutaAiAnalise {
  score: number
  resumo?: string
  papel_teg?: 'contratante' | 'contratada' | 'indefinido'
  poder_barganha?: { nivel: 'alto' | 'medio' | 'baixo'; justificativa?: string }
  riscos: MinutaAiRisco[]
  sugestoes: MinutaAiSugestao[]
  oportunidades?: MinutaAiOportunidade[]
  clausulas_analisadas?: MinutaAiClausula[]
  conformidade?: MinutaAiConformidade
}

export interface ConfigAnalise {
  id: string
  chave: string
  valor: string
  descricao?: string
  tipo: 'texto' | 'numero' | 'lista' | 'booleano'
  categoria: 'geral' | 'clausulas' | 'limites' | 'penalidades' | 'compliance'
  ativo: boolean
  updated_at: string
}

export interface Solicitacao {
  id: string
  numero: string
  solicitante_id?: string
  solicitante_nome: string
  departamento?: string
  obra_id?: string
  tipo_solicitacao?: TipoSolicitacao
  tipo_contraparte: TipoContraparte
  contraparte_nome: string
  contraparte_cnpj?: string
  contraparte_telefone?: string
  contraparte_email?: string
  contraparte_id?: string
  fornecedor_cadastrado?: string
  contrato_vigente_fornecedor?: string
  responsavel_aprovacao?: string
  tipo_contrato: TipoContratoV2
  categoria_contrato: CategoriaContrato
  grupo_contrato?: GrupoContrato
  subtipo_contrato?: string
  objeto: string
  descricao_escopo?: string
  justificativa?: string
  valor_estimado?: number
  forma_pagamento?: string
  data_inicio_prevista?: string
  data_fim_prevista?: string
  prazo_meses?: number
  centro_custo?: string
  classe_financeira?: string
  indice_reajuste?: string
  urgencia: UrgenciaSolicitacao
  data_necessidade?: string
  documentos_ref: Array<{ nome: string; url: string; tipo: string }>
  etapa_atual: EtapaSolicitacao
  status: StatusSolicitacao
  observacoes?: string
  motivo_cancelamento?: string
  responsavel_id?: string
  responsavel_nome?: string
  created_at: string
  updated_at: string
  created_by?: string
  // Joined
  obra?: { id: string; nome: string }
}

export interface SolicitacaoHistorico {
  id: string
  solicitacao_id: string
  etapa_de: string
  etapa_para: string
  executado_por?: string
  executado_nome?: string
  observacao?: string
  dados_etapa?: Record<string, unknown>
  created_at: string
}

export interface Minuta {
  id: string
  solicitacao_id?: string
  contrato_id?: string
  tipo: TipoMinuta
  categoria?: string
  titulo: string
  descricao?: string
  versao: number
  arquivo_url: string
  arquivo_nome: string
  mime_type?: string
  tamanho_bytes?: number
  onedrive_id?: string
  onedrive_url?: string
  sharepoint_path?: string
  ai_analise?: MinutaAiAnalise
  ai_analisado_em?: string
  ai_melhorias?: Record<string, unknown>
  ai_melhorado_em?: string
  status: StatusMinuta
  created_at: string
  updated_at: string
  created_by?: string
}

export interface ResumoExecutivo {
  id: string
  solicitacao_id: string
  titulo: string
  partes_envolvidas: string
  objeto_resumo: string
  valor_total?: number
  vigencia?: string
  riscos: Array<{ nivel: string; descricao: string; mitigacao?: string }>
  oportunidades: Array<{ descricao: string; impacto?: string }>
  recomendacao?: string
  aprovacao_id?: string
  status: StatusResumo
  arquivo_url?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface NovaSolicitacaoPayload {
  solicitante_id?: string
  solicitante_nome: string
  departamento?: string
  obra_id?: string
  tipo_solicitacao?: TipoSolicitacao
  tipo_contraparte: TipoContraparte
  contraparte_nome: string
  contraparte_cnpj?: string
  contraparte_telefone?: string
  contraparte_email?: string
  contraparte_id?: string
  fornecedor_cadastrado?: string
  contrato_vigente_fornecedor?: string
  responsavel_aprovacao?: string
  tipo_contrato: TipoContratoV2
  categoria_contrato: CategoriaContrato
  objeto: string
  descricao_escopo?: string
  justificativa?: string
  valor_estimado?: number
  forma_pagamento?: string
  data_inicio_prevista?: string
  data_fim_prevista?: string
  prazo_meses?: number
  centro_custo?: string
  classe_financeira?: string
  indice_reajuste?: string
  urgencia?: UrgenciaSolicitacao
  data_necessidade?: string
  observacoes?: string
}

// ── Certisign Assinaturas ───────────────────────────────────────────

export type StatusAssinaturaType = 'pendente' | 'enviado' | 'parcialmente_assinado' | 'assinado' | 'recusado' | 'expirado' | 'cancelado'
export type ProvedorAssinatura = 'certisign' | 'manual'
export type TipoAssinatura = 'eletronica' | 'digital_icp'

export interface Signatario {
  nome: string
  email: string
  cpf: string
  papel: string
  ordem: number
  status: 'pendente' | 'assinado' | 'recusado'
  assinado_em: string | null
  link_assinatura: string | null
}

export interface Assinatura {
  id: string
  contrato_id: string | null
  solicitacao_id: string | null
  minuta_id: string | null
  provedor: ProvedorAssinatura
  tipo_assinatura: TipoAssinatura
  documento_externo_id: string | null
  envelope_id: string | null
  status: StatusAssinaturaType
  signatarios: Signatario[]
  enviado_em: string | null
  concluido_em: string | null
  expira_em: string | null
  documento_assinado_url: string | null
  certificado_url: string | null
  webhook_log: unknown[]
  created_at: string
  updated_at: string
}

export interface EnviarAssinaturaPayload {
  solicitacao_id: string
  minuta_url: string
  tipo_assinatura: TipoAssinatura
  signatarios: Pick<Signatario, 'nome' | 'email' | 'cpf' | 'papel'>[]
}

export interface EnviarAssinaturaResponse {
  assinatura_id: string
  envelope_id: string
  status: 'enviado'
}
