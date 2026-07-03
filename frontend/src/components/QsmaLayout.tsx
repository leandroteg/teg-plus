import { LayoutDashboard, Plus, ClipboardCheck, HardHat, Leaf } from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function QsmaLayout() {
  const NAV: NavItem[] = [
    { to: '/qsma',               icon: LayoutDashboard, label: 'Painel',        end: true },
    { to: '/qsma/novo',          icon: Plus,            label: 'Novo Registro', accent: true },
    { to: '/qsma/inspecoes',     icon: ClipboardCheck,  label: 'Inspeções' },
    { to: '/qsma/seguranca',     icon: HardHat,         label: 'Segurança' },
    { to: '/qsma/meio-ambiente', icon: Leaf,            label: 'Meio Ambiente' },
  ]
  return (
    <ModuleLayout
      moduleKey="qsma"
      moduleName="QSMA"
      moduleEmoji="🦺"
      moduleSubtitle="Qualidade, Segurança e Meio Ambiente"
      accent="rose"
      nav={NAV}
      bottomNavMaxItems={5}
      truncateBottomLabels
    />
  )
}
