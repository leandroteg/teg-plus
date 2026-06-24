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
