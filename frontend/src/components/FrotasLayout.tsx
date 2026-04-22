import { LayoutDashboard, Truck, Wrench, Gauge, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'

export default function FrotasLayout() {
  const navigate = useNavigate()

  const NAV = [
    { to: '/frotas',            icon: LayoutDashboard, label: 'Painel',          end: true },
    {
      to: '/frotas/solicitacoes',
      icon: Plus,
      label: 'Nova Solicitação',
      end: false,
      accent: true,
      requisitanteAllowed: true,
      action: () => navigate(`/frotas/solicitacoes?nova=${Date.now()}`),
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
