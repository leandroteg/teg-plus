// ─────────────────────────────────────────────────────────────────────────────
// status-report-projeto-pdf.ts — Status Report de um Projeto/Frente (EGP)
// Estrutura em CAPÍTULOS respondendo as 10 perguntas do padrão de status report.
// Cada capítulo = dados quantitativos (tabelas) + análise do SuperTEG (Q&A por
// capítulo, vindo de pmo_projeto_status.capitulos). Dado ausente = "Não
// disponível no período" discreto. Só caracteres WinAnsi (sem →/−/emoji).
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'

export interface ProjPdfPacote { n: string; pctFis: number | null; pctFin: number; qtdContr: number; qtdReal: number; unidade: string | null; valor: number }
export interface ProjPdfMedRow { pac: string; meses: number[]; total: number }
export interface ProjPdfAcao { acao: string; dono?: string; prazo?: string }
export interface ProjPdfObra { nome: string; status: string | null; diagnostico: string | null; farol: string | null; acoes: ProjPdfAcao[] | null }
export interface ProjPdfObraLista { nome: string; oscs: string[] }
export interface ProjPdfPrazoObra { nome: string; venc: string | null; pctPrazo: number | null }
export interface ProjPdfPrazo { pctPrazoProj: number | null; terminoPrev: string | null; obras: ProjPdfPrazoObra[] }
export interface ProjPdfRecursos { fundacao: number; montlanc: number; maqFund: number; maqML: number }
export interface ProjPdfRisco { descricao: string; categoria: string | null; sev: number; prob: number; imp: number }
export interface ProjPdfCustos { realizado: number; orcado: number }
export interface ProjPdfCapItem { q: string; a: string }
export interface ProjPdfCap { key: string; titulo: string; itens: ProjPdfCapItem[] }
export interface ProjPdfStReport { farol: string | null; sintese: string | null; decisoes: string[] | null; capitulos: ProjPdfCap[] | null; gerado_em: string | null }
export interface StatusReportProjetoPdfData {
  projeto: string; nObras: number; nOscs: number
  pctFis: number; pctFin: number
  contratado: number; faturado: number; saldo: number
  obrasLista: ProjPdfObraLista[]
  pacotes: ProjPdfPacote[]
  medicao: ProjPdfMedRow[]
  meses: string[]
  prazo: ProjPdfPrazo
  recursos: ProjPdfRecursos | null
  riscos: ProjPdfRisco[]
  custos: ProjPdfCustos | null
  obras: ProjPdfObra[]
  stReport: ProjPdfStReport | null
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
  const GREEN = [5, 150, 105] as const, AMBER = [217, 119, 6] as const, LIGHT = [241, 245, 249] as const
  const BOTTOM = 280
  const check = (n = 10) => { if (y + n > BOTTOM) { doc.addPage(); y = M + 4 } }
  const PAGE_USABLE = BOTTOM - M - 4
  const keepTogether = (h: number) => { if (h <= PAGE_USABLE && y + h > BOTTOM) { doc.addPage(); y = M + 4 } }

  const farolRGB: Record<string, readonly [number, number, number]> = { vermelho: RED, amarelo: AMBER, verde: GREEN, cinza: MID }
  const farolChip = (farol: string | null, x: number, cy: number): number => {
    const f = farol ?? 'cinza'
    const col = farolRGB[f] ?? MID
    const lbl = f.toUpperCase()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
    const w2 = doc.getTextWidth(lbl) + 5
    doc.setFillColor(...col); doc.roundedRect(x, cy - 3.2, w2, 4.6, 2.3, 2.3, 'F')
    doc.setTextColor(255, 255, 255); doc.text(lbl, x + 2.5, cy)
    return w2
  }

