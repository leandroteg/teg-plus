// Engine compartilhada do Cronograma/Histograma — lógica pura (árvore, precedência, projeção mês a mês)
// Usada por CronogramaPainel (R$/qtd) e HistogramaPainel (recursos: pessoas + máquinas).
import type { EAPPoloRaw } from '../../../hooks/usePMO'

// drivers de construção (pp = produtividade padrão por pessoa/mês; maq = máquinas padrão por pessoa)
export const DRV = [
  { pac: 'Fundações', label: 'Fundação', uni: 'm³', cor: '#92400e', pp: 40, maq: 0.3 },
  { pac: 'Montagem de Torres', label: 'Montagem', uni: 'ton', cor: '#374151', pp: 8, maq: 0.25 },
  { pac: 'Lançamento de Cabos', label: 'Lançamento', uni: 'km', cor: '#3730a3', pp: 1.2, maq: 0.2 },
]
// tudo que não é driver (topografia, canteiro, adm, outros) → "ADM + Outros" (só R$)
export const OUTROS_PAC = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Administração Local', 'Outros']
export const COR_OUTROS = '#6d28d9'

const MES_ABR = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_ABR[+m]}/${y.slice(2)}` }
export const shiftYM = (ym: string, d: number) => { let [y, m] = ym.split('-').map(Number); m += d; while (m > 12) { m -= 12; y++ } while (m < 1) { m += 12; y-- } return `${y}-${String(m).padStart(2, '0')}` }
export const startYM = () => { const d = new Date(); return shiftYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 1) }
export const fmtM = (v: number) => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k' : 'R$ ' + Math.round(v)
export const fmtQ = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : (Number.isInteger(v) ? String(v) : v.toFixed(1))
export const ymNum = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y * 12 + m }

// indicador de produtividade/ritmo: físico vs prazo decorrido
export function ritmoCor(pctFis: number, ini: string | null, fim: string | null): string {
  if (!ini || !fim) return '#94a3b8'
  const t0 = Date.parse(ini), t1 = Date.parse(fim), now = Date.now()
  if (!(t1 > t0)) return '#94a3b8'
  const dec = Math.min(100, Math.max(0, (now - t0) / (t1 - t0) * 100))
  const d = pctFis - dec
  return d >= 0 ? '#10b981' : d >= -15 ? '#f59e0b' : '#ef4444'
}
// indicador de prazo: término previsto (YYYY-MM) vs vencimento
export function prazoCor(termino: string | null, fim: string | null): string {
  if (!termino || !fim) return '#94a3b8'
  const diff = ymNum(termino) - ymNum(fim.slice(0, 7))
  return diff <= 0 ? '#10b981' : diff <= 2 ? '#f59e0b' : '#ef4444'
}
export const worstCor = (cs: string[]) => cs.includes('#ef4444') ? '#ef4444' : cs.includes('#f59e0b') ? '#f59e0b' : cs.includes('#10b981') ? '#10b981' : '#94a3b8'

export type Drv = { label: string; uni: string; cor: string; pac: string; contr: number; real: number; valor: number; fat: number; saldoQ: number; saldoR: number; pctFis: number }
export type Obra = { nome: string; frente: string; drivers: Drv[]; saldoR: number; outrosR: number; omR: number; omOscs: string[]; pctFis: number; ini: string | null; fim: string | null }
export type Frente = { label: string; obras: Obra[] }
// prodPP: produtividade por pessoa/mês por driver; equipe: nº de pessoas por obra → por driver
export type Config = { prodPP: Record<string, number>; equipe: Record<string, Record<string, number>>; horizonte: number; precedencia?: boolean; lag?: number }
export type Versao = { id: string; nome: string; config: Config; updated_at: string }

export function emptyDrivers(): Drv[] { return DRV.map(d => ({ ...d, contr: 0, real: 0, valor: 0, fat: 0, saldoQ: 0, saldoR: 0, pctFis: 0 })) }

// árvore frente → obra → drivers (saldo) a partir do raw da EAP
export function buildTree(raw: EAPPoloRaw[] | undefined): Frente[] {
  const frentes = new Map<string, { label: string; obras: Map<string, { drivers: Drv[]; outrosR: number; omR: number; omOscs: string[]; ini: string | null; fim: string | null }> }>()
  for (const polo of (raw ?? [])) {
    let fr = frentes.get(polo.label); if (!fr) { fr = { label: polo.label, obras: new Map() }; frentes.set(polo.label, fr) }
    for (const o of polo.oscs) {
      if (o.etapa_atual === 'cancelada') continue
      if (o.tipo !== 'construcao' && o.tipo !== 'manutencao') continue // exclui depósito; construção+O&M
      let od = fr.obras.get(o.obra_nome); if (!od) { od = { drivers: emptyDrivers(), outrosR: 0, omR: 0, omOscs: [], ini: null, fim: null }; fr.obras.set(o.obra_nome, od) }
      const di = o.data_osc?.slice(0, 10); if (di && (!od.ini || di < od.ini)) od.ini = di
      const dv = o.vencimento?.slice(0, 10); if (dv && (!od.fim || dv > od.fim)) od.fim = dv
      if (o.tipo === 'manutencao') { // O&M → uma linha "Execução" (saldo R$ total), identificando a OSC
        let s = 0; for (const pa of Object.values(o.pacotes)) s += Math.max(0, pa.valor - pa.fat)
        if (s > 0) { od.omR += s; if (o.numero_os && !od.omOscs.includes(o.numero_os)) od.omOscs.push(o.numero_os) }
        continue
      }
      for (const [pn, pa] of Object.entries(o.pacotes)) {
        const d = od.drivers.find(x => x.pac === pn)
        if (d) { d.contr += pa.qC; d.real += pa.qR; d.valor += pa.valor; d.fat += pa.fat; d.saldoR += Math.max(0, pa.valor - pa.fat) }
        else if (OUTROS_PAC.includes(pn)) od.outrosR += Math.max(0, pa.valor - pa.fat)
      }
    }
  }
  return [...frentes.values()].map(fr => ({
    label: fr.label,
    obras: [...fr.obras.entries()].map(([nome, od]) => {
      od.drivers.forEach(d => { d.saldoQ = Math.max(0, d.contr - d.real); d.pctFis = d.contr ? Math.round(d.real / d.contr * 100) : 0 })
      const wf = od.drivers.filter(d => d.contr > 0); const wsum = wf.reduce((s, d) => s + d.valor, 0)
      const pctFis = wsum ? Math.round(wf.reduce((s, d) => s + (d.real / d.contr * 100) * d.valor, 0) / wsum) : 0
      return { nome, frente: fr.label, drivers: od.drivers, outrosR: od.outrosR, omR: od.omR, omOscs: od.omOscs, ini: od.ini, fim: od.fim, pctFis, saldoR: od.drivers.reduce((s, d) => s + d.saldoR, 0) + od.outrosR + od.omR } as Obra
    }).filter(o => o.drivers.some(d => d.contr > 0) || o.outrosR > 0 || o.omR > 0).sort((a, b) => b.saldoR - a.saldoR),
  })).filter(fr => fr.obras.length > 0).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}

// config default (produtividade/pessoa padrão; equipe p/ terminar cada obra em 12m, ∝ saldo)
export function makeDefaultConfig(allObras: Obra[]): Config {
  const prodPP: Record<string, number> = {}; DRV.forEach(d => prodPP[d.label] = d.pp)
  const h = 12, equipe: Record<string, Record<string, number>> = {}
  allObras.forEach(o => { const e: Record<string, number> = {}; o.drivers.forEach(d => { if (d.contr > 0 && d.saldoQ > 0) { const pp = prodPP[d.label] || 1; e[d.label] = Math.max(1, Math.round(d.saldoQ / (pp * h))) } }); equipe[o.nome] = e })
  return { prodPP, equipe, horizonte: h, precedencia: true, lag: 0 }
}

// rate (qtd/mês) por (obra, driver) = nº de pessoas × produtividade por pessoa
export function rateOf(o: Obra, d: Drv, cfg: Config) {
  if (d.saldoQ <= 0) return 0
  return (cfg.equipe?.[o.nome]?.[d.label] ?? 0) * (cfg.prodPP?.[d.label] ?? 0)
}

// projeção mês a mês da obra com PRECEDÊNCIA: Fundação libera Montagem, Montagem libera Lançamento.
// rows[].pessoas[m] = nº de pessoas ativas naquele mês (= equipe se o driver produz no mês).
export function projObra(o: Obra, cfg: Config, start: string) {
  const present = DRV.map(dv => o.drivers.find(d => d.label === dv.label && d.contr > 0)).filter(Boolean) as Drv[]
  const order = present.map(d => d.label)
  const rate: Record<string, number> = {}, contr: Record<string, number> = {}, real: Record<string, number> = {}, cum: Record<string, number> = {}
  const hist: Record<string, number[]> = {}, monthly: Record<string, number[]> = {}
  present.forEach(d => { rate[d.label] = rateOf(o, d, cfg); contr[d.label] = d.contr; real[d.label] = d.real; cum[d.label] = d.real; hist[d.label] = []; monthly[d.label] = [] })
  const prec = cfg.precedencia !== false; const lag = cfg.lag || 0
  let i = 0
  while (i < 120) {
    for (let k = 0; k < order.length; k++) {
      const lbl = order[k]
      let capPct = 1
      if (prec && k > 0) { const pl = order[k - 1]; const predCum = lag <= 0 ? cum[pl] : (i - lag >= 0 ? hist[pl][i - lag] : real[pl]); capPct = contr[pl] > 0 ? predCum / contr[pl] : 1 }
      const adv = Math.max(0, Math.min(rate[lbl], contr[lbl] - cum[lbl], capPct * contr[lbl] - cum[lbl]))
      monthly[lbl].push(adv); cum[lbl] += adv
    }
    order.forEach(l => hist[l].push(cum[l]))
    i++
    if (!order.some(l => monthly[l][i - 1] > 0.001)) break // travou (sem capacidade) ou terminou
  }
  let drvMax = 0; for (let m = 0; m < i; m++) if (order.some(l => monthly[l][m] > 0.001)) drvMax = m + 1
  // O&M (manutenção): execução distribuída uniformemente até o vencimento (sem drivers/precedência)
  const omMeses = o.omR > 0 ? (present.length > 0 ? drvMax : Math.max(1, Math.min(60, o.fim ? (ymNum(o.fim.slice(0, 7)) - ymNum(start) + 1) : 12))) : 0
  let maxMeses = Math.max(drvMax, omMeses)
  if (maxMeses === 0 && o.outrosR > 0) maxMeses = 1
  const meses = Array.from({ length: maxMeses }, (_, m) => shiftYM(start, m))
  const rows = present.map(d => {
    const qty = Array.from({ length: maxMeses }, (_, m) => monthly[d.label][m] || 0)
    const rMes = qty.map(q => d.saldoQ > 0 ? d.saldoR * (q / d.saldoQ) : 0)
    const pessoas = qty.map(q => q > 0.001 ? (cfg.equipe?.[o.nome]?.[d.label] ?? 0) : 0) // efetivo ativo no mês
    const mesesD = qty.reduce((a, q, m) => q > 0.001 ? m + 1 : a, 0)
    return { d, qty, rMes, pessoas, meses: mesesD }
  })
  const execMes = meses.map((_, m) => (omMeses > 0 && m < omMeses) ? o.omR / omMeses : 0)
  const drvRmes = meses.map((_, m) => rows.reduce((s, x) => s + (x.rMes[m] || 0), 0))
  const totDrvR = drvRmes.reduce((s, x) => s + x, 0)
  const outrosRmes = meses.map((_, m) => totDrvR > 0 ? o.outrosR * drvRmes[m] / totDrvR : (drvMax ? o.outrosR / drvMax : 0))
  const totalRmes = meses.map((_, m) => drvRmes[m] + outrosRmes[m] + execMes[m])
  return { meses, rows, execMes, outrosRmes, totalRmes, maxMeses, termino: maxMeses > 0 ? meses[maxMeses - 1] : null }
}
