// ─────────────────────────────────────────────────────────────────────────────
// status-report-projeto-pdf.ts — Status Report de um Projeto/Frente (EGP)
// Cabeçalho enxuto (logo transição + nome do projeto) + panorama, e o corpo em
// CAPÍTULOS espelhando as perguntas-chave de um status report de projeto:
// Obras & OSCs · Progresso físico (EAP) · Prazo · Produção/ritmo · Financeiro ·
// Recursos & equipe · Riscos & bloqueios · Qualidade & segurança · Contrato &
// cliente · Ações & obras críticas (PDCA) · Síntese. Dimensões ainda não
// instrumentadas são marcadas com honestidade (não inventar dado).
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'

export interface ProjPdfPacote { n: string; pctFis: number | null; pctFin: number; qtdContr: number; qtdReal: number; unidade: string | null; valor: number }
export interface ProjPdfMedRow { pac: string; meses: number[]; total: number }
export interface ProjPdfAcao { acao: string; dono?: string; prazo?: string }
export interface ProjPdfObra { nome: string; status: string | null; diagnostico: string | null; farol: string | null; acoes: ProjPdfAcao[] | null }
export interface ProjPdfObraLista { nome: string; oscs: string[] }
export interface StatusReportProjetoPdfData {
  projeto: string; nObras: number; nOscs: number
  pctFis: number; pctFin: number
  contratado: number; faturado: number; saldo: number
  obrasLista: ProjPdfObraLista[]
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
const PAC_RGB = (n: string): [number, number, number] => {
  const s = n.toLowerCase()
  if (s.includes('cabo')) return [79, 70, 229]
  if (s.includes('torre') || s.includes('montag')) return [30, 41, 59]
  if (s.includes('funda')) return [180, 83, 9]
  if (s.includes('adm')) return [124, 58, 237]
  if (s.includes('prelim') || s.includes('canteir')) return [37, 99, 235]
  return [100, 116, 139]
}

function buildDoc(d: StatusReportProjetoPdfData, _empresa: EmpresaData, logo: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - 2 * M
  let y = M
  const DARK = [30, 41, 59] as const, MID = [100, 116, 139] as const, RED = [220, 38, 38] as const
  const GREEN = [5, 150, 105] as const, AMBER = [217, 119, 6] as const
  const check = (n = 10) => { if (y + n > 282) { doc.addPage(); y = M } }

  // Cabeçalho de capítulo numerado (faixa escura)
  let chap = 0
  const chapter = (t: string) => {
    chap++
    check(14)
    doc.setFillColor(...DARK); doc.roundedRect(M, y - 4.5, CW, 8, 1.6, 1.6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255)
    doc.text(`${chap}.  ${t}`, M + 3.5, y + 0.8)
    y += 8.5
  }
  // Corpo de texto simples
  const para = (txt: string, size = 8.5, color: readonly [number, number, number] = MID) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color)
    const t = doc.splitTextToSize(txt, CW - 4)
    check(t.length * (size * 0.5) + 3); doc.text(t, M + 2, y); y += t.length * (size * 0.5) + 3
  }
  // Marca de dimensão ainda não instrumentada (honesto)
  const gap = (txt: string) => {
    check(9)
    doc.setDrawColor(...AMBER); doc.setLineWidth(0.5); doc.line(M + 2, y - 3, M + 2, y + 2)
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...AMBER)
    doc.text('A instrumentar', M + 5, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MID)
    const t = doc.splitTextToSize(txt, CW - 30)
    doc.text(t, M + 30, y); y += Math.max(t.length * 4, 4) + 4
  }

  // ── Cabeçalho enxuto (sem CNPJ/endereço) ──────────────────────────────────
  const HH = 26
  doc.setFillColor(...DARK); doc.rect(0, 0, W, HH, 'F')
  if (logo) { try { doc.addImage(logo, 'PNG', M, 7, 42, 11) } catch { /* */ } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(180, 190, 200)
  doc.text('STATUS REPORT · PROJETO', W - M, 9.5, { align: 'right' })
  // Nome do projeto em destaque (encolhe a fonte se não couber)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
  let fs = 13; doc.setFontSize(fs)
  while (doc.getTextWidth(d.projeto) > 132 && fs > 8) { fs -= 0.5; doc.setFontSize(fs) }
  doc.text(d.projeto, W - M, 16.5, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(180, 190, 200)
  doc.text(`Escritório de Gestão de Projetos (EGP) · ${new Date().toLocaleDateString('pt-BR')}`, W - M, 22, { align: 'right' })
  y = HH + 8

  // ── Panorama (executivo) ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MID)
  doc.text(`${d.nObras} obras · ${d.nOscs} OSCs   ·   só construção não concluída`, M, y); y += 7
  const cards: [string, string, readonly [number, number, number]][] = [
    ['Físico', `${d.pctFis}%  ·  ${fmtM(d.contratado)}`, DARK],
    ['Financeiro', `${d.pctFin}%  ·  ${fmtM(d.faturado)}`, GREEN],
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

  // ── 1. Obras e OSCs ───────────────────────────────────────────────────────
  chapter('OBRAS E OSCs DO PROJETO')
  if (d.obrasLista.length) {
    d.obrasLista.forEach(ob => {
      check(8)
      doc.setFillColor(...DARK); doc.circle(M + 1.6, y - 1, 1.1, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK); doc.text(ob.nome, M + 5, y)
      y += 4
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MID)
      const ot = doc.splitTextToSize(ob.oscs.length ? `OSCs: ${ob.oscs.join('  ·  ')}` : 'sem OSC vinculada', CW - 8)
      check(ot.length * 3.8 + 2); doc.text(ot, M + 5, y); y += ot.length * 3.8 + 3
    })
  } else para('Sem obras de construção em aberto neste projeto.')
  y += 2

  // ── 2. Progresso físico (EAP) ─────────────────────────────────────────────
  chapter('PROGRESSO FÍSICO — EAP POR PACOTE')
  para(`Avanço físico consolidado do projeto: ${d.pctFis}% executado sobre ${fmtM(d.contratado)} contratados.`)
  const gcw = (CW - 4) / 2, gch = 18
  d.pacotes.forEach((pc, i) => {
    const col = i % 2
    if (col === 0) check(gch + 3)
    const cx = M + col * (gcw + 4), cy = y
    const color = PAC_RGB(pc.n)
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.roundedRect(cx, cy, gcw, gch, 2, 2)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 42, 74); doc.text(pc.n.slice(0, 24), cx + 3, cy + 5.5)
    const qb = fmtQ(pc.qtdContr, pc.unidade)
    if (qb) {
      doc.setFontSize(6.5); const bw = doc.getTextWidth(qb) + 4
      doc.setFillColor(...color); doc.roundedRect(cx + gcw - bw - 3, cy + 2, bw, 4.5, 2.2, 2.2, 'F')
      doc.setTextColor(255, 255, 255); doc.text(qb, cx + gcw - bw - 1, cy + 5.2)
    }
    const bar = pc.pctFis ?? pc.pctFin
    doc.setFillColor(226, 232, 240); doc.roundedRect(cx + 3, cy + 8, gcw - 6, 3.4, 1.7, 1.7, 'F')
    doc.setFillColor(...color); doc.roundedRect(cx + 3, cy + 8, Math.max(2, (gcw - 6) * Math.min(bar, 100) / 100), 3.4, 1.7, 1.7, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MID)
    doc.text(pc.pctFis != null ? `Físico ${pc.pctFis}% · falta ${fmtQ(pc.qtdContr - (pc.qtdReal ?? 0), pc.unidade) || '0'}` : `Faturado ${pc.pctFin}%`, cx + 3, cy + 15.5)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 42, 74); doc.text(`R$ ${fmtM(pc.valor)}`, cx + gcw - 3, cy + 15.5, { align: 'right' })
    if (col === 1 || i === d.pacotes.length - 1) y += gch + 3
  })
  y += 3

  // ── 3. Prazo ──────────────────────────────────────────────────────────────
  chapter('PRAZO — CRONOGRAMA E PROJEÇÃO DE TÉRMINO')
  const gapFisFin = d.pctFis - d.pctFin
  para(gapFisFin >= 3
    ? `Físico (${d.pctFis}%) à frente do financeiro (${d.pctFin}%) em ${gapFisFin.toFixed(0)} p.p. — há produção executada ainda não medida/faturada (ver lag no cap. Produção).`
    : `Físico ${d.pctFis}% × financeiro ${d.pctFin}%.`)
  gap('% de prazo consumido e projeção de término por obra (data OSC × vencimento) ainda não consolidados neste relatório automático.')

  // ── 4. Produção e ritmo ───────────────────────────────────────────────────
  chapter('PRODUÇÃO E RITMO — MEDIÇÃO MÊS A MÊS')
  para('Atenção ao lag de medição: a produção de campo do mês N só é MEDIDA e faturada em N+1. R$ 0 no mês corrente não significa obra parada — pode ser trabalho ainda não lançado.', 8, MID)
  if (d.medicao.length) {
    const nCol = d.meses.length
    const cLbl = 46, cTot = 20, cMes = (CW - cLbl - cTot) / nCol
    check(8)
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
  } else para('Sem medições lançadas no período.')

  // ── 5. Financeiro ─────────────────────────────────────────────────────────
  chapter('FINANCEIRO — FATURADO × CONTRATADO')
  para(`Contratado R$ ${fmtM(d.contratado)} · Faturado R$ ${fmtM(d.faturado)} (${d.pctFin}%) · Saldo a produzir R$ ${fmtM(d.saldo)}.`, 8.5, DARK)
  gap('Margem por obra (receita × custo realizado) não é fechada aqui — o custo está consolidado por polo/frente, não por obra.')

  // ── 6. Recursos e equipe ──────────────────────────────────────────────────
  chapter('RECURSOS E EQUIPE — EFETIVO E LIDERANÇA DA FRENTE')
  gap('Efetivo real no ponto (view de presença por frente), horas, liderança nominal (eng./supervisor/encarregado) e veículos alocados — a preencher pela análise do SuperTEG. Lembrar: liderança é PJ e nem sempre bate ponto.')

  // ── 7. Riscos e bloqueios ─────────────────────────────────────────────────
  chapter('RISCOS E BLOQUEIOS')
  gap('Riscos priorizados (matriz prob.×impacto do módulo EGP-Riscos) e bloqueios de campo (acesso/fundiário/projeto/suprimentos) ainda não vinculados ao relatório por projeto.')

  // ── 8. Qualidade e segurança ──────────────────────────────────────────────
  chapter('QUALIDADE E SEGURANÇA')
  gap('Retrabalho, não-conformidades e ocorrências de segurança (módulo QSMA) a integrar por frente/obra.')

  // ── 9. Contrato e cliente ─────────────────────────────────────────────────
  chapter('CONTRATO E CLIENTE (CEMIG)')
  gap('Pendências contratuais, aditivos e status de relacionamento com o cliente a consolidar.')

  // ── 10. Ações e obras críticas (PDCA) ─────────────────────────────────────
  chapter(`AÇÕES E OBRAS CRÍTICAS${d.obras.length ? ` (${d.obras.length})` : ''}`)
  if (d.obras.length) {
    const farolRGB: Record<string, readonly [number, number, number]> = { vermelho: RED, amarelo: AMBER, verde: GREEN, cinza: MID }
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
  } else para('Nenhuma obra marcada como crítica no momento.')

  // ── 11. Síntese ───────────────────────────────────────────────────────────
  chapter('SÍNTESE E DECISÃO')
  const nVerm = d.obras.filter(o => o.farol === 'vermelho').length
  const nAmar = d.obras.filter(o => o.farol === 'amarelo').length
  para(`Projeto com ${d.pctFis}% físico e ${d.pctFin}% financeiro sobre ${fmtM(d.contratado)} contratados (saldo ${fmtM(d.saldo)}).` +
    (d.obras.length ? ` ${d.obras.length} obra(s) em acompanhamento crítico${nVerm ? ` — ${nVerm} vermelho` : ''}${nAmar ? `${nVerm ? ',' : ' —'} ${nAmar} amarelo` : ''}.` : ' Sem obras críticas.') +
    ' Recomendação/farol geral e próximos passos executivos a serem confirmados pela análise do SuperTEG.', 8.5, DARK)

  // ── Rodapé ────────────────────────────────────────────────────────────────
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
