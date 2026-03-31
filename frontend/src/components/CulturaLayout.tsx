import { LayoutDashboard, ImagePlay, Megaphone } from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/rh/cultura',                icon: LayoutDashboard, label: 'Cultura',           end: true },
  { to: '/rh/cultura/mural',          icon: ImagePlay,       label: 'Mural de Recados',  adminOnly: true },
  { to: '/rh/cultura/endomarketing',  icon: Megaphone,       label: 'Endomarketing' },
]

export default function CulturaLayout() {
  return (
    <ModuleLayout
      moduleKey="rh"
      moduleName="Cultura"
      mobileModuleName="Cultura"
      moduleEmoji="💜"
      accent="violet"
      nav={NAV}
      moduleSubtitle="Engajamento & Endomarketing"
      backRoute="/rh"
    />
  )
}
