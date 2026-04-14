import {
  LayoutDashboard, Plus, ArrowLeftRight, Landmark, ScanLine,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function PatrimonialLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/patrimonial', icon: LayoutDashboard, label: 'Painel', end: true },
    {
      to: '/patrimonial',
      icon: Plus,
      label: 'Nova Movimenta\u00e7\u00e3o',
      action: () => navigate('/patrimonial/movimentacoes?nova=1'),
      accent: true,
      requisitanteAllowed: true,
    },
    { to: '/patrimonial/scanner', icon: ScanLine, label: 'Consultar QR' },
    { to: '/patrimonial/patrimonio', icon: Landmark, label: 'Patrim\u00f4nio' },
    { to: '/patrimonial/historico', icon: ArrowLeftRight, label: 'Hist\u00f3rico' },
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
