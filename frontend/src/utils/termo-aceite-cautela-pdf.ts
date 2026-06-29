// ─────────────────────────────────────────────────────────────────────────────
// termo-aceite-cautela-pdf.ts — Termo de Responsabilidade e Aceite de Retirada
// de Material (Cautela). Mesmo padrão visual do Laudo de Vistoria e Pedido de
// Compra: header corporativo (logo + CNPJ TEG), dados do colaborador/obra,
// tabela de itens, cláusula de responsabilidade e assinatura (preenchida no
// tablet pelo colaborador). Multi-page com quebras automáticas.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import type { Cautela } from '../types/cautela'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TermoAceiteData {
  cautela: Cautela
  /** Nome da base/almoxarifado (não persistido no registro da cautela) */
  baseNome?: string
  /** Assinatura do colaborador na RETIRADA (data URL PNG) */
  assinaturaDataUrl?: string
  /** Assinatura de quem DEVOLVEU o material (colaborador) na devolução (data URL PNG) */
  assinaturaDevolucaoColaboradorDataUrl?: string
  /** Assinatura de quem RECEBEU a entrega final na devolução (data URL PNG) */
  assinaturaDevolucaoRecebedorDataUrl?: string
}

// ── Logo Loader ─────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('pt-BR')
  } catch {
    return d
  }
}

function fmtDateFull(d?: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch {
    return d
  }
}

const TERMO_CLAUSULA =
  'Declaro ter recebido os materiais e/ou equipamentos relacionados neste termo, ' +
  'em perfeitas condições de uso, comprometendo-me a zelar pela sua guarda e ' +
  'conservação e a devolvê-los nas mesmas condições até a data de devolução ' +
  'prevista. Responsabilizo-me por eventuais danos, extravios ou perdas ' +
  'decorrentes de uso indevido, negligência ou imprudência, autorizando o ' +
  'desconto do valor correspondente, nos termos da legislação vigente e da ' +
  'política interna da empresa.'

// ── Build PDF ───────────────────────────────────────────────────────────────

