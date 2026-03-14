import {
  LayoutDashboard, BriefcaseBusiness, ReceiptText, FolderKanban, Lightbulb,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/controladoria', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/controladoria/controle-orcamentario', icon: BriefcaseBusiness, label: 'Controle Orçamentário' },
  { to: '/controladoria/controle-custos', icon: ReceiptText, label: 'Controle de Custos' },
  { to: '/controladoria/controle-projetos', icon: FolderKanban, label: 'Controle Projetos' },
  { to: '/controladoria/cenarios', icon: Lightbulb, label: 'Cenários' },
]

export default function ControladoriaLayout() {
  return (
    <ModuleLayout
      moduleKey="controladoria"
      moduleName="Controladoria"
      moduleEmoji="📈"
      accent="emerald"
      nav={NAV}
      mobileNav={NAV}
      bottomNavMaxItems={5}
      truncateBottomLabels
      moduleSubtitle="Painel, orçamento e custos"
    />
  )
}
