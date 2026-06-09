// pages/rh/DPBeneficios.tsx — DP > Benefícios
import { HeartPulse, UtensilsCrossed, Bus, Home, MoreHorizontal, Gift } from 'lucide-react'
import DPFluxoPage from '../../components/rh/DPFluxoPage'
import type { RHTab } from '../../components/rh/RHTabRail'

const TABS: RHTab[] = [
  { key: 'plano_saude', label: 'Plano de Saúde', icon: HeartPulse,       cor: 'emerald' },
  { key: 'alimentacao', label: 'Alimentação',    icon: UtensilsCrossed,  cor: 'amber' },
  { key: 'transporte',  label: 'Transporte',     icon: Bus,              cor: 'sky' },
  { key: 'moradia',     label: 'Moradia',        icon: Home,             cor: 'violet' },
  { key: 'outros',      label: 'Outros',         icon: MoreHorizontal,   cor: 'slate' },
]

export default function DPBeneficios() {
  return <DPFluxoPage titulo="Benefícios" subtitulo="Gestão dos benefícios dos colaboradores" icon={Gift} iconColor="text-amber-400" tabs={TABS} />
}
