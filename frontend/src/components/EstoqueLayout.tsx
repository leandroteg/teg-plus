import {
  LayoutDashboard, Package2,
  ClipboardList, Plus, KeyRound,
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
      label: 'Nova Movimentação',
      action: () => navigate('/estoque/movimentacoes?nova=1'),
      accent: true,
    },
    { to: '/estoque/cautelas', icon: KeyRound, label: 'Cautelas', end: false },
    { to: '/estoque/itens', icon: Package2, label: 'Estoque', end: false },
    { to: '/estoque/inventario', icon: ClipboardList, label: 'Inventário', end: false },
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