function buildTermoDoc(
  data: TermoAceiteData,
  empresa: EmpresaData,
  logo: string | null,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15
  const CW = W - 2 * M
  let y = M

  // Colors (same as Vistoria / Pedido de Compra)
  const TEAL = [13, 148, 136] as const
  const DARK = [30, 41, 59] as const
  const MID  = [100, 116, 139] as const
  const LIGHT = [226, 232, 240] as const

  const { cautela } = data
  const itens = cautela.itens ?? []

  // ── Utility: page break check ──────────────────────────────────────────────
  const checkPage = (needed = 10) => {
    if (y + needed > 275) {
      doc.addPage()
      y = M
    }
  }

  // ── Section title ──────────────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    checkPage(15)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEAL)
    doc.text(title, M, y)
    y += 1
    doc.setDrawColor(...TEAL)
    doc.setLineWidth(0.5)
    doc.line(M, y, W - M, y)
    y += 5
  }

  // ── Two-column field pair ──────────────────────────────────────────────────
  const addFieldPair = (l1: string, v1: string, l2: string, v2: string) => {
    const halfW = CW / 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text(l1, M, y)
    doc.text(l2, M + halfW, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(v1 || '—', M, y)
    doc.text(v2 || '—', M + halfW, y)
    y += 6
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER BAR
  // ══════════════════════════════════════════════════════════════════════════

  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 34, 'F')

  if (logo) {
    try { doc.addImage(logo, 'PNG', M, 3, 18, 28) } catch { /* ignore */ }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(empresa.fantasia, M + 22, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M + 22, 16)
  if (empresa.endereco) {
    doc.text(`${empresa.endereco}${empresa.cidade ? ` - ${empresa.cidade}/${empresa.uf ?? ''}` : ''}`, M + 22, 21)
  }
  if (empresa.telefone) {
    doc.text(`${empresa.telefone}${empresa.email ? ` | ${empresa.email}` : ''}`, M + 22, 26)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text('TERMO DE RESPONSABILIDADE', W - M, 12, { align: 'right' })
  doc.setFontSize(8)
  doc.setTextColor(180, 190, 200)
  doc.text('Aceite de Retirada de Material', W - M, 17, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Cautela ${cautela.numero || '—'}`, W - M, 23, { align: 'right' })
  doc.setFontSize(7)
  doc.text(`#${cautela.id.slice(0, 8).toUpperCase()}`, W - M, 28, { align: 'right' })
  y = 42

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: DADOS DA RETIRADA
  // ══════════════════════════════════════════════════════════════════════════

  sectionTitle('DADOS DA RETIRADA')

  addFieldPair(
    'Colaborador', cautela.solicitante_nome || '—',
    'Obra / Centro de Custo', cautela.obra_nome || cautela.centro_custo || '—',
  )
  addFieldPair(
    'Base / Almoxarifado', data.baseNome || '—',
    'Data de Retirada', fmtDate(cautela.data_retirada || cautela.criado_em),
  )
  addFieldPair(
    'Devolução Prevista', fmtDate(cautela.data_devolucao_prevista),
    'Urgência', (cautela.urgencia || 'normal').toUpperCase(),
  )

  y += 2

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: ITENS RETIRADOS
  // ══════════════════════════════════════════════════════════════════════════

  sectionTitle('ITENS RETIRADOS')

  // Table header
  const cols = {
    cod:  M + 2,
    desc: M + 28,
    un:   M + CW - 38,
    qtd:  M + CW - 12,
  }
  doc.setFillColor(241, 245, 249)
  doc.rect(M, y - 4, CW, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text('CÓDIGO', cols.cod, y)
  doc.text('DESCRIÇÃO', cols.desc, y)
  doc.text('UN', cols.un, y)
  doc.text('QTD', cols.qtd, y, { align: 'right' })
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  if (itens.length === 0) {
    doc.setTextColor(...MID)
    doc.text('Nenhum item registrado.', cols.cod, y)
    y += 6
  } else {
    for (const it of itens) {
      checkPage(8)
      const codigo = it.item?.codigo || '—'
      const descricao = it.item?.descricao || it.descricao_livre || '—'
      const unidade = it.item?.unidade || 'UN'

      doc.setTextColor(...TEAL)
      doc.setFont('helvetica', 'normal')
      doc.text(String(codigo).slice(0, 14), cols.cod, y)

      doc.setTextColor(...DARK)
      const descMax = cols.un - cols.desc - 2
      const descLines = doc.splitTextToSize(String(descricao), descMax)
      doc.text(descLines[0], cols.desc, y)

      doc.setTextColor(...MID)
      doc.text(String(unidade).slice(0, 5), cols.un, y)

      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.text(String(it.quantidade ?? 0), cols.qtd, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')

      y += 5
      doc.setDrawColor(241, 245, 249)
      doc.setLineWidth(0.2)
      doc.line(M, y - 2, W - M, y - 2)
    }
  }

  if (cautela.observacao) {
    y += 2
    checkPage(16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text('Observação', M, y)
    y += 4
    doc.setTextColor(...DARK)
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(cautela.observacao, CW)
    doc.text(lines.slice(0, 4), M, y)
    y += Math.min(lines.length, 4) * 4.5
  }

  y += 4

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: TERMO DE RESPONSABILIDADE
  // ══════════════════════════════════════════════════════════════════════════

  checkPage(40)
  sectionTitle('TERMO DE RESPONSABILIDADE')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  const clausulaLines = doc.splitTextToSize(TERMO_CLAUSULA, CW)
  doc.text(clausulaLines, M, y)
  y += clausulaLines.length * 4.8 + 6

  // ══════════════════════════════════════════════════════════════════════════
  // ASSINATURAS
  // ══════════════════════════════════════════════════════════════════════════

  checkPage(36)
  y = Math.max(y + 4, 244)

  // Assinatura do colaborador (embute a imagem capturada no tablet, se houver)
  if (data.assinaturaDataUrl) {
    try {
      doc.addImage(data.assinaturaDataUrl, 'PNG', M, y - 18, 70, 18)
    } catch { /* ignore */ }
  }

  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.3)

  // Left: colaborador
  doc.line(M, y, M + 75, y)
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text('Assinatura do Colaborador', M + 37.5, y + 4, { align: 'center' })
  if (cautela.solicitante_nome) {
    doc.setFontSize(6)
    doc.text(cautela.solicitante_nome, M + 37.5, y + 8, { align: 'center' })
  }

  // Right: responsável almoxarifado
  doc.line(W - M - 75, y, W - M, y)
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text('Responsável pelo Almoxarifado', W - M - 37.5, y + 4, { align: 'center' })
  doc.setFontSize(6)
  doc.text(empresa.fantasia, W - M - 37.5, y + 8, { align: 'center' })

  // Local e data
  y += 14
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text(
    `${empresa.cidade || ''}${empresa.cidade ? ', ' : ''}${fmtDateFull(cautela.data_retirada || cautela.criado_em)}`,
    M, y,
  )

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: DEVOLUÇÃO (só quando o material já foi devolvido)
  // ══════════════════════════════════════════════════════════════════════════

  const temDevolucao = !!(
    cautela.data_devolucao_real ||
    data.assinaturaDevolucaoColaboradorDataUrl ||
    data.assinaturaDevolucaoRecebedorDataUrl
  )
  if (temDevolucao) {
    checkPage(58)
    y += 6
    sectionTitle('DEVOLUÇÃO')
    addFieldPair(
      'Data da Devolução', fmtDate(cautela.data_devolucao_real),
      'Recebido por', cautela.recebedor_nome || '—',
    )
    y += 16

    // Assinatura de quem devolveu (colaborador) — esquerda
    if (data.assinaturaDevolucaoColaboradorDataUrl) {
      try { doc.addImage(data.assinaturaDevolucaoColaboradorDataUrl, 'PNG', M, y - 18, 70, 18) } catch { /* ignore */ }
    }
    // Assinatura de quem recebeu (recebedor) — direita
    if (data.assinaturaDevolucaoRecebedorDataUrl) {
      try { doc.addImage(data.assinaturaDevolucaoRecebedorDataUrl, 'PNG', W - M - 75, y - 18, 70, 18) } catch { /* ignore */ }
    }

    doc.setDrawColor(...LIGHT)
    doc.setLineWidth(0.3)

    // Left: quem devolveu
    doc.line(M, y, M + 75, y)
    doc.setFontSize(7)
    doc.setTextColor(...MID)
    doc.text('Assinatura de quem devolveu', M + 37.5, y + 4, { align: 'center' })
    if (cautela.solicitante_nome) {
      doc.setFontSize(6)
      doc.text(cautela.solicitante_nome, M + 37.5, y + 8, { align: 'center' })
    }

    // Right: quem recebeu a entrega final
    doc.line(W - M - 75, y, W - M, y)
    doc.setFontSize(7)
    doc.setTextColor(...MID)
    doc.text('Assinatura de quem recebeu', W - M - 37.5, y + 4, { align: 'center' })
    if (cautela.recebedor_nome) {
      doc.setFontSize(6)
      doc.text(cautela.recebedor_nome, W - M - 37.5, y + 8, { align: 'center' })
    }

    // Local e data da devolução
    y += 14
    doc.setFontSize(7)
    doc.setTextColor(...MID)
    doc.text(
      `${empresa.cidade || ''}${empresa.cidade ? ', ' : ''}${fmtDateFull(cautela.data_devolucao_real)}`,
      M, y,
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════════════════

  const now = new Date().toLocaleString('pt-BR')
  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(
    `TEG+ ERP · ${empresa.fantasia} · CNPJ ${empresa.cnpj} · Termo gerado em ${now}`,
    W / 2, 290, { align: 'center' },
  )

  return doc
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getTermoPdfFileName(data: TermoAceiteData): string {
  const num = (data.cautela.numero || data.cautela.id.slice(0, 8)).replace(/[^\w-]/g, '')
  const date = (data.cautela.data_retirada || data.cautela.criado_em || '').slice(0, 10)
  return `termo-aceite-${num}-${date}.pdf`
}

export async function gerarTermoPdfBlob(data: TermoAceiteData): Promise<Blob> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const logo = await loadLogoBase64(empresa.logoUrl)
  const doc = buildTermoDoc(data, empresa, logo)
  return doc.output('blob')
}

/** Gera e abre o termo em nova aba (ideal para imprimir/assinar) */
export async function abrirTermoPdf(data: TermoAceiteData): Promise<void> {
  const blob = await gerarTermoPdfBlob(data)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

/** Gera e dispara o download do termo */
export async function downloadTermoPdf(data: TermoAceiteData): Promise<void> {
  const blob = await gerarTermoPdfBlob(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = getTermoPdfFileName(data)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
