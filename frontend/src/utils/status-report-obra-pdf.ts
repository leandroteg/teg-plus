// ─────────────────────────────────────────────────────────────────────────────
// status-report-obra-pdf.ts — Status Report de uma Obra (EGP)
// Header corporativo TEG (logo transição) + indicadores (valor, faturado, saldo,
// % faturado, % prazo, OSCs) + status descritivo gerado pela IA (SuperTEG).
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'

export interface StatusReportObraPdfAcao { acao: string; dono?: string; prazo?: string }
export interface StatusReportObraPdfData {
  obra: string
  frente: string
  valor: number
  faturado: number
  saldo: number
  fatPct: number
  prazoPct: number | null
  nOsc: number
  statusTexto: string | null
  diagnostico?: string | null
  acoes?: StatusReportObraPdfAcao[] | null
  farol: string | null
  geradoPor?: string | null
}

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
  } catch { return null }
}

const fmtBRL = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR')

function buildDoc(d: StatusReportObraPdfData, empresa: EmpresaData, logo: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - 2 * M
  let y = M
  const DARK = [30, 41, 59] as const
  const MID = [100, 116, 139] as const
  const RED = [220, 38, 38] as const
  const farolRGB: Record<string, readonly [number, number, number]> =
    { vermelho: [220, 38, 38], amarelo: [217, 119, 6], verde: [5, 150, 105], cinza: [100, 116, 139] }
  const fRGB = farolRGB[d.farol ?? 'cinza'] ?? farolRGB.cinza

  // ── Header ──
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 34, 'F')
  if (logo) { try { doc.addImage(logo, 'PNG', M, 7, 46, 12) } catch { /* ignore */ } }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M, 24)
  if (empresa.endereco) doc.text(`${empresa.endereco}${empresa.cidade ? ` - ${empresa.cidade}/${empresa.uf ?? ''}` : ''}`, M, 28)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255)
  doc.text('STATUS REPORT — OBRA', W - M, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 190, 200)
  doc.text('Escritório de Gestão de Projetos (EGP)', W - M, 17, { align: 'right' })
  doc.text(new Date().toLocaleDateString('pt-BR'), W - M, 22, { align: 'right' })
  y = 44

  // ── Obra / frente ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...DARK)
  doc.text(d.obra, M, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MID)
  doc.text(`Projeto / Frente: ${d.frente}   ·   ${d.nOsc} OSC${d.nOsc !== 1 ? 's' : ''}`, M, y); y += 9

  // ── Indicadores (cards em grade) ──
  const cards: [string, string, readonly [number, number, number]][] = [
    ['Valor contratado', fmtBRL(d.valor), DARK],
    ['Faturado', `${fmtBRL(d.faturado)}  (${d.fatPct}%)`, [5, 150, 105]],
    ['Saldo a produzir', fmtBRL(d.saldo), RED],
    ['% Prazo consumido', d.prazoPct == null ? '—' : `${d.prazoPct}%`, d.prazoPct != null && d.prazoPct >= 90 ? RED : MID],
  ]
  const cw = CW / 2, ch = 16
  cards.forEach((c, i) => {
    const cx = M + (i % 2) * cw, cy = y + Math.floor(i / 2) * (ch + 3)
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.roundedRect(cx, cy, cw - 3, ch, 2, 2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MID)
    doc.text(c[0], cx + 4, cy + 5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...c[2])
    doc.text(c[1], cx + 4, cy + 12)
  })
  y += 2 * (ch + 3) + 6

  // ── Status (IA) ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED)
  doc.text('SITUAÇÃO ATUAL', M, y); y += 1
  doc.setDrawColor(...RED); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 6
  // farol
  doc.setFillColor(...fRGB); doc.circle(M + 2, y - 1.2, 1.6, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...fRGB)
  doc.text((d.farol ?? '—').toUpperCase(), M + 6, y); y += 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...DARK)
  const resumo = doc.splitTextToSize(d.statusTexto ?? 'Status ainda não gerado.', CW)
  doc.text(resumo, M, y); y += resumo.length * 5.5 + 4

  if (d.diagnostico) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MID)
    const diag = doc.splitTextToSize(d.diagnostico, CW)
    if (y + diag.length * 5 > 272) { doc.addPage(); y = M }
    doc.text(diag, M, y); y += diag.length * 5 + 8
  }

  if (d.acoes && d.acoes.length) {
    if (y + 22 > 272) { doc.addPage(); y = M }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED)
    doc.text('AÇÕES SUGERIDAS', M, y); y += 1
    doc.setDrawColor(...RED); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 6
    d.acoes.forEach((a, i) => {
      const txt = doc.splitTextToSize(`${i + 1}. ${a.acao}`, CW - 4)
      if (y + txt.length * 5 + 5 > 278) { doc.addPage(); y = M }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...DARK)
      doc.text(txt, M, y); y += txt.length * 5
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...MID)
      doc.text(`${a.dono ?? '—'}${a.prazo ? ` · até ${a.prazo}` : ''}`, M + 4, y); y += 6
    })
  }

  // ── Rodapé ──
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...MID)
  doc.text(`Gerado por ${d.geradoPor ?? 'SuperTEG'} · ${new Date().toLocaleString('pt-BR')}`, M, 285)
  doc.text(empresa.razao || 'TEG União Engenharia', W - M, 285, { align: 'right' })
  return doc
}

export async function gerarStatusReportObraPdf(d: StatusReportObraPdfData): Promise<void> {
  let empresa: EmpresaData = EMPRESA_FALLBACK
  try { empresa = await getEmpresa() } catch { /* fallback */ }
  const logo = await loadLogoBase64('/logo-teg-transicao-branca.png') ?? (empresa.logoUrl ? await loadLogoBase64(empresa.logoUrl) : null)
  const doc = buildDoc(d, empresa, logo)
  doc.save(`Status_Report_${d.obra.replace(/[^\w\-]+/g, '_').slice(0, 40)}.pdf`)
}
