import { LayoutGrid, FolderKanban, Layers, Wallet, Scale, Rocket, Users, Presentation } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem, NavGroup } from './ModuleLayout'
import { useAuth } from '../contexts/AuthContext'
import { PAINEIS } from '../pages/paineis/registry'
import type { Pilar } from '../pages/paineis/registry'

// Ordem dos pilares no menu lateral de Painéis.
const PILARES: { label: Pilar; icon: LucideIcon }[] = [
  { label: 'Governança',  icon: Scale },
  { label: 'Projetos',    icon: FolderKanban },
  { label: 'Suprimentos', icon: Layers },
  { label: 'Backoffice',  icon: Wallet },
  { label: 'RH',          icon: Users },
  { label: 'Expansão',    icon: Rocket },
]

// Hub "Painéis": menu lateral = Visão Geral + um grupo (accordion) por pilar,
// cada grupo listando os painéis daquele pilar. Tudo filtrado por permissão —
// admin vê todos; demais só os módulos liberados.
export default function PaineisLayout() {
  const { isAdmin, hasModule } = useAuth()
  const acessiveis = PAINEIS.filter(p => isAdmin || hasModule(p.key))

  const NAV: NavItem[] = [
    { to: '/paineis', icon: LayoutGrid, label: 'Visão Geral', end: true },
    { to: '/paineis/slideshow', icon: Presentation, label: 'Slide Show' },
  ]

  const navGroups: NavGroup[] = PILARES
    .map(pil => ({
      key: pil.label,
      label: pil.label,
      icon: pil.icon,
      items: acessiveis
        .filter(p => p.pilar === pil.label)
        .map(p => ({ to: `/paineis/${p.key}`, icon: p.Icon, label: p.label })),
    }))
    .filter(g => g.items.length > 0)

  return (
    <ModuleLayout
      moduleKey="paineis"
      moduleName="Painéis"
      moduleEmoji="📊"
      moduleSubtitle="Visão executiva"
      accent="indigo"
      nav={NAV}
      navGroups={navGroups}
      bottomNavMaxItems={5}
      truncateBottomLabels
    />
  )
}
