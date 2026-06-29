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

// proximo mes (p/ filtros de data) a partir de YYYY-MM-01
export function proximoMes(anoMes: string): string {
  const [y, m] = anoMes.split('-').map(Number)
  const d = new Date(y, (m || 1), 1) // m já é +1 (mês seguinte) pois Date é 0-based
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
