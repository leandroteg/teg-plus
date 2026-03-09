import {
  LayoutDashboard, FolderKanban, Network, GanttChart, Receipt,
  BarChart2, Workflow, FileBarChart, AlertTriangle, Users2, GitBranch, Activity,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem, NavSection } from './ModuleLayout'

const NAV: NavItem[] = [
  { to: '/pmo', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/pmo/portfolio', icon: FolderKanban, label: 'Portfólio' },
]

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Planejamento',
    items: [
      { to: '/pmo/eap', icon: Network, label: 'EAP / WBS' },
      { to: '/pmo/cronograma', icon: GanttChart, label: 'Cronograma' },
    ],
  },
  {
    label: 'Execução',
    items: [
      { to: '/pmo/medicoes', icon: Receipt, label: 'Medições' },
      { to: '/pmo/histograma', icon: BarChart2, label: 'Histograma' },
      { to: '/pmo/fluxo-os', icon: Workflow, label: 'Fluxo OS' },
    ],
  },
  {
    label: 'Controle',
    items: [
      { to: '/pmo/status-report', icon: FileBarChart, label: 'Status Report' },
      { to: '/pmo/multas', icon: AlertTriangle, label: 'Multas' },
      { to: '/pmo/reunioes', icon: Users2, label: 'Reuniões' },
      { to: '/pmo/mudancas', icon: GitBranch, label: 'Mudanças' },
      { to: '/pmo/indicadores', icon: Activity, label: 'Indicadores' },
    ],
  },
]

export default function PMOLayout() {
  return (
    <ModuleLayout
      moduleKey="pmo"
      moduleName="PMO"
      moduleEmoji="📊"
      accent="blue"
      nav={NAV}
      navSections={NAV_SECTIONS}
      moduleSubtitle="Gestão de Projetos"
      maxWidth="max-w-6xl"
      bottomNavMaxItems={5}
    />
  )
}
