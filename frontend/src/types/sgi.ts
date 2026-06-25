// ── Status / Tipo unions ──────────────────────────────────────────────────────
export type StatusDocumento = 'rascunho' | 'em_revisao' | 'em_aprovacao' | 'vigente' | 'obsoleto'
export type TipoDocumento = 'politica' | 'procedimento' | 'instrucao' | 'formulario' | 'manual' | 'outro'

// ── Interfaces ────────────────────────────────────────────────────────────────
export interface SgiDocumento {
  id: string
  codigo?: string | null
  titulo: string
  descricao?: string | null
  tipo: TipoDocumento
  area_processo?: string | null
  status: StatusDocumento
  versao: number
  requer_ciencia: boolean
  publico_alvo?: Record<string, unknown>
  arquivo_url?: string | null
  arquivo_nome?: string | null
  proxima_revisao?: string | null
  periodicidade_revisao_meses?: number | null
  responsavel_id?: string | null
  obra_id?: string | null
  centro_custo_id?: string | null
  vigente_em?: string | null
  obsoleto_em?: string | null
  created_at: string
  updated_at: string
  criado_por_nome?: string | null
  atualizado_por_nome?: string | null
}

export interface CriarDocumentoPayload {
  titulo: string
  tipo: TipoDocumento
  descricao?: string
  area_processo?: string
  requer_ciencia?: boolean
  periodicidade_revisao_meses?: number
}

