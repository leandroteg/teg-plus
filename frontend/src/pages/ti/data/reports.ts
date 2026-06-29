// Relatórios (agregações de ti_chamados). Reproduz o /reports/summary do server
// no cliente: busca os chamados do período e agrega em JS. Sem RPC/migration.
import { supabase } from './supabase'
import { STATUS_FROM_DB, PRIORITY_FROM_DB } from './enums'
import type { Status, Priority } from './shapes'

export interface NameValue { name: string; value: number }
export interface ReportSummary {
  range: { from: string; to: string }
  total: number
  resolvedCount: number
  avgResolutionHours: number
  slaCompliance: number | null
  byStatus: Record<Status, number>
  byPriority: Record<Priority, number>
  byCategory: NameValue[]
  bySector: NameValue[]
  byAgent: NameValue[]
  series: { date: string; count: number }[]
}

const STATUSES_EN: Status[] = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO']
const PRIORITIES_EN: Priority[] = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']

const REPORT_SELECT = `
  status, prioridade, created_at, resolved_at, due_at,
  cat:ti_categorias!ti_chamados_categoria_id_fkey(nome),
  setor:ti_setores!ti_chamados_setor_id_fkey(nome),
  atendente:sys_perfis!ti_chamados_atendente_id_fkey(nome)
`

export async function getReportSummary(from: string, to: string): Promise<ReportSummary> {
  const fromIso = new Date(`${from}T00:00:00`).toISOString()
  const toIso = new Date(`${to}T23:59:59`).toISOString()
  const { data, error } = await supabase
    .from('ti_chamados')
    .select(REPORT_SELECT)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
  if (error) throw error

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const tickets = (data ?? []) as any[]
  const byStatus = Object.fromEntries(STATUSES_EN.map((s) => [s, 0])) as Record<Status, number>
  const byPriority = Object.fromEntries(PRIORITIES_EN.map((p) => [p, 0])) as Record<Priority, number>
  const byCategory: Record<string, number> = {}
  const bySector: Record<string, number> = {}
  const byAgent: Record<string, number> = {}
  const byDay: Record<string, number> = {}
  let resolvedCount = 0, resolutionMsSum = 0, slaMet = 0, slaConsidered = 0

  for (const t of tickets) {
    const st: Status = STATUS_FROM_DB[t.status as keyof typeof STATUS_FROM_DB] ?? 'ABERTO'
    const pr: Priority = PRIORITY_FROM_DB[t.prioridade as keyof typeof PRIORITY_FROM_DB] ?? 'MEDIA'
    byStatus[st] = (byStatus[st] || 0) + 1
    byPriority[pr] = (byPriority[pr] || 0) + 1
    const cat = t.cat?.nome || 'Sem categoria'; byCategory[cat] = (byCategory[cat] || 0) + 1
    const sec = t.setor?.nome || 'Sem setor'; bySector[sec] = (bySector[sec] || 0) + 1
    const ag = t.atendente?.nome || 'Não atribuído'; byAgent[ag] = (byAgent[ag] || 0) + 1
    const day = String(t.created_at).slice(0, 10); byDay[day] = (byDay[day] || 0) + 1
    if (t.resolved_at) {
      resolvedCount++
      resolutionMsSum += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()
      if (t.due_at) { slaConsidered++; if (new Date(t.resolved_at) <= new Date(t.due_at)) slaMet++ }
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const toArr = (obj: Record<string, number>): NameValue[] =>
    Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  return {
    range: { from: fromIso, to: toIso },
    total: tickets.length,
    resolvedCount,
    avgResolutionHours: resolvedCount ? +(resolutionMsSum / resolvedCount / 3600000).toFixed(1) : 0,
    slaCompliance: slaConsidered ? Math.round((slaMet / slaConsidered) * 100) : null,
    byStatus,
    byPriority,
    byCategory: toArr(byCategory),
    bySector: toArr(bySector),
    byAgent: toArr(byAgent),
    series: Object.entries(byDay).sort().map(([date, count]) => ({ date, count })),
  }
}
