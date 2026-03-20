import {
  LayoutDashboard, ClipboardList,
  FileSignature, Briefcase, Users, FileStack,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/contratos',              icon: LayoutDashboard,  label: 'Painel',          end: true  },
  { to: '/contratos/solicitacoes', icon: ClipboardList,    label: 'Solicitações'    },
  { to: '/contratos/assinaturas',  icon: FileSignature,    label: 'Assinaturas'     },
  { to: '/contratos/gestao',       icon: Briefcase,        label: 'Gestão'          },
  { to: '/contratos/equipe-pj',    icon: Users,            label: 'Equipe PJ'       },
  { to: '/contratos/modelos',      icon: FileStack,        label: 'Modelos'         },
]

export default function ContratosLayout() {
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
