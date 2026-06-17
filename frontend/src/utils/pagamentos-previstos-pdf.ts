// ─────────────────────────────────────────────────────────────────────────────
// pagamentos-previstos-pdf.ts — Relatório Gerencial de Pagamentos Previstos
// Mesmo padrão visual do Termo/Laudo: header corporativo (logo + CNPJ), cards
// de resumo e tabela de contas a pagar agrupada por faixa de vencimento.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import type { ContaPagar } from '../types/financeiro'

async function loadLogoBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const fmtMoeda = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d?: string) =>
  d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—'
const hoje = () => new Date().toISOString().slice(0, 10)

interface Faixa {
  key: string
  label: string
  cps: ContaPagar[]
  total: number
  alerta: boolean
}

function agruparPorVencimento(cps: ContaPagar[]): Faixa[] {
  const t = hoje()
  const d7 = new Date(); d7.setDate(d7.getDate() + 7)
  const d30 = new Date(); d30.setDate(d30.getDate() + 30)
  const s7 = d7.toISOString().slice(0, 10)
  const s30 = d30.toISOString().slice(0, 10)

  const buckets: Record<string, ContaPagar[]> = {
    vencidos: [], hoje: [], sete: [], trinta: [], futuro: [],
  }
  for (const cp of cps) {
    const v = cp.data_vencimento
    if (!v || v < t) buckets.vencidos.push(cp)
    else if (v === t) buckets.hoje.push(cp)
    else if (v <= s7) buckets.sete.push(cp)
    else if (v <= s30) buckets.trinta.push(cp)
    else buckets.futuro.push(cp)
  }

  const defs: { key: keyof typeof buckets; label: string; alerta: boolean }[] = [
    { key: 'vencidos', label: 'Vencidos', alerta: true },
    { key: 'hoje', label: 'Vence hoje', alerta: true },
    { key: 'sete', label: 'Próximos 7 dias', alerta: false },
    { key: 'trinta', label: '8 a 30 dias', alerta: false },
    { key: 'futuro', label: 'Acima de 30 dias', alerta: false },
  ]

  return defs
    .map(d => {
      const cpsSorted = [...buckets[d.key]].sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
      return {
        key: d.key,
        label: d.label,
        cps: cpsSorted,
        total: cpsSorted.reduce((s, c) => s + (c.valor_original || 0), 0),
        alerta: d.alerta,
      }
    })
    .filter(f => f.cps.length > 0)
}

export type EscopoRelatorio = 'todos' | 'previstos' | 'confirmados'

const TITULOS: Record<EscopoRelatorio, string> = {
  todos: 'PAGAMENTOS EM ABERTO',
  previstos: 'PAGAMENTOS PREVISTOS',
  confirmados: 'PAGAMENTOS CONFIRMADOS',
}

