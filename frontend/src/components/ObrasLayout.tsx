import {
  LayoutDashboard, ClipboardList, FileText, Banknote,
  Receipt,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/obras', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/obras/apontamentos', icon: ClipboardList, label: 'Apontamentos' },
  { to: '/obras/rdo', icon: FileText, label: 'Diário Obra' },
  { to: '/obras/adiantamentos', icon: Banknote, label: 'Adiantamentos' },
  { to: '/obras/prestacao', icon: Receipt, label: 'Prest. Contas' },
]

export default function ObrasLayout() {
  return (
    <ModuleLayout
      moduleKey="obras"
      moduleName="Obras"
      moduleEmoji="🏗️"
      accent="orange"
      nav={NAV}
      moduleSubtitle="Gestão de Obras"
      variant="compact"
    />
  )
}
