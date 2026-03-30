import { LayoutDashboard, Truck, Wrench, Gauge, Plus } from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/frotas',                   icon: LayoutDashboard, label: 'Painel',             end: true },
  { to: '/frotas/solicitacoes',      icon: Plus,            label: 'Nova Solicitação'              },
  { to: '/frotas/frota',             icon: Truck,           label: 'Frota & Máquinas'              },
  { to: '/frotas/manutencao',        icon: Wrench,          label: 'Manutenção'                    },
  { to: '/frotas/operacao',          icon: Gauge,           label: 'Operação & Controle'           },
]

export default function FrotasLayout() {
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
