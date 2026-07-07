import {
  LayoutDashboard, ClipboardList,
  FileSignature, Briefcase, FileStack, Plus, Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'
import { useAuth } from '../contexts/AuthContext'

export default function ContratosLayout() {
  const navigate = useNavigate()
  const { perfil, hasSetorPapel } = useAuth()
  // Equipe PJ é sigilosa: item só aparece p/ admin e supervisão de Contratos (RLS protege o dado)
  const canPJ = perfil?.role === 'administrador' || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])

  const NAV: NavItem[] = [
    { to: '/contratos',              icon: LayoutDashboard,  label: 'Painel',            end: true  },
    { to: '/contratos/solicitacoes/nova', icon: Plus,        label: 'Nova Solicitação',  end: false,
      action: () => navigate(`/contratos/solicitacoes/nova`), accent: true },
    { to: '/contratos/solicitacoes', icon: ClipboardList,    label: 'Elaboração'        },
    { to: '/contratos/assinaturas',  icon: FileSignature,    label: 'Assinaturas'       },
    { to: '/contratos/gestao',       icon: Briefcase,        label: 'Gestão'            },
    ...(canPJ ? [{ to: '/contratos/equipe-pj', icon: Users, label: 'Equipe PJ' } as NavItem] : []),
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
