import {
  LayoutDashboard, FileText, FilePlus, CalendarDays,
  FileSignature, TrendingUp, ClipboardList, Wallet,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/contratos',              icon: LayoutDashboard,  label: 'Painel',          end: true  },
  { to: '/contratos/lista',        icon: FileText,         label: 'Contratos'       },
  { to: '/contratos/novo',         icon: FilePlus,         label: 'Novo'            },
  { to: '/contratos/solicitacoes', icon: ClipboardList,    label: 'Solicitacoes'    },
  { to: '/contratos/previsao',     icon: Wallet,           label: 'Prev. Financeira'},
  { to: '/contratos/aditivos',     icon: FileSignature,    label: 'Aditivos'        },
  { to: '/contratos/reajustes',    icon: TrendingUp,       label: 'Reajustes'       },
]

export default function ContratosLayout() {
  return (
    <ModuleLayout
      moduleKey="contratos"
      moduleName="Contratos"
      moduleEmoji="📋"
      accent="indigo"
      nav={NAV}
      bottomNavMaxItems={5}
    />
  )
}
