import {
  LayoutDashboard, Receipt, DollarSign, BarChart3,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/financeiro',                    icon: LayoutDashboard, label: 'Painel',          end: true  },
  { to: '/financeiro/contas-a-pagar',     icon: Receipt,         label: 'Contas a Pagar',  end: false },
  { to: '/financeiro/cr',                 icon: DollarSign,      label: 'A Receber',       end: false },
  { to: '/financeiro/relatorios',         icon: BarChart3,       label: 'Relatórios',      end: false },
]

export default function FinanceiroLayout() {
  return (
    <ModuleLayout
      moduleKey="financeiro"
      moduleName="Financeiro"
      moduleEmoji="💰"
      accent="emerald"
      nav={NAV}
      bottomNavMaxItems={4}
      truncateBottomLabels
    />
  )
}
