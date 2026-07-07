import {
  LayoutDashboard, Receipt, DollarSign, Landmark, Plus, Calendar,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'

export default function FinanceiroLayout() {
  const navigate = useNavigate()

  const NAV = [
    { to: '/financeiro',                      icon: LayoutDashboard, label: 'Painel',           end: true },
    {
      to: '/financeiro',
      icon: Plus,
      label: 'Nova Solicitação',
      end: false,
      accent: true,
      requisitanteAllowed: true,
      actionMenu: {
        title: 'Nova solicitação',
        items: [
          {
            icon: Receipt,
            label: 'Pagamento Extraordinário',
            description: 'Solicitação manual urgente com entrada direta em Confirmados.',
            tone: 'amber',
            action: () => navigate('/financeiro/contas-a-pagar?nova=extraordinario'),
          },
          {
            icon: Calendar,
            label: 'Previsão de Pagamento',
            description: 'Planejamento de despesas futuras com recorrência opcional.',
            tone: 'emerald',
            action: () => navigate('/financeiro/contas-a-pagar?nova=previsao'),
          },
        ],
      },
    },
    { to: '/financeiro/contas-a-pagar',       icon: Receipt,         label: 'Contas a Pagar',   end: false },
    { to: '/financeiro/cr',                   icon: DollarSign,      label: 'Contas a Receber', end: false },
    { to: '/financeiro/tesouraria',           icon: Landmark,        label: 'Tesouraria',       end: false },
    // Relatórios saiu do menu — as telas (DRE/Fluxo/CC/Aging) vivem no seletor do Painel
  ]

  return (
    <ModuleLayout
      moduleKey="financeiro"
      moduleName="Financeiro"
      moduleEmoji="💰"
      accent="emerald"
      nav={NAV}
      bottomNavMaxItems={7}
      truncateBottomLabels
    />
  )
}
