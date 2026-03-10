import {
  LayoutDashboard, FilePlus, ClipboardList,
  FileSignature, Briefcase, Users,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/contratos',              icon: LayoutDashboard,  label: 'Painel',          end: true  },
  { to: '/contratos/novo',         icon: FilePlus,         label: 'Novo Contrato'   },
  { to: '/contratos/solicitacoes', icon: ClipboardList,    label: 'Solicitacoes'    },
  { to: '/contratos/assinaturas',  icon: FileSignature,    label: 'Assinaturas'     },
  { to: '/contratos/gestao',       icon: Briefcase,        label: 'Gestao'          },
  { to: '/contratos/equipe-pj',    icon: Users,            label: 'Equipe PJ'       },
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
