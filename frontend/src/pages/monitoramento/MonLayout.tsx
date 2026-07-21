// Layout (shell + nav) do módulo Monitoramento (CFTV) — wrapper sobre o
// ModuleLayout padrão do TEG+. disableRequisitanteMode: todos com o módulo são
// "viewers" (não há fluxo de requisitante aqui).
import { Video, Bell, Settings } from 'lucide-react'
import ModuleLayout from '../../components/ModuleLayout'
import type { NavItem } from '../../components/ModuleLayout'

const NAV: NavItem[] = [
  { to: '/monitoramento', icon: Video, label: 'Câmeras', end: true },
  { to: '/monitoramento/eventos', icon: Bell, label: 'Eventos', end: false },
  { to: '/monitoramento/config', icon: Settings, label: 'Configurações', end: false, adminOnly: true },
]

export default function MonLayout() {
  return (
    <ModuleLayout
      moduleKey="monitoramento"
      moduleName="Monitoramento"
      moduleEmoji="🎥"
      accent="indigo"
      nav={NAV}
      moduleSubtitle="Câmeras e eventos (CFTV)"
      maxWidth="max-w-7xl"
      disableRequisitanteMode
    />
  )
}
