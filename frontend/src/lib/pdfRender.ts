// ─────────────────────────────────────────────────────────────────────────────
// lib/pdfRender.ts — Renderiza páginas de um PDF em <canvas> via pdf.js (client-side)
// ─────────────────────────────────────────────────────────────────────────────
import * as pdfjsLib from 'pdfjs-dist'
// Worker resolvido pelo Vite (ESM). O `?url` entrega o caminho final do bundle.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/** Renderiza todas as páginas do PDF em canvases (escala = qualidade). */
export async function renderPdfPages(data: ArrayBuffer, scale = 2): Promise<HTMLCanvasElement[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const canvases: HTMLCanvasElement[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    canvases.push(canvas)
  }
  return canvases
}

/** Recorta uma região (em px do canvas) e devolve um PNG Blob. */
export function cropCanvasToBlob(
  src: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
): Promise<Blob> {
  const out = document.createElement('canvas')
  out.width = Math.round(w)
  out.height = Math.round(h)
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, x, y, w, h, 0, 0, w, h)
  return new Promise((resolve) => out.toBlob(b => resolve(b!), 'image/png'))
}
