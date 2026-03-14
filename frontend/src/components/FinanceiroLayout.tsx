import {
  LayoutDashboard, Receipt, DollarSign, BarChart3, Landmark, Layers, Banknote,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/financeiro',                   icon: LayoutDashboard, label: 'Painel',          end: true },
  { to: '/financeiro/contas-a-pagar',    icon: Receipt,         label: 'Contas a Pagar',  end: false },
  { to: '/financeiro/lotes',             icon: Layers,          label: 'Lotes',           end: false },
  { to: '/financeiro/painel-pagamentos', icon: Banknote,        label: 'Pagamentos',      end: false },
  { to: '/financeiro/cr',                icon: DollarSign,      label: 'Contas a Receber', end: false },
  { to: '/financeiro/tesouraria',        icon: Landmark,        label: 'Tesouraria',      end: false },
  { to: '/financeiro/relatorios',        icon: BarChart3,       label: 'Relatorios',      end: false },
]

export default function FinanceiroLayout() {
  return (
    <ModuleLayout
      moduleKey="financeiro"
      moduleName="Financeiro"
      moduleEmoji="💰"
      accent="emerald"
      nav={NAV}
      mobileNav={NAV.slice(0, 5)}
      bottomNavMaxItems={5}
      truncateBottomLabels
    />
  )
}
