// Enums do módulo TI (Help Desk).
//
// A fonte da verdade é o BANCO (minúsculas snake_case, igual às tabelas ti_*).
// Os mapas TO_DB/FROM_DB existem para as telas portadas do helpdesk que usam
// os valores em MAIÚSCULA (ABERTO, EM_ANDAMENTO, …) — usados a partir da Fase 2.

export type StatusDb = 'aberto' | 'em_atendimento' | 'aguardando_usuario' | 'resolvido' | 'fechado'
export type PriorityDb = 'baixa' | 'media' | 'alta' | 'urgente'

export const STATUS_LABEL: Record<StatusDb, string> = {
  aberto:             'Aberto',
  em_atendimento:     'Em atendimento',
  aguardando_usuario: 'Aguardando usuário',
  resolvido:          'Resolvido',
  fechado:            'Fechado',
}

export const STATUS_COLOR: Record<StatusDb, string> = {
  aberto:             'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  em_atendimento:     'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  aguardando_usuario: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  resolvido:          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  fechado:            'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
}

export const PRIORITY_LABEL: Record<PriorityDb, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
}

export const PRIORITY_DOT: Record<PriorityDb, string> = {
  baixa: 'bg-slate-400', media: 'bg-sky-500', alta: 'bg-amber-500', urgente: 'bg-rose-500',
}

/** Código exibível do chamado — alinhado ao banco (triggers usam CH-####). */
export function formatCode(numero: number): string {
  return `CH-${String(numero).padStart(4, '0')}`
}

// ── Pontes EN (helpdesk) ⇄ DB (Supabase) — base para as telas portadas ──────────
export type StatusEn = 'ABERTO' | 'EM_ANDAMENTO' | 'AGUARDANDO' | 'RESOLVIDO' | 'FECHADO'
export type PriorityEn = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'

export const STATUS_TO_DB: Record<StatusEn, StatusDb> = {
  ABERTO: 'aberto',
  EM_ANDAMENTO: 'em_atendimento',
  AGUARDANDO: 'aguardando_usuario',
  RESOLVIDO: 'resolvido',
  FECHADO: 'fechado',
}
export const STATUS_FROM_DB: Record<StatusDb, StatusEn> = {
  aberto: 'ABERTO',
  em_atendimento: 'EM_ANDAMENTO',
  aguardando_usuario: 'AGUARDANDO',
  resolvido: 'RESOLVIDO',
  fechado: 'FECHADO',
}
export const PRIORITY_TO_DB: Record<PriorityEn, PriorityDb> = {
  BAIXA: 'baixa', MEDIA: 'media', ALTA: 'alta', URGENTE: 'urgente',
}
export const PRIORITY_FROM_DB: Record<PriorityDb, PriorityEn> = {
  baixa: 'BAIXA', media: 'MEDIA', alta: 'ALTA', urgente: 'URGENTE',
}
