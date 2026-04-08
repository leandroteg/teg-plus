import { useState } from 'react'
import { CalendarDays, ClipboardList, Wrench, History } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import Planejamento        from './Planejamento'
import ChecklistsManutencao from './ChecklistsManutencao'
import OSAbertas            from './OSAbertas'
import HistoricoOS          from './HistoricoOS'

type TabId = 'planejamento' | 'checklists' | 'os' | 'historico'

interface Tab {
  id: TabId
  label: string
  icon: React.ElementType
  component: React.ComponentType
}

const TABS: Tab[] = [
  { id: 'planejamento', label: 'Planejamento', icon: CalendarDays,  component: Planejamento         },
  { id: 'checklists',   label: 'Checklists',   icon: ClipboardList, component: ChecklistsManutencao },
  { id: 'os',           label: 'OS Abertas',   icon: Wrench,        component: OSAbertas            },
  { id: 'historico',    label: 'Histórico',    icon: History,       component: HistoricoOS          },
]

export default function ManutencaoHub() {
  const [tab, setTab] = useState<TabId>('os')
  const { isLightSidebar: isLight } = useTheme()

  const Comp = TABS.find(t => t.id === tab)?.component ?? OSAbertas

  return (
    <div className="flex flex-col h-full">
      <div
        className={`flex items-center gap-1 px-4 sm:px-6 pt-4 pb-0 border-b overflow-x-auto ${
          isLight ? 'border-slate-200' : 'border-white/[0.06]'
        }`}
      >
        {TABS.map(t => {
          const Icon   = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg border-b-2 transition-all ${
                active
                  ? 'border-rose-500 text-rose-500'
                  : `border-transparent ${
                      isLight
                        ? 'text-slate-500 hover:text-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        <Comp />
      </div>
    </div>
  )
}
