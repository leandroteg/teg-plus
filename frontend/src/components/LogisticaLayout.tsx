import {
  LayoutDashboard, ClipboardList, Package2,
  Truck, Plus, Radio,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function LogisticaLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/logistica',                 icon: LayoutDashboard, label: 'Painel',             end: true  },
    { to: '/logistica', icon: Plus, label: 'Nova Solicitação', end: false,
      action: () => navigate(`/logistica/solicitacoes?nova=${Date.now()}`), accent: true, requisitanteAllowed: true },
    { to: '/logistica/solicitacoes',    icon: ClipboardList,   label: 'Solicitações',       end: false },
    { to: '/logistica/expedicao',       icon: Package2,        label: 'Expedição',          end: false },
    { to: '/logistica/transportes',     icon: Truck,           label: 'Transportes',        end: false },
    { to: '/logistica/telemetria',      icon: Radio,           label: 'Telemetria',         end: false },
  ]

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
