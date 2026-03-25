import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Plus, ClipboardList,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function ApontamentosLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/apontamentos',            icon: LayoutDashboard, label: 'Painel',                  end: true },
    { to: '/apontamentos/novo',       icon: Plus,            label: 'Novo Apontamento',         end: false, action: () => navigate(`/apontamentos/realizados?nova=${Date.now()}`), accent: true },
    { to: '/apontamentos/realizados', icon: ClipboardList,   label: 'Apontamentos Realizados',  end: false },
  ]

  return (
    <ModuleLayout
      moduleKey="apontamentos"
      moduleName="Apontamentos"
      moduleEmoji="💳"
      accent="violet"
      nav={NAV}
    />
  )
}
