// Engine compartilhada do Cronograma/Histograma — lógica pura (árvore, precedência, projeção mês a mês)
// Usada por CronogramaPainel (R$/qtd) e HistogramaPainel (recursos: pessoas + máquinas).
import type { EAPPoloRaw } from '../../../hooks/usePMO'

// drivers de construção (pp = produtividade padrão por pessoa/mês; maq = máquinas padrão por pessoa)
// pp = produtividade por pessoa/mês na UNIDADE do driver (m³/ton/km); ppTorre = idem em TORRES (só Fund./Mont.).
// Quando a obra tem nº de torres lançado, o motor usa ppTorre (× m³ou-ton por torre da obra); senão, pp (volume).
export const DRV = [
  { pac: 'Fundações', label: 'Fundação', uni: 'm³', cor: '#92400e', pp: 14.29, ppTorre: 0, maq: 0.3 }, // 100 m³/mês por equipe de 7 (padrão prevista)
  { pac: 'Montagem de Torres', label: 'Montagem', uni: 'ton', cor: '#059669', pp: 8, ppTorre: 1.83, maq: 0.25 }, // 22 torres/mês por equipe de 12 (pré-montagem)
  { pac: 'Lançamento de Cabos', label: 'Lançamento', uni: 'km', cor: '#3730a3', pp: 1.2, ppTorre: 0, maq: 0.2 }, // sempre km
]
// tudo que não é driver vira 3 linhas próprias (só R$):
//   Preliminares (Serv. Preliminares + Canteiro e Mobiliz.) · Administração (ADM Local) · Outros (desmont/conf/aterr/etc)
export const OUTROS_PAC = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Administração Local', 'Outros']
export const PREL_PAC = ['Serv. Preliminares', 'Canteiro e Mobiliz.']
export const COR_PREL = '#0284c7'
export const COR_ADM = '#6d28d9'
export const COR_OUTROS = '#64748b'

