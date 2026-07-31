// ─────────────────────────────────────────────────────────────────────────────
// ficha-epi-pdf.ts — Ficha de Controle e Entrega de EPI (NR-06)
// Mesmo padrão visual do Termo de Cautela: header corporativo TEG, dados do
// colaborador/obra, tabela de EPIs com CA, termo de responsabilidade NR-06 e
// campo de assinatura do colaborador (assinada no Portal TEG).
// Fluxo: gerar → colher assinatura → digitalizar → arquivar na ficha.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'

export interface FichaEpiPdfItem {
  nome: string
  ca?: string
  quantidade: number
  tamanho?: string
  trocaPrevista?: string
}

export interface FichaEpiPdfData {
  codigo?: string
  colaboradorNome: string
  baseNome?: string
  dataEntrega?: string
  motivo?: string
  observacoes?: string
  entreguePorNome?: string
  itens: FichaEpiPdfItem[]
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
  } catch {
    return null
  }
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try { return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return d }
}

// NR-06 item 6.6.1 + CLT art. 158: texto padrão de mercado da ficha de EPI
const TERMO_NR06 =
  'Declaro, para os devidos fins, que recebi GRATUITAMENTE os Equipamentos de Proteção ' +
  'Individual (EPI) relacionados nesta ficha, todos com Certificado de Aprovação (CA), em ' +
  'perfeito estado de conservação e funcionamento, bem como recebi orientação e treinamento ' +
  'quanto ao uso correto, guarda e conservação. Comprometo-me a: usá-los apenas para a ' +
  'finalidade a que se destinam durante a jornada de trabalho; responsabilizar-me pela guarda e ' +
  'conservação; comunicar ao empregador qualquer alteração que os torne impróprios para uso; ' +
  'e responsabilizar-me pela danificação ou extravio decorrente de uso inadequado. Estou ciente ' +
  'de que o uso do EPI é OBRIGATÓRIO (NR-06 e art. 158 da CLT) e que a recusa injustificada ao ' +
  'uso constitui ato faltoso, sujeito às penalidades legais, incluindo a rescisão por justa causa.'

