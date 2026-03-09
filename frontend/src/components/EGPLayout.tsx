import {
  LayoutDashboard, FolderKanban, Workflow,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/egp', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/egp/portfolio', icon: FolderKanban, label: 'Portfólio' },
  { to: '/egp/fluxo-os', icon: Workflow, label: 'Fluxo OS' },
]

export default function EGPLayout() {
  return (
    <ModuleLayout
      moduleKey="egp"
      moduleName="EGP"
      moduleEmoji="📊"
      accent="blue"
      nav={NAV}
      moduleSubtitle="Escritório de Gestão de Projetos"
      bottomNavMaxItems={3}
    />
  )
}
