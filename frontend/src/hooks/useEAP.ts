// ─────────────────────────────────────────────────────────────────────────────
// hooks/useEAP.ts — EAP Carteira CEMIG
// Carrega dados consolidados (totais + saldos por pacote) dos JSONs estáticos
// extraídos de EAP_Polos.html e EAP_Final.html.
// ─────────────────────────────────────────────────────────────────────────────
import eapFinalRaw from '../data/eap/eap_final.json'
import eapPolosRaw from '../data/eap/eap_polos.json'

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface EAPLine {
  sub: string                  // ex: "1.6"
  label: string                // ex: "Topografia"
  qty: string                  // ex: "85.5 km"
  pct?: number                 // % realizado
  qty_real?: string            // ex: "43.4 km"
  qty_total?: string           // ex: "85.5 km"
  data?: string                // ex: "10/04"
  special?: boolean
}

export interface EAPPacote {
  nome: string                 // "Serv. Preliminares" etc.
  cor: string                  // hex
  pct: number                  // % físico realizado
  valor_total_str: string      // "R$ 1,5M" (vem formatado)
  has: boolean
  is_outros: boolean
  lines: EAPLine[]
  outros_valor?: string
}

export interface EAPOSC {
  codigo: string               // "OSC-2024/27"
  codigo_curto: string         // "2024/27"
  nome: string
  status: string
  valor: number
  saldo: number
  pct_acum: number
  valor_acum: number
  torres: number
  ton: number
  tem_medicao: boolean
  fonte_qtd: string
  detalhe_torres?: string
  canteiro?: string            // nome do canteiro
}

export interface EAPPolo {
  id: string                   // "F1 - Frutal"
  cc_codigo: string            // "CC-101"
  label: string                // "Frutal"
  contratado: number
  saldo: number
  faturado: number             // contratado - saldo
  pct_fin: number              // % financeiro
  pct_fis: number              // % físico
  torres: number
  ton: number
  n_oscs: number
  pacotes: EAPPacote[]         // 7 pacotes (Serv. Preliminares...Outros)
  oscs: EAPOSC[]               // todas OSCs do polo
  canteiros: { nome: string; n_oscs: number; contratado: number; saldo: number }[]
  metrics?: { fund?: string; mont?: string; lanc?: string; log?: string }
}

// ── Mapeamento Frente (ID HTML) → CC do sistema ──────────────────────────────
const FRENTE_TO_CC: Record<string, string> = {
  'F1 - Frutal':                  'CC-101',
  'F1':                            'CC-101',
  'F2 - Tres Marias':             'CC-105',
  'F2':                            'CC-105',
  'F3.1/3.2 - Araxa/Perdizes':    'CC-107',
  'F3.1/3.2':                      'CC-107',
  'F3.3/3.4 - Patrocinio/Ituiutaba': 'CC-104',
  'F3.3/3.4':                      'CC-104',
  'F3.5/3.6/3.7 - Uberlandia':    'CC-106',
  'F3.5/3.6/3.7':                  'CC-106',
  'F3.12 - Paracatu':             'CC-103',
  'F3.12':                         'CC-103',
  'F4 - Rio Paranaiba':           'CC-102',
  'F4':                            'CC-102',
  'F5':                            'CC-102',  // EAP_Final usa F5 para Rio Paranaíba
}

