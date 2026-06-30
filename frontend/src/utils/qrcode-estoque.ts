import QRCode from 'qrcode'

/** URL que o QR de um item de estoque codifica — abre a ficha /e/:codigo. */
export function urlFichaItem(codigo: string): string {
  return `${window.location.origin}/e/${encodeURIComponent(codigo)}`
}

/** Gera o QR como data URL (PNG) — usado tanto na tela quanto nas etiquetas PDF. */
export function qrDataUrl(value: string, size = 240): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 1,
    color: { dark: '#1e293b', light: '#ffffff' },
  })
}
