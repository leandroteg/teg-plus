import jsPDF from 'jspdf'
import { qrDataUrl, urlFichaItem } from './qrcode-estoque'

export interface ItemEtiqueta {
  codigo: string
  descricao: string
  unidade?: string
  categoria?: string
}

/** Desenha 1 etiqueta (QR + textos) num retângulo (x,y,w,h) de um doc jsPDF. */
function desenharEtiqueta(doc: jsPDF, it: ItemEtiqueta, qr: string, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(190)
  doc.setLineWidth(0.3)
  doc.roundedRect(x + 1, y + 1, w - 2, h - 2, 1.5, 1.5)

  const qrSize = Math.min(h - 8, 30)
  const qrX = x + 4
  const qrY = y + (h - qrSize) / 2
  doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize)

  const textX = qrX + qrSize + 4
  const maxW = x + w - textX - 4
  let ty = y + 9

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text(doc.splitTextToSize(it.codigo, maxW).slice(0, 1), textX, ty)
  ty += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(51, 65, 85)
  const descLines = doc.splitTextToSize(it.descricao ?? '', maxW).slice(0, 3)
  doc.text(descLines, textX, ty)
  ty += descLines.length * 3.6 + 2

  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  const meta = [it.unidade ? `Un: ${it.unidade}` : '', it.categoria ? it.categoria : ''].filter(Boolean).join('  •  ')
  if (meta) doc.text(doc.splitTextToSize(meta, maxW).slice(0, 1), textX, ty)
}

/** Etiqueta individual 80x50mm (mesmo formato da etiqueta patrimonial). */
export function gerarEtiquetaItemPDF(item: ItemEtiqueta, qr: string): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [80, 50] })
  desenharEtiqueta(doc, item, qr, 0, 0, 80, 50)
  return doc.output('blob')
}

/** Lote: A4 retrato com grade de etiquetas (2 col x 5 lin = 10/página). Gera o QR de cada item. */
export async function gerarEtiquetasItensLotePDF(itens: ItemEtiqueta[]): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 8
  const cols = 2, rows = 5
  const cellW = (210 - margin * 2) / cols   // 97mm
  const cellH = (297 - margin * 2) / rows   // ~56mm
  const perPage = cols * rows

  for (let i = 0; i < itens.length; i++) {
    if (i > 0 && i % perPage === 0) doc.addPage()
    const slot = i % perPage
    const col = slot % cols
    const row = Math.floor(slot / cols)
    const x = margin + col * cellW
    const y = margin + row * cellH
    const qr = await qrDataUrl(urlFichaItem(itens[i].codigo), 240)
    desenharEtiqueta(doc, itens[i], qr, x, y, cellW, cellH)
  }
  return doc.output('blob')
}
