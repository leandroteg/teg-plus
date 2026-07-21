import { LayoutDashboard, Gift, Fingerprint, Receipt, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'

export default function DPLayout() {
  const navigate = useNavigate()

  const NAV = [
    { to: '/rh/dp',            icon: LayoutDashboard, label: 'Painel',     end: true },
    {
      to: 'dp-novo-registro',
      icon: Plus,
      label: 'Novo Registro',
      end: false,
      accent: true,
      actionMenu: {
        title: 'Novo registro',
        items: [
          {
            icon: Receipt,
            label: 'Lançar folha de pagamento',
            description: 'Criar a apuração de uma nova competência de folha.',
            tone: 'blue' as const,
            action: () => navigate('/rh/dp/folha?nova=1'),
          },
        ],
      },
    },
    { to: '/rh/dp/beneficios', icon: Gift,            label: 'Benefícios' },
    { to: '/rh/dp/ponto',      icon: Fingerprint,     label: 'Ponto' },
    { to: '/rh/dp/folha',      icon: Receipt,         label: 'Folha' },
  ]

  return (
    <ModuleLayout
      moduleKey="rh"
      moduleName="DP"
      mobileModuleName="DP"
      moduleEmoji="🧮"
      accent="amber"
      nav={NAV}
      moduleSubtitle="Departamento Pessoal"
      backRoute="/rh"
    />
  )
}
