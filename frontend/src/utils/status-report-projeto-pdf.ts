// ─────────────────────────────────────────────────────────────────────────────
// status-report-projeto-pdf.ts — Status Report de um Projeto/Frente (EGP)
// Capa (físico/financeiro) + EAP por pacote + medição mês a mês + detalhe das
// obras críticas (diagnóstico + ações). Header corporativo TEG (logo transição).
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'

export interface ProjPdfPacote { n: string; pctFis: number | null; pctFin: number; qtdContr: number; qtdReal: number; unidade: string | null; valor: number }
export interface ProjPdfMedRow { pac: string; meses: number[]; total: number }
export interface ProjPdfAcao { acao: string; dono?: string; prazo?: string }
export interface ProjPdfObra { nome: string; status: string | null; diagnostico: string | null; farol: string | null; acoes: ProjPdfAcao[] | null }
export interface StatusReportProjetoPdfData {
  projeto: string; nObras: number; nOscs: number
  pctFis: number; pctFin: number
  contratado: number; faturado: number; saldo: number
  pacotes: ProjPdfPacote[]
  medicao: ProjPdfMedRow[]
  meses: string[]
  obras: ProjPdfObra[]
}

async function loadLogoBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url); if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.onerror = () => resolve(null); r.readAsDataURL(blob) })
  } catch { return null }
}

