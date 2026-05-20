import { useState, useEffect } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateAvailable() {
  const { isDark } = useTheme()
  const [show, setShow] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return
      // Checa por updates ao registrar, a cada 5 min, e ao voltar para a aba
      r.update()
      setInterval(() => { r.update() }, 5 * 60 * 1000)
      const onVisible = () => { if (document.visibilityState === 'visible') r.update() }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', onVisible)
    },
    onRegSWUpdFound() {
      setShow(true)
    },
  })

  useEffect(() => {
    if (needRefresh) setShow(true)
  }, [needRefresh])

  if (!show) return null

  const handleUpdate = () => {
    updateServiceWorker(true)
  }

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border animate-fade-in-up ${
      isDark
        ? 'bg-slate-900/95 border-teal-500/25 text-white shadow-glow-sm'
        : 'bg-white border-slate-200 text-slate-800 shadow-xl'
    }`}>
      <RefreshCw size={16} className={`animate-spin ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
      <span className="text-sm font-medium">Nova versao disponivel</span>
      <button
        onClick={handleUpdate}
        className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 transition-colors"
      >
        Atualizar
      </button>
      <button onClick={() => setShow(false)} className="p-0.5 rounded hover:bg-white/10">
        <X size={14} className="text-slate-400" />
      </button>
    </div>
  )
}