function buildDoc(data: FichaEpiPdfData, empresa: EmpresaData, logo: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15
  const CW = W - 2 * M
  let y = M

  const RED  = [220, 38, 38] as const
  const DARK = [30, 41, 59] as const
  const MID  = [100, 116, 139] as const

  const checkPage = (needed = 10) => {
    if (y + needed > 275) { doc.addPage(); y = M }
  }

  const sectionTitle = (title: string) => {
    checkPage(15)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...RED)
    doc.text(title, M, y)
    y += 1
    doc.setDrawColor(...RED)
    doc.setLineWidth(0.5)
    doc.line(M, y, W - M, y)
    y += 5
  }

  const addFieldPair = (l1: string, v1: string, l2: string, v2: string) => {
    const halfW = CW / 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text(l1, M, y)
    doc.text(l2, M + halfW, y)
    y += 4
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(v1 || '—', M, y)
    doc.text(v2 || '—', M + halfW, y)
    y += 6
  }

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 34, 'F')
  // Logo institucional (larga ~3.84:1) — proporcional, alinhada à esquerda
  if (logo) {
    try { doc.addImage(logo, 'PNG', M, 7, 46, 12) } catch { /* ignore */ }
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M, 24)
  if (empresa.endereco) {
    doc.text(`${empresa.endereco}${empresa.cidade ? ` - ${empresa.cidade}/${empresa.uf ?? ''}` : ''}`, M, 28)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text('FICHA DE ENTREGA DE EPI', W - M, 12, { align: 'right' })
  doc.setFontSize(8)
  doc.setTextColor(180, 190, 200)
  doc.text('Controle de Equipamento de Proteção Individual — NR-06', W - M, 17, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text(data.codigo ?? '', W - M, 23, { align: 'right' })
  y = 42

  // ── Dados da entrega ────────────────────────────────────────────────────────
  sectionTitle('DADOS DA ENTREGA')
  addFieldPair('Colaborador', data.colaboradorNome, 'Base', data.baseNome ?? '—')
  addFieldPair('Data da Entrega', fmtDate(data.dataEntrega), 'Motivo', (data.motivo ?? 'entrega').toUpperCase())
  if (data.observacoes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text('Observações', M, y)
    y += 4
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    const obsLines = doc.splitTextToSize(data.observacoes, CW)
    doc.text(obsLines, M, y)
    y += obsLines.length * 4 + 2
  }
  y += 2

  // ── Itens ───────────────────────────────────────────────────────────────────
  sectionTitle('EQUIPAMENTOS ENTREGUES')
  const cols = {
    nome: M + 2,
    ca:   M + CW - 72,
    qtd:  M + CW - 48,
    tam:  M + CW - 34,
    troca: M + CW - 2,
  }
  doc.setFillColor(241, 245, 249)
  doc.rect(M, y - 4, CW, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text('EQUIPAMENTO', cols.nome, y)
  doc.text('CA', cols.ca, y)
  doc.text('QTD', cols.qtd, y)
  doc.text('TAM.', cols.tam, y)
  doc.text('TROCA PREV.', cols.troca, y, { align: 'right' })
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  for (const it of data.itens) {
    checkPage(8)
    doc.setTextColor(...DARK)
    const nomeLines = doc.splitTextToSize(it.nome, cols.ca - cols.nome - 4)
    doc.text(nomeLines, cols.nome, y)
    doc.text(it.ca ?? '—', cols.ca, y)
    doc.text(String(it.quantidade), cols.qtd, y)
    doc.text(it.tamanho ?? '—', cols.tam, y)
    doc.text(it.trocaPrevista ? fmtDate(it.trocaPrevista) : '—', cols.troca, y, { align: 'right' })
    y += Math.max(nomeLines.length * 4, 5) + 1
    doc.setDrawColor(230, 235, 240)
    doc.setLineWidth(0.2)
    doc.line(M, y - 2.5, W - M, y - 2.5)
  }
  y += 4

  // ── Termo NR-06 ─────────────────────────────────────────────────────────────
  sectionTitle('TERMO DE RESPONSABILIDADE (NR-06)')
  checkPage(40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  const termoLines = doc.splitTextToSize(TERMO_NR06, CW)
  doc.text(termoLines, M, y)
  y += termoLines.length * 3.6 + 10

  // ── Assinatura ──────────────────────────────────────────────────────────────
  // Uma so: quem RECEBE o EPI. Ela e colhida eletronicamente no Portal TEG.
  // Quem entregou ja consta como dado da ficha — nao precisa de rubrica.
  checkPage(45)
  const larg = Math.min(CW, 110)
  const cx = M + larg / 2
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.3)
  doc.line(M, y + 18, M + larg, y + 18)
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  doc.text(data.colaboradorNome, cx, y + 23, { align: 'center' })
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text('Assinatura do colaborador (recebimento)', cx, y + 27, { align: 'center' })
  if (data.entreguePorNome) {
    doc.text(`Entregue por: ${data.entreguePorNome}`, M, y + 33)
  }
  y += 38

  // rodapé
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text(`Documento gerado pelo TEG+ QSMA em ${new Date().toLocaleString('pt-BR')}`, M, 288)

  return doc
}

/** Monta o PDF e devolve o arquivo, em vez de baixar — usado no envio para
 *  assinatura, que precisa subir o documento no storage. */
export async function gerarFichaEpiBlob(data: FichaEpiPdfData): Promise<Blob> {
  let empresa: EmpresaData = EMPRESA_FALLBACK
  try { empresa = await getEmpresa() } catch { /* fallback */ }
  const logo = await loadLogoBase64('/logo-teg-transicao-branca.png') ?? (empresa.logoUrl ? await loadLogoBase64(empresa.logoUrl) : null)
  return buildDoc(data, empresa, logo).output('blob')
}

export async function gerarFichaEpiPdf(data: FichaEpiPdfData): Promise<void> {
  let empresa: EmpresaData = EMPRESA_FALLBACK
  try { empresa = await getEmpresa() } catch { /* fallback */ }
  // Logo institucional (transição) versão BRANCA — cabeçalho escuro da ficha de EPI
  const logo = await loadLogoBase64('/logo-teg-transicao-branca.png') ?? (empresa.logoUrl ? await loadLogoBase64(empresa.logoUrl) : null)
  const doc = buildDoc(data, empresa, logo)
  const nome = `Ficha_EPI_${(data.codigo ?? 'nova').replace(/[^\w\-]+/g, '_')}_${data.colaboradorNome.split(' ')[0]}.pdf`
  doc.save(nome)
}
