import jsPDF from 'jspdf'
import type { PatImobilizado } from '../types/estoque'

/**
 * Gera PDF de etiqueta patrimonial (80x50mm) com QR Code + dados resumidos.
 * Retorna um Blob pronto para download/visualizacao.
 */
export async function gerarEtiquetaPDF(ativo: PatImobilizado, qrDataUrl: string): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [80, 50],
  })

  const W = 80
  const H = 50

  // ── Borda ──────────────────────────────────────────────
  doc.setDrawColor(180)
  doc.setLineWidth(0.3)
  doc.roundedRect(1, 1, W - 2, H - 2, 2, 2)

  // ── QR Code (left side) ────────────────────────────────
  const qrSize = 30
  const qrX = 4
  const qrY = (H - qrSize) / 2
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

  // ── Textos (right side) ────────────────────────────────
  const textX = qrX + qrSize + 4
  const maxW = W - textX - 4
  let y = 10

  // Numero patrimonio
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59) // slate-800
  doc.text(ativo.numero_patrimonio, textX, y)
  y += 5

  // Descricao (truncada)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105) // slate-500
  const desc = ativo.descricao.length > 35
    ? ativo.descricao.substring(0, 35) + '...'
    : ativo.descricao
  const lines = doc.splitTextToSize(desc, maxW)
  doc.text(lines.slice(0, 2), textX, y)
  y += lines.slice(0, 2).length * 3.5 + 2

  // Categoria
  doc.setFontSize(6)
  doc.setTextColor(100, 116, 139) // slate-400
  doc.text(`Cat: ${ativo.categoria}`, textX, y)
  y += 4

  // Base
  if (ativo.base_nome) {
    doc.text(`Base: ${ativo.base_nome}`, textX, y)
    y += 4
  }

  // Valor
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(30, 41, 59)
  const valor = (ativo.valor_atual ?? ativo.valor_aquisicao ?? 0)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  doc.text(valor, textX, y)

  return doc.output('blob')
}
