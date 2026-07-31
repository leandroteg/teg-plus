// ─────────────────────────────────────────────────────────────────────────────
// os-seguranca-pdf.ts — Ordem de Serviço de Segurança (NR-01)
//
// Reproduz o documento que a TEG já usa: cabeçalho com nome/função/CBO/admissão
// /departamento, objetivo, descrição da atividade, riscos da função, EPIs
// obrigatórios, treinamentos e o termo de ciência com uma assinatura — a de
// quem recebe, colhida no Portal TEG.
//
// O conteúdo vem do SNAPSHOT gravado na OS, nunca das matrizes: uma OS assinada
// tem de mostrar o que a pessoa leu naquele dia.
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'

export interface OsSegPdfData {
  codigo?: string | null
  colaboradorNome: string
  matricula?: string | null
  cargo?: string | null
  setor?: string | null
  cbo?: string | null
  dataAdmissao?: string | null
  objetivo: string
  descricaoAtividade: string
  /** Diretrizes de SST, uma por linha. */
  obrigacoes: string
  riscos: { perigo: string; fonte?: string | null; medidas?: string | null }[]
  epis: { nome: string; ca?: string | null }[]
  epcs?: string[]
  treinamentos: { nome: string; norma?: string | null }[]
  emitidaPorNome?: string | null
}

const DARK: [number, number, number] = [15, 23, 42]
const MID: [number, number, number] = [100, 116, 139]
const LIGHT: [number, number, number] = [226, 232, 240]

async function loadLogoBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const r = new FileReader()
      r.onloadend = () => resolve(r.result as string)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch { return null }
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try { return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return d }
}

