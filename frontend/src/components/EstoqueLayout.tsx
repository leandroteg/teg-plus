import {
  LayoutDashboard, Package2, ArrowLeftRight,
  ClipboardList, Plus,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function EstoqueLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/estoque', icon: LayoutDashboard, label: 'Painel', end: true },
    {
      to: '/estoque/movimentacoes?nova=1',
      icon: Plus,
      label: 'Nova Movimenta\u00e7\u00e3o',
      action: () => navigate('/estoque/movimentacoes?nova=1'),
      accent: true,
    },
    { to: '/estoque/movimentacoes', icon: ArrowLeftRight, label: 'Movimenta\u00e7\u00f5es', end: false },
    { to: '/estoque/itens', icon: Package2, label: 'Estoque', end: false },
    { to: '/estoque/inventario', icon: ClipboardList, label: 'Invent\u00e1rio', end: false },
  ]

  return (
    <ModuleLayout
      moduleKey="estoque"
      moduleName="Estoque"
      moduleEmoji="📦"
      accent="blue"
      nav={NAV}
      truncateBottomLabels
    />
  )
}
