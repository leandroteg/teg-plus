import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Share2 } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { useTheme } from '../contexts/ThemeContext'
import { haptic } from '../utils/haptics'

export default function PWAInstallPrompt() {
  const { canInstall, isInstalled, promptInstall, dismiss, dismissCount, isIOS } = usePWAInstall()
  const { isDark } = useTheme()
  const [visible, setVisible] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [closing, setClosing] = useState(false)

  // Show after 2 seconds on page, if not dismissed too many times
  useEffect(() => {
    if (isInstalled) return
    if (!canInstall && !isIOS) return
    if (dismissCount >= 5) return

    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [canInstall, isInstalled, isIOS, dismissCount])

  if (!visible || isInstalled) return null

  const handleInstall = async () => {
    haptic('medium')
    if (isIOS) {
      setShowIOSGuide(true)
      return
    }
    await promptInstall()
    handleClose()
  }

  const handleClose = () => {
    setClosing(true)
    dismiss()
    setTimeout(() => {
      setVisible(false)
      setClosing(false)
    }, 300)
  }

  // ── Compact pill (after 2+ dismissals) ────────────────────────────
  if (dismissCount >= 2) {
    return (
      <button
        onClick={handleInstall}
        className={`fixed bottom-24 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-300 ${
          closing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0 animate-fade-in-up'
        } ${
          isDark
            ? 'bg-teal-500/20 border border-teal-400/30 text-teal-300 hover:bg-teal-500/30 shadow-glow-sm'
            : 'bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 shadow-lg'
        }`}
      >
        <Download size={16} className="animate-pulse" />
        <span className="text-sm font-semibold">Abrir App</span>
      </button>
    )
  }

  // ── iOS Guide Modal ───────────────────────────────────────────────
  if (showIOSGuide) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className={`w-full max-w-sm rounded-3xl p-6 space-y-5 animate-scale-in ${
          isDark ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200 shadow-2xl'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Instalar TEG+
            </h3>
            <button onClick={() => { setShowIOSGuide(false); handleClose() }} className="p-1 rounded-lg hover:bg-slate-100/10">
              <X size={18} className="text-slate-400" />
            </button>
          </div>

          <div className="space-y-4">
            <Step n={1} isDark={isDark}>
              Toque no botao <Share2 size={14} className="inline text-blue-500 -mt-0.5" /> <strong>Compartilhar</strong> na barra do Safari
            </Step>
            <Step n={2} isDark={isDark}>
              Role para baixo e toque em <strong>"Adicionar a Tela de Inicio"</strong>
            </Step>
            <Step n={3} isDark={isDark}>
              Toque em <strong>"Adicionar"</strong> no canto superior direito
            </Step>
          </div>

          <div className={`text-[11px] text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            O TEG+ vai abrir como um app nativo no seu iPhone
          </div>
        </div>
      </div>
    )
  }

  // ── Full banner (first sessions) ──────────────────────────────────
  return (
    <div className={`fixed bottom-24 right-4 z-[60] w-[300px] transition-all duration-300 ${
      closing ? 'opacity-0 translate-y-8 scale-95' : 'opacity-100 translate-y-0 scale-100 animate-fade-in-up'
    }`}>
      <div className={`rounded-2xl p-5 shadow-2xl border backdrop-blur-xl ${
        isDark
          ? 'bg-slate-900/95 border-teal-500/20 shadow-glow-sm'
          : 'bg-white/95 border-slate-200 shadow-xl'
      }`}>
        {/* Close */}
        <button
          onClick={handleClose}
          className={`absolute top-3 right-3 p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'
          }`}
        >
          <X size={14} />
        </button>

        {/* Icon */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
          isDark
            ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-400/20'
            : 'bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200'
        }`}>
          <Smartphone size={22} className={isDark ? 'text-teal-400' : 'text-teal-600'} />
        </div>

        {/* Text */}
        <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Abrir como App
        </h3>
        <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Instale o TEG+ para acesso rapido, tela cheia e notificacoes. Sem ocupar espaco.
        </p>

        {/* Install button */}
        <button
          onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all
            bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500
            shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 active:scale-[0.98]"
        >
          <Download size={16} />
          Instalar TEG+
        </button>
      </div>
    </div>
  )
}

function Step({ n, isDark, children }: { n: number; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
        isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
      }`}>
        {n}
      </div>
      <p className={`text-sm pt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {children}
      </p>
    </div>
  )
}