function buildDoc(d: OsSegPdfData, empresa: EmpresaData, logo: string | null): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 12, CW = W - M * 2
  let y = 0

  // ── cabeçalho ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 26, 'F')
  if (logo) { try { doc.addImage(logo, 'PNG', M, 7, 30, 8) } catch { /* segue sem logo */ } }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('ORDEM DE SERVIÇO DE SEGURANÇA', W / 2, 12, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text('NR-01 · Segurança e Medicina do Trabalho', W / 2, 17.5, { align: 'center' })
  if (d.codigo) doc.text(d.codigo, W - M, 12, { align: 'right' })
  doc.setFontSize(7)
  doc.text(`${empresa.razao} · CNPJ ${empresa.cnpj}`, W / 2, 22, { align: 'center' })
  y = 32

  const checkPage = (need: number) => {
    if (y + need > 285) { doc.addPage(); y = 16 }
  }

  const secao = (titulo: string) => {
    checkPage(14)
    doc.setFillColor(...LIGHT)
    doc.rect(M, y, CW, 5.5, 'F')
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text(titulo, M + 2, y + 3.9)
    y += 8
  }

  const paragrafo = (txt: string, size = 8) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...DARK)
    const linhas = doc.splitTextToSize(txt, CW - 2)
    checkPage(linhas.length * 3.7 + 3)
    doc.text(linhas, M + 1, y)
    y += linhas.length * 3.7 + 3
  }

  // ── identificação ──────────────────────────────────────────────────────────
  const campos: [string, string][] = [
    ['NOME DO TRABALHADOR', d.colaboradorNome],
    ['MATRÍCULA', d.matricula || '—'],
    ['DATA DE ADMISSÃO', fmtDate(d.dataAdmissao)],
    ['CARGO', d.cargo || '—'],
    ['SETOR', d.setor || '—'],
    ['C.B.O.', d.cbo || '—'],
  ]
  const cw = CW / 3
  campos.forEach((c, i) => {
    const col = i % 3, lin = Math.floor(i / 3)
    const x = M + col * cw, yy = y + lin * 11
    doc.setDrawColor(...LIGHT); doc.setLineWidth(0.2)
    doc.rect(x, yy, cw, 11)
    doc.setFontSize(6); doc.setTextColor(...MID); doc.setFont('helvetica', 'bold')
    doc.text(c[0], x + 1.5, yy + 3.5)
    doc.setFontSize(8); doc.setTextColor(...DARK); doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(c[1], cw - 3)[0] ?? '—', x + 1.5, yy + 8)
  })
  y += 11 * 2 + 5

  secao('DESCRIÇÃO DA ATIVIDADE'); paragrafo(d.descricaoAtividade || '—')
  secao('OBJETIVO'); paragrafo(d.objetivo, 7.5)

  // ── diretrizes: uma por linha, com marcador ────────────────────────────────
  secao('DIRETRIZES DE SAÚDE E SEGURANÇA DO TRABALHO')
  doc.setFontSize(7.2); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
  d.obrigacoes.split('\n').map(x => x.trim()).filter(Boolean).forEach(item => {
    const linhas = doc.splitTextToSize(item, CW - 6)
    checkPage(linhas.length * 3.3 + 1.4)
    doc.text('•', M + 1, y + 2.2)
    doc.text(linhas, M + 4.5, y + 2.2)
    y += linhas.length * 3.3 + 1.4
  })
  y += 3

  // ── riscos: risco · fonte geradora · medidas administrativas ──────────────
  secao(`IDENTIFICAÇÃO DOS RISCOS AMBIENTAIS (${d.riscos.length})`)
  const cR = 45, cF = 50
  doc.setFontSize(6); doc.setTextColor(...MID); doc.setFont('helvetica', 'bold')
  checkPage(6)
  doc.text('RISCO', M + 1, y + 2.2)
  doc.text('FONTE GERADORA', M + cR + 1, y + 2.2)
  doc.text('MEDIDAS ADMINISTRATIVAS', M + cR + cF + 1, y + 2.2)
  y += 4
  doc.setFontSize(6.6)
  d.riscos.forEach((r, i) => {
    const lR = doc.splitTextToSize(r.perigo || '—', cR - 3)
    const lF = doc.splitTextToSize(r.fonte || '—', cF - 3)
    const lM = doc.splitTextToSize(r.medidas || '—', CW - cR - cF - 3)
    const alt = Math.max(lR.length, lF.length, lM.length) * 2.9 + 2
    checkPage(alt + 2)
    if (i > 0) { doc.setDrawColor(...LIGHT); doc.setLineWidth(0.12); doc.line(M, y - 1, W - M, y - 1) }
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.text(lR, M + 1, y + 2)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MID)
    doc.text(lF, M + cR + 1, y + 2)
    doc.text(lM, M + cR + cF + 1, y + 2)
    y += alt
  })
  y += 3

  // ── medidas preventivas: EPI | EPC, lado a lado como na OS original ───────
  secao('MEDIDAS PREVENTIVAS')
  const meia = CW / 2
  doc.setFontSize(6); doc.setTextColor(...MID); doc.setFont('helvetica', 'bold')
  checkPage(8)
  doc.text('EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPI)', M + 1, y + 2.2)
  doc.text('EQUIPAMENTOS DE PROTEÇÃO COLETIVA (EPC)', M + meia + 1, y + 2.2)
  y += 4.5
  const epcs = d.epcs ?? []
  const linhasMed = Math.max(d.epis.length, epcs.length, 1)
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
  for (let i = 0; i < linhasMed; i++) {
    checkPage(5)
    const e = d.epis[i]
    if (e) doc.text(doc.splitTextToSize(`•  ${e.nome}${e.ca ? `  (CA ${e.ca})` : ''}`, meia - 4)[0] ?? '', M + 1, y + 2.4)
    else if (i === 0 && !d.epis.length) { doc.setTextColor(...MID); doc.text('—', M + 1, y + 2.4); doc.setTextColor(...DARK) }
    const c = epcs[i]
    if (c) doc.text(doc.splitTextToSize(`•  ${c}`, meia - 4)[0] ?? '', M + meia + 1, y + 2.4)
    else if (i === 0 && !epcs.length) { doc.setTextColor(...MID); doc.text('—', M + meia + 1, y + 2.4); doc.setTextColor(...DARK) }
    y += 4.2
  }
  y += 3

  // ── treinamentos ──────────────────────────────────────────────────────────
  secao(`TREINAMENTOS EXIGIDOS (${d.treinamentos.length})`)
  doc.setFontSize(7); doc.setTextColor(...DARK); doc.setFont('helvetica', 'normal')
  if (!d.treinamentos.length) { paragrafo('Nenhum treinamento obrigatório definido para esta função.', 7) }
  else {
    d.treinamentos.forEach((t, i) => {
      const col = i % 2, lin = Math.floor(i / 2)
      if (col === 0) checkPage(5)
      const txt = `•  ${t.nome}${t.norma ? `  (${t.norma})` : ''}`
      doc.text(doc.splitTextToSize(txt, meia - 4)[0] ?? txt, M + 1 + col * meia, y + lin * 4.2)
    })
    y += Math.ceil(d.treinamentos.length / 2) * 4.2 + 3
  }

  // ── ciência: uma assinatura, a de quem recebe ─────────────────────────────
  secao('CIÊNCIA DO COLABORADOR')
  paragrafo(
    'Declaro que recebi, li e compreendi esta Ordem de Serviço; que fui informado sobre os riscos da minha ' +
    'função, as medidas de controle, os EPIs obrigatórios e os treinamentos exigidos; e que me comprometo a ' +
    'cumprir as determinações aqui descritas.', 7.2)

  // Centrada, e com o pe da folha livre para o carimbo da assinatura
  // eletronica (autenticidade, selo e QR) — senao os dois se sobrepoem.
  checkPage(30)
  const larg = Math.min(CW, 110)
  const lx = (W - larg) / 2
  const cx = W / 2
  doc.setDrawColor(...DARK); doc.setLineWidth(0.3)
  doc.line(lx, y + 16, lx + larg, y + 16)
  doc.setFontSize(8); doc.setTextColor(...DARK)
  doc.text(d.colaboradorNome, cx, y + 21, { align: 'center' })
  doc.setFontSize(7); doc.setTextColor(...MID)
  doc.text('Assinatura do colaborador (ciência)', cx, y + 25, { align: 'center' })
  if (d.emitidaPorNome) doc.text(`Emitida por: ${d.emitidaPorNome}`, cx, y + 31, { align: 'center' })
  return doc
}

async function montar(d: OsSegPdfData) {
  let empresa: EmpresaData = EMPRESA_FALLBACK
  try { empresa = await getEmpresa() } catch { /* fallback */ }
  const logo = await loadLogoBase64('/logo-teg-transicao-branca.png')
    ?? (empresa.logoUrl ? await loadLogoBase64(empresa.logoUrl) : null)
  return buildDoc(d, empresa, logo)
}

export async function gerarOsSegurancaPdf(d: OsSegPdfData): Promise<void> {
  const nome = `OS_Seguranca_${(d.codigo ?? 'nova').replace(/[^\w-]+/g, '_')}_${d.colaboradorNome.split(' ')[0]}.pdf`
  ;(await montar(d)).save(nome)
}

/** Devolve o arquivo em vez de baixar — usado no envio para assinatura. */
export async function gerarOsSegurancaBlob(d: OsSegPdfData): Promise<Blob> {
  return (await montar(d)).output('blob')
}
