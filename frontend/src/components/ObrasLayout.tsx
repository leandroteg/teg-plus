import {
  LayoutDashboard, FileText, Users2, Truck,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/obras', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/obras/rdo', icon: FileText, label: 'Diário Obra' },
  { to: '/obras/equipe', icon: Users2, label: 'Alocação de Equipes' },
  { to: '/obras/alocacao-recursos', icon: Truck, label: 'Alocação de Recursos' },
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
    />
  )
}
