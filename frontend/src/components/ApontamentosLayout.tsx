import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, CreditCard,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function ApontamentosLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/despesas', icon: LayoutDashboard, label: 'Painel', end: true },
    { to: '/despesas/cartoes', icon: CreditCard, label: 'Cartões', end: false, action: () => navigate(`/despesas/cartoes?nova=${Date.now()}`), accent: true },
    { to: '/despesas/adiantamentos', icon: Wallet, label: 'Adiantamentos', end: false },
  ]

  return (
    <ModuleLayout
      moduleKey="apontamentos"
      moduleName="Despesas"
      moduleEmoji="💳"
      accent="violet"
      nav={NAV}
    />
  )
}
