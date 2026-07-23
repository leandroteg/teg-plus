import {
  LayoutDashboard, Users, ShieldCheck, ScrollText, BarChart3, Code2, Link2,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem, NavSection } from './ModuleLayout'

const NAV: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Painel', end: true },
]

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Gestão',
    items: [
      { to: '/admin/usuarios',             icon: Users,      label: 'Usuários'        },
      { to: '/admin/politicas-aprovacao',  icon: ShieldCheck, label: 'Pol. Aprovação' },
    ],
  },
  {
    label: 'Monitoramento',
    items: [
      { to: '/admin/logs',        icon: ScrollText, label: 'Logs'           },
      { to: '/admin/uso-modulos', icon: BarChart3,  label: 'Uso de Módulos' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/admin/integracoes',     icon: Link2, label: 'Integrações'     },
      { to: '/admin/desenvolvimento', icon: Code2, label: 'Desenvolvimento' },
    ],
  },
]

const MOBILE_NAV: NavItem[] = [
  { to: '/admin',             icon: LayoutDashboard, label: 'Painel',   end: true  },
  { to: '/admin/usuarios',    icon: Users,           label: 'Usuários', end: false },
  { to: '/admin/logs',        icon: ScrollText,      label: 'Logs',     end: false },
  { to: '/admin/uso-modulos', icon: BarChart3,       label: 'Uso',      end: false },
  { to: '/admin/integracoes', icon: Link2,           label: 'Integr.',  end: false },
]

export default function AdminLayout() {
  return (
    <ModuleLayout
      moduleKey="admin"
      moduleName="Administração"
      moduleEmoji="🛡️"
      accent="indigo"
      nav={NAV}
      navSections={NAV_SECTIONS}
      mobileNav={MOBILE_NAV}
      showCadastrosLink={false}
      moduleSubtitle="Painel do administrador"
      backRoute={-1}
      disableRequisitanteMode
    />
  )
}
