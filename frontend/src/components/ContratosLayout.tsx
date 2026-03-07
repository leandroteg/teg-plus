import {
  LayoutDashboard, FileText, FilePlus, CalendarDays,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/contratos',            icon: LayoutDashboard, label: 'Painel',      end: true  },
  { to: '/contratos/lista',      icon: FileText,        label: 'Contratos',   end: false },
  { to: '/contratos/novo',       icon: FilePlus,        label: 'Novo',        end: false },
  { to: '/contratos/parcelas',   icon: CalendarDays,    label: 'Parcelas',    end: false },
]

export default function ContratosLayout() {
  return (
    <ModuleLayout
      moduleKey="contratos"
      moduleName="Contratos"
      moduleEmoji="📋"
      accent="indigo"
      nav={NAV}
    />
  )
}
