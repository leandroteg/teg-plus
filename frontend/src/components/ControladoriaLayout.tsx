import {
  LayoutDashboard, Calculator, TrendingUp, Activity,
  Lightbulb, ClipboardList, Scale, BarChart3, AlertTriangle,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/controladoria', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/controladoria/orcamentos', icon: Calculator, label: 'Orçamentos' },
  { to: '/controladoria/plano-orcamentario', icon: ClipboardList, label: 'Plano Orçamentário' },
  { to: '/controladoria/controle-orcamentario', icon: Scale, label: 'Controle Orçamentário' },
  { to: '/controladoria/indicadores', icon: BarChart3, label: 'Indicadores' },
  { to: '/controladoria/dre', icon: TrendingUp, label: 'DRE' },
  { to: '/controladoria/kpis', icon: Activity, label: 'KPIs' },
  { to: '/controladoria/cenarios', icon: Lightbulb, label: 'Cenários' },
  { to: '/controladoria/alertas',  icon: AlertTriangle, label: 'Alertas' },
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
    />
  )
}