const MES_ABR = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_ABR[+m]}/${y.slice(2)}` }
export const shiftYM = (ym: string, d: number) => { let [y, m] = ym.split('-').map(Number); m += d; while (m > 12) { m -= 12; y++ } while (m < 1) { m += 12; y-- } return `${y}-${String(m).padStart(2, '0')}` }
// projeção começa no MÊS CORRENTE (o mês em andamento também produz)
export const startYM = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
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
export type Obra = { nome: string; frente: string; drivers: Drv[]; saldoR: number; prelR: number; admR: number; outrosR: number; omR: number; omOscs: string[]; valorContr: number; torres: number; pctFis: number; ini: string | null; fim: string | null }
export type Frente = { label: string; obras: Obra[] }
// prodPP: produtividade por pessoa/mês por driver; equipe: nº de pessoas por obra → por driver.
// inicio: mês planejado (YYYY-MM) por obra — não produz antes dele.
// fim: mês planejado de término (YYYY-MM) — quando definido, o ritmo é FORÇADO pela data (saldo ÷ meses até o fim),
//   ignorando equipe×produtividade naquela obra (precedência entre serviços ainda vale).
// inicioS/fimS: overrides POR SERVIÇO (obra → driver → YYYY-MM) — vencem o nível obra; editar a obra limpa os overrides.
// realoc: realocação automática — equipe liberada (driver concluído) migra pra obra que aponta esta como
//   predecessora (pred: obra → obra predecessora); sem sucessora com saldo, cai na fila legada (fila: nº = ordem).
export type Config = { prodPP: Record<string, number>; prodPPTorre?: Record<string, number>; equipe: Record<string, Record<string, number>>; horizonte: number; precedencia?: boolean; lag?: number; realoc?: boolean; fila?: Record<string, number>; pred?: Record<string, string>; inicio?: Record<string, string>; fim?: Record<string, string>; inicioS?: Record<string, Record<string, string>>; fimS?: Record<string, Record<string, string>> }
export type Versao = { id: string; nome: string; config: Config; updated_at: string }

export function emptyDrivers(): Drv[] { return DRV.map(d => ({ ...d, contr: 0, real: 0, valor: 0, fat: 0, saldoQ: 0, saldoR: 0, pctFis: 0 })) }

// árvore frente → obra → drivers (saldo) a partir do raw da EAP
export function buildTree(raw: EAPPoloRaw[] | undefined): Frente[] {
  const frentes = new Map<string, { label: string; obras: Map<string, { drivers: Drv[]; prelR: number; admR: number; outrosR: number; omR: number; omOscs: string[]; valorContr: number; torres: number; ini: string | null; fim: string | null }> }>()
  for (const polo of (raw ?? [])) {
    let fr = frentes.get(polo.label); if (!fr) { fr = { label: polo.label, obras: new Map() }; frentes.set(polo.label, fr) }
    for (const o of polo.oscs) {
      if (o.etapa_atual === 'cancelada') continue
      if (o.tipo !== 'construcao' && o.tipo !== 'manutencao') continue // exclui depósito; construção+O&M
      let od = fr.obras.get(o.obra_nome); if (!od) { od = { drivers: emptyDrivers(), prelR: 0, admR: 0, outrosR: 0, omR: 0, omOscs: [], valorContr: 0, torres: 0, ini: null, fim: null }; fr.obras.set(o.obra_nome, od) }
      od.valorContr += Number(o.valor || 0) // valor contratual previsto (todas as OSCs da obra)
      od.torres += Number(o.qtd_torres || 0) // nº de torres somado das OSCs (lançado manualmente na Iniciação)
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
        else if (PREL_PAC.includes(pn)) od.prelR += Math.max(0, pa.valor - pa.fat)
        else if (pn === 'Administração Local') od.admR += Math.max(0, pa.valor - pa.fat)
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
      return { nome, frente: fr.label, drivers: od.drivers, prelR: od.prelR, admR: od.admR, outrosR: od.outrosR, omR: od.omR, omOscs: od.omOscs, valorContr: od.valorContr, torres: od.torres, ini: od.ini, fim: od.fim, pctFis, saldoR: od.drivers.reduce((s, d) => s + d.saldoR, 0) + od.prelR + od.admR + od.outrosR + od.omR } as Obra
    }).filter(o => o.drivers.some(d => d.contr > 0) || o.prelR > 0 || o.admR > 0 || o.outrosR > 0 || o.omR > 0).sort((a, b) => b.saldoR - a.saldoR),
  })).filter(fr => fr.obras.length > 0).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}

// config default (produtividade/pessoa padrão; equipe p/ terminar cada obra em 12m, ∝ saldo)
export function makeDefaultConfig(allObras: Obra[]): Config {
  const prodPP: Record<string, number> = {}; DRV.forEach(d => prodPP[d.label] = d.pp)
  const prodPPTorre: Record<string, number> = {}; DRV.forEach(d => prodPPTorre[d.label] = d.ppTorre)
  const h = 12, equipe: Record<string, Record<string, number>> = {}
  allObras.forEach(o => { const e: Record<string, number> = {}; o.drivers.forEach(d => { if (d.contr > 0 && d.saldoQ > 0) { const pp = prodPP[d.label] || 1; e[d.label] = Math.max(1, Math.round(d.saldoQ / (pp * h))) } }); equipe[o.nome] = e })
  return { prodPP, prodPPTorre, equipe, horizonte: h, precedencia: true, lag: 0 }
}

// distribui o efetivo real de cada frente (Fundação + Montagem&Lançamento) entre as obras ∝ saldo.
// Montagem e Lançamento são equipe única → mesma alocação nos dois drivers (a precedência sequencia).
export function equipeFromEfetivo(tree: Frente[], porFrente: Record<string, { fundacao: number; montlanc: number }>, round = true): Record<string, Record<string, number>> {
  const sQ = (o: Obra, lbl: string) => o.drivers.find(d => d.label === lbl)?.saldoQ || 0
  const r = (v: number) => round ? Math.round(v) : v
  const equipe: Record<string, Record<string, number>> = {}
  for (const fr of tree) {
    const ef = porFrente[fr.label]
    const fundS = fr.obras.map(o => sQ(o, 'Fundação')); const fundT = fundS.reduce((s, x) => s + x, 0)
    const mlS = fr.obras.map(o => sQ(o, 'Montagem') + sQ(o, 'Lançamento')); const mlT = mlS.reduce((s, x) => s + x, 0)
    fr.obras.forEach((o, i) => {
      const e: Record<string, number> = {}
      const fund = ef && fundT > 0 ? ef.fundacao * fundS[i] / fundT : 0
      const ml = ef && mlT > 0 ? ef.montlanc * mlS[i] / mlT : 0
      if (sQ(o, 'Fundação') > 0) e['Fundação'] = r(fund)
      if (sQ(o, 'Montagem') > 0) e['Montagem'] = r(ml)
      if (sQ(o, 'Lançamento') > 0) e['Lançamento'] = r(ml)
      equipe[o.nome] = e
    })
  }
  return equipe
}

// rate (qtd/mês na unidade do driver) = nº de pessoas × produtividade.
// Se a obra tem nº de torres E há produtividade POR TORRE (Fund./Mont.), usa torres: rate = pessoas × torres/mês
// convertido pra unidade nativa via (contr ÷ torres) = m³ (ou ton) por torre — mesma duração que o cálculo por torre.
// Sem torres lançadas (ou driver sem ppTorre, ex.: Lançamento) → cai no volume (m³/ton/km por pessoa).
export function rateOf(o: Obra, d: Drv, cfg: Config) {
  if (d.saldoQ <= 0) return 0
  const ppl = cfg.equipe?.[o.nome]?.[d.label] ?? 0
  const pt = cfg.prodPPTorre?.[d.label] ?? 0
  if (o.torres > 0 && pt > 0 && d.contr > 0) return ppl * pt * (d.contr / o.torres)
  return ppl * (cfg.prodPP?.[d.label] ?? 0)
}

// início/fim planejados POR DRIVER: override do serviço (inicioS/fimS) vence o nível obra (inicio/fim).
// Aceita YYYY-MM ou YYYY-MM-DD (data completa) — a simulação é mensal, o dia é ignorado (slice 0,7).
const delayOf = (o: Obra, lbl: string, cfg: Config, start: string) => {
  const ini = cfg.inicioS?.[o.nome]?.[lbl] ?? cfg.inicio?.[o.nome]
  return ini ? Math.max(0, ymNum(ini.slice(0, 7)) - ymNum(start)) : 0
}
const fimOf = (o: Obra, lbl: string, cfg: Config) => { const f = cfg.fimS?.[o.nome]?.[lbl] ?? cfg.fim?.[o.nome]; return f ? f.slice(0, 7) : f }

// estado bruto de uma simulação (por obra) — consumido por finalizeObra
type SimObra = {
  order: string[]; monthly: Record<string, number[]>; hist: Record<string, number[]>
  cum: Record<string, number>; contr: Record<string, number>; real: Record<string, number>
  pessoas?: Record<string, number[]>; meses: number
}

// transforma a simulação em resultado (linhas, R$/mês, Prelim/ADM/Outros por marcos, O&M)
function finalizeObra(o: Obra, cfg: Config, start: string, sim: SimObra) {
  const present = DRV.map(dv => o.drivers.find(d => d.label === dv.label && d.contr > 0)).filter(Boolean) as Drv[]
  const { order, monthly, hist, cum, contr, real } = sim
  let drvMax = 0; for (let m = 0; m < sim.meses; m++) if (order.some(l => (monthly[l][m] || 0) > 0.001)) drvMax = m + 1
  // O&M (manutenção): execução distribuída uniformemente até o vencimento (sem drivers/precedência)
  const omMeses = o.omR > 0 ? (present.length > 0 ? drvMax : Math.max(1, Math.min(60, o.fim ? (ymNum(o.fim.slice(0, 7)) - ymNum(start) + 1) : 12))) : 0
  let maxMeses = Math.max(drvMax, omMeses)
  if (maxMeses === 0 && (o.prelR > 0 || o.admR > 0 || o.outrosR > 0)) maxMeses = 1
  const meses = Array.from({ length: maxMeses }, (_, m) => shiftYM(start, m))
  const rows = present.map(d => {
    const qty = Array.from({ length: maxMeses }, (_, m) => monthly[d.label][m] || 0)
    const rMes = qty.map(q => d.saldoQ > 0 ? d.saldoR * (q / d.saldoQ) : 0)
    // efetivo ativo no mês: com realocação usa o histórico de alocação; senão a equipe fixa da config
    const pessoas = qty.map((q, m) => q > 0.001 ? (sim.pessoas?.[d.label]?.[m] ?? cfg.equipe?.[o.nome]?.[d.label] ?? 0) : 0)
    const mesesD = qty.reduce((a, q, m) => q > 0.001 ? m + 1 : a, 0)
    return { d, qty, rMes, pessoas, meses: mesesD }
  })
  const execMes = meses.map((_, m) => (omMeses > 0 && m < omMeses) ? o.omR / omMeses : 0)
  const drvRmes = meses.map((_, m) => rows.reduce((s, x) => s + (x.rMes[m] || 0), 0))
  const totDrvR = drvRmes.reduce((s, x) => s + x, 0)
  // Administração: proporcional à medição dos drivers (ADM mede junto com o avanço físico).
  // SEM equipe alocada (drivers não produzem) → mede ZERO — nada de espalhar saldo sem produção.
  const propMes = (valor: number) => meses.map((_, m) => totDrvR > 0 ? valor * drvRmes[m] / totDrvR : 0)
  // Preliminares/Outros: medição por MARCOS do driver âncora — 25% do saldo a cada 25% atingido
  // (Preliminares ← Fundação; Outros ← Montagem). Âncora JÁ 100% antes da projeção → saldo FICA EM ABERTO
  // (não fatura só porque acabou); sem o driver âncora no escopo, mede junto da produção que existir.
  const marcoMes = (valor: number, anc: string) => {
    if (!(valor > 0)) return meses.map(() => 0)
    const c = contr[anc]
    if (!c || !(c > 0)) return propMes(valor)
    const pct0 = (real[anc] || 0) / c
    const marcos = [0.25, 0.5, 0.75, 1].filter(x => x > pct0 + 1e-9)
    if (!marcos.length) return meses.map(() => 0) // âncora já concluída no passado → em aberto
    const porMarco = valor / marcos.length
    let prev = pct0
    return meses.map((_, m) => {
      const cur = ((hist[anc]?.[m] ?? cum[anc]) || 0) / c
      const n = marcos.filter(x => x > prev + 1e-9 && x <= cur + 1e-9).length
      prev = Math.max(prev, cur)
      return porMarco * n
    })
  }
  const prelRmes = marcoMes(o.prelR, 'Fundação')
  const admRmes = propMes(o.admR)
  const outrosRmes = marcoMes(o.outrosR, 'Montagem')
  const totalRmes = meses.map((_, m) => drvRmes[m] + prelRmes[m] + admRmes[m] + outrosRmes[m] + execMes[m])
  return { meses, rows, execMes, prelRmes, admRmes, outrosRmes, totalRmes, maxMeses, termino: maxMeses > 0 ? meses[maxMeses - 1] : null }
}

// projeção mês a mês da obra ISOLADA com PRECEDÊNCIA (Fundação libera Montagem, Montagem libera Lançamento)
// e início planejado (cfg.inicio). rows[].pessoas[m] = nº de pessoas ativas naquele mês.
export function projObra(o: Obra, cfg: Config, start: string) {
  const present = DRV.map(dv => o.drivers.find(d => d.label === dv.label && d.contr > 0)).filter(Boolean) as Drv[]
  const order = present.map(d => d.label)
  const prec = cfg.precedencia !== false; const lag = cfg.lag || 0
  const rate: Record<string, number> = {}, contr: Record<string, number> = {}, real: Record<string, number> = {}, cum: Record<string, number> = {}
  const hist: Record<string, number[]> = {}, monthly: Record<string, number[]> = {}
  const delayD: Record<string, number> = {} // início planejado POR DRIVER (override do serviço vence a obra)
  present.forEach(d => {
    delayD[d.label] = delayOf(o, d.label, cfg, start)
    const fimYM = fimOf(o, d.label, cfg) // fim planejado → ritmo forçado (saldo ÷ meses entre o início efetivo e o fim)
    const durF = fimYM ? Math.max(1, ymNum(fimYM) - ymNum(start) - delayD[d.label] + 1) : 0
    rate[d.label] = durF > 0 && d.saldoQ > 0 ? d.saldoQ / durF : rateOf(o, d, cfg)
    contr[d.label] = d.contr; real[d.label] = d.real; cum[d.label] = d.real; hist[d.label] = []; monthly[d.label] = []
  })
  const maxDelay = Math.max(0, ...order.map(l => delayD[l]))
  let i = 0
  while (i < 120) {
    for (let k = 0; k < order.length; k++) {
      const lbl = order[k]
      let adv = 0
      if (i >= delayD[lbl]) {
        let capPct = 1
        if (prec && k > 0) { const pl = order[k - 1]; const predCum = lag <= 0 ? cum[pl] : (i - lag >= 0 ? hist[pl][i - lag] : real[pl]); capPct = contr[pl] > 0 ? predCum / contr[pl] : 1 }
        adv = Math.max(0, Math.min(rate[lbl], contr[lbl] - cum[lbl], capPct * contr[lbl] - cum[lbl]))
      }
      monthly[lbl].push(adv); cum[lbl] += adv
    }
    order.forEach(l => hist[l].push(cum[l]))
    i++
    if (i > maxDelay && !order.some(l => monthly[l][i - 1] > 0.001)) break // travou (sem capacidade) ou terminou
  }
  return finalizeObra(o, cfg, start, { order, monthly, hist, cum, contr, real, meses: i })
}

// projeção CONJUNTA com realocação automática: quando um driver conclui numa obra, a equipe liberada
// migra pra obra que tem esta como PREDECESSORA (cfg.pred, seguindo a cadeia se a sucessora não tiver
// saldo daquele driver); sem sucessora, cai na fila legada (cfg.fila). Sem realoc, projObra por obra.
export function projTodas(obras: Obra[], cfg: Config, start: string): Map<string, ReturnType<typeof projObra>> {
  const res = new Map<string, ReturnType<typeof projObra>>()
  if (!cfg.realoc) { for (const o of obras) res.set(o.nome, projObra(o, cfg, start)); return res }
  const prec = cfg.precedencia !== false; const lag = cfg.lag || 0
  const filaOrd = Object.entries(cfg.fila ?? {}).map(([n, v]) => [n, Number(v)] as const)
    .filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1]).map(([n]) => n)
  const succ: Record<string, string[]> = {} // predecessora → sucessoras
  for (const [nome, p] of Object.entries(cfg.pred ?? {})) { if (!p || p === nome) continue; (succ[p] ??= []).push(nome) }
  type S = {
    o: Obra; order: string[]; delayD: Record<string, number>
    assign: Record<string, number>; forced: Record<string, number>; monthly: Record<string, number[]>; hist: Record<string, number[]>
    pess: Record<string, number[]>; cum: Record<string, number>; contr: Record<string, number>; real: Record<string, number>
  }
  const sts: S[] = obras.map(o => {
    const present = DRV.map(dv => o.drivers.find(d => d.label === dv.label && d.contr > 0)).filter(Boolean) as Drv[]
    const s: S = { o, order: present.map(d => d.label), delayD: {}, assign: {}, forced: {}, monthly: {}, hist: {}, pess: {}, cum: {}, contr: {}, real: {} }
    present.forEach(d => {
      s.delayD[d.label] = delayOf(o, d.label, cfg, start)
      const fimYM = fimOf(o, d.label, cfg)
      const durF = fimYM ? Math.max(1, ymNum(fimYM) - ymNum(start) - s.delayD[d.label] + 1) : 0
      s.assign[d.label] = cfg.equipe?.[o.nome]?.[d.label] ?? 0; s.forced[d.label] = durF > 0 && d.saldoQ > 0 ? d.saldoQ / durF : 0
      s.monthly[d.label] = []; s.hist[d.label] = []; s.pess[d.label] = []; s.cum[d.label] = d.real; s.contr[d.label] = d.contr; s.real[d.label] = d.real
    })
    return s
  })
  const byNome = new Map(sts.map(s => [s.o.nome, s]))
  const pool: Record<string, number> = {}; DRV.forEach(d => pool[d.label] = 0)
  let i = 0
  while (i < 120) {
    let any = false
    for (const s of sts) {
      for (let k = 0; k < s.order.length; k++) {
        const lbl = s.order[k]
        let adv = 0
        if (i >= (s.delayD[lbl] ?? 0) && (s.assign[lbl] > 0 || s.forced[lbl] > 0)) {
          let capPct = 1
          if (prec && k > 0) { const pl = s.order[k - 1]; const predCum = lag <= 0 ? s.cum[pl] : (i - lag >= 0 ? s.hist[pl][i - lag] : s.real[pl]); capPct = s.contr[pl] > 0 ? predCum / s.contr[pl] : 1 }
          const rate = s.forced[lbl] > 0 ? s.forced[lbl] : s.assign[lbl] * (cfg.prodPP?.[lbl] ?? 0)
          adv = Math.max(0, Math.min(rate, s.contr[lbl] - s.cum[lbl], capPct * s.contr[lbl] - s.cum[lbl]))
        }
        s.monthly[lbl].push(adv); s.cum[lbl] += adv
        if (adv > 0.001) any = true
      }
      s.order.forEach(l => { s.hist[l].push(s.cum[l]); s.pess[l].push(s.assign[l]) })
    }
    // fim do mês: driver concluído libera a equipe → sucessora direta (cadeia de predecessão); sem destino → pool
    for (const s of sts) for (const l of s.order) if (s.assign[l] > 0 && s.cum[l] >= s.contr[l] - 1e-6) {
      const freed = s.assign[l]; s.assign[l] = 0
      let dest: S | null = null
      const q = [...(succ[s.o.nome] ?? [])]; const seen = new Set<string>()
      while (q.length) {
        const n = q.shift()!; if (seen.has(n)) continue; seen.add(n)
        const t = byNome.get(n)
        if (t && t.order.includes(l) && t.cum[l] < t.contr[l] - 1e-6) { dest = t; break }
        q.push(...(succ[n] ?? [])) // sucessora sem saldo deste serviço → segue a cadeia
      }
      if (dest) dest.assign[l] += freed; else pool[l] += freed
    }
    // pool → próxima obra da fila com saldo daquele driver (respeitando o início planejado dela)
    for (const d of DRV) {
      const l = d.label
      if (pool[l] <= 0) continue
      for (const nome of filaOrd) {
        const s = byNome.get(nome)
        if (!s || !s.order.includes(l)) continue
        if (s.cum[l] >= s.contr[l] - 1e-6) continue
        if (i + 1 < (s.delayD[l] ?? 0)) continue
        s.assign[l] += pool[l]; pool[l] = 0; break
      }
    }
    i++
    if (!any) {
      // só encerra se nada mais vai acontecer: sem início futuro pendente e sem pool com destino possível
      const aindaVem = sts.some(s => s.order.some(l => (s.assign[l] > 0 || s.forced[l] > 0) && s.cum[l] < s.contr[l] - 1e-6 && i < (s.delayD[l] ?? 0)))
      const poolTemDestino = DRV.some(d => pool[d.label] > 0 && filaOrd.some(n => { const s = byNome.get(n); return !!s && s.order.includes(d.label) && s.cum[d.label] < s.contr[d.label] - 1e-6 }))
      if (!aindaVem && !poolTemDestino) break
    }
  }
  for (const s of sts) res.set(s.o.nome, finalizeObra(s.o, cfg, start, { order: s.order, monthly: s.monthly, hist: s.hist, cum: s.cum, contr: s.contr, real: s.real, pessoas: s.pess, meses: i }))
  return res
}
