// ─────────────────────────────────────────────────────────────────────────────
// types/qsma.ts — Módulo QSMA (Qualidade, Segurança e Meio Ambiente)
// Inspeções de campo, SST (riscos/EPI/treinamentos/ocorrências) e Meio Ambiente.
// Ações corretivas vivem em sgi_acoes (origem_tipo='qsma_ocorrencia').
// ─────────────────────────────────────────────────────────────────────────────

// ── Inspeções ────────────────────────────────────────────────────────────────

export type TipoModelo = 'inspecao' | 'apr' | 'auditoria'
export type EscopoModelo = 'equipe' | 'veiculo' | 'atividade' | 'area'
export type TipoResposta = 'cna' | 'texto' | 'numero'
export type StatusInspecao = 'programada' | 'executada' | 'cancelada'
export type Veredito = 'liberado' | 'bloqueado'

export interface ItemChecklist {
  ordem: number
  texto: string
  tipo_resposta: TipoResposta
  foto_obrigatoria?: boolean
}

export interface QsmaModeloChecklist {
  id: string
  codigo?: string
  nome: string
  tipo: TipoModelo
  escopo: EscopoModelo
  exige_veredito: boolean
  itens: ItemChecklist[]
  ativo: boolean
  criado_por_nome?: string
  created_at: string
  updated_at: string
}

export interface RespostaItem {
  ordem: number
  resposta?: string          // 'c' | 'nc' | 'na' | texto | número
  obs?: string
  foto_paths?: string[]
}

export interface QsmaInspecao {
  id: string
  codigo?: string
  modelo_id?: string
  modelo?: QsmaModeloChecklist
  obra_id?: string
  frente?: string
  base_id?: string
  centro_custo_id?: string
  equipe_lider_id?: string
  veiculo_id?: string
  data_prevista?: string
  data_execucao?: string
  executor_id?: string
  executor_nome?: string
  respostas: RespostaItem[]
  fotos: string[]
  latitude?: number
  longitude?: number
  veredito?: Veredito | null
  observacoes?: string
  status: StatusInspecao
  created_at: string
  updated_at: string
}

// ── SST ──────────────────────────────────────────────────────────────────────

export type TipoOcorrencia = 'desvio' | 'quase_acidente' | 'acidente_spt' | 'acidente_cpt' | 'ambiental'
export type Gravidade = 'baixa' | 'media' | 'alta' | 'critica'
export type StatusOcorrencia = 'registro' | 'investigacao' | 'acao' | 'encerrada'

export interface Envolvido {
  colaborador_id?: string
  nome: string
  funcao?: string
}

export interface QsmaOcorrencia {
  id: string
  codigo?: string
  tipo: TipoOcorrencia
  gravidade: Gravidade
  obra_id?: string
  base_id?: string
  frente?: string
  data_ocorrencia: string
  local_descricao?: string
  descricao: string
  envolvidos: Envolvido[]
  veiculo_id?: string
  fotos: string[]
  dias_afastamento?: number
  status: StatusOcorrencia
  causa_raiz?: { metodo: '5porques' | 'ishikawa'; analise: unknown; causa?: string } | null
  riia?: unknown
  /** Registro vinculado no SGI (Melhoria Contínua) — o tratamento acontece lá */
  sgi_registro_id?: string
  registrado_por_id?: string
  registrado_por_nome?: string
  created_at: string
  updated_at: string
}

export type EscopoRisco = 'pgr' | 'apr'
export type StatusRisco = 'ativo' | 'mitigado' | 'encerrado'

export interface QsmaRisco {
  id: string
  codigo?: string
  escopo: EscopoRisco
  obra_id?: string
  ghe?: string
  tarefa?: string
  perigo: string
  risco: string
  probabilidade: number
  severidade: number
  controles?: string
  epis_requeridos?: string
  status: StatusRisco
  responsavel_id?: string
  created_at: string
  updated_at: string
}

