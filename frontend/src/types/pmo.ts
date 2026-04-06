// ── PMO Types ──────────────────────────────────────────────────────────────────

export type StatusPortfolio =
  | 'em_analise_ate' | 'revisao_cliente' | 'liberado_iniciar'
  | 'obra_andamento' | 'obra_paralisada' | 'obra_concluida' | 'cancelada'

export type TipoOSC = 'obra' | 'manutencao'
export type RiscoMulta = 'baixo' | 'medio' | 'alto' | 'critico'
export type StatusTAP = 'rascunho' | 'em_aprovacao' | 'aprovado' | 'rejeitado'
export type ClassificacaoNivel = 'baixa' | 'media' | 'alta'
export type FaseEAP = 'iniciacao' | 'planejamento' | 'execucao' | 'monitoramento' | 'encerramento'
export type PrioridadeTarefa = 'alta' | 'media' | 'baixa'
export type StatusTarefa = 'a_fazer' | 'em_andamento' | 'concluido' | 'nao_iniciado' | 'cancelado'
export type TipoDependencia = 'fim_inicio' | 'inicio_inicio' | 'fim_fim'

export type EtapaFluxoOS =
  | 'recebida' | 'classificada' | 'em_analise' | 'devolvida_comentarios'
  | 'retornada_cliente' | 'cancelada' | 'planejamento_logistica'
  | 'planejamento_materiais' | 'checagem_materiais' | 'aguardando_suprimentos'
  | 'aguardando_material_cemig' | 'pronta_iniciar' | 'em_execucao'

export type StatusMedicaoPeriodo =
  | 'teg_a_fazer' | 'teg_em_andamento' | 'teg_revisao_final'
  | 'cemig_recebida' | 'cemig_em_analise' | 'cemig_comentarios' | 'cemig_aprovada'

export type CategoriaHistograma = 'mod' | 'moi' | 'maquinario'

export type TipoMulta =
  | 'atraso_prazo' | 'qualidade' | 'ssma' | 'documental' | 'subcontratacao' | 'outra'
export type StatusMulta = 'risco' | 'notificada' | 'contestada' | 'confirmada' | 'paga' | 'cancelada'

export type TipoReuniao = 'dds' | 'alinhamento_semanal' | 'gestao_mensal' | 'cliente_mensal' | 'analise_trimestral'
export type StatusReuniao = 'agendada' | 'realizada' | 'cancelada'

export type TipoMudanca = 'mudanca_escopo' | 'mudanca_lider' | 'mudanca_orcamento' | 'mudanca_prazo'
export type ParecerMudanca = 'pendente' | 'aprovado' | 'reprovado'
export type NivelImpacto = 'baixo' | 'medio' | 'alto'

export type StatusReport = 'rascunho' | 'publicado'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface PMOPortfolio {
  id: string
  obra_id: string
  contrato_id?: string
  numero_osc: string
  nome_obra: string
  tipo_osc: TipoOSC
  resumo_osc?: string
  cluster?: string
  cidade_estado?: string
  status: StatusPortfolio
  data_inicio_contratual?: string
  data_termino_contratual?: string
  data_inicio_real?: string
  data_termino_real?: string
  valor_total_osc: number
  valor_faturado: number
  custo_orcado: number
  custo_planejado: number
  custo_real: number
  multa_previsao?: RiscoMulta
  multa_motivo?: string
  multa_valor_estimado: number
  created_at: string
  updated_at: string
  // Joins
  obra?: { id: string; nome: string; codigo: string }
}

export interface PMOTAP {
  id: string
  portfolio_id: string
  nome_projeto: string
  numero_projeto?: string
  cliente?: string
  data_abertura?: string
  patrocinador_cliente?: string
  gerente_projeto?: string
  classificacao_urgencia: ClassificacaoNivel
  classificacao_complexidade: ClassificacaoNivel
  classificacao_faturamento: 'baixo' | 'medio' | 'alto'
  classificacao_duracao: ClassificacaoNivel
  tipo_projeto?: string
  objetivo?: string
  escopo_inclui?: string[]
  escopo_nao_inclui?: string[]
  premissas?: string[]
  restricoes?: string[]
  riscos_principais: unknown[]
  stakeholder_patrocinador?: string
  stakeholder_cliente_chave?: string
  stakeholders_outros?: string[]
  marcos_cronograma: unknown[]
  orcamento_total: number
  orcamento_referencia?: string
  orcamento_grupos: unknown[]
  marcos_pagamento: unknown[]
  criterios_sucesso?: string[]
  equipe: unknown[]
  aprovado_por?: string
  aprovado_cargo?: string
  aprovado_data?: string
  aprovado_assinatura_url?: string
  observacoes?: string
  status: StatusTAP
  created_at: string
  updated_at: string
}

