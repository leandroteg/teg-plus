import { useTheme } from '../contexts/ThemeContext'
import type { LucideIcon } from 'lucide-react'

export interface EGPSubTab {
  key: string
  label: string
  icon?: LucideIcon
  count?: number
}

interface EGPSubTabsProps {
  tabs: EGPSubTab[]
  active: string
  onChange: (key: string) => void
  accent?: string
}

export default function EGPSubTabs({ tabs, active, onChange, accent = 'blue' }: EGPSubTabsProps) {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const accentBg = `bg-${accent}-500`
  const badgeBg  = `bg-${accent}-400`

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tabs.map((tab, i) => {
        const isActive = tab.key === active
        const Icon = tab.icon

        return (
          <div key={tab.key} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-slate-300 dark:text-slate-600 text-xs select-none px-0.5">
                {'\u2192'}
              </span>
            )}
            <button
              onClick={() => onChange(tab.key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                transition-all duration-150 whitespace-nowrap
                ${isActive
                  ? `${accentBg} text-white shadow-sm`
                  : dark
                    ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                }
              `}
            >
              {Icon && <Icon size={14} />}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`
                    ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px]
                    rounded-full text-[10px] font-bold leading-none px-1
                    ${isActive
                      ? `${badgeBg} text-white/90`
                      : dark
                        ? 'bg-white/10 text-slate-400'
                        : 'bg-slate-200 text-slate-500'
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