export interface QsmaEpi {
  id: string
  nome: string
  ca?: string
  validade_ca?: string
  fabricante?: string
  vida_util_dias?: number
  especificacoes?: string
  possui_devolucao?: boolean
  tamanho_por_funcionario?: boolean
  ativo: boolean
  created_at: string
}

// Espelho local da base oficial de CAs do MTE (CAEPI) — consulta instantânea
export interface QsmaCaepi {
  ca: string
  equipamento?: string
  descricao?: string
  fabricante?: string
  fabricante_cnpj?: string
  validade?: string
  situacao?: string
}

export type MotivoEntregaEpi = 'entrega' | 'troca' | 'devolucao'
export type StatusFichaEpi = 'aguardando_assinatura' | 'arquivada' | 'cancelada'

// Ficha de entrega (padrão NR-06): 1 ficha → N itens; gera PDF, colhe
// assinatura e arquiva o documento assinado no bucket.
export interface QsmaEpiFicha {
  id: string
  codigo?: string
  colaborador_id: string
  colaborador_nome?: string
  obra_id?: string
  data_entrega: string
  motivo?: MotivoEntregaEpi
  observacoes?: string
  status: StatusFichaEpi
  arquivo_assinado_path?: string
  missao_id?: string
  entregue_por_nome?: string
  itens?: QsmaEpiEntrega[]
  created_at: string
  updated_at: string
}

export interface QsmaEpiEntrega {
  id: string
  ficha_id?: string
  epi_id?: string
  epi?: QsmaEpi
  colaborador_id: string
  colaborador_nome?: string
  obra_id?: string
  quantidade: number
  tamanho?: string
  data_entrega: string
  data_troca_prevista?: string
  motivo: MotivoEntregaEpi
  missao_id?: string
  assinado: boolean
  entregue_por_nome?: string
  created_at: string
}