export interface PMOEAP {
  id: string
  portfolio_id: string
  parent_id?: string
  codigo?: string
  titulo: string
  fase?: FaseEAP
  tipo_servico?: string[]
  ordem: number
  descricao?: string
  responsavel?: string
  entregaveis?: string[]
  criterio_conclusao?: string
  peso_percentual: number
  created_at: string
  children?: PMOEAP[]
}

export interface PMOTarefa {
  id: string
  portfolio_id: string
  eap_id?: string
  parent_id?: string
  codigo?: string
  tarefa: string
  prioridade: PrioridadeTarefa
  status: StatusTarefa
  responsavel?: string
  responsavel_id?: string
  data_inicio_planejado?: string
  data_termino_planejado?: string
  duracao_dias?: number
  data_inicio_real?: string
  data_termino_real?: string
  percentual_concluido: number
  dependencias?: string[]
  tipo_dependencia: TipoDependencia
  notas?: string
  ordem: number
  created_at: string
  updated_at: string
}

export interface PMOMedicaoResumo {
  id: string
  portfolio_id: string
  cliente?: string
  numero_osc?: string
  nome_obra?: string
  valor_contrato: number
  prazo?: string
  total_medido_valor: number
  total_medido_pct: number
  total_a_medir_valor: number
  total_a_medir_pct: number
  created_at: string
  updated_at: string
}

export interface PMOMedicaoPeriodo {
  id: string
  medicao_resumo_id: string
  periodo: string
  valor_previsto: number
  valor_realizado: number
  delta: number
  created_at: string
}

export interface PMOMedicaoItem {
  id: string
  portfolio_id: string
  contrato_item_id?: string
  numero_medicao: number
  item_descricao: string
  unidade?: string
  quantidade_prevista: number
  preco_unitario: number
  valor_total: number
  created_at: string
  updated_at: string
}

export interface PMOMedicaoItemPeriodo {
  id: string
  medicao_item_id: string
  periodo: string
  status_periodo: StatusMedicaoPeriodo
  qtd_executada_acum: number
  valor_medir: number
  valor_medir_pct: number
  created_at: string
}

export interface PMOHistograma {
  id: string
  portfolio_id: string
  categoria: CategoriaHistograma
  funcao: string
  semana?: string
  mes?: string
  data_inicio_semana?: string
  quantidade_planejada: number
  quantidade_real: number
  custo_unitario_hora: number
  horas_semana: number
  created_at: string
}

