import { useState } from 'react'
import { LogIn, Warehouse, ClipboardCheck, MapPin } from 'lucide-react'
import EGPSubTabs, { type EGPSubTab } from '../../../components/EGPSubTabs'
import EmEntrada      from './EmEntrada'
import Patio          from './Patio'
import ChecklistSaida from './ChecklistSaida'
import Alocados       from './Alocados'

const TABS: EGPSubTab[] = [
  { key: 'em_entrada',      label: 'Em Entrada',      icon: LogIn          },
  { key: 'patio',           label: 'Pátio',            icon: Warehouse      },
  { key: 'checklist_saida', label: 'Checklist Saída',  icon: ClipboardCheck },
  { key: 'alocados',        label: 'Alocados',         icon: MapPin         },
]

const COMPS: Record<string, React.ComponentType> = {
  em_entrada: EmEntrada,
  patio: Patio,
  checklist_saida: ChecklistSaida,
  alocados: Alocados,
}

export default function FrotaHub() {
  const [active, setActive] = useState('patio')
  const Comp = COMPS[active] ?? Patio

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 pt-4 pb-3">
        <EGPSubTabs tabs={TABS} active={active} onChange={setActive} accent="rose" />
      </div>
      <div className="flex-1 overflow-auto">
        <Comp />
      </div>
    </div>
  )
}
