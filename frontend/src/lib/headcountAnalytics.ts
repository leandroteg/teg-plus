// ─────────────────────────────────────────────────────────────────────────────
// lib/headcountAnalytics.ts — Agregações puras dos painéis de Headcount (RH).
// Tudo derivado de rh_colaboradores (data_admissao/data_demissao/cargo/tipo/salario).
// Os HTMLs originais foram montados de planilhas; aqui usamos os dados REAIS do banco.
// ─────────────────────────────────────────────────────────────────────────────

export interface HeadcountRow {
  id: string
  nome: string
  cargo: string
  tipo_contrato: string
  data_admissao: string | null
  data_demissao: string | null
  salario: number | null
  ativo: boolean
}

// ── Setores (8 dos HTMLs) — derivados do cargo, já que rh_colaboradores.setor está vazio ──
export interface SetorDef { key: string; label: string; color: string }
export const SETORES: SetorDef[] = [
  { key: 'fundacao',   label: 'Fundação e Solo',        color: '#e87b2a' },
  { key: 'montagem',   label: 'Montagem e Lançamento',  color: '#2d6cdf' },
  { key: 'logistica',  label: 'Logística e Estoque',    color: '#16a34a' },
  { key: 'admapoio',   label: 'Adm e Apoio',            color: '#7c3aed' },
  { key: 'seguranca',  label: 'Segurança e Meio Amb.',  color: '#dc2626' },
  { key: 'servicos',   label: 'Serviços Gerais',        color: '#64748b' },
  { key: 'topografia', label: 'Topografia',             color: '#0891b2' },
  { key: 'florestal',  label: 'Op. Florestais',         color: '#65a30d' },
  { key: 'outros',     label: 'Outros',                 color: '#94a3b8' },
]
export const SETOR_LABEL: Record<string, string> = Object.fromEntries(SETORES.map(s => [s.key, s.label]))
export const SETOR_COLOR: Record<string, string> = Object.fromEntries(SETORES.map(s => [s.key, s.color]))

// Regras por palavra-chave (1ª que casar vence). Heurística sobre os ~125 cargos.
const REGRAS_SETOR: Array<{ re: RegExp; key: string }> = [
  { re: /TOPOGRAF|AGRIMENSOR|NIVELAD/, key: 'topografia' },
  { re: /FLOREST|MOTOSSERR|ROÇAD|ROCAD|PODA|SUPRESS|MEIO AMBIENTE|AMBIENTAL/, key: 'florestal' },
  { re: /SEGURAN|\bTST\b|BOMBEIR|ENFERM|T[ÉE]CNICO.*SEGURAN/, key: 'seguranca' },
  { re: /SERVI[ÇC]OS GERAIS|LIMPEZA|COZINH|COPEIR|ZELAD|JARDIN|MERENDEIR/, key: 'servicos' },
  { re: /MOTORISTA|MOTOBOY|LOG[ÍI]STIC|ESTOQU|ALMOXARIF|CAMINH|GUINDAUTO|MUNCK|EMPILHAD|OPERADOR DE M[ÁA]QUIN|OPERADOR DE GUINDA|GUINCH/, key: 'logistica' },
  { re: /MONTADOR|MONTAGEM|LAN[ÇC]A|ELETRICISTA|LINHA DE TRANSM|\bLT\b|CABIST|RIGGER|TRACIONAMENTO/, key: 'montagem' },
  { re: /SERVENTE|PEDREIR|ARMADOR|CARPINTEIR|FUNDA[ÇC]|CONCRET|PERFUR|ESCAVA|SOLDADOR|AJUDANTE|FERREIR|BETONEIR/, key: 'fundacao' },
  { re: /ADMINISTR|FINANC|COMPRAS|ANALISTA|ASSISTENTE|AUXILIAR DE ESCRIT|\bRH\b|RECURSOS HUMANOS|RECEPC|ESTAGI|ENCARREGAD|SUPERVISOR|COORDENAD|GERENTE|ENGENHEIR|T[ÉE]CNICO DE EDIF|APONTAD|APOIO|SECRET|ALMOXARIFE|FISCAL|MESTRE/, key: 'admapoio' },
]
export function cargoParaSetor(cargo?: string | null): string {
  const c = (cargo || '').toUpperCase()
  if (!c.trim()) return 'outros'
  for (const r of REGRAS_SETOR) if (r.re.test(c)) return r.key
  return 'outros'
}