// ── Label maps (mesma forma dos demais módulos) ───────────────────────────────
export const STATUS_DOC_LABEL: Record<StatusDocumento, { label: string; dot: string; bg: string; text: string }> = {
  rascunho:     { label: 'Rascunho',     dot: 'bg-slate-400',   bg: 'bg-slate-50',   text: 'text-slate-600' },
  em_revisao:   { label: 'Em Revisão',   dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  em_aprovacao: { label: 'Em Aprovação', dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  vigente:      { label: 'Vigente',      dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  obsoleto:     { label: 'Obsoleto',     dot: 'bg-slate-400',   bg: 'bg-slate-100',  text: 'text-slate-500' },
}

export const TIPO_DOC_LABEL: Record<TipoDocumento, string> = {
  politica:     'Política',
  procedimento: 'Procedimento',
  instrucao:    'Instrução de Trabalho',
  formulario:   'Formulário',
  manual:       'Manual',
  outro:        'Outro',
}

// ════════════════ FASE 2 — Melhoria Contínua (PDCA) ════════════════
export type StatusPdca = 'pendente' | 'analise_causa' | 'plano_acao' | 'execucao' | 'verificacao' | 'encerrado'
export type TipoRegistro = 'anomalia' | 'falha' | 'desvio' | 'quase_acidente' | 'reclamacao' | 'oportunidade'
export type OrigemRegistro = 'campo' | 'auditoria' | 'cliente' | 'meta' | 'inspecao' | 'outro'
export type Gravidade = 'baixa' | 'media' | 'alta' | 'critica'
export type ClassificacaoRegistro = 'pendente' | 'nc' | 'registro' | 'dispensado'
export type StatusAcao = 'aberta' | 'em_execucao' | 'concluida' | 'cancelada'

export interface SgiRegistro {
  id: string
  codigo?: string | null
  tipo: TipoRegistro
  origem: OrigemRegistro
  gravidade: Gravidade
  area_processo?: string | null
  obra_id?: string | null
  titulo: string
  descricao?: string | null
  evidencia_url?: string | null
  status_pdca: StatusPdca
  classificacao: ClassificacaoRegistro
  responsavel_id?: string | null
  prazo?: string | null
  encerrado_em?: string | null
  created_at: string
  updated_at: string
  criado_por_nome?: string | null
}

export interface SgiAcao {
  id: string
  origem_tipo: 'registro' | 'meta' | 'achado_auditoria' | 'inspecao' | 'avulsa'
  origem_id?: string | null
  titulo: string
  descricao?: string | null
  responsavel_id?: string | null
  prazo?: string | null
  sla_horas?: number | null
  status: StatusAcao
  escalonado: boolean
  evidencia_url?: string | null
  concluida_em?: string | null
  created_at: string
  updated_at: string
}

// Identificação de causa (Ishikawa 6M + 5 Porquês) — guardado em sgi_analise_causa.conteudo (jsonb)
export const ISHIKAWA_6M = ['metodo', 'maquina', 'mao_obra', 'material', 'medicao', 'meio_ambiente'] as const
export type Ishikawa6M = (typeof ISHIKAWA_6M)[number]
export const ISHIKAWA_LABEL: Record<Ishikawa6M, string> = {
  metodo: 'Método', maquina: 'Máquina', mao_obra: 'Mão de obra', material: 'Material', medicao: 'Medição', meio_ambiente: 'Meio ambiente',
}
export interface AnaliseCausaConteudo {
  porques: string[]
  ishikawa: Record<Ishikawa6M, string[]>
}
export interface SgiAnaliseCausa {
  id: string
  registro_id: string
  metodo: '5porques' | 'ishikawa' | 'outro'
  conteudo: Partial<AnaliseCausaConteudo>
  causa_raiz?: string | null
  created_at: string
}

export const PDCA_STAGES: { key: StatusPdca; label: string; dot: string; bar: string }[] = [
  { key: 'pendente',      label: 'Pendente',              dot: 'bg-slate-400',   bar: 'bg-slate-400' },
  { key: 'analise_causa', label: 'Análise de Causa',      dot: 'bg-blue-500',    bar: 'bg-blue-500' },
  { key: 'plano_acao',    label: 'Plano de Ação',         dot: 'bg-violet-500',  bar: 'bg-violet-500' },
  { key: 'verificacao',   label: 'Verificação e Revisão', dot: 'bg-cyan-500',    bar: 'bg-cyan-500' },
  { key: 'encerrado',     label: 'Encerrado',             dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
]

export const TIPO_REGISTRO_LABEL: Record<TipoRegistro, string> = {
  anomalia: 'Anomalia', falha: 'Falha', desvio: 'Desvio',
  quase_acidente: 'Quase-acidente', reclamacao: 'Reclamação', oportunidade: 'Oportunidade',
}
export const ORIGEM_REGISTRO_LABEL: Record<OrigemRegistro, string> = {
  campo: 'Campo', auditoria: 'Auditoria', cliente: 'Cliente', meta: 'Meta', inspecao: 'Inspeção', outro: 'Outro',
}
export const GRAVIDADE_CFG: Record<Gravidade, { label: string; bg: string; text: string; dot: string }> = {
  baixa:   { label: 'Baixa',   bg: 'bg-slate-50',  text: 'text-slate-600',  dot: 'bg-slate-400' },
  media:   { label: 'Média',   bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  alta:    { label: 'Alta',    bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  critica: { label: 'Crítica', bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
}
export const STATUS_ACAO_LABEL: Record<StatusAcao, { label: string; bg: string; text: string; dot: string }> = {
  aberta:      { label: 'Aberta',       bg: 'bg-slate-50',   text: 'text-slate-600',  dot: 'bg-slate-400' },
  em_execucao: { label: 'Em Execução',  bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500' },
  concluida:   { label: 'Concluída',    bg: 'bg-emerald-50', text: 'text-emerald-700',dot: 'bg-emerald-500' },
  cancelada:   { label: 'Cancelada',    bg: 'bg-slate-100',  text: 'text-slate-500',  dot: 'bg-slate-400' },
}

// ════════════════ FASE 3 — Objetivos e Metas ════════════════
export type DirecaoMeta = 'maior_melhor' | 'menor_melhor'
export type Farol = 'verde' | 'amarelo' | 'vermelho' | 'cinza'

export interface SgiObjetivo {
  id: string
  ano: number
  titulo: string
  descricao?: string | null
  area_processo?: string | null
  responsavel_id?: string | null
  indicador?: string | null
  unidade?: string | null
  direcao: DirecaoMeta
  status: 'ativo' | 'concluido' | 'cancelado'
  created_at: string
  updated_at: string
}
export interface SgiMeta {
  id: string
  objetivo_id: string
  periodo: 'anual' | 'trimestral'
  trimestre?: number | null
  ano: number
  alvo?: number | null
  /** KR textual (OKR): quando preenchido, a meta é um Resultado-Chave descritivo. */
  descricao?: string | null
  /** Prazo do KR (data-limite). */
  prazo?: string | null
  /** Acompanhamento (Check-in): aberto / encerrado / cancelado. */
  status_checkin?: StatusCheckinMeta
  /** Resultado (Revisão): atingida / parcial / não atingida / cancelada. */
  status_revisao?: StatusRevisaoMeta | null
  created_at: string
}

export type StatusCheckinMeta = 'aberto' | 'encerrado' | 'cancelado'
export type StatusRevisaoMeta = 'atingida' | 'parcial' | 'nao_atingida' | 'cancelada'

export const STATUS_CHECKIN_CFG: Record<StatusCheckinMeta, { label: string; badge: string }> = {
  aberto:    { label: 'Aberto',    badge: 'bg-sky-100 text-sky-700' },
  encerrado: { label: 'Encerrado', badge: 'bg-emerald-100 text-emerald-700' },
  cancelado: { label: 'Cancelado', badge: 'bg-slate-200 text-slate-600' },
}
export const STATUS_REVISAO_CFG: Record<StatusRevisaoMeta, { label: string; badge: string }> = {
  atingida:     { label: 'Atingida',       badge: 'bg-emerald-100 text-emerald-700' },
  parcial:      { label: 'Atingida parcial',badge: 'bg-amber-100 text-amber-700' },
  nao_atingida: { label: 'Não atingida',   badge: 'bg-red-100 text-red-700' },
  cancelada:    { label: 'Cancelada',      badge: 'bg-slate-200 text-slate-600' },
}
export interface SgiCheckin {
  id: string
  meta_id: string
  competencia: string
  realizado?: number | null
  farol?: Farol | null
  observacao?: string | null
  created_at: string
}

export const FAROL_CFG: Record<Farol, { label: string; dot: string; bg: string; text: string }> = {
  verde:    { label: 'No alvo',  dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  amarelo:  { label: 'Atenção',  dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  vermelho: { label: 'Crítico',  dot: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-700' },
  cinza:    { label: 'Sem dado', dot: 'bg-slate-400',   bg: 'bg-slate-100',  text: 'text-slate-500' },
}
