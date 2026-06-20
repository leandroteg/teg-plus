import { LayoutDashboard, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function OrcamentacaoLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/orcamentacao', icon: LayoutDashboard, label: 'Painel', end: true },
    {
      to: '/orcamentacao/novo',
      icon: Plus,
      label: 'Novo Orçamento',
      action: () => navigate('/orcamentacao/novo'),
      accent: true,
    },
  ]

  return (
    <ModuleLayout
      moduleKey="orcamentacao"
      moduleName="Orçamentação"
      moduleEmoji="🗺️"
      moduleSubtitle="Estimativa de LT"
      accent="amber"
      nav={NAV}
    />
  )
}