const fmtM = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`
const fmtQ = (q: number, u: string | null) => u ? `${Number(q).toLocaleString('pt-BR', { maximumFractionDigits: q < 10 ? 1 : 0 })} ${u}` : ''

function buildDoc(d: StatusReportProjetoPdfData, empresa: EmpresaData, logo: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - 2 * M
  let y = M
  const DARK = [30, 41, 59] as const, MID = [100, 116, 139] as const, RED = [220, 38, 38] as const
  const check = (n = 10) => { if (y + n > 282) { doc.addPage(); y = M } }
  const title = (t: string) => { check(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED); doc.text(t, M, y); y += 1; doc.setDrawColor(...RED); doc.setLineWidth(0.4); doc.line(M, y, W - M, y); y += 6 }

  // Header
  doc.setFillColor(...DARK); doc.rect(0, 0, W, 34, 'F')
  if (logo) { try { doc.addImage(logo, 'PNG', M, 7, 46, 12) } catch { /* */ } }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M, 24)
  if (empresa.endereco) doc.text(`${empresa.endereco}${empresa.cidade ? ` - ${empresa.cidade}/${empresa.uf ?? ''}` : ''}`, M, 28)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255)
  doc.text('STATUS REPORT — PROJETO', W - M, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 190, 200)
  doc.text('Escritório de Gestão de Projetos (EGP)', W - M, 17, { align: 'right' })
  doc.text(new Date().toLocaleDateString('pt-BR'), W - M, 22, { align: 'right' })
  y = 44

  // Capa
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...DARK)
  doc.text(d.projeto, M, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MID)
  doc.text(`${d.nObras} obras · ${d.nOscs} OSCs   ·   só construção não concluída`, M, y); y += 8
  const cards: [string, string, readonly [number, number, number]][] = [
    ['Físico', `${d.pctFis}%  ·  ${fmtM(d.contratado)}`, DARK],
    ['Financeiro', `${d.pctFin}%  ·  ${fmtM(d.faturado)}`, [5, 150, 105]],
    ['Saldo a produzir', `R$ ${fmtM(d.saldo)}`, RED],
  ]
  const cw = CW / 3
  cards.forEach((c, i) => {
    const cx = M + i * cw
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.roundedRect(cx, y, cw - 3, 16, 2, 2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MID); doc.text(c[0], cx + 4, y + 5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...c[2]); doc.text(c[1], cx + 4, y + 12)
  })
  y += 24

  // EAP por pacote
  title('EAP DO PROJETO (POR PACOTE)')
  doc.setFontSize(8.5)
  d.pacotes.forEach(pc => {
    check(9)
    const fis = pc.pctFis != null ? `Físico ${pc.pctFis}%` : `Faturado ${pc.pctFin}%`
    const qtd = fmtQ(pc.qtdReal, pc.unidade) && `${fmtQ(pc.qtdReal, pc.unidade)} / ${fmtQ(pc.qtdContr, pc.unidade)}`
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK); doc.text(pc.n, M, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MID)
    doc.text(`${fis}${qtd ? `  ·  ${qtd}` : ''}`, M + 55, y)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK); doc.text(`R$ ${fmtM(pc.valor)}`, W - M, y, { align: 'right' })
    y += 4
    const bar = pc.pctFis ?? pc.pctFin
    doc.setFillColor(226, 232, 240); doc.roundedRect(M, y, CW, 1.8, 0.9, 0.9, 'F')
    doc.setFillColor(...DARK); doc.roundedRect(M, y, Math.max(2, CW * Math.min(bar, 100) / 100), 1.8, 0.9, 0.9, 'F')
    y += 5
  })
  y += 3

  // Medição mês a mês
  if (d.medicao.length) {
    title('MEDIÇÃO MÊS A MÊS (POR PACOTE)')
    const nCol = d.meses.length
    const cLbl = 46, cTot = 20, cMes = (CW - cLbl - cTot) / nCol
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MID)
    doc.text('Pacote', M, y)
    d.meses.forEach((mL, i) => doc.text(mL, M + cLbl + i * cMes + cMes - 1, y, { align: 'right' }))
    doc.text('Total', W - M, y, { align: 'right' }); y += 4
    doc.setFontSize(7.5)
    const tot = new Array(nCol).fill(0); let totG = 0
    d.medicao.forEach(m => {
      check(6)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK); doc.text(m.pac.slice(0, 24), M, y)
      m.meses.forEach((v, i) => { tot[i] += v; doc.setTextColor(v > 0 ? DARK[0] : 200, v > 0 ? DARK[1] : 200, v > 0 ? DARK[2] : 200); doc.text(v > 0 ? fmtM(v) : '·', M + cLbl + i * cMes + cMes - 1, y, { align: 'right' }) })
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK); doc.text(fmtM(m.total), W - M, y, { align: 'right' }); totG += m.total
      y += 4.5
    })
    check(6); doc.setDrawColor(...MID); doc.setLineWidth(0.3); doc.line(M, y - 1.5, W - M, y - 1.5)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK); doc.text('Total', M, y + 1.5)
    tot.forEach((v, i) => doc.text(fmtM(v), M + cLbl + i * cMes + cMes - 1, y + 1.5, { align: 'right' }))
    doc.text(fmtM(totG), W - M, y + 1.5, { align: 'right' }); y += 8
  }

  // Obras críticas
  if (d.obras.length) {
    title(`OBRAS CRÍTICAS (${d.obras.length})`)
    const farolRGB: Record<string, readonly [number, number, number]> = { vermelho: [220, 38, 38], amarelo: [217, 119, 6], verde: [5, 150, 105], cinza: MID }
    d.obras.forEach(o => {
      check(20)
      const fc = farolRGB[o.farol ?? 'cinza'] ?? MID
      doc.setFillColor(...fc); doc.circle(M + 1.4, y - 1, 1.3, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK); doc.text(o.nome, M + 5, y); y += 4.5
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MID)
      const diag = doc.splitTextToSize(o.diagnostico ?? o.status ?? '', CW - 2)
      check(diag.length * 4.5 + 6); doc.text(diag, M + 2, y); y += diag.length * 4.5 + 1
      ;(o.acoes ?? []).forEach(a => {
        const t = doc.splitTextToSize(`• ${a.acao}  — ${a.dono ?? '—'}${a.prazo ? ` · ${a.prazo}` : ''}`, CW - 4)
        check(t.length * 4 + 2); doc.setFontSize(8); doc.setTextColor(...DARK); doc.text(t, M + 3, y); y += t.length * 4
      })
      y += 4
    })
  }

  // Rodapé
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...MID)
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.text(`Gerado pelo SuperTEG · ${new Date().toLocaleString('pt-BR')}`, M, 290); doc.text(`${i}/${pages}`, W - M, 290, { align: 'right' }) }
  return doc
}

export async function gerarStatusReportProjetoPdf(d: StatusReportProjetoPdfData): Promise<void> {
  let empresa: EmpresaData = EMPRESA_FALLBACK
  try { empresa = await getEmpresa() } catch { /* */ }
  const logo = await loadLogoBase64('/logo-teg-transicao-branca.png') ?? (empresa.logoUrl ? await loadLogoBase64(empresa.logoUrl) : null)
  const doc = buildDoc(d, empresa, logo)
  doc.save(`Status_Report_${d.projeto.replace(/[^\w\-]+/g, '_').slice(0, 40)}.pdf`)
}
