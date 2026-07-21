// ─────────────────────────────────────────────────────────────────────────────
// utils/tabela-pdf.ts — Relatório PDF genérico a partir de uma <table> do DOM.
// Lê os cabeçalhos (thead th) e as linhas visíveis (tbody tr td) — ou seja,
// respeita filtros/ordenação aplicados na tela — e desenha uma tabela paginada.
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf'

export function gerarTabelaPdf(opts: { titulo: string; subtitulo?: string; table: HTMLTableElement }) {
  const { titulo, subtitulo, table } = opts

  const headers = Array.from(table.querySelectorAll('thead th'))
    .map(th => (th.textContent || '').replace(/[↑↓]/g, '').trim())
  const rows = Array.from(table.querySelectorAll('tbody tr'))
    .map(tr => Array.from(tr.querySelectorAll('td')).map(td => (td.textContent || '').replace(/\s+/g, ' ').trim()))
    .filter(r => r.length > 0)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297, H = 210, M = 10
  const CW = W - 2 * M
  const DARK: [number, number, number] = [30, 41, 59]

  // ── Cabeçalho do documento ──
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 20, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text(titulo, M, 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 190, 200)
  if (subtitulo) doc.text(subtitulo, M, 15)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${rows.length} registro${rows.length !== 1 ? 's' : ''}`, W - M, 15, { align: 'right' })

  const n = headers.length || (rows[0]?.length ?? 1)
  // largura das colunas proporcional ao maior conteúdo, com mínimo
  const maxLen = Array.from({ length: n }, (_, i) =>
    Math.max((headers[i] || '').length, ...rows.map(r => (r[i] || '').length), 4))
  const totLen = maxLen.reduce((a, b) => a + b, 0) || 1
  let colW = maxLen.map(l => Math.max(14, (l / totLen) * CW))
  const sum = colW.reduce((a, b) => a + b, 0)
  colW = colW.map(w => (w / sum) * CW)
  const colX: number[] = []; let x = M
  for (let i = 0; i < n; i++) { colX.push(x); x += colW[i] }

  let y = 27
  const drawHead = () => {
    doc.setFillColor(241, 245, 249); doc.rect(M, y - 4, CW, 6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(71, 85, 105)
    headers.forEach((h, i) => doc.text(doc.splitTextToSize(h.toUpperCase(), colW[i] - 2)[0] ?? '', colX[i] + 1, y))
    y += 5
  }
  drawHead()

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  rows.forEach((r, idx) => {
    if (y > H - 10) {
      doc.addPage(); y = 15; drawHead()
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    }
    if (idx % 2) { doc.setFillColor(248, 250, 252); doc.rect(M, y - 3.6, CW, 5, 'F') }
    doc.setTextColor(30, 41, 59)
    for (let i = 0; i < n; i++) {
      const txt = doc.splitTextToSize(r[i] || '', colW[i] - 2)[0] ?? ''
      doc.text(txt, colX[i] + 1, y)
    }
    y += 5
  })

  // rodapé com numeração de páginas
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 160, 170)
    doc.text(`Página ${p}/${total}`, W - M, H - 4, { align: 'right' })
    doc.text('TEG+ · Locação de Imóveis', M, H - 4)
  }

  const nome = `${titulo.replace(/[^\w\-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nome)
}