const SEC_COLOR: Record<string, string> = {
  'Serv. Preliminares': '#0284c7',
  'Canteiro e Mobiliz.': '#0369a1',
  'Fundações': '#92400e',
  'Montagem de Torres': '#374151',
  'Lançamento de Cabos': '#3730a3',
  'Administração Local': '#6d28d9',
  'Outros': '#4b5563',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function shortOSC(key: string): string {
  // já vem como "2024/27" no JSON
  return key
}

function parseValorBR(s: string): number {
  // "R$ 1,5M" → 1_500_000; "R$ 597k" → 597_000; "R$ 36k" → 36_000
  if (!s) return 0
  const m = s.match(/R\$\s*([\d.,]+)\s*([Mk]?)/i)
  if (!m) return 0
  const num = parseFloat(m[1].replace('.', '').replace(',', '.'))
  const suf = m[2].toLowerCase()
  if (suf === 'm') return num * 1_000_000
  if (suf === 'k') return num * 1_000
  return num
}

// ── Função principal ─────────────────────────────────────────────────────────
function buildPolos(): EAPPolo[] {
  const polosFinal = (eapFinalRaw as any).polos as any[]
  const frentes = (eapPolosRaw as any).frentes as any[]

  // Index polosFinal por id (sem prefixo)
  const finalById = new Map<string, any>()
  polosFinal.forEach((p) => {
    finalById.set(p.id, p)
  })

  // Fonte primária = frentes (EAP_Polos), enriquecida com pacotes do EAP_Final
  return frentes.map((fr: any): EAPPolo => {
    // ID curto: "F1 - Frutal" → "F1", "F4 - Rio Paranaiba" → "F4"
    const shortId = fr.id.split(' - ')[0]
    const cc = FRENTE_TO_CC[fr.id] || FRENTE_TO_CC[shortId] || ''
    const label = fr.id.split(' - ').slice(1).join(' - ') || fr.id

    // Procura no EAP_Final por shortId ou pelo F5 (Rio Paranaíba)
    let polFinal: any = null
    for (const k of [fr.id, shortId, 'F5']) {
      const candidate = finalById.get(k)
      if (candidate && (candidate.label.toLowerCase().includes(label.toLowerCase()) || k === shortId)) {
        polFinal = candidate
        break
      }
    }
    if (!polFinal) {
      // último recurso — match por label
      polFinal = polosFinal.find(
        (p) => p.label.toLowerCase().includes(label.toLowerCase()),
      )
    }

    // Pacotes (vêm do EAP_Final)
    const pacotes: EAPPacote[] = polFinal
      ? polFinal.pacotes.map((p: any): EAPPacote => ({
          nome: p.n,
          cor: SEC_COLOR[p.n] || '#374151',
          pct: p.pct || 0,
          valor_total_str: p.valor_total || 'R$ 0',
          has: p.has !== false,
          is_outros: p._is_outros_block === true,
          lines: (p._lines || []).map((l: any): EAPLine => ({
            sub: l.sub,
            label: l.label,
            qty: l.qty,
            pct: l.med?.pct,
            qty_real: l.med?.qty_real,
            qty_total: l.med?.qty_total,
            data: l.med?.data,
            special: l.special === true,
          })),
          outros_valor: p._outros || undefined,
        }))
      : []

    // OSCs (somando todos os canteiros)
    const oscs: EAPOSC[] = []
    fr.canteiros.forEach((c: any) => {
      ;(c.oscs || []).forEach((o: any) => {
        oscs.push({
          codigo: `OSC-${o.key}`,
          codigo_curto: shortOSC(o.key),
          nome: o.obra,
          status: o.status,
          valor: o.valor || 0,
          saldo: o.saldo || 0,
          pct_acum: o.pct_acum || 0,
          valor_acum: o.valor_acum || 0,
          torres: o.tot || o.estr || 0,
          ton: o.ton || 0,
          tem_medicao: o.tem_medicao === true,
          fonte_qtd: o.fonte_qtd || '',
          detalhe_torres: o.detalhe_torres || undefined,
          canteiro: c.nome,
        })
      })
    })

    const contratado = fr.contratado || 0
    const saldo = fr.saldo || 0
    const faturado = contratado - saldo
    const pct_fin = polFinal?.pct_fin ?? (contratado > 0 ? Math.round((faturado / contratado) * 100) : 0)
    const pct_fis = polFinal?.pct_fis ?? Math.round(fr.secoes_pct?.geral || 0)

    const canteiros = (fr.canteiros || []).map((c: any) => ({
      nome: c.nome,
      n_oscs: c.n_oscs || (c.oscs || []).length,
      contratado: c.contratado || 0,
      saldo: c.saldo || 0,
    }))

    return {
      id: fr.id,
      cc_codigo: cc,
      label,
      contratado,
      saldo,
      faturado,
      pct_fin,
      pct_fis,
      torres: fr.torres || 0,
      ton: fr.ton || 0,
      n_oscs: fr.n_oscs || oscs.length,
      pacotes,
      oscs,
      canteiros,
      metrics: polFinal?.metrics || undefined,
    }
  })
}

const POLOS_CACHE = buildPolos()

export function useEAP() {
  // Síncrono — dados estão em JSON estático embedded no bundle
  return {
    data: POLOS_CACHE,
    isLoading: false,
    error: null,
  }
}

// ── Helpers de formatação ────────────────────────────────────────────────────
export function fmtBRL(v: number): string {
  if (!v) return 'R$ 0'
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (v >= 1_000) return `R$ ${Math.round(v / 1000)}k`
  return `R$ ${v.toFixed(0)}`
}

export function fmtNum(v: number, dec: number = 0): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

// Soma totais globais
export function totalGeral(polos: EAPPolo[]) {
  return {
    contratado: polos.reduce((s, p) => s + p.contratado, 0),
    saldo: polos.reduce((s, p) => s + p.saldo, 0),
    faturado: polos.reduce((s, p) => s + p.faturado, 0),
    torres: polos.reduce((s, p) => s + p.torres, 0),
    ton: polos.reduce((s, p) => s + p.ton, 0),
    oscs: polos.reduce((s, p) => s + p.n_oscs, 0),
    polos: polos.length,
  }
}
