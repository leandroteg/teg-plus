// Planejamento Automático do cronograma geral (Fase 1) — simulador de portfólio mês a mês
// por EQUIPE-PADRÃO e RECURSOS CRÍTICOS (premissas TEG: PADRÃO PRODUTIVIDADE EQUIPE + método PMO-MET-001).
//
//   Fundação:    equipe de 7 → 100 m³/mês (×4 com perfuratriz, só em obra com >10 torres);
//                cada frente de fundação ocupa 1 ROTOR (5 no total → máx. 5 frentes simultâneas).
//   Pré-mont.+Montagem: equipe de 12 → COM guindaste ~1 torre/dia útil por equipe (pré-montagem é o
//                gargalo; o guindaste iça 10/dia e atende até 10 equipes); SEM guindaste a equipe divide
//                pré e içamento (metade do ritmo). Obra com torres > limiar só monta com guindaste (espera na fila).
//   Lançamento:  frente = 1 COMBOIO (puller-freio + munck + prensa) + 2-3 equipes de 12 → 15 km/mês.
//   Fator residual (material/clima/retrabalho) multiplica tudo; 1º mês de frente nova produz 50% (mobilização).
//   Precedência física: montagem limitada ao % fundado (defasagem natural de 1 mês pelo corte no início do mês);
//   lançamento limitado ao % montado. Prioridade das ondas: prazo CEMIG (mais crítico) + volume R$; embargadas fora.
//
// As DATAS são RESULTADO da simulação — o chamador grava início/término por serviço na config existente.

export type PlanParams = {
  eqF: number // equipes de fundação (7 pessoas cada)
  eqML: number // equipes de montagem/lançamento (12 pessoas cada)
  rotores: number
  perfuratrizes: number
  guindastes: number
  comboios: number
  residual: number // fator de eficiência 0–1 sobre a produtividade prevista
  limiarGuind: number // torres acima disso: só monta com guindaste
  eqPorLanc: number // equipes de 12 por frente de lançamento (2–3)
  diasUteis: number // dias úteis/mês (22)
  excluidas: string[] // obras embargadas / fora do plano
  ordem?: string[] // prioridade manual (ordem das obras) — vence o critério prazo×R$; obras fora da lista caem no fim
  alvoIdx?: number | null // índice do mês-alvo (a partir do mês corrente) p/ cálculo de reforço
}

export type PlanObraIn = {
  nome: string
  frente: string
  saldoR: number
  prazoIdx: number | null // vencimento contratual em meses a partir do início (null = sem prazo)
  fund: { c: number; s: number } // m³ contratado / saldo
  mont: { c: number; s: number } // ton contratado / saldo
  lanc: { c: number; s: number } // km contratado / saldo
  torres: number | null // nº de torres da obra (qtd_torres das OSCs); null = estimar
}

export type PlanJanela = { ini: number; fim: number; eqMax: number }
export type PlanObraOut = { fund?: PlanJanela; mont?: PlanJanela; lanc?: PlanJanela; esperas: string[]; pred?: string }
export type PlanResult = {
  obras: Record<string, PlanObraOut>
  fimGeral: number // último mês com produção (índice; -1 = nada a fazer)
  estouros: { nome: string; fimIdx: number; prazoIdx: number }[]
  inconclusas: { nome: string; motivo: string }[] // NÃO concluem nem em 120 meses (gargalo permanente de recurso)
  torresEstimadas: string[] // obras planejadas com torres estimadas por km (falta lançar qtd_torres)
  reforco?: { eqF: number; eqML: number; fimIdx: number } | null // menor adição de equipes que cumpre o alvo
}

const MOB = 0.5 // 1º mês de frente nova = mobilização (produz metade)
const LIMIAR_PERF = 10 // perfuratriz só compensa em obra com mais de 10 torres (deslocamento)

type Jan = { ini: number; fim: number; eqMax: number }
type St = {
  o: PlanObraIn
  torresTot: number
  torresEst: boolean
  fRest: number
  tRest: number // torres restantes de montagem
  lRest: number
  fund?: Jan; mont?: Jan; lanc?: Jan
  atv: { f: boolean; t: boolean; l: boolean } // frente ativa no mês anterior (mobilização)
  esp: Record<string, number> // motivo → meses de espera
}

