import {
  ClipboardList, Kanban,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/fiscal/pipeline',   icon: Kanban,        label: 'Emissão de Nota Fiscal', end: false },
  { to: '/fiscal',            icon: ClipboardList, label: 'Histórico NF',           end: true  },
]

export default function FiscalLayout() {
  return (
    <ModuleLayout
      moduleKey="fiscal"
      moduleName="Fiscal"
      moduleEmoji="🧾"
      accent="amber"
      nav={NAV}
    />
  )
}
