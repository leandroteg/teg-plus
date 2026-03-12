import {
  LayoutDashboard, ClipboardList, Package2,
  Truck, Building2,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/logistica',                 icon: LayoutDashboard, label: 'Painel',          end: true  },
  { to: '/logistica/solicitacoes',    icon: ClipboardList,   label: 'Solicitações',    end: false },
  { to: '/logistica/expedicao',       icon: Package2,        label: 'Expedição',       end: false },
  { to: '/logistica/transportes',     icon: Truck,           label: 'Transportes',     end: false },
  { to: '/logistica/transportadoras', icon: Building2,       label: 'Transportadoras', end: false },
]

export default function LogisticaLayout() {
  return (
    <ModuleLayout
      moduleKey="logistica"
      moduleName="Logística"
      moduleEmoji="🚛"
      accent="orange"
      nav={NAV}
      bottomNavMaxItems={6}
      truncateBottomLabels
    />
  )
}
