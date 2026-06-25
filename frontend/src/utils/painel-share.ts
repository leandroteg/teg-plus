import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

// ─────────────────────────────────────────────────────────────────────────────
//  Export / compartilhamento de painéis do hub /paineis.
//  Captura o nó DOM do painel → PNG (html-to-image) → PDF A4 (jsPDF).
//  Compartilhar segue o padrão da casa (vistoria-pdf / frotas-checklist-pdf):
//    • mobile / navegador compatível → navigator.share com o arquivo PDF
//    • desktop → baixa o PDF p/ anexar + abre WhatsApp (wa.me) ou e-mail (mailto)
// ─────────────────────────────────────────────────────────────────────────────

export interface PainelShareMeta {
  label: string  // ex.: "Financeiro"
  key: string    // ex.: "financeiro" — usado no deep-link /paineis/<key>
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function baixar(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// Captura o nó do painel como PNG em alta resolução, preenchendo o fundo.
async function capturarPng(node: HTMLElement, isDark: boolean): Promise<string> {
  return toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: isDark ? '#0c1222' : '#f8fafc',
    // permite excluir elementos marcados explicitamente do export
    filter: (el) => !(el instanceof HTMLElement && el.dataset?.noExport === 'true'),
  })
}

// Gera um PDF A4 com cabeçalho TEG+ e a imagem do painel ajustada à página.
export async function gerarPainelPdf(
  node: HTMLElement,
  meta: PainelShareMeta,
  isDark: boolean,
): Promise<{ blob: Blob; filename: string }> {
  const dataUrl = await capturarPng(node, isDark)
  const img = new Image()
  img.src = dataUrl
  await img.decode()

  const pxW = img.naturalWidth
  const pxH = img.naturalHeight
  const orientation = pxW > pxH ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 10
  const headerH = 14

  // Cabeçalho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 30)
  doc.text(`TEG+ · Painel ${meta.label}`, M, M + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 130)
  doc.text(new Date().toLocaleString('pt-BR'), M, M + 11)

  // Imagem do painel, ajustada à página mantendo proporção
  const availW = pageW - M * 2
  const availH = pageH - M * 2 - headerH
  const ratio = Math.min(availW / pxW, availH / pxH)
  const drawW = pxW * ratio
  const drawH = pxH * ratio
  const x = M + (availW - drawW) / 2
  const y = M + headerH
  doc.addImage(dataUrl, 'PNG', x, y, drawW, drawH)

  return { blob: doc.output('blob'), filename: `painel-${slug(meta.label)}-${stamp()}.pdf` }
}

export async function exportarPainel(node: HTMLElement, meta: PainelShareMeta, isDark: boolean): Promise<void> {
  const { blob, filename } = await gerarPainelPdf(node, meta, isDark)
  baixar(blob, filename)
}

export async function compartilharPainel(
  node: HTMLElement,
  meta: PainelShareMeta,
  isDark: boolean,
  via: 'email' | 'whatsapp',
): Promise<void> {
  const { blob, filename } = await gerarPainelPdf(node, meta, isDark)
  const file = new File([blob], filename, { type: 'application/pdf' })
  const link = `${location.origin}/paineis/${meta.key}`
  const assunto = `Painel ${meta.label} · TEG+`
  const texto = `${assunto}\n${link}`

  // Mobile / navegador compatível: compartilha o PDF de fato (WhatsApp, e-mail, etc.)
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: assunto, text: texto, files: [file] })
      return
    } catch (e) {
      // cancelado pelo usuário → não cai pro fallback
      if ((e as DOMException)?.name === 'AbortError') return
    }
  }

  // Desktop: baixa o PDF (p/ anexar) e abre o canal com a mensagem + link
  baixar(blob, filename)
  if (via === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  } else {
    const body = `${texto}\n\n(PDF do painel baixado automaticamente — anexe ao e-mail.)`
    window.open(`mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(body)}`)
  }
}
