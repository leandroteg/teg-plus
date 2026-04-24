import {
  LayoutDashboard, Plus, List, ShoppingCart,
  Truck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function Layout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/compras',     icon: LayoutDashboard, label: 'Painel',            end: true  },
    { to: '/nova', icon: Plus, label: 'Nova Solicitação', end: false,
      action: () => navigate(`/nova?nova=${Date.now()}`), accent: true, requisitanteAllowed: true },
    { to: '/requisicoes', icon: List,            label: 'Requisições',       end: false },
    { to: '/cotacoes',    icon: ShoppingCart,    label: 'Cotações',          end: false },
    { to: '/pedidos',     icon: Truck,           label: 'Pedidos',           end: false },
  ]

  return (
    <ModuleLayout
      moduleKey="compras"
      moduleName="Compras"
      moduleEmoji="🛒"
      accent="teal"
      nav={NAV}
      maxWidth="max-w-none"
      bottomNavCompact={false}
    />
  )
}
