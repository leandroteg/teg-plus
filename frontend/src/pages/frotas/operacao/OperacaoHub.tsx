import { useState } from 'react'
import { CalendarDays, Fuel, AlertCircle, Radio, BarChart3 } from 'lucide-react'
import EGPSubTabs, { type EGPSubTab } from '../../../components/EGPSubTabs'
import AgendaAlocacao from './AgendaAlocacao'
import AbastecimentosOp from './AbastecimentosOp'
import MultasPedagios from './MultasPedagios'
import TelemetriaOp from './TelemetriaOp'
import Indicadores from './Indicadores'

const TABS: EGPSubTab[] = [
  { key: 'agenda',          label: 'Agenda',            icon: CalendarDays },
  { key: 'abastecimentos',  label: 'Abastecimentos',    icon: Fuel },
  { key: 'multas',          label: 'Multas & Pedágios', icon: AlertCircle },
  { key: 'telemetria',      label: 'Telemetria',        icon: Radio },
  { key: 'indicadores',     label: 'Indicadores',       icon: BarChart3 },
]

const COMPS: Record<string, React.ComponentType> = {
  agenda: AgendaAlocacao,
  abastecimentos: AbastecimentosOp,
  multas: MultasPedagios,
  telemetria: TelemetriaOp,
  indicadores: Indicadores,
}

export default function OperacaoHub() {
  const [active, setActive] = useState('agenda')
  const Comp = COMPS[active] ?? AgendaAlocacao

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
