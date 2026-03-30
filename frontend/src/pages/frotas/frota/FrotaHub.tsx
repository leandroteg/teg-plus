import { useState } from 'react'
import { LogIn, Warehouse, ClipboardCheck, MapPin } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import EmEntrada      from './EmEntrada'
import Patio          from './Patio'
import ChecklistSaida from './ChecklistSaida'
import Alocados       from './Alocados'

const TABS = [
  { id: 'em_entrada',      label: 'Em Entrada',     icon: LogIn,          component: EmEntrada      },
  { id: 'patio',           label: 'Pátio',           icon: Warehouse,      component: Patio          },
  { id: 'checklist_saida', label: 'Checklist Saída', icon: ClipboardCheck, component: ChecklistSaida },
  { id: 'alocados',        label: 'Alocados',        icon: MapPin,         component: Alocados       },
]

export default function FrotaHub() {
  const [tab, setTab] = useState('patio')
  const { isLightSidebar: isLight } = useTheme()
  const Comp = TABS.find(t => t.id === tab)?.component ?? Patio

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-1 px-4 sm:px-6 pt-4 pb-0 border-b overflow-x-auto ${
        isLight ? 'border-slate-200' : 'border-white/[0.06]'
      }`}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg border-b-2 transition-all ${
                active
                  ? 'border-rose-500 text-rose-500'
                  : `border-transparent ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'}`
              }`}
            >
              <Icon size={13} />
              {t.label}
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
