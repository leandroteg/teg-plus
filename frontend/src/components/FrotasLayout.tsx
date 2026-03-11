import {
  LayoutDashboard, Car, Wrench, ClipboardCheck,
  Fuel, Radio,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/frotas',                 icon: LayoutDashboard, label: 'Painel',            end: true },
  { to: '/frotas/veiculos',        icon: Car,             label: 'Veículos'                     },
  { to: '/frotas/ordens',          icon: Wrench,          label: 'Ordens de Serviço'            },
  { to: '/frotas/checklists',      icon: ClipboardCheck,  label: 'Checklists'                   },
  { to: '/frotas/abastecimentos',  icon: Fuel,            label: 'Abastecimentos'               },
  { to: '/frotas/telemetria',      icon: Radio,           label: 'Telemetria'                   },
]

export default function FrotasLayout() {
  return (
    <ModuleLayout
      moduleKey="frotas"
      moduleName="Frotas"
      moduleEmoji="🚗"
      accent="rose"
      nav={NAV}
      moduleSubtitle="Manutenção & Uso"
    />
  )
}
