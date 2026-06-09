// pages/rh/DPPonto.tsx — DP > Ponto
import { Clock, FileEdit, Timer, FileText, ShieldCheck, CheckCircle2, Fingerprint } from 'lucide-react'
import DPFluxoPage from '../../components/rh/DPFluxoPage'
import type { RHTab } from '../../components/rh/RHTabRail'

const TABS: RHTab[] = [
  { key: 'registros',     label: 'Registros Ponto', icon: Clock,        cor: 'blue' },
  { key: 'retificacoes',  label: 'Retificações',    icon: FileEdit,     cor: 'amber' },
  { key: 'horas_extras',  label: 'Horas Extras',    icon: Timer,        cor: 'orange' },
  { key: 'atestados',     label: 'Atestados',       icon: FileText,     cor: 'rose' },
  { key: 'aprovacao',     label: 'Aprovação',       icon: ShieldCheck,  cor: 'violet' },
  { key: 'consolidacao',  label: 'Consolidação',    icon: CheckCircle2, cor: 'emerald' },
]

export default function DPPonto() {
  return <DPFluxoPage titulo="Ponto" subtitulo="Registros, retificações, horas extras e consolidação" icon={Fingerprint} iconColor="text-blue-400" tabs={TABS} />
}
