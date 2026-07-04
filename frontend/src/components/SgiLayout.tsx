import { LayoutDashboard, Plus, Target, RefreshCcw, ClipboardCheck, AlertTriangle, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function SgiLayout() {
  const navigate = useNavigate()
  const NAV: NavItem[] = [
    { to: '/sgi',              icon: LayoutDashboard, label: 'Painel',            end: true },
    {
      to: 'sgi-novo-registro',
      icon: Plus,
      label: 'Novo Registro',
      end: false,
      accent: true,
      actionMenu: {
        title: 'Novo registro',
        items: [
          { icon: Target,        label: 'Check-in de Meta', description: 'Lançar realizado vs. alvo de uma meta.',          tone: 'emerald', action: () => navigate('/sgi/objetivos') },
          { icon: AlertTriangle, label: 'Anomalia / Falha',  description: 'Registrar desvio, falha ou ocorrência.',          tone: 'amber',   action: () => navigate('/sgi/melhoria') },
          { icon: FileText,      label: 'Documento',         description: 'Criar documento (política, procedimento, IT…).',  tone: 'blue',    action: () => navigate('/sgi/padronizacao') },
        ],
      },
    },
    { to: '/sgi/objetivos',    icon: Target,          label: 'Objetivos e Metas' },
    { to: '/sgi/melhoria',     icon: RefreshCcw,      label: 'Melhoria Contínua' },
    { to: '/sgi/padronizacao', icon: ClipboardCheck,  label: 'Padronização' },
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
