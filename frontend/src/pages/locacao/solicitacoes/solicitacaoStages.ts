// ─────────────────────────────────────────────────────────────────────────────
// Etapas da solicitação de Locação — as mesmas seis da OS de Frotas, para que
// quem opera os dois módulos não precise aprender dois fluxos.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ClipboardCheck, FileSearch, ShieldCheck, CalendarClock, Cog, PauseCircle, CheckCircle2,
} from 'lucide-react'
import type { StatusSolicitacao } from '../../../types/locacao'

export type StageKey =
  | 'pendente' | 'em_cotacao' | 'aguardando_aprovacao' | 'aprovada' | 'em_execucao'
  | 'aguardando' | 'concluida'

export interface Stage {
  key: StageKey
  label: string
  icon: React.ElementType
}

export const STAGES: Stage[] = [
  { key: 'pendente',             label: 'Pendente',    icon: ClipboardCheck },
  { key: 'em_cotacao',           label: 'Cotação',     icon: FileSearch },
  { key: 'aguardando_aprovacao', label: 'Aprovação',   icon: ShieldCheck },
  { key: 'aprovada',             label: 'Programação', icon: CalendarClock },
  { key: 'em_execucao',          label: 'Execução',    icon: Cog },
  { key: 'aguardando',           label: 'Aguardando',  icon: PauseCircle },
  { key: 'concluida',            label: 'Liberado',    icon: CheckCircle2 },
]

/**
 * Traduz o status gravado para a etapa do quadro. Os dois status antigos
 * ('aberta', 'em_andamento') continuam válidos no banco e caem na etapa
 * equivalente — mesma tolerância que Frotas tem com 'aberta'.
 */
export function stageDe(status: StatusSolicitacao | string): StageKey {
  if (status === 'aberta') return 'pendente'
  if (status === 'em_andamento') return 'em_execucao'
  return status as StageKey
}

export const ENCERRADOS = ['concluida', 'cancelada', 'rejeitada']

/** Para onde o botão "Retomar" devolve a solicitação que estava em Aguardando. */
export const STAGE_RETOMA_LABEL: Record<string, string> = {
  pendente: 'Pendente', em_cotacao: 'Cotação', aguardando_aprovacao: 'Aprovação',
  aprovada: 'Programação', em_execucao: 'Execução',
}

/**
 * "Aguardando" é uma saída LATERAL do fluxo (a solicitação para, mas não foi
 * cancelada nem executada) — não é um passo entre Execução e Liberado. Por isso
 * o avanço linear ignora esse bucket: de Execução vai direto para Liberado, e de
 * Aguardando não se avança (sai pelo botão Retomar).
 */
const FLUXO: StageKey[] = [
  'pendente', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'em_execucao', 'concluida',
]

export function proximaEtapa(atual: StageKey): Stage | null {
  const i = FLUXO.indexOf(atual)
  if (i < 0 || i >= FLUXO.length - 1) return null
  const prox = FLUXO[i + 1]
  return STAGES.find(s => s.key === prox) ?? null
}

type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }

export const STAGE_ACCENT: Record<StageKey, AccentSet> = {
  pendente:             { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   badge:'bg-slate-200/80 text-slate-600',    border:'border-slate-200' },
  aguardando:           { bg:'bg-orange-50',  bgActive:'bg-orange-100',  text:'text-orange-500',  textActive:'text-orange-800',  badge:'bg-orange-200/80 text-orange-700',  border:'border-orange-200' },
  em_cotacao:           { bg:'bg-sky-50',     bgActive:'bg-sky-100',     text:'text-sky-500',     textActive:'text-sky-800',     badge:'bg-sky-200/80 text-sky-700',        border:'border-sky-200' },
  aguardando_aprovacao: { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   badge:'bg-amber-200/80 text-amber-700',    border:'border-amber-200' },
  aprovada:             { bg:'bg-teal-50',    bgActive:'bg-teal-100',    text:'text-teal-500',    textActive:'text-teal-800',    badge:'bg-teal-200/80 text-teal-700',      border:'border-teal-200' },
  em_execucao:          { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  badge:'bg-violet-200/80 text-violet-700',  border:'border-violet-200' },
  concluida:            { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', badge:'bg-emerald-200/80 text-emerald-700',border:'border-emerald-200' },
}

export const STAGE_ACCENT_DARK: Record<StageKey, AccentSet> = {
  pendente:             { bg:'bg-white/[0.02]',  bgActive:'bg-white/[0.06]',   text:'text-slate-500',   textActive:'text-slate-200',   badge:'bg-white/[0.06] text-slate-400',     border:'border-white/[0.08]' },
  aguardando:           { bg:'bg-orange-500/5',     bgActive:'bg-orange-500/15',     text:'text-orange-400',     textActive:'text-orange-200',     badge:'bg-orange-500/15 text-orange-300',         border:'border-orange-500/20' },
  em_cotacao:           { bg:'bg-sky-500/5',     bgActive:'bg-sky-500/15',     text:'text-sky-400',     textActive:'text-sky-200',     badge:'bg-sky-500/15 text-sky-300',         border:'border-sky-500/20' },
  aguardando_aprovacao: { bg:'bg-amber-500/5',   bgActive:'bg-amber-500/15',   text:'text-amber-400',   textActive:'text-amber-200',   badge:'bg-amber-500/15 text-amber-300',     border:'border-amber-500/20' },
  aprovada:             { bg:'bg-teal-500/5',    bgActive:'bg-teal-500/15',    text:'text-teal-400',    textActive:'text-teal-200',    badge:'bg-teal-500/15 text-teal-300',       border:'border-teal-500/20' },
  em_execucao:          { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',  text:'text-violet-400',  textActive:'text-violet-200',  badge:'bg-violet-500/15 text-violet-300',   border:'border-violet-500/20' },
  concluida:            { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15', text:'text-emerald-400', textActive:'text-emerald-200', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
}
