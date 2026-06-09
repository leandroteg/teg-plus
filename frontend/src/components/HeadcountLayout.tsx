import { LayoutDashboard, UserPlus, Users, TrendingUp, UserMinus, Receipt, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'

export default function HeadcountLayout() {
  const navigate = useNavigate()

  const NAV = [
    { to: '/rh/headcount',               icon: LayoutDashboard, label: 'Painel',           end: true },
    {
      to: 'rh-nova-solicitacao',
      icon: Plus,
      label: 'Nova Solicitação',
      end: false,
      accent: true,
      actionMenu: {
        title: 'Nova solicitação',
        items: [
          {
            icon: UserPlus,
            label: 'Admissão',
            description: 'Solicitar a admissão de um novo colaborador.',
            tone: 'emerald' as const,
            action: () => navigate('/rh/headcount/admissao?nova=1'),
          },
          {
            icon: TrendingUp,
            label: 'Movimentação',
            description: 'Promoção, transferência, reajuste ou mudança de cargo/obra.',
            tone: 'sky' as const,
            action: () => navigate('/rh/headcount/movimentacoes'),
          },
          {
            icon: UserMinus,
            label: 'Desligamento',
            description: 'Iniciar o processo de desligamento de um colaborador.',
            tone: 'rose' as const,
            action: () => navigate('/rh/headcount/desligamento'),
          },
        ],
      },
    },
    { to: '/rh/headcount/admissao',      icon: UserPlus,        label: 'Admissão' },
    { to: '/rh/headcount/colaboradores', icon: Users,           label: 'Colaboradores' },
    { to: '/rh/headcount/desligamento',  icon: UserMinus,       label: 'Desligamento' },
  ]

  return (
    <ModuleLayout
      moduleKey="rh"
      moduleName="Headcount"
      mobileModuleName="Headcount"
      moduleEmoji="👥"
      accent="violet"
      nav={NAV}
      moduleSubtitle="Admissão, Gestão & Movimentações"
      backRoute="/rh"
    />
  )
}
