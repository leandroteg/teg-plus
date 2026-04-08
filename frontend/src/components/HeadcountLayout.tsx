import { LayoutDashboard, UserPlus, Users, TrendingUp, UserMinus } from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/rh/headcount',               icon: LayoutDashboard, label: 'Painel',           end: true },
  { to: '/rh/headcount/admissao',      icon: UserPlus,        label: 'Admissão' },
  { to: '/rh/headcount/colaboradores', icon: Users,           label: 'Colaboradores' },
  { to: '/rh/headcount/movimentacoes', icon: TrendingUp,      label: 'Movimentações' },
  { to: '/rh/headcount/desligamento',  icon: UserMinus,       label: 'Desligamento' },
]

export default function HeadcountLayout() {
  return (
    <ModuleLayout
      moduleKey="rh"
      moduleName="Headcount"
      mobileModuleName="Headcount"
      moduleEmoji="👥"
      accent="violet"
      nav={NAV}
      moduleSubtitle="Admissão, Gestão & Movimentações"
      backRoute="/rh"
    />
  )
}
