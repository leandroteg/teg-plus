import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRCodeAtivoProps {
  numero: string
  size?: number
}

export default function QRCodeAtivo({ numero, size = 120 }: QRCodeAtivoProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!numero) return
    const url = `${window.location.origin}/p/${numero}`
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: { dark: '#1e293b', light: '#ffffff' },
    }).then(setSrc).catch(() => setSrc(null))
  }, [numero, size])

  if (!src) {
    return (
      <div
        className="animate-pulse rounded-lg bg-slate-200/50"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <img
      src={src}
      alt={`QR Code ${numero}`}
      width={size}
      height={size}
      className="rounded-lg"
    />
  )
}