export interface PMOFluxoOS {
  id: string
  portfolio_id: string
  numero_os: string
  etapa_atual: EtapaFluxoOS
  tipo_servico?: string
  tipo_obra?: 'nova' | 'em_andamento'
  analise_coordenador: Record<string, unknown>
  informacoes_completas: boolean
  materiais_cliente_disponiveis?: boolean
  materiais_cemig_campo?: boolean
  requisicao_suprimentos_id?: string
  data_recebimento?: string
  data_inicio_atividades?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface PMOStatusReport {
  id: string
  portfolio_id: string
  periodo: string
  data_report: string
  os_total: number
  os_a_iniciar: number
  os_em_andamento: number
  os_concluidas: number
  os_paralisadas: number
  meta_faturamento: number
  faturamento_atual: number
  delta_faturamento: number
  detalhamento_os: unknown[]
  atividades: unknown[]
  riscos: unknown[]
  multas: unknown[]
  gerado_por?: string
  status: StatusReport
  created_at: string
  updated_at: string
}

export interface PMOMulta {
  id: string
  portfolio_id: string
  tipo_multa: TipoMulta
  descricao: string
  base_contratual?: string
  valor_estimado: number
  valor_confirmado: number
  status: StatusMulta
  data_notificacao?: string
  data_vencimento?: string
  acao_mitigacao?: string
  responsavel?: string
  created_at: string
  updated_at: string
}

export interface PMOReuniao {
  id: string
  portfolio_id?: string
  tipo: TipoReuniao
  data: string
  participantes?: string[]
  pauta?: string
  ata?: string
  ata_url?: string
  decisoes: unknown[]
  status: StatusReuniao
  duracao_minutos: number
  created_at: string
  updated_at: string
}

export interface PMOMudanca {
  id: string
  portfolio_id: string
  tipo: TipoMudanca
  descricao: string
  justificativa?: string
  esforco_estimado: NivelImpacto
  custo_estimado: NivelImpacto
  impacto_prazo: NivelImpacto
  parecer: ParecerMudanca
  aprovado_por?: string
  data_solicitacao?: string
  data_parecer?: string
  solicitado_por?: string
  created_at: string
  updated_at: string
}

export interface PMOIndicadoresSnapshot {
  id: string
  portfolio_id?: string
  data_snapshot: string
  pct_valor_executado?: number
  valor_medido_mes?: number
  meta_mensal?: number
  multas_acumuladas?: number
  idc?: number
  idp?: number
  us_executadas?: number
  us_planejadas?: number
  os_abertas?: number
  os_concluidas?: number
  os_atrasadas?: number
  pct_subcontratacao?: number
  prazo_medio_inicio_apos_ate?: number
  producao_mensal?: number
  pct_docs_no_prazo?: number
  notificacoes_mes?: number
  taxa_frequencia?: number
  taxa_gravidade?: number
  horas_trabalhadas?: number
  acidentes_graves: number
  dados_extras: Record<string, unknown>
  created_at: string
}

// ── Stakeholders ──
export interface PMOStakeholder {
  id: string
  portfolio_id: string
  nome: string
  papel?: string
  organizacao?: string
  influencia?: 'baixa' | 'media' | 'alta'
  estrategia?: string
  created_at?: string
}

// ── Comunicação ──
export interface PMOComunicacao {
  id: string
  portfolio_id: string
  item: string
  destinatario?: string
  frequencia?: string
  canal?: string
  responsavel?: string
  created_at?: string
}

// ── Orçamento ──
export interface PMOOrcamento {
  id: string
  portfolio_id: string
  disciplina: string
  insumo?: string
  fase?: string
  valor_previsto: number
  valor_realizado: number
  created_at?: string
  updated_at?: string
}

// ── Riscos ──
export type ProbabilidadeRisco = 'baixa' | 'media' | 'alta' | 'muito_alta'
export type ImpactoRisco = 'baixo' | 'medio' | 'alto' | 'muito_alto'
export type StatusRisco = 'aberto' | 'mitigando' | 'fechado' | 'aceito'

export interface PMORisco {
  id: string
  portfolio_id: string
  descricao: string
  categoria?: string
  probabilidade?: ProbabilidadeRisco
  impacto?: ImpactoRisco
  resposta?: string
  responsavel?: string
  status: StatusRisco
  created_at?: string
  updated_at?: string
}

// ── Plano de Ação ──
export type StatusAcao = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'

export interface PMOPlanoAcao {
  id: string
  portfolio_id: string
  descricao: string
  tipo_desvio?: string
  responsavel?: string
  prazo?: string
  status: StatusAcao
  evidencia_url?: string
  created_at?: string
  updated_at?: string
}

// ── Entregáveis ──
export type StatusEntregavel = 'pendente' | 'em_andamento' | 'concluido' | 'atrasado'

export interface PMOEntregavel {
  id: string
  portfolio_id: string
  eap_id?: string
  titulo: string
  responsavel?: string
  pct_conclusao: number
  status: StatusEntregavel
  data_prevista?: string
  data_real?: string
  created_at?: string
  updated_at?: string
}

// ── Documentos ──
export type StatusDocumento = 'vigente' | 'a_vencer' | 'vencido' | 'renovado' | 'na'

export interface PMODocumento {
  id: string
  portfolio_id: string
  tipo: string
  descricao?: string
  data_emissao?: string
  data_vencimento?: string
  status: StatusDocumento
  arquivo_url?: string
  created_at?: string
  updated_at?: string
}

// ── Avanço Físico ──
export interface PMOAvancoFisico {
  id: string
  portfolio_id: string
  semana?: number
  mes?: string
  pct_planejado: number
  pct_executado: number
  observacoes?: string
  created_at?: string
}

// ── Lições Aprendidas ──
export interface PMOLicaoAprendida {
  id: string
  portfolio_id: string
  fase?: string
  descricao: string
  tipo?: 'positivo' | 'negativo'
  recomendacao?: string
  created_at?: string
}

// ── Aceite ──
export type StatusAceite = 'pendente' | 'assinado' | 'rejeitado'

export interface PMOAceite {
  id: string
  portfolio_id: string
  contrato_id?: string
  data_aceite?: string
  assinatura_url?: string
  observacoes?: string
  status: StatusAceite
  created_at?: string
  updated_at?: string
}

// ── Desmobilização ──
export type StatusDesmobilizacao = 'pendente' | 'em_andamento' | 'concluido'

export interface PMODesmobilizacao {
  id: string
  portfolio_id: string
  item: string
  categoria?: string
  status: StatusDesmobilizacao
  responsavel?: string
  data_prevista?: string
  data_real?: string
  created_at?: string
  updated_at?: string
}
