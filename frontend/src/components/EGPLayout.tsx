import {
  LayoutDashboard, FolderKanban, Workflow,
  GitBranch, CalendarDays, BarChart3, Users, DollarSign,
  FileText, Activity, ClipboardCheck,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/egp',            icon: LayoutDashboard, label: 'Painel',       end: true },
  { to: '/egp/portfolio',  icon: FolderKanban,    label: 'Portfólio' },
  { to: '/egp/tap',        icon: ClipboardCheck,  label: 'TAP' },
  { to: '/egp/eap',        icon: GitBranch,       label: 'EAP' },
  { to: '/egp/cronograma', icon: CalendarDays,    label: 'Cronograma' },
  { to: '/egp/medicoes',   icon: BarChart3,       label: 'Medições' },
  { to: '/egp/histograma', icon: Users,           label: 'Histograma' },
  { to: '/egp/custos',     icon: DollarSign,      label: 'Custos' },
  { to: '/egp/fluxo-os',   icon: Workflow,        label: 'Fluxo OS' },
  { to: '/egp/reunioes',   icon: FileText,        label: 'Reunioes' },
  { to: '/egp/indicadores', icon: Activity,       label: 'Indicadores' },
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
      bottomNavMaxItems={4}
    />
  )
}