export const STATUS_FICHA_EPI_LABEL: Record<StatusFichaEpi, { label: string; light: string; dark: string }> = {
  aguardando_assinatura: { label: 'Aguard. assinatura', light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-400' },
  arquivada:             { label: 'Arquivada',          light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  cancelada:             { label: 'Cancelada',          light: 'bg-red-100 text-red-600',         dark: 'bg-red-500/15 text-red-400' },
}

export interface QsmaTreinamento {
  id: string
  colaborador_id: string
  colaborador_nome?: string
  norma: string
  curso?: string
  carga_horaria?: number
  data_realizacao?: string
  validade_meses?: number
  vencimento?: string
  certificado_path?: string
  obs?: string
  created_at: string
  updated_at: string
}

// ── Meio Ambiente ────────────────────────────────────────────────────────────

export type TipoLicenca = 'licenca' | 'autorizacao' | 'outorga' | 'cadastro'
export type StatusLicenca = 'vigente' | 'em_renovacao' | 'vencida' | 'encerrada'
export type StatusCondicionante = 'pendente' | 'atendida' | 'atrasada'
export type Recorrencia = 'unica' | 'mensal' | 'trimestral' | 'semestral' | 'anual'

export interface QsmaLicenca {
  id: string
  codigo?: string
  obra_id?: string
  tipo: TipoLicenca
  numero?: string
  orgao?: string
  descricao?: string
  emissao?: string
  validade?: string
  status: StatusLicenca
  arquivo_path?: string
  condicionantes?: QsmaCondicionante[]
  created_at: string
  updated_at: string
}

export interface QsmaCondicionante {
  id: string
  licenca_id: string
  descricao: string
  prazo?: string
  recorrencia?: Recorrencia
  responsavel_id?: string
  responsavel_nome?: string
  status: StatusCondicionante
  evidencia_path?: string
  created_at: string
  updated_at: string
}

export interface QsmaEventoAmbiental {
  id: string
  titulo: string
  obra_id?: string
  data: string
  recorrencia?: Recorrencia
  descricao?: string
  status: 'previsto' | 'realizado' | 'cancelado'
  created_at: string
}

export interface QsmaAspecto {
  id: string
  obra_id?: string
  atividade: string
  aspecto: string
  impacto: string
  severidade: number
  controles?: string
  status: string
  created_at: string
  updated_at: string
}

// ── Label maps (light/dark) ──────────────────────────────────────────────────

export const TIPO_OCORRENCIA_LABEL: Record<TipoOcorrencia, string> = {
  desvio: 'Desvio',
  quase_acidente: 'Quase-acidente',
  acidente_spt: 'Acidente s/ afastamento',
  acidente_cpt: 'Acidente c/ afastamento',
  ambiental: 'Ocorrência ambiental',
}

export const GRAVIDADE_LABEL: Record<Gravidade, { label: string; light: string; dark: string }> = {
  baixa:   { label: 'Baixa',   light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
  media:   { label: 'Média',   light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-400' },
  alta:    { label: 'Alta',    light: 'bg-orange-100 text-orange-700',   dark: 'bg-orange-500/15 text-orange-400' },
  critica: { label: 'Crítica', light: 'bg-red-100 text-red-700',         dark: 'bg-red-500/15 text-red-400' },
}

export const STATUS_OCORRENCIA_LABEL: Record<StatusOcorrencia, { label: string; light: string; dark: string }> = {
  registro:     { label: 'Registro',     light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
  investigacao: { label: 'Investigação', light: 'bg-blue-100 text-blue-700',       dark: 'bg-blue-500/15 text-blue-400' },
  acao:         { label: 'Em Ação',      light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-400' },
  encerrada:    { label: 'Encerrada',    light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
}

export const STATUS_INSPECAO_LABEL: Record<StatusInspecao, { label: string; light: string; dark: string }> = {
  programada: { label: 'Programada', light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
  executada:  { label: 'Executada',  light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  cancelada:  { label: 'Cancelada',  light: 'bg-red-100 text-red-600',         dark: 'bg-red-500/15 text-red-400' },
}

export const TIPO_MODELO_LABEL: Record<TipoModelo, string> = {
  inspecao: 'Inspeção',
  apr: 'APR',
  auditoria: 'Auditoria',
}

export const ESCOPO_MODELO_LABEL: Record<EscopoModelo, string> = {
  equipe: 'Equipe',
  veiculo: 'Veículo / Máquina',
  atividade: 'Atividade',
  area: 'Área / Canteiro',
}

export const STATUS_LICENCA_LABEL: Record<StatusLicenca, { label: string; light: string; dark: string }> = {
  vigente:      { label: 'Vigente',      light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  em_renovacao: { label: 'Em Renovação', light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-400' },
  vencida:      { label: 'Vencida',      light: 'bg-red-100 text-red-700',         dark: 'bg-red-500/15 text-red-400' },
  encerrada:    { label: 'Encerrada',    light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
}

export const STATUS_CONDICIONANTE_LABEL: Record<StatusCondicionante, { label: string; light: string; dark: string }> = {
  pendente: { label: 'Pendente', light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-400' },
  atendida: { label: 'Atendida', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  atrasada: { label: 'Atrasada', light: 'bg-red-100 text-red-700',         dark: 'bg-red-500/15 text-red-400' },
}

export const NORMAS_TREINAMENTO = ['NR-06', 'NR-10', 'NR-10 SEP', 'NR-11', 'NR-12', 'NR-18', 'NR-33', 'NR-35', 'Primeiros Socorros', 'Direção Defensiva', 'Outro']

// nível de risco 5×5 (mesma régua do EGP Riscos)
export function nivelRisco(prob: number, sev: number): { valor: number; label: string; cor: string } {
  const v = prob * sev
  if (v >= 17) return { valor: v, label: 'Crítico', cor: '#dc2626' }
  if (v >= 10) return { valor: v, label: 'Alto', cor: '#f97316' }
  if (v >= 5)  return { valor: v, label: 'Médio', cor: '#f59e0b' }
  return { valor: v, label: 'Baixo', cor: '#10b981' }
}
