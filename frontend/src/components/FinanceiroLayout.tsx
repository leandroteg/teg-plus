import {
  LayoutDashboard, Receipt, DollarSign, FileCheck2,
  Landmark, BarChart3, Layers, Banknote,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/financeiro',                    icon: LayoutDashboard, label: 'Painel',          end: true  },
  { to: '/financeiro/cp',                 icon: Receipt,         label: 'Contas a Pagar',  end: false },
  { to: '/financeiro/cr',                 icon: DollarSign,      label: 'A Receber',       end: false },
  { to: '/financeiro/aprovacoes',         icon: FileCheck2,      label: 'Aprovações',      end: false },
  { to: '/financeiro/lotes',              icon: Layers,          label: 'Lotes',            end: false },
  { to: '/financeiro/painel-pagamentos',  icon: Banknote,        label: 'Painel Pgto',     end: false },
  { to: '/financeiro/conciliacao',        icon: Landmark,        label: 'Conciliação',     end: false },
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
      bottomNavMaxItems={5}
      truncateBottomLabels
    />
  )
}
