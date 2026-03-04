import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type Theme } from '../contexts/ThemeContext'

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'original', icon: Monitor, label: 'Original' },
  { value: 'dark',     icon: Moon,    label: 'Dark' },
  { value: 'light',    icon: Sun,     label: 'Light' },
]

interface Props {
  /** Visual variant that adapts to sidebar context */
  variant?: 'dark' | 'light'
  compact?: boolean
}

export default function ThemeToggle({ variant = 'dark', compact = false }: Props) {
  const { theme, setTheme } = useTheme()
  const isLight = variant === 'light'

  return (
    <div
      className={[
        'flex items-center gap-0.5 p-0.5 rounded-lg border',
        isLight
          ? 'bg-slate-100 border-slate-200'
          : 'bg-white/5 border-white/[0.06]',
      ].join(' ')}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={[
              'flex items-center gap-1.5 rounded-md text-[10px] font-semibold transition-all duration-150',
              compact ? 'px-1.5 py-1.5' : 'px-2 py-1.5',
              active
                ? isLight
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'bg-white/10 text-white shadow-sm'
                : isLight
                  ? 'text-slate-400 hover:text-slate-600'
                  : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
            title={label}
          >
            <Icon size={12} />
            {!compact && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
