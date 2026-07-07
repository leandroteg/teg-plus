import {
  LayoutDashboard, ClipboardList,
  FileSignature, Briefcase, FileStack, Plus, FileText, Receipt,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function ContratosLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/contratos',              icon: LayoutDashboard,  label: 'Painel',            end: true  },
    {
      to: 'con-nova-solicitacao',
      icon: Plus,
      label: 'Nova Solicitação',
      end: false,
      accent: true,
      actionMenu: {
        title: 'Nova solicitação',
        items: [
          {
            icon: FileText,
            label: 'Novo Contrato',
            description: 'Abrir uma solicitação de contrato — da minuta à assinatura.',
            tone: 'violet' as const,
            action: () => navigate('/contratos/solicitacoes/nova'),
          },
          {
            icon: Receipt,
            label: 'Nova Medição',
            description: 'Lançar medição (BM) de um contrato ativo.',
            tone: 'rose' as const,
            action: () => navigate('/contratos/gestao?nova-medicao=1'),
          },
        ],
      },
    },
    { to: '/contratos/solicitacoes', icon: ClipboardList,    label: 'Elaboração'        },
    { to: '/contratos/assinaturas',  icon: FileSignature,    label: 'Assinaturas'       },
    { to: '/contratos/gestao',       icon: Briefcase,        label: 'Gestão'            },
    { to: '/contratos/modelos',      icon: FileStack,        label: 'Modelos'           },
  ]

  return (
    <ModuleLayout
      moduleKey="contratos"
      moduleName="Contratos"
      moduleEmoji="📋"
      accent="indigo"
      nav={NAV}
      bottomNavMaxItems={6}
    />
  )
}
