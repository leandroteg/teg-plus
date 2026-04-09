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
  const [active, setActive] = useState<TabId>('os')
  const { isLightSidebar: isLight } = useTheme()

  const Comp = TABS.find(t => t.id === active)?.component ?? OSAbertas

  return (
    <div className="flex flex-col h-full">
      <div
        className={`flex gap-1 px-4 sm:px-6 pt-4 pb-0 border-b overflow-x-auto ${
          isLight ? 'border-slate-200' : 'border-white/[0.06]'
        }`}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-xl border-b-2 transition-all ${
                isActive
                  ? isLight
                    ? 'border-b-rose-500 text-rose-700 bg-rose-50'
                    : 'border-b-rose-400 text-rose-300 bg-rose-500/10'
                  : isLight
                    ? 'border-b-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    : 'border-b-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {label}
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
