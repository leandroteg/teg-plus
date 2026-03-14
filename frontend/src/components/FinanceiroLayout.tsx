import {
  LayoutDashboard, Receipt, DollarSign, BarChart3, Landmark, Plus,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'

export default function FinanceiroLayout() {
  const navigate = useNavigate()

  const NAV = [
    { to: '/financeiro',                icon: LayoutDashboard, label: 'Painel',           end: true },
    { to: '/financeiro/nova-solicitacao', icon: Plus,            label: 'Nova Solicitação', end: false, action: () => navigate(`/financeiro/contas-a-pagar?nova=${Date.now()}`), accent: true },
    { to: '/financeiro/contas-a-pagar', icon: Receipt,         label: 'Contas a Pagar',   end: false },
    { to: '/financeiro/cr',             icon: DollarSign,      label: 'Contas a Receber', end: false },
    { to: '/financeiro/tesouraria',     icon: Landmark,        label: 'Tesouraria',       end: false },
    { to: '/financeiro/relatorios',     icon: BarChart3,       label: 'Relatórios',       end: false },
  ]

  return (
    <ModuleLayout
      moduleKey="financeiro"
      moduleName="Financeiro"
      moduleEmoji="💰"
      accent="emerald"
      nav={NAV}
      bottomNavMaxItems={6}
      truncateBottomLabels
    />
  )
}
