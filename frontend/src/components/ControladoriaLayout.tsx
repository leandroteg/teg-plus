import {
  LayoutDashboard, Calculator, TrendingUp, Activity,
  Lightbulb,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/controladoria', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/controladoria/orcamentos', icon: Calculator, label: 'Orçamentos' },
  { to: '/controladoria/dre', icon: TrendingUp, label: 'DRE' },
  { to: '/controladoria/kpis', icon: Activity, label: 'KPIs' },
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
      moduleSubtitle="Indicadores & Controle"
      variant="compact"
    />
  )
}
