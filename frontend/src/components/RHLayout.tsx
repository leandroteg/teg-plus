import { LayoutDashboard, ImagePlay } from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/rh',       icon: LayoutDashboard, label: 'Painel',           end: true },
  { to: '/rh/mural', icon: ImagePlay,       label: 'Mural de Recados', adminOnly: true },
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
      variant="compact"
      moduleSubtitle="Pessoas & Organização"
    />
  )
}
