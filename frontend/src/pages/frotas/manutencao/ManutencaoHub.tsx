import { useState } from 'react'
import { CalendarDays, ClipboardList, Wrench, History } from 'lucide-react'
import EGPSubTabs, { type EGPSubTab } from '../../../components/EGPSubTabs'
import Planejamento         from './Planejamento'
import ChecklistsManutencao from './ChecklistsManutencao'
import OSAbertas            from './OSAbertas'
import HistoricoOS          from './HistoricoOS'

const TABS: EGPSubTab[] = [
  { key: 'planejamento', label: 'Planejamento', icon: CalendarDays  },
  { key: 'checklists',   label: 'Checklists',   icon: ClipboardList },
  { key: 'os',           label: 'OS Abertas',   icon: Wrench        },
  { key: 'historico',    label: 'Histórico',     icon: History       },
]

const COMPS: Record<string, React.ComponentType> = {
  planejamento: Planejamento,
  checklists: ChecklistsManutencao,
  os: OSAbertas,
  historico: HistoricoOS,
}

export default function ManutencaoHub() {
  const [active, setActive] = useState('os')
  const Comp = COMPS[active] ?? OSAbertas

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 pt-4 pb-3">
        <EGPSubTabs tabs={TABS} active={active} onChange={setActive} accent="rose" />
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        <Comp />
      </div>
    </div>
  )
}
