import {
  LayoutDashboard, Plus, List, ShoppingCart,
  Truck,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/compras',     icon: LayoutDashboard, label: 'Painel',      end: true  },
  { to: '/nova',        icon: Plus,            label: 'Nova Solicitação', end: false },
  { to: '/requisicoes', icon: List,            label: 'Requisições', end: false },
  { to: '/cotacoes',    icon: ShoppingCart,    label: 'Cotações',    end: false },
  { to: '/pedidos',     icon: Truck,           label: 'Pedidos',     end: false },
]

export default function Layout() {
  return (
    <ModuleLayout
      moduleKey="compras"
      moduleName="Compras"
      moduleEmoji="🛒"
      accent="teal"
      nav={NAV}
      maxWidth="max-w-4xl"
      bottomNavCompact={false}
    />
  )
}
