import {
  LayoutDashboard, ClipboardList,
  FileSignature, Briefcase, FileStack, Plus,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'

export default function ContratosLayout() {
  const navigate = useNavigate()

  const NAV: NavItem[] = [
    { to: '/contratos',              icon: LayoutDashboard,  label: 'Painel',            end: true  },
    { to: '/contratos/solicitacoes/nova', icon: Plus,        label: 'Nova Solicitação',  end: false,
      action: () => navigate(`/contratos/solicitacoes/nova`), accent: true },
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
