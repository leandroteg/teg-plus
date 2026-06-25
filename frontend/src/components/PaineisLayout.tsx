import { LayoutGrid } from 'lucide-react'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'
import { useAuth } from '../contexts/AuthContext'
import { PAINEIS } from '../pages/paineis/registry'

// Hub "Painéis": reúne os painéis de todos os módulos. A navegação é montada
// a partir do registro (registry.tsx), filtrada pela permissão do usuário —
// admin vê todos; demais só os módulos liberados.
export default function PaineisLayout() {
  const { isAdmin, hasModule } = useAuth()
  const acessiveis = PAINEIS.filter(p => isAdmin || hasModule(p.key))

  const NAV: NavItem[] = [
    { to: '/paineis', icon: LayoutGrid, label: 'Visão Geral', end: true },
    ...acessiveis.map(p => ({ to: `/paineis/${p.key}`, icon: p.Icon, label: p.label })),
  ]

  return (
    <ModuleLayout
      moduleKey="paineis"
      moduleName="Painéis"
      moduleEmoji="📊"
      moduleSubtitle="Visão executiva"
      accent="indigo"
      nav={NAV}
      bottomNavMaxItems={5}
      truncateBottomLabels
    />
  )
}
