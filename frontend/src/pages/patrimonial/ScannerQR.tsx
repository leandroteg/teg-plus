import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanLine, Camera, X, Search, AlertCircle } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function ScannerQR() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const nav = useNavigate()

  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [manualInput, setManualInput] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerRef = useRef<any>(null)

  // Start camera and scan
  const startScanner = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)

      // Use BarcodeDetector if available (Chrome Android 83+)
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const scan = async () => {
          if (!videoRef.current || !streamRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const url = barcodes[0].rawValue
              handleQRResult(url)
              return
            }
          } catch {}
          scannerRef.current = requestAnimationFrame(scan)
        }
        scannerRef.current = requestAnimationFrame(scan)
      } else {
        // Fallback: no native BarcodeDetector — show manual input
        setError('Câmera ativa, mas seu navegador não suporta leitura de QR nativa. Use o campo abaixo para digitar o número.')
      }
    } catch (err: any) {
      setError('Não foi possível acessar a câmera. Verifique as permissões.')
      setScanning(false)
    }
  }, [])

  const stopScanner = useCallback(() => {
    if (scannerRef.current) cancelAnimationFrame(scannerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => stopScanner(), [stopScanner])

  const handleQRResult = (raw: string) => {
    stopScanner()
    // Extract numero from URL: .../p/PAT-0001 or just PAT-0001
    const match = raw.match(/\/p\/([A-Za-z0-9\-]+)/) || raw.match(/(PAT-\d+)/)
    if (match) {
      nav(`/p/${match[1]}`)
    } else {
      setError(`QR não reconhecido: ${raw}`)
    }
  }

  const handleManualSearch = () => {
    const v = manualInput.trim().toUpperCase()
    if (v) nav(`/p/${v}`)
  }

  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className={`text-lg font-extrabold flex items-center gap-2 ${txt}`}>
          <ScanLine size={20} className="text-amber-500" /> Consultar QR Code
        </h1>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>Aponte a câmera para o QR Code do patrimônio</p>
      </div>

      {/* Scanner area */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        {!scanning ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
              <Camera size={36} className="text-amber-500" />
            </div>
            <p className={`text-sm font-semibold mb-1 ${txt}`}>Escanear QR Code</p>
            <p className={`text-xs text-center max-w-xs mb-6 ${txtMuted}`}>
              Aponte a câmera do dispositivo para o QR Code colado no patrimônio
            </p>
            <button onClick={startScanner}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-all active:scale-95">
              <Camera size={16} /> Abrir Câmera
            </button>
          </div>
        ) : (
          <div className="relative">
            <video ref={videoRef} className="w-full aspect-video object-cover" playsInline muted />
            {/* Overlay com guia */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-amber-400 rounded-2xl" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />
            </div>
            <div className="absolute top-3 right-3">
              <button onClick={stopScanner} className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                <X size={16} />
              </button>
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="bg-black/50 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                Posicione o QR Code no centro
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${isDark ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Manual input fallback */}
      <div className={`rounded-2xl border p-4 ${cardBg}`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Ou digite o número do patrimônio</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
              placeholder="PAT-0001"
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                isDark ? 'bg-white/[0.04] border-white/[0.06] text-white' : 'border-slate-200 bg-white'
              }`}
            />
          </div>
          <button onClick={handleManualSearch} disabled={!manualInput.trim()}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-all disabled:opacity-40 active:scale-95">
            Consultar
          </button>
        </div>
      </div>
    </div>
  )
}
