import {
  ClipboardList, FileInput, FileOutput,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/fiscal',             icon: ClipboardList, label: 'Histórico NF',     end: true  },
  { to: '/fiscal/solicitacao', icon: FileInput,     label: 'Solicitação NF',   end: false },
  { to: '/fiscal/emissao',     icon: FileOutput,    label: 'Emissão NF',       end: false },
]

export default function FiscalLayout() {
  return (
    <ModuleLayout
      moduleKey="fiscal"
      moduleName="Fiscal"
      moduleEmoji="🧾"
      accent="amber"
      nav={NAV}
    />
  )
}
