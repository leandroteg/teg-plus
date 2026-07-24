import { LayoutDashboard, Truck, Wrench, Gauge, Plus, Car, CalendarPlus, ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'

export default function FrotasLayout() {
  const navigate = useNavigate()

  const NAV = [
    { to: '/frotas',            icon: LayoutDashboard, label: 'Painel',          end: true },
    {
      to: 'frotas-nova-solicitacao',
      icon: Plus,
      label: 'Nova Solicitação',
      end: false,
      accent: true,
      requisitanteAllowed: true,
      actionMenu: {
        title: 'Nova solicitação',
        items: [
          {
            icon: Car,
            label: 'Requisição de Frota',
            description: 'Solicitar veículo ou máquina para uma obra / centro de custo.',
            tone: 'sky' as const,
            action: () => navigate(`/frotas/solicitacoes?nova=${Date.now()}&tipo=emprestimo`),
          },
          {
            icon: Wrench,
            label: 'Solicitação de Manutenção',
            description: 'Reportar um problema ou agendar revisão de um ativo.',
            tone: 'rose' as const,
            action: () => navigate(`/frotas/solicitacoes?nova=${Date.now()}&tipo=manutencao`),
          },
          {
            icon: ClipboardList,
            label: 'Nova OS',
            description: 'Abrir uma ordem de serviço de manutenção direto no quadro.',
            tone: 'amber' as const,
            action: () => navigate(`/frotas/manutencao?tab=os&nova=${Date.now()}`),
          },
          {
            icon: CalendarPlus,
            label: 'Registro Alocação',
            description: 'Registrar diretamente a saída de um ativo para a obra.',
            tone: 'emerald' as const,
            action: () => navigate(`/frotas/operacao?novaAlocacao=1&t=${Date.now()}`),
          },
        ],
      },
    },
    { to: '/frotas/frota',      icon: Truck,           label: 'Frota & Máquinas' },
    { to: '/frotas/manutencao', icon: Wrench,          label: 'Manutenção'       },
    { to: '/frotas/operacao',   icon: Gauge,           label: 'Operação'         },
  ]

  return (
    <ModuleLayout
      moduleKey="frotas"
      moduleName="Frotas"
      moduleEmoji="🚗"
      accent="rose"
      nav={NAV}
      moduleSubtitle="Veículos & Máquinas"
    />
  )
}