  // Capítulo numerado (faixa escura, sem órfão no rodapé)
  let chap = 0
  const chapter = (t: string) => {
    chap++
    check(24)
    doc.setFillColor(...DARK); doc.roundedRect(M, y - 4.5, CW, 8, 1.6, 1.6, 'F')
    doc.setFillColor(...RED); doc.roundedRect(M, y - 4.5, 2, 8, 1, 1, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255)
    doc.text(`${chap}.  ${t}`, M + 4.5, y + 0.8)
    y += 9.5
  }
  const para = (txt: string, size = 8.5, color: readonly [number, number, number] = MID) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color)
    const t = doc.splitTextToSize(txt, CW - 4)
    check(t.length * (size * 0.5) + 3); doc.text(t, M + 2, y); y += t.length * (size * 0.5) + 3
  }
  const naDisp = (txt: string) => {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...MID)
    const t = doc.splitTextToSize(`Não disponível no período — ${txt}`, CW - 4)
    check(t.length * 4 + 3); doc.text(t, M + 2, y); y += t.length * 4 + 3
  }
  const fmtD = (s: string | null) => s ? (() => { const d2 = new Date(s + 'T00:00:00'); return `${String(d2.getDate()).padStart(2, '0')}/${String(d2.getMonth() + 1).padStart(2, '0')}/${d2.getFullYear()}` })() : '-'

  // Q&A do SuperTEG por capítulo (key) — subtópicos pergunta » resposta
  const caps = new Map<string, ProjPdfCap>((d.stReport?.capitulos ?? []).map(c => [c.key, c]))
  const qa = (key: string): boolean => {
    const cap = caps.get(key)
    if (!cap || !(cap.itens ?? []).length) return false
    cap.itens.forEach(it => {
      doc.setFontSize(8)
      const qt = doc.splitTextToSize(`» ${it.q}`, CW - 4)
      const at = doc.splitTextToSize(it.a, CW - 8)
      keepTogether(qt.length * 3.9 + at.length * 3.9 + 3.5)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK); doc.text(qt, M + 2, y); y += qt.length * 3.9
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MID); doc.text(at, M + 6, y); y += at.length * 3.9 + 2.5
    })
    y += 1
    return true
  }

  // Tabela genérica com header repetido em quebra de página
  const table = (cols: { t: string; w: number; align?: 'left' | 'right' }[], rows: { cells: string[]; colors?: (readonly [number, number, number] | null)[] }[], opts?: { zebra?: boolean }) => {
    const xs: number[] = []; let acc = M
    cols.forEach(c => { xs.push(acc); acc += c.w })
    const header = () => {
      doc.setFillColor(...LIGHT); doc.rect(M, y - 3.4, CW, 5, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MID)
      cols.forEach((c, i) => doc.text(c.t, c.align === 'right' ? xs[i] + c.w - 2 : xs[i] + 1.5, y, { align: c.align === 'right' ? 'right' : 'left' }))
      y += 4.6
    }
    check(10); header()
    rows.forEach((r, ri) => {
      doc.setFontSize(7.5)
      const hts = r.cells.map((cell, i) => doc.splitTextToSize(cell, cols[i].w - 3).length)
      const rowH = Math.max(...hts) * 3.8 + 1.4
      if (y + rowH > BOTTOM) { doc.addPage(); y = M + 4; header() }
      if (opts?.zebra && ri % 2 === 1) { doc.setFillColor(250, 250, 252); doc.rect(M, y - 3.2, CW, rowH, 'F') }
      r.cells.forEach((cell, i) => {
        const col = r.colors?.[i] ?? DARK
        doc.setFont('helvetica', i === 0 ? 'normal' : 'normal'); doc.setFontSize(7.5); doc.setTextColor(...col)
        const t = doc.splitTextToSize(cell, cols[i].w - 3)
        doc.text(t, cols[i].align === 'right' ? xs[i] + cols[i].w - 2 : xs[i] + 1.5, y, { align: cols[i].align === 'right' ? 'right' : 'left' })
      })
      y += rowH
    })
    y += 2.5
  }

  // ── Cabeçalho (enxuto, nome do projeto) ───────────────────────────────────
  const HH = 26
  doc.setFillColor(...DARK); doc.rect(0, 0, W, HH, 'F')
  if (logo) { try { doc.addImage(logo, 'PNG', M, 7, 42, 11) } catch { /* */ } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(180, 190, 200)
  doc.text('STATUS REPORT · PROJETO', W - M, 9.5, { align: 'right' })
  doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
  let fs = 13; doc.setFontSize(fs)
  while (doc.getTextWidth(d.projeto) > 132 && fs > 8) { fs -= 0.5; doc.setFontSize(fs) }
  doc.text(d.projeto, W - M, 16.5, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(180, 190, 200)
  doc.text(`Escritório de Gestão de Projetos (EGP) · ${new Date().toLocaleDateString('pt-BR')}`, W - M, 22, { align: 'right' })
  y = HH + 8

  // ── Panorama executivo ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MID)
  doc.text(`${d.nObras} obras · ${d.nOscs} OSCs · só construção não concluída`, M, y)
  if (d.stReport?.farol) farolChip(d.stReport.farol, M + doc.getTextWidth(`${d.nObras} obras · ${d.nOscs} OSCs · só construção não concluída`) + 5, y)
  y += 7
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
    table(
      [{ t: 'Obra', w: CW * 0.46 }, { t: 'OSCs', w: CW * 0.54 }],
      d.obrasLista.map(ob => ({ cells: [ob.nome, ob.oscs.length ? ob.oscs.join(' · ') : 'sem OSC vinculada'], colors: [DARK, MID] })),
      { zebra: true },
    )
  } else para('Sem obras de construção em aberto neste projeto.')

  // ── 2. Progresso físico (EAP) ─────────────────────────────────────────────
  chapter('PROGRESSO FÍSICO (EAP)')
  const gcw = (CW - 4) / 2, gch = 18
  keepTogether(Math.ceil(d.pacotes.length / 2) * (gch + 3))
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
  y += 2
  qa('fisico')

  // ── 3. Prazo ──────────────────────────────────────────────────────────────
  chapter('PRAZO')
  const diasLbl = (venc: string | null): { txt: string; n: number | null } => {
    if (!venc) return { txt: '-', n: null }
    const n = Math.round((Date.now() - new Date(venc + 'T00:00:00').getTime()) / 86400000)
    if (n > 0) return { txt: `${n} dias de atraso`, n }
    if (n < 0) return { txt: `faltam ${-n} dias`, n }
    return { txt: 'vence hoje', n: 0 }
  }
  if (d.prazo?.terminoPrev || d.prazo?.obras?.length) {
    const pj = diasLbl(d.prazo?.terminoPrev ?? null)
    para(`Término previsto (vencimento da última OSC): ${fmtD(d.prazo?.terminoPrev ?? null)}${pj.n != null ? ` — ${pj.txt}` : ''} · Físico atual ${d.pctFis}%.`, 8.5, DARK)
    if (d.prazo?.obras?.length) {
      table(
        [{ t: 'Obra', w: CW * 0.52 }, { t: 'Vencimento', w: CW * 0.2, align: 'right' }, { t: 'Desvio de prazo', w: CW * 0.28, align: 'right' }],
        d.prazo.obras.map(o => {
          const dl = diasLbl(o.venc)
          const col: readonly [number, number, number] = dl.n == null ? MID : dl.n > 0 ? RED : GREEN
          return { cells: [o.nome, fmtD(o.venc), dl.txt], colors: [DARK, DARK, col] }
        }),
        { zebra: true },
      )
    }
  } else naDisp('datas de OSC/vencimento não lançadas para as obras do projeto.')
  qa('prazo')

  // ── 4. Produção e ritmo ───────────────────────────────────────────────────
  chapter('PRODUÇÃO E RITMO — MEDIÇÃO MÊS A MÊS')
  if (d.medicao.length) {
    const nCol = d.meses.length
    const wLbl = CW * 0.24, wTot = CW * 0.1, wMes = (CW - wLbl - wTot) / nCol
    const totCols = new Array(nCol).fill(0); let totG = 0
    const rows = d.medicao.map(m => {
      m.meses.forEach((v, i) => { totCols[i] += v }); totG += m.total
      return { cells: [m.pac, ...m.meses.map(v => v > 0 ? fmtM(v) : '·'), fmtM(m.total)], colors: [DARK, ...m.meses.map(v => (v > 0 ? DARK : [203, 213, 225] as const)), DARK] }
    })
    rows.push({ cells: ['Total', ...totCols.map(v => fmtM(v)), fmtM(totG)], colors: [DARK, ...totCols.map(() => DARK), DARK] })
    table(
      [{ t: 'Pacote', w: wLbl }, ...d.meses.map(mL => ({ t: mL, w: wMes, align: 'right' as const })), { t: 'Total', w: wTot, align: 'right' as const }],
      rows, { zebra: true },
    )
  } else para('Sem medições lançadas no período.')
  qa('producao')

  // ── 5. Financeiro / margem ────────────────────────────────────────────────
  chapter('FINANCEIRO / MARGEM')
  {
    const rowsFin: { cells: string[]; colors?: (readonly [number, number, number] | null)[] }[] = [
      { cells: ['Contratado', `R$ ${fmtM(d.contratado)}`], colors: [MID, DARK] },
      { cells: ['Faturado (medido)', `R$ ${fmtM(d.faturado)}  (${d.pctFin}%)`], colors: [MID, GREEN] },
      { cells: ['Saldo a produzir', `R$ ${fmtM(d.saldo)}`], colors: [MID, RED] },
    ]
    if (d.custos) {
      const pctC = d.custos.orcado > 0 ? Math.round(d.custos.realizado / d.custos.orcado * 100) : 0
      rowsFin.push({ cells: ['Custo realizado × orçado (frente)', `R$ ${fmtM(d.custos.realizado)} de R$ ${fmtM(d.custos.orcado)}  (${pctC}%)`], colors: [MID, DARK] })
      rowsFin.push({ cells: ['Margem parcial (faturado - custo)', `R$ ${fmtM(d.faturado - d.custos.realizado)}`], colors: [MID, d.faturado - d.custos.realizado >= 0 ? GREEN : RED] })
    }
    table([{ t: 'Indicador', w: CW * 0.55 }, { t: 'Valor', w: CW * 0.45, align: 'right' }], rowsFin, { zebra: true })
  }
  qa('financeiro')

  // ── 6. Recursos e equipe ──────────────────────────────────────────────────
  chapter('RECURSOS E EQUIPE')
  if (d.recursos) {
    const r = d.recursos
    table(
      [{ t: 'Recurso', w: CW * 0.55 }, { t: 'Quantidade', w: CW * 0.45, align: 'right' }],
      [
        { cells: ['Pessoas — Fundação', String(r.fundacao)] },
        { cells: ['Pessoas — Montagem / Lançamento', String(r.montlanc)] },
        { cells: ['Máquinas de fundação', String(r.maqFund)] },
        { cells: ['Guindauto / lançamento', String(r.maqML)] },
      ], { zebra: true },
    )
  }
  if (!qa('recursos') && !d.recursos) naDisp('efetivo da frente não casado com a base do projeto no período.')

  // ── 7. Riscos e bloqueios ─────────────────────────────────────────────────
  chapter(`RISCOS E BLOQUEIOS${d.riscos.length ? ` (${d.riscos.length})` : ''}`)
  const sevLbl = (s: number) => s >= 16 ? 'Crítico' : s >= 11 ? 'Alto' : s >= 6 ? 'Médio' : 'Baixo'
  const sevRGB = (s: number): readonly [number, number, number] => s >= 16 ? RED : s >= 11 ? [234, 88, 12] : s >= 6 ? AMBER : GREEN
  const CAT_LBL: Record<string, string> = { prazo: 'Prazo', custo: 'Custo', recurso: 'Recurso', seguranca: 'Segurança', qualidade: 'Qualidade', ambiental: 'Ambiental', externo: 'Externo', contratual: 'Contratual' }
  if (d.riscos.length) {
    table(
      [{ t: 'Risco', w: CW * 0.62 }, { t: 'Categoria', w: CW * 0.18 }, { t: 'Severidade', w: CW * 0.2, align: 'right' }],
      d.riscos.map(r => ({ cells: [r.descricao, r.categoria ? (CAT_LBL[r.categoria] ?? r.categoria) : '-', `${sevLbl(r.sev)} (${r.prob}×${r.imp})`], colors: [DARK, MID, sevRGB(r.sev)] })),
      { zebra: true },
    )
  }
  if (!qa('riscos') && !d.riscos.length) naDisp('nenhum risco cadastrado para o projeto no módulo EGP-Riscos.')

  // ── 8. Segurança (QSMA) ───────────────────────────────────────────────────
  chapter('SEGURANÇA (QSMA)')
  if (!qa('seguranca')) naDisp('sem análise de ocorrências/inspeções QSMA — gere o relatório com o SuperTEG.')

  // ── 9. Contrato / cliente — só quando o SuperTEG tem conteúdo ─────────────
  if ((caps.get('contrato')?.itens ?? []).length) {
    chapter('CONTRATO / CLIENTE (CEMIG)')
    qa('contrato')
  }

  // ── 10. Ações e obras críticas ────────────────────────────────────────────
  chapter(`AÇÕES E OBRAS CRÍTICAS${d.obras.length ? ` (${d.obras.length})` : ''}`)
  if (d.obras.length) {
    d.obras.forEach(o => {
      // pré-mede o bloco (título + diagnóstico + tabela de ações) p/ não partir
      doc.setFontSize(8.5)
      const diag = doc.splitTextToSize(o.diagnostico ?? o.status ?? '', CW - 4)
      const acoes = o.acoes ?? []
      doc.setFontSize(7.5)
      const acLines = acoes.map(a => doc.splitTextToSize(a.acao, CW * 0.62 - 3).length)
      const acH = acoes.length ? 5 + acLines.reduce((s, n) => s + n * 3.8 + 1.4, 0) : 0
      keepTogether(6 + diag.length * 4.2 + acH + 6)
      // título com chip de farol
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK)
      const chipW = farolChip(o.farol, M, y)
      doc.text(o.nome, M + chipW + 3, y); y += 5.5
      // diagnóstico
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MID)
      check(diag.length * 4.2 + 2); doc.text(diag, M + 2, y); y += diag.length * 4.2 + 2.5
      // ações em tabela
      if (acoes.length) {
        table(
          [{ t: 'Ação', w: CW * 0.62 }, { t: 'Responsável', w: CW * 0.26 }, { t: 'Prazo', w: CW * 0.12, align: 'right' }],
          acoes.map(a => ({ cells: [a.acao, a.dono ?? '-', a.prazo ?? '-'], colors: [DARK, MID, DARK] })),
          { zebra: true },
        )
      }
      y += 2
    })
  } else para('Nenhuma obra marcada como crítica no momento.')
  qa('acoes')

  // ── 11. Síntese e decisão ─────────────────────────────────────────────────
  chapter('SÍNTESE E DECISÃO')
  if (d.stReport?.sintese) {
    keepTogether(14)
    const chipW = farolChip(d.stReport.farol, M + 2, y)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
    doc.text('Farol do projeto', M + 2 + chipW + 3, y); y += 5.5
    para(d.stReport.sintese, 8.5, DARK)
    const decs = d.stReport.decisoes ?? []
    if (decs.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...AMBER)
      check(5); doc.text('Exige decisão da diretoria:', M + 2, y); y += 4.5
      decs.forEach(dec => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK)
        const t = doc.splitTextToSize(`• ${dec}`, CW - 8)
        check(t.length * 4 + 2); doc.text(t, M + 4, y); y += t.length * 4 + 1
      })
    }
  } else {
    const nVerm = d.obras.filter(o => o.farol === 'vermelho').length
    const nAmar = d.obras.filter(o => o.farol === 'amarelo').length
    para(`Projeto com ${d.pctFis}% físico e ${d.pctFin}% financeiro sobre ${fmtM(d.contratado)} contratados (saldo ${fmtM(d.saldo)}).` +
      (d.obras.length ? ` ${d.obras.length} obra(s) em acompanhamento crítico${nVerm ? ` — ${nVerm} vermelho` : ''}${nAmar ? `${nVerm ? ',' : ' —'} ${nAmar} amarelo` : ''}.` : ' Sem obras críticas.') +
      ' Gere o relatório com o SuperTEG para farol, síntese e decisões recomendadas.', 8.5, DARK)
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...MID)
  const pages = doc.getNumberOfPages()
  const genLbl = d.stReport?.gerado_em ? `Análise SuperTEG de ${new Date(d.stReport.gerado_em).toLocaleString('pt-BR')}` : `Gerado em ${new Date().toLocaleString('pt-BR')}`
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.text(genLbl, M, 290); doc.text(`${i}/${pages}`, W - M, 290, { align: 'right' }) }
  return doc
}

export async function gerarStatusReportProjetoPdf(d: StatusReportProjetoPdfData): Promise<void> {
  let empresa: EmpresaData = EMPRESA_FALLBACK
  try { empresa = await getEmpresa() } catch { /* */ }
  const logo = await loadLogoBase64('/logo-teg-transicao-branca.png') ?? (empresa.logoUrl ? await loadLogoBase64(empresa.logoUrl) : null)
  const doc = buildDoc(d, empresa, logo)
  doc.save(`Status_Report_${d.projeto.replace(/[^\w\-]+/g, '_').slice(0, 40)}.pdf`)
}