// ── Datas / meses ────────────────────────────────────────────────────────────
export function parseData(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s.slice(0, 10) + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}
export function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export function ymLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MESES_ABREV[Number(m) - 1]}/${y.slice(2)}`
}
/** Lista de 'YYYY-MM' de fromYM até toYM inclusive. */
export function listaMeses(fromYM: string, toYM: string): string[] {
  const out: string[] = []
  let [y, m] = fromYM.split('-').map(Number)
  const [ty, tm] = toYM.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}
function ultimoDiaDoMes(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0, 23, 59, 59)
}

/** Estava ativo no fim do mês `ym`? (admitido até o fim e não desligado até lá) */
function ativoNoFim(row: HeadcountRow, fim: Date): boolean {
  const adm = parseData(row.data_admissao)
  if (!adm || adm > fim) return false
  const dem = parseData(row.data_demissao)
  if (dem) return dem > fim
  // sem data de demissão: conta se ainda ativo hoje (inativos sem data ficam de fora da linha do tempo)
  return row.ativo
}

export function tempoMeses(adm: Date, ref: Date): number {
  return (ref.getFullYear() - adm.getFullYear()) * 12 + (ref.getMonth() - adm.getMonth())
}
export interface FaixaTempo { key: string; label: string }
export const FAIXAS_TEMPO: FaixaTempo[] = [
  { key: 'm1', label: 'menos de 1 mês' },
  { key: 'm1_6', label: '1 a 6 meses' },
  { key: 'm6_12', label: '6 a 12 meses' },
  { key: 'a1_2', label: '1 a 2 anos' },
  { key: 'a2', label: 'mais de 2 anos' },
]
export function faixaTempoKey(meses: number): string {
  if (meses < 1) return 'm1'
  if (meses < 6) return 'm1_6'
  if (meses < 12) return 'm6_12'
  if (meses < 24) return 'a1_2'
  return 'a2'
}
export function tempoEmpresaTexto(adm: Date, ref: Date): string {
  const m = Math.max(tempoMeses(adm, ref), 0)
  if (m < 1) return 'menos de 1 mês'
  const anos = Math.floor(m / 12), meses = m % 12
  const pa = anos > 0 ? `${anos} ano${anos > 1 ? 's' : ''}` : ''
  const pm = meses > 0 ? `${meses} ${meses > 1 ? 'meses' : 'mês'}` : ''
  return [pa, pm].filter(Boolean).join(' e ') || `${m} meses`
}

const isPJ = (t?: string) => (t || '').toUpperCase() === 'PJ'
const isCLT = (t?: string) => { const u = (t || 'CLT').toUpperCase(); return u === 'CLT' || u === '' }

// ── EVOLUÇÃO: série mensal de efetivo / entradas / saídas / turnover ──────────
export interface MesSerie {
  ym: string; label: string
  clt: number; pj: number; outros: number; total: number
  entradas: number; saidas: number; saldo: number; turnover: number
}
export function serieMensal(rows: HeadcountRow[], fromYM: string, toYM: string): MesSerie[] {
  return listaMeses(fromYM, toYM).map(ym => {
    const fim = ultimoDiaDoMes(ym)
    let clt = 0, pj = 0, outros = 0
    let entradas = 0, saidas = 0
    for (const r of rows) {
      if (ativoNoFim(r, fim)) {
        if (isPJ(r.tipo_contrato)) pj++
        else if (isCLT(r.tipo_contrato)) clt++
        else outros++
      }
      const adm = parseData(r.data_admissao)
      if (adm && ymKey(adm) === ym) entradas++
      const dem = parseData(r.data_demissao)
      if (dem && ymKey(dem) === ym) saidas++
    }
    const total = clt + pj + outros
    return { ym, label: ymLabel(ym), clt, pj, outros, total, entradas, saidas, saldo: entradas - saidas, turnover: total ? (saidas / total) * 100 : 0 }
  })
}

// ── COMPOSIÇÃO atual por setor + cargos ───────────────────────────────────────
export interface SetorComposicao {
  key: string; label: string; color: string; total: number; pct: number
  cargos: Array<{ cargo: string; n: number }>
}
export function composicaoAtual(rows: HeadcountRow[]): { setores: SetorComposicao[]; total: number } {
  const ativos = rows.filter(r => r.ativo)
  const total = ativos.length || 1
  const map = new Map<string, { total: number; cargos: Map<string, number> }>()
  for (const r of ativos) {
    const k = cargoParaSetor(r.cargo)
    if (!map.has(k)) map.set(k, { total: 0, cargos: new Map() })
    const e = map.get(k)!
    e.total++
    const cg = (r.cargo || '—').toUpperCase().trim()
    e.cargos.set(cg, (e.cargos.get(cg) || 0) + 1)
  }
  const setores = SETORES.map(s => {
    const e = map.get(s.key)
    const tot = e?.total || 0
    return {
      key: s.key, label: s.label, color: s.color, total: tot, pct: (tot / total) * 100,
      cargos: e ? [...e.cargos.entries()].map(([cargo, n]) => ({ cargo, n })).sort((a, b) => b.n - a.n) : [],
    }
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total)
  return { setores, total: ativos.length }
}

/** Efetivo ativo por setor × mês (para barras empilhadas). */
export function evolucaoPorSetor(rows: HeadcountRow[], meses: string[]): { meses: string[]; series: Array<{ key: string; label: string; color: string; valores: number[] }> } {
  const series = SETORES.map(s => ({ key: s.key, label: s.label, color: s.color, valores: meses.map(() => 0) }))
  const idx = new Map(series.map((s, i) => [s.key, i]))
  meses.forEach((ym, mi) => {
    const fim = ultimoDiaDoMes(ym)
    for (const r of rows) {
      if (!ativoNoFim(r, fim)) continue
      const si = idx.get(cargoParaSetor(r.cargo))!
      series[si].valores[mi]++
    }
  })
  return { meses, series: series.filter(s => s.valores.some(v => v > 0)) }
}

/** Faixas de tempo de empresa: ativos (até hoje) vs já saíram (tempo na saída). */
export function tempoEmpresaDist(rows: HeadcountRow[], hoje = new Date()): Array<{ key: string; label: string; ativos: number; saiu: number }> {
  const base = FAIXAS_TEMPO.map(f => ({ key: f.key, label: f.label, ativos: 0, saiu: 0 }))
  const byKey = new Map(base.map(b => [b.key, b]))
  for (const r of rows) {
    const adm = parseData(r.data_admissao); if (!adm) continue
    const dem = parseData(r.data_demissao)
    const ref = dem || hoje
    const fk = faixaTempoKey(Math.max(tempoMeses(adm, ref), 0))
    const e = byKey.get(fk)!
    if (dem) e.saiu++; else if (r.ativo) e.ativos++
  }
  return base
}

// ── TURNOVER: saídas por faixa/cargo/mês + custo (salário × multiplicador) ────
// Multiplicadores de custo por faixa de tempo (premissa do modelo; salário vem do banco).
export const MULT_CUSTO: Record<string, number> = { m1: 1.5, m1_6: 2.0, m6_12: 2.5, a1_2: 3.0, a2: 3.0 }

export interface TurnoverAgg {
  totalSaidas: number
  saidasSemData: number
  custoTotal: number
  temSalario: boolean
  porFaixa: Array<{ key: string; label: string; saidas: number; custo: number }>
  porCargo: Array<{ cargo: string; popTotal: number; saidas: number; pctTurnover: number; custo: number }>
  heatmap: {
    meses: Array<{ ym: string; mes: string; ano: string }>
    linhas: Array<{ key: string; label: string; color: string; valores: number[]; total: number }>
    totalMes: number[]
  }
}
export function turnoverAgg(rows: HeadcountRow[], fromYM?: string, toYM?: string): TurnoverAgg {
  const noIntervalo = (d: Date) => { const k = ymKey(d); return (!fromYM || k >= fromYM) && (!toYM || k <= toYM) }
  const saidas = rows.filter(r => { const d = parseData(r.data_demissao); return d && noIntervalo(d) })
  const saidasSemData = rows.filter(r => !r.ativo && !parseData(r.data_demissao)).length

  // por faixa de tempo na saída + custo
  const porFaixaMap = new Map(FAIXAS_TEMPO.map(f => [f.key, { key: f.key, label: f.label, saidas: 0, custo: 0 }]))
  let custoTotal = 0, comSalario = 0
  for (const r of saidas) {
    const adm = parseData(r.data_admissao), dem = parseData(r.data_demissao)!
    const fk = adm ? faixaTempoKey(Math.max(tempoMeses(adm, dem), 0)) : 'm1'
    const e = porFaixaMap.get(fk)!
    e.saidas++
    const sal = r.salario || 0
    if (sal > 0) comSalario++
    const custo = sal * (MULT_CUSTO[fk] || 2)
    e.custo += custo; custoTotal += custo
  }

  // por cargo (saídas + população que passou pelo cargo)
  const popCargo = new Map<string, number>()
  for (const r of rows) { const cg = (r.cargo || '—').toUpperCase().trim(); popCargo.set(cg, (popCargo.get(cg) || 0) + 1) }
  const saiCargo = new Map<string, { saidas: number; custo: number }>()
  for (const r of saidas) {
    const cg = (r.cargo || '—').toUpperCase().trim()
    const adm = parseData(r.data_admissao), dem = parseData(r.data_demissao)!
    const fk = adm ? faixaTempoKey(Math.max(tempoMeses(adm, dem), 0)) : 'm1'
    const e = saiCargo.get(cg) || { saidas: 0, custo: 0 }
    e.saidas++; e.custo += (r.salario || 0) * (MULT_CUSTO[fk] || 2)
    saiCargo.set(cg, e)
  }
  const porCargo = [...saiCargo.entries()].map(([cargo, v]) => {
    const pop = popCargo.get(cargo) || v.saidas
    return { cargo, popTotal: pop, saidas: v.saidas, pctTurnover: pop ? (v.saidas / pop) * 100 : 0, custo: v.custo }
  }).sort((a, b) => b.saidas - a.saidas)

  // heatmap setor × mês — único, colunas = meses do intervalo do filtro
  const mesesYM = listaMeses(fromYM || '2025-01', toYM || ymKey(new Date()))
  const mesesInfo = mesesYM.map(ym => { const [y, m] = ym.split('-'); return { ym, mes: MESES_ABREV[Number(m) - 1], ano: y.slice(2) } })
  const idxMes = new Map(mesesYM.map((ym, i) => [ym, i]))
  const hmLinhas = SETORES.map(s => ({ key: s.key, label: s.label, color: s.color, valores: mesesYM.map(() => 0), total: 0 }))
  const idxSetor = new Map(hmLinhas.map((l, i) => [l.key, i]))
  const totalMes = mesesYM.map(() => 0)
  for (const r of saidas) {
    const mi = idxMes.get(ymKey(parseData(r.data_demissao)!))
    if (mi === undefined) continue
    const li = idxSetor.get(cargoParaSetor(r.cargo))!
    hmLinhas[li].valores[mi]++; hmLinhas[li].total++; totalMes[mi]++
  }
  const heatmap = { meses: mesesInfo, linhas: hmLinhas.filter(l => l.total > 0), totalMes }

  return { totalSaidas: saidas.length, saidasSemData, custoTotal, temSalario: comSalario > 0, porFaixa: [...porFaixaMap.values()], porCargo, heatmap }
}

export const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
