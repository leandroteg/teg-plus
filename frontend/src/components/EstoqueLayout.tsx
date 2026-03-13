import {
  LayoutDashboard, Package2, ArrowLeftRight,
  ClipboardList, Landmark, FileBox,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/estoque',               icon: LayoutDashboard, label: 'Painel',          end: true  },
  { to: '/estoque/solicitacoes', icon: FileBox,         label: 'Solicitações',   end: false },
  { to: '/estoque/itens',         icon: Package2,        label: 'Estoque',         end: false },
  { to: '/estoque/movimentacoes', icon: ArrowLeftRight,  label: 'Movimentações',   end: false },
  { to: '/estoque/inventario',    icon: ClipboardList,   label: 'Inventário',      end: false },
  { to: '/estoque/patrimonial',   icon: Landmark,        label: 'Patrimonial',     end: false },
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
