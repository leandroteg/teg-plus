import { LayoutDashboard, Plus, Target, RefreshCcw, ClipboardCheck } from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function SgiLayout() {
  const NAV: NavItem[] = [
    { to: '/sgi',              icon: LayoutDashboard, label: 'Painel',            end: true },
    { to: '/sgi/novo',         icon: Plus,            label: 'Novo Registro',     accent: true },
    { to: '/sgi/objetivos',    icon: Target,          label: 'Objetivos e Metas' },
    { to: '/sgi/padronizacao', icon: ClipboardCheck,  label: 'Padronização' },
    { to: '/sgi/melhoria',     icon: RefreshCcw,      label: 'Melhoria Contínua' },
  ]
  return (
    <ModuleLayout
      moduleKey="sgi"
      moduleName="Gestão"
      moduleEmoji="⚖️"
      moduleSubtitle="SGI · Governança"
      accent="violet"
      nav={NAV}
      bottomNavMaxItems={5}
      truncateBottomLabels
    />
  )
}
