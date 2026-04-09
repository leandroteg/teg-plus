import { useState } from 'react'
import { LogIn, Warehouse, ClipboardCheck, MapPin } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import EmEntrada      from './EmEntrada'
import Patio          from './Patio'
import ChecklistSaida from './ChecklistSaida'
import Alocados       from './Alocados'

type TabKey = 'em_entrada' | 'patio' | 'checklist_saida' | 'alocados'

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType; component: React.ComponentType }> = [
  { key: 'em_entrada',      label: 'Em Entrada',      icon: LogIn,          component: EmEntrada      },
  { key: 'patio',           label: 'Pátio',            icon: Warehouse,      component: Patio          },
  { key: 'checklist_saida', label: 'Checklist Saída',  icon: ClipboardCheck, component: ChecklistSaida },
  { key: 'alocados',        label: 'Alocados',         icon: MapPin,         component: Alocados       },
]

export default function FrotaHub() {
  const [active, setActive] = useState<TabKey>('patio')
  const { isLightSidebar: isLight } = useTheme()
  const Comp = TABS.find(t => t.key === active)?.component ?? Patio

  return (
    <div className="flex flex-col h-full">
      <div className={`flex gap-1 px-4 sm:px-6 pt-4 pb-0 border-b overflow-x-auto ${
        isLight ? 'border-slate-200' : 'border-white/[0.06]'
      }`}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
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
      <div className="flex-1 overflow-auto">
        <Comp />
      </div>
    </div>
  )
}
