import { useEffect, useState } from 'react'
import { qrDataUrl } from '../utils/qrcode-estoque'

/** Renderiza um QR Code para qualquer valor (URL). Reaproveita a lib `qrcode`. */
export default function QRCodeView({ value, size = 160 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!value) return
    let alive = true
    qrDataUrl(value, size).then(d => { if (alive) setSrc(d) }).catch(() => { if (alive) setSrc(null) })
    return () => { alive = false }
  }, [value, size])

  if (!src) {
    return <div className="animate-pulse rounded-lg bg-slate-200/50" style={{ width: size, height: size }} />
  }
  return <img src={src} alt={`QR ${value}`} width={size} height={size} className="rounded-lg" />
}
