import {
  LayoutDashboard, Rocket, Compass, Zap, BarChart3, CheckCircle2,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/egp',              icon: LayoutDashboard, label: 'Painel',        end: true },
  { to: '/egp/iniciacao',    icon: Rocket,          label: 'Iniciação' },
  { to: '/egp/planejamento', icon: Compass,         label: 'Planejamento' },
  { to: '/egp/execucao',     icon: Zap,             label: 'Execução' },
  { to: '/egp/controle',     icon: BarChart3,       label: 'Controle' },
  { to: '/egp/encerramento', icon: CheckCircle2,    label: 'Encerramento' },
]

export default function EGPLayout() {
  return (
    <ModuleLayout
      moduleKey="egp"
      moduleName="EGP"
      moduleEmoji="📊"
      accent="blue"
      nav={NAV}
      moduleSubtitle="Escritório de Gestão de Projetos"
      bottomNavMaxItems={6}
    />
  )
}
