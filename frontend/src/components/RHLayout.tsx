import { LayoutDashboard, UserPlus, Users, TrendingUp, UserMinus, ImagePlay } from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/rh',               icon: LayoutDashboard, label: 'Painel',           end: true },
  { to: '/rh/admissao',      icon: UserPlus,        label: 'Admissão' },
  { to: '/rh/colaboradores', icon: Users,           label: 'Colaboradores' },
  { to: '/rh/movimentacoes', icon: TrendingUp,      label: 'Movimentações' },
  { to: '/rh/desligamento',  icon: UserMinus,       label: 'Desligamento' },
  { to: '/rh/mural',         icon: ImagePlay,       label: 'Mural',            adminOnly: true },
]

export default function RHLayout() {
  return (
    <ModuleLayout
      moduleKey="rh"
      moduleName="Gestão de Colaboradores"
      mobileModuleName="RH"
      moduleEmoji="👥"
      accent="violet"
      nav={NAV}
      moduleSubtitle="Admissão, Gestão & Movimentações"
    />
  )
}