export function planejar(obrasIn: PlanObraIn[], p: PlanParams): PlanResult {
  const excl = new Set(p.excluidas)
  const res = Math.max(0.05, Math.min(1, p.residual))
  const sts: St[] = obrasIn.filter(o => !excl.has(o.nome)).map(o => {
    const est = o.torres == null && o.mont.c > 0
    const torresTot = o.torres != null ? o.torres : (o.mont.c > 0 ? Math.max(1, Math.round(3 * o.lanc.c)) : 0)
    const tRest = o.mont.c > 0 && torresTot > 0 ? torresTot * (o.mont.s / o.mont.c) : 0
    return { o, torresTot, torresEst: est, fRest: o.fund.s, tRest, lRest: o.lanc.s, atv: { f: false, t: false, l: false }, esp: {} }
  })
  // ordem de ataque: prioridade MANUAL (cfg.ordem) primeiro; senão prazo CEMIG + maior saldo R$ (PMO-MET-001)
  const ordIdx = new Map((p.ordem ?? []).map((n, i) => [n, i]))
  const prio = [...sts].sort((a, b) => {
    const oa = ordIdx.has(a.o.nome) ? ordIdx.get(a.o.nome)! : 1e9
    const ob = ordIdx.has(b.o.nome) ? ordIdx.get(b.o.nome)! : 1e9
    if (oa !== ob) return oa - ob
    const pa = a.o.prazoIdx ?? 9999, pb = b.o.prazoIdx ?? 9999
    if (pa !== pb) return pa - pb
    return b.o.saldoR - a.o.saldoR
  })
  const pend = (s: St) => s.fRest > 0.01 || s.tRest > 0.01 || s.lRest > 0.01
  const marca = (s: St, k: string) => { s.esp[k] = (s.esp[k] || 0) + 1 }

  let m = 0
  for (; m < 120 && sts.some(pend); m++) {
    let availF = p.eqF, availML = p.eqML, rot = p.rotores, perf = p.perfuratrizes, comb = p.comboios
    let craneEq = 10 * p.guindastes // 1 guindaste (10 torres/dia) atende a pré-montagem de até 10 equipes (1/dia cada)
    type Alloc = { s: St; k: 'f' | 't' | 'l'; eq: number; comCrane?: boolean; perf?: boolean }
    const allocs: Alloc[] = []
    for (const s of prio) {
      const o = s.o
      const fundPct = o.fund.c > 0 ? (o.fund.c - s.fRest) / o.fund.c : 1
      const montadas = s.torresTot - s.tRest
      const montavel = s.torresTot * fundPct - montadas // torres fundadas ainda não montadas
      const montPct = s.torresTot > 0 ? montadas / s.torresTot : 1
      const lancavel = o.lanc.c * montPct - (o.lanc.c - s.lRest) // km liberado pela montagem
      // LANÇAMENTO — frente contínua: 1 comboio + N equipes de 12
      if (s.lRest > 0.01 && lancavel > 0.01) {
        if (comb > 0 && availML >= p.eqPorLanc) { comb--; availML -= p.eqPorLanc; allocs.push({ s, k: 'l', eq: p.eqPorLanc }) }
        else marca(s, comb > 0 ? 'lançamento: sem equipes livres' : 'lançamento: fila do comboio')
      }
      // MONTAGEM (pré-montagem + içamento)
      if (s.tRest > 0.01 && montavel > 0.01) {
        if (availML > 0) {
          const eq = Math.min(s.tRest > 60 ? 2 : 1, availML)
          if (s.torresTot > p.limiarGuind) {
            if (craneEq >= eq) { craneEq -= eq; availML -= eq; allocs.push({ s, k: 't', eq, comCrane: true }) }
            else marca(s, 'montagem: fila do guindaste')
          } else { availML -= eq; allocs.push({ s, k: 't', eq, comCrane: false }) }
        } else marca(s, 'montagem: sem equipes livres')
      }
      // FUNDAÇÃO — frente ocupa 1 rotor; perfuratriz vai pra obra mais prioritária com >10 torres
      if (s.fRest > 0.01) {
        if (availF > 0) {
          if (rot > 0) {
            rot--
            const eq = Math.min(s.fRest > 600 ? 2 : 1, availF)
            availF -= eq
            let comPerf = false
            if (perf > 0 && s.torresTot > LIMIAR_PERF) { perf--; comPerf = true }
            allocs.push({ s, k: 'f', eq, perf: comPerf })
          } else marca(s, 'fundação: fila do rotor')
        } else marca(s, 'fundação: sem equipes livres')
      }
    }
    // produção do mês
    const atvNow = new Map<St, { f: boolean; t: boolean; l: boolean }>()
    for (const a of allocs) {
      const flags = atvNow.get(a.s) ?? { f: false, t: false, l: false }
      const mob = a.s.atv[a.k] ? 1 : MOB
      if (a.k === 'f') {
        const q = Math.min(a.s.fRest, 100 * (a.perf ? 4 : 1) * a.eq * res * mob)
        a.s.fRest -= q
        if (q > 0.001) { const w = (a.s.fund ??= { ini: m, fim: m, eqMax: 0 }); w.fim = m; w.eqMax = Math.max(w.eqMax, a.eq); flags.f = true }
      } else if (a.k === 't') {
        const taxa = (a.comCrane ? p.diasUteis : p.diasUteis / 2) * a.eq // torres/mês
        const o = a.s.o
        const fundPct = o.fund.c > 0 ? (o.fund.c - a.s.fRest) / o.fund.c : 1
        const montavel = a.s.torresTot * fundPct - (a.s.torresTot - a.s.tRest)
        const q = Math.max(0, Math.min(a.s.tRest, montavel, taxa * res * mob))
        a.s.tRest -= q
        if (q > 0.001) { const w = (a.s.mont ??= { ini: m, fim: m, eqMax: 0 }); w.fim = m; w.eqMax = Math.max(w.eqMax, a.eq); flags.t = true }
      } else {
        const o = a.s.o
        const montPct = a.s.torresTot > 0 ? (a.s.torresTot - a.s.tRest) / a.s.torresTot : 1
        const lancavel = o.lanc.c * montPct - (o.lanc.c - a.s.lRest)
        const q = Math.max(0, Math.min(a.s.lRest, lancavel, 15 * res * mob))
        a.s.lRest -= q
        if (q > 0.001) { const w = (a.s.lanc ??= { ini: m, fim: m, eqMax: 0 }); w.fim = m; w.eqMax = Math.max(w.eqMax, a.eq); flags.l = true }
      }
      atvNow.set(a.s, flags)
    }
    for (const s of sts) s.atv = atvNow.get(s) ?? { f: false, t: false, l: false }
  }

  // resultado
  const out: Record<string, PlanObraOut> = {}
  let fimGeral = -1
  const estouros: PlanResult['estouros'] = []
  const torresEstimadas: string[] = []
  for (const s of sts) {
    const esperas = Object.entries(s.esp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v}m)`)
    const fimObra = Math.max(s.fund?.fim ?? -1, s.mont?.fim ?? -1, s.lanc?.fim ?? -1)
    if (fimObra > fimGeral) fimGeral = fimObra
    if (s.o.prazoIdx != null && fimObra >= 0 && fimObra > s.o.prazoIdx) estouros.push({ nome: s.o.nome, fimIdx: fimObra, prazoIdx: s.o.prazoIdx })
    if (s.torresEst && (s.mont || s.tRest > 0.01)) torresEstimadas.push(s.o.nome)
    out[s.o.nome] = { fund: s.fund, mont: s.mont, lanc: s.lanc, esperas }
  }
  // predecessão exibida: de quem a obra "herdou" a frente (janela anterior encostada), preferindo a mesma frente
  for (const s of sts) {
    const o = out[s.o.nome]
    const acha = (get: (x: St) => Jan | undefined, ini: number) => {
      const cand = sts.filter(d => d !== s && get(d) && (get(d)!.fim === ini - 1 || get(d)!.fim === ini))
      return cand.find(d => d.o.frente === s.o.frente) ?? cand[0]
    }
    if (s.fund && s.fund.ini > 0) o.pred = acha(x => x.fund, s.fund.ini)?.o.nome
    else if (!s.fund && s.mont && s.mont.ini > 0) o.pred = acha(x => x.mont, s.mont.ini)?.o.nome
  }
  estouros.sort((a, b) => (b.fimIdx - b.prazoIdx) - (a.fimIdx - a.prazoIdx))
  // saldo sobrando ao fim de 120 meses = gargalo permanente (ex.: 0 guindastes com obra acima do limiar)
  const inconclusas = sts.filter(pend).map(s => {
    const top = Object.entries(s.esp).sort((a, b) => b[1] - a[1])[0]
    return { nome: s.o.nome, motivo: top ? top[0] : 'sem capacidade' }
  })
  return { obras: out, fimGeral, estouros, inconclusas, torresEstimadas, reforco: undefined }
}

// com data-alvo: procura a MENOR adição de equipes que faz o portfólio caber no alvo
export function planejarComReforco(obrasIn: PlanObraIn[], p: PlanParams): PlanResult {
  const cumpre = (r: PlanResult) => r.inconclusas.length === 0 && (p.alvoIdx == null || r.fimGeral <= p.alvoIdx)
  const base = planejar(obrasIn, p)
  if (p.alvoIdx == null || cumpre(base)) return { ...base, reforco: null }
  const tents: [number, number][] = [[0, 1], [1, 0], [1, 1], [0, 2], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3], [4, 4], [5, 5]]
  for (const [df, dml] of tents) {
    const r = planejar(obrasIn, { ...p, eqF: p.eqF + df, eqML: p.eqML + dml })
    if (cumpre(r)) return { ...base, reforco: { eqF: df, eqML: dml, fimIdx: r.fimGeral } }
  }
  return { ...base, reforco: null } // nem +5/+5 equipes resolve → gargalo é recurso crítico (guindaste/rotor/comboio)
}
