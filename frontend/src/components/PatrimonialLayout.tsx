import {
  LayoutDashboard, Plus, ArrowLeftRight, Landmark,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function PatrimonialLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/patrimonial', icon: LayoutDashboard, label: 'Painel', end: true },
    {
      to: '/patrimonial/movimentacoes?nova=1',
      icon: Plus,
      label: 'Nova Movimenta\u00e7\u00e3o',
      action: () => navigate('/patrimonial/movimentacoes?nova=1'),
      accent: true,
    },
    { to: '/patrimonial/movimentacoes', icon: ArrowLeftRight, label: 'Movimenta\u00e7\u00f5es' },
    { to: '/patrimonial/patrimonio', icon: Landmark, label: 'Patrim\u00f4nio' },
  ]

  return (
    <ModuleLayout
      moduleKey="patrimonial"
      moduleName="Patrimonial"
      moduleEmoji="🏛️"
      accent="amber"
      nav={NAV}
      moduleSubtitle={'Ativos e deprecia\u00e7\u00e3o'}
      mobileModuleName="Patrimonial"
      maxWidth="max-w-5xl"
      bottomNavCompact={false}
      truncateBottomLabels
    />
  )
}
