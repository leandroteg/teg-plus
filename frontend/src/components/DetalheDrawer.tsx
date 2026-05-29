import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
}

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
}

export default function DetalheDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'md',
}: Props) {
  const { isDark } = useTheme()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9000] flex" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div
        className={`w-full ${WIDTHS[width]} h-full overflow-y-auto shadow-2xl flex flex-col ${
          isDark ? 'bg-slate-900 border-l border-white/10' : 'bg-white border-l border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`sticky top-0 z-10 px-5 py-4 border-b ${
            isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'} truncate`}>
                {title}
              </h2>
              {subtitle && (
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition ${
                isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">{children}</div>
      </div>
    </div>
  )
}
