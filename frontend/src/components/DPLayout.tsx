import { LayoutDashboard, Gift, Fingerprint, Receipt, FileText } from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/rh/dp',            icon: LayoutDashboard, label: 'Painel',     end: true },
  { to: '/rh/dp/beneficios', icon: Gift,            label: 'Benefícios' },
  { to: '/rh/dp/ponto',      icon: Fingerprint,     label: 'Ponto' },
  { to: '/rh/dp/folha',      icon: Receipt,         label: 'Folha' },
  { to: '/rh/dp/holerites',  icon: FileText,        label: 'Holerites' },
]

export default function DPLayout() {
  return (
    <ModuleLayout
      moduleKey="rh"
      moduleName="DP"
      mobileModuleName="DP"
      moduleEmoji="🧮"
      accent="amber"
      nav={NAV}
      moduleSubtitle="Departamento Pessoal"
      backRoute="/rh"
    />
  )
}
