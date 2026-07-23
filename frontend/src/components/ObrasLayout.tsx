import {
  LayoutDashboard, Users2, Truck, ClipboardList, Plus, FileText, FolderSearch,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'

export default function ObrasLayout() {
  const navigate = useNavigate()

  const NAV = [
    { to: '/obras', icon: LayoutDashboard, label: 'Painel', end: true },
    {
      to: 'obras-novo-registro',
      icon: Plus,
      label: 'Novo Registro',
      end: false,
      accent: true,
      actionMenu: {
        title: 'Novo registro',
        items: [
          {
            icon: FileText,
            label: 'Registrar RDO',
            description: 'Criar um novo Relatório Diário de Obra.',
            tone: 'amber' as const,
            action: () => navigate('/obras/gestao?novo_rdo=1'),
          },
          {
            icon: FolderSearch,
            label: 'Lançar Projeto Técnico',
            description: 'Ler os documentos da pasta do projeto e preencher a obra/OSC.',
            tone: 'emerald' as const,
            action: () => navigate('/obras/gestao?lancar_projeto=1'),
          },
        ],
      },
    },
    { to: '/obras/gestao', icon: ClipboardList, label: 'Gestão de Obras' },
    { to: '/obras/equipe', icon: Users2, label: 'Alocação de Equipes' },
    { to: '/obras/alocacao-recursos', icon: Truck, label: 'Alocação de Recursos' },
  ]

  return (
    <ModuleLayout
      moduleKey="obras"
      moduleName="Obras"
      moduleEmoji="🏗️"
      accent="orange"
      nav={NAV}
      moduleSubtitle="Gestão de Obras"
    />
  )
}
