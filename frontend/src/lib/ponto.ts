// lib/ponto.ts — helpers do módulo Ponto (DP)

// Postgres interval (via PostgREST) chega como "HH:MM:SS", "X days HH:MM:SS" ou negativo.
// Formata para "185h00" (ou "-2h30"). Retorna "—" se vazio/zero-irrelevante.
export function fmtHoras(s?: string | null, dashIfZero = true): string {
  if (!s) return dashIfZero ? '—' : '0h00'
  const neg = s.trim().startsWith('-')
  let str = neg ? s.trim().slice(1) : s.trim()
  let days = 0
  const dm = str.match(/(\d+)\s+day/)
  if (dm) { days = Number(dm[1]); str = str.replace(/.*day[s]?\s*/, '') }
  const parts = str.split(':')
  const h = Number(parts[0] || 0)
  const m = Number(parts[1] || 0)
  const totalH = days * 24 + h
  if (dashIfZero && totalH === 0 && m === 0) return '—'
  const out = `${totalH}h${String(m).padStart(2, '0')}`
  return neg ? `-${out}` : out
}

// soma de intervalos (em strings) -> minutos
export function intervalToMin(s?: string | null): number {
  if (!s) return 0
  const neg = s.trim().startsWith('-')
  let str = neg ? s.trim().slice(1) : s.trim()
  let days = 0
  const dm = str.match(/(\d+)\s+day/)
  if (dm) { days = Number(dm[1]); str = str.replace(/.*day[s]?\s*/, '') }
  const [h = 0, m = 0] = str.split(':').map(Number)
  const total = days * 24 * 60 + h * 60 + m
  return neg ? -total : total
}

export function minToHoras(min: number): string {
  const neg = min < 0
  const a = Math.abs(min)
  const out = `${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`
  return neg ? `-${out}` : out
}

// "07:00:00" -> "07:00"
export function fmtHora(s?: string | null): string {
  if (!s) return ''
  return s.slice(0, 5)
}

// ano_mes atual no formato YYYY-MM-01
export function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// rótulo "junho/2026"
export function labelMes(anoMes: string): string {
  const [y, m] = anoMes.split('-').map(Number)
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${meses[(m || 1) - 1]}/${y}`
}

// lista de meses (YYYY-MM-01) dos últimos N meses
export function ultimosMeses(n = 12): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

// datas ISO YYYY-MM-DD
export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function ontemISO(): string {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// proximo mes (p/ filtros de data) a partir de YYYY-MM-01
export function proximoMes(anoMes: string): string {
  const [y, m] = anoMes.split('-').map(Number)
  const d = new Date(y, (m || 1), 1) // m já é +1 (mês seguinte) pois Date é 0-based
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Jornada padrão da empresa (exceto motoristas): seg–qui 07:00–17:00, sex 07:00–16:00 ──
// tolerância de 10 min para mais ou para menos (desvio simétrico)
export const JORNADA_TOL_MIN = 10

export function ehMotorista(cargo?: string | null): boolean {
  return /motorista/i.test(cargo ?? '')
}

// referência do dia em minutos (entrada / fim da jornada), ou null em fim de semana
export function refJornada(dataISO: string): { entrada: number; saidaFim: number } | null {
  const dow = new Date(dataISO + 'T00:00:00').getDay() // 0=dom … 6=sáb
  if (dow === 0 || dow === 6) return null
  return { entrada: 7 * 60, saidaFim: (dow === 5 ? 16 : 17) * 60 }
}

// "07:30:00" | "07:30" -> minutos do dia; null se vazio/inválido
function horaMin(s?: string | null): number | null {
  if (!s) return null
  const [h, m] = s.split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}

export interface ForaHorario { entrada1: boolean; saida1: boolean; saida2: boolean; algum: boolean }
const FORA_NONE: ForaHorario = { entrada1: false, saida1: false, saida2: false, algum: false }

// batidas fora da referência — entrada1 vs 07:00 e fim do dia (saida2) vs 17:00/16:00.
// saida1 é almoço (sem referência, nunca marcado). Dia sem saida2 só avalia a entrada
// (não marca saída até fechar -> falta de saida2 cai em "ponto em aberto").
// Motorista ou fim de semana => nada fora.
export function batidasForaHorario(row: {
  data: string; cargo?: string | null
  entrada1: string | null; saida1?: string | null; saida2: string | null
}): ForaHorario {
  if (ehMotorista(row.cargo)) return FORA_NONE
  const ref = refJornada(row.data)
  if (!ref) return FORA_NONE
  const e1 = horaMin(row.entrada1)
  const entrada1 = e1 != null && Math.abs(e1 - ref.entrada) > JORNADA_TOL_MIN
  const s2 = horaMin(row.saida2)
  const saida2 = s2 != null && Math.abs(s2 - ref.saidaFim) > JORNADA_TOL_MIN
  return { entrada1, saida1: false, saida2, algum: entrada1 || saida2 }
}

// ponto em aberto = par de batida incompleto (entrou e não saiu)
export function pontoEmAberto(row: {
  entrada1: string | null; saida1: string | null; entrada2: string | null; saida2: string | null
}): boolean {
  return (!!row.entrada1 && !row.saida1) || (!!row.entrada2 && !row.saida2)
}
