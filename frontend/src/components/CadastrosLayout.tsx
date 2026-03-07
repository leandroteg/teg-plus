import {
  LayoutDashboard, Building, Building2, Package2, Tag,
  Target, HardHat, Users, Layers, FolderTree,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem, NavSection } from './ModuleLayout'

const NAV: NavItem[] = [
  { to: '/cadastros', icon: LayoutDashboard, label: 'Painel', end: true },
]

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Estrutura',
    items: [
      { to: '/cadastros/empresas',      icon: Building,  label: 'Empresas'    },
      { to: '/cadastros/centros-custo',  icon: Target,    label: 'C. Custo'    },
      { to: '/cadastros/obras',          icon: HardHat,   label: 'Obras'       },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/cadastros/grupos',      icon: Layers,     label: 'Grupos'      },
      { to: '/cadastros/categorias',  icon: FolderTree, label: 'Categorias'  },
      { to: '/cadastros/classes',     icon: Tag,        label: 'Classes'     },
    ],
  },
  {
    label: 'Entidades',
    items: [
      { to: '/cadastros/fornecedores',  icon: Building2, label: 'Fornecedores'  },
      { to: '/cadastros/colaboradores', icon: Users,     label: 'Colaboradores' },
      { to: '/cadastros/itens',         icon: Package2,  label: 'Itens'         },
    ],
  },
]

const MOBILE_NAV: NavItem[] = [
  { to: '/cadastros',              icon: LayoutDashboard, label: 'Painel',  end: true  },
  { to: '/cadastros/empresas',     icon: Building,        label: 'Empresas',end: false },
  { to: '/cadastros/centros-custo',icon: Target,          label: 'C.Custo', end: false },
  { to: '/cadastros/fornecedores', icon: Building2,       label: 'Fornec.', end: false },
  { to: '/cadastros/classes',      icon: Tag,             label: 'Classes', end: false },
]

export default function CadastrosLayout() {
  return (
    <ModuleLayout
      moduleKey="cadastros"
      moduleName="Cadastros"
      moduleEmoji="⚙️"
      accent="violet"
      nav={NAV}
      navSections={NAV_SECTIONS}
      mobileNav={MOBILE_NAV}
      showCadastrosLink={false}
      moduleSubtitle="Configurações"
      backRoute={-1}
    />
  )
}
