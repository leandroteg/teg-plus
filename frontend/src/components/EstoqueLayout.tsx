import {
  LayoutDashboard, Package2, ArrowLeftRight,
  ClipboardList, FileBox,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/estoque', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/estoque/solicitacoes', icon: FileBox, label: 'Solicita\u00e7\u00f5es', end: false },
  { to: '/estoque/itens', icon: Package2, label: 'Estoque', end: false },
  { to: '/estoque/movimentacoes', icon: ArrowLeftRight, label: 'Movimenta\u00e7\u00f5es', end: false },
  { to: '/estoque/inventario', icon: ClipboardList, label: 'Invent\u00e1rio', end: false },
]

export default function EstoqueLayout() {
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
