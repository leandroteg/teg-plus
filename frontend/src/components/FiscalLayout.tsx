import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Kanban, ClipboardList, Plus,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function FiscalLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/fiscal',             icon: LayoutDashboard, label: 'Painel',                  end: true },
    { to: '/fiscal/pipeline',    icon: Plus,            label: 'Nova Solicitação',         end: false, action: () => navigate('/fiscal/pipeline?nova=1'), accent: true },
    { to: '/fiscal/pipeline',    icon: Kanban,          label: 'Emissão de Nota Fiscal',   end: false },
    { to: '/fiscal/historico',   icon: ClipboardList,   label: 'Histórico NF',             end: false },
  ]

  return (
    <ModuleLayout
      moduleKey="fiscal"
      moduleName="Fiscal"
      moduleEmoji="🧾"
      accent="amber"
      nav={NAV}
    />
  )
}
