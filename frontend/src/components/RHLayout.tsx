import { LayoutDashboard } from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/rh', icon: LayoutDashboard, label: 'Módulos RH', end: true },
]

export default function RHLayout() {
  return (
    <ModuleLayout
      moduleKey="rh"
      moduleName="Recursos Humanos"
      mobileModuleName="RH"
      moduleEmoji="👥"
      accent="violet"
      nav={NAV}
      moduleSubtitle="Pessoas & Organização"
      variant="compact"
    />
  )
}