function buildDoc(cps: ContaPagar[], empresa: EmpresaData, logo: string | null, escopo: EscopoRelatorio) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - 2 * M
  let y = M

  const TEAL = [13, 148, 136] as const
  const DARK = [30, 41, 59] as const
  const MID = [100, 116, 139] as const
  const RED = [220, 38, 38] as const

  const checkPage = (needed = 10) => { if (y + needed > 280) { doc.addPage(); y = M } }

  // ── Header bar ──
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 30, 'F')
  if (logo) { try { doc.addImage(logo, 'PNG', M, 4, 16, 22) } catch { /* ignore */ } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
  doc.text(empresa.fantasia, M + 20, 12)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M + 20, 17)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255)
  doc.text(TITULOS[escopo], W - M, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 190, 200)
  doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, W - M, 19, { align: 'right' })
  y = 38

  const t = hoje()
  const totalGeral = cps.reduce((s, c) => s + (c.valor_original || 0), 0)
  const vencidos = cps.filter(c => !c.data_vencimento || c.data_vencimento < t)
  const venceHoje = cps.filter(c => c.data_vencimento === t)

  // ── Resumo (3 cards) ──
  const cards = [
    { label: 'Total a pagar', valor: totalGeral, cor: DARK, sub: `${cps.length} título(s)` },
    { label: 'Vencidos', valor: vencidos.reduce((s, c) => s + (c.valor_original || 0), 0), cor: RED, sub: `${vencidos.length} título(s)` },
    { label: 'Vence hoje', valor: venceHoje.reduce((s, c) => s + (c.valor_original || 0), 0), cor: TEAL, sub: `${venceHoje.length} título(s)` },
  ]
  const cardW = (CW - 8) / 3
  cards.forEach((c, i) => {
    const x = M + i * (cardW + 4)
    doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, cardW, 20, 2, 2, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MID)
    doc.text(c.label.toUpperCase(), x + 3, y + 5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...c.cor)
    doc.text(fmtMoeda(c.valor), x + 3, y + 12)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MID)
    doc.text(c.sub, x + 3, y + 17)
  })
  y += 27

  // ── Tabela por faixa ──
  const faixas = agruparPorVencimento(cps)
  const cols = { venc: M + 2, forn: M + 22, doc: M + CW - 58, cc: M + CW - 32, val: M + CW - 2 }

  for (const faixa of faixas) {
    checkPage(16)
    // Sub-header da faixa
    doc.setFillColor(faixa.alerta ? 254 : 241, faixa.alerta ? 226 : 245, faixa.alerta ? 226 : 249)
    doc.roundedRect(M, y - 4, CW, 7, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
    doc.setTextColor(...(faixa.alerta ? RED : DARK))
    doc.text(faixa.label, M + 2, y + 0.5)
    doc.text(`${faixa.cps.length} · ${fmtMoeda(faixa.total)}`, W - M - 2, y + 0.5, { align: 'right' })
    y += 8

    // Cabeçalho da tabela
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105)
    doc.text('VENC.', cols.venc, y)
    doc.text('FORNECEDOR', cols.forn, y)
    doc.text('DOCUMENTO', cols.doc, y)
    doc.text('C.CUSTO', cols.cc, y)
    doc.text('VALOR', cols.val, y, { align: 'right' })
    y += 3.5

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
    for (const cp of faixa.cps) {
      checkPage(7)
      doc.setTextColor(...(faixa.alerta ? RED : MID))
      doc.text(fmtData(cp.data_vencimento), cols.venc, y)
      doc.setTextColor(...DARK)
      const forn = (cp.fornecedor_nome || '—')
      doc.text(forn.length > 26 ? forn.slice(0, 24) + '…' : forn, cols.forn, y)
      doc.setTextColor(...MID)
      doc.text((cp.numero_documento || '—').slice(0, 14), cols.doc, y)
      doc.text((cp.centro_custo || '—').slice(0, 12), cols.cc, y)
      doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold')
      doc.text(fmtMoeda(cp.valor_original), cols.val, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      y += 4.5
      doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2)
      doc.line(M, y - 2, W - M, y - 2)
    }
    y += 4
  }

  // ── Total geral ──
  checkPage(12)
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DARK)
  doc.text('TOTAL GERAL', M, y)
  doc.setTextColor(...TEAL)
  doc.text(fmtMoeda(totalGeral), W - M, y, { align: 'right' })

  // ── Footer ──
  doc.setFontSize(6); doc.setTextColor(180, 180, 180)
  const rodapeLabel = escopo === 'previstos'
    ? 'Relatório gerencial de pagamentos previstos'
    : escopo === 'confirmados'
      ? 'Relatório gerencial de pagamentos confirmados'
      : 'Relatório gerencial de pagamentos em aberto'
  doc.text(`TEG+ ERP · ${empresa.fantasia} · ${rodapeLabel}`, W / 2, 290, { align: 'center' })

  return doc
}

export async function gerarPagamentosPrevistosPdfBlob(cps: ContaPagar[], escopo: EscopoRelatorio = 'todos'): Promise<Blob> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const logo = await loadLogoBase64(empresa.logoUrl)
  return buildDoc(cps, empresa, logo, escopo).output('blob')
}

export async function downloadPagamentosPrevistosPdf(cps: ContaPagar[], escopo: EscopoRelatorio = 'todos'): Promise<void> {
  const blob = await gerarPagamentosPrevistosPdfBlob(cps, escopo)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pagamentos-${escopo}-${hoje()}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function abrirPagamentosPrevistosPdf(cps: ContaPagar[], escopo: EscopoRelatorio = 'todos'): Promise<void> {
  const blob = await gerarPagamentosPrevistosPdfBlob(cps, escopo)
  window.open(URL.createObjectURL(blob), '_blank')
}
