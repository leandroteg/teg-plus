// pages/rh/DPFolha.tsx — DP > Folha de Pagamento
import { Calculator, SearchCheck, FileEdit, Lock, Send, CheckCircle2, Receipt } from 'lucide-react'
import DPFluxoPage from '../../components/rh/DPFluxoPage'
import type { RHTab } from '../../components/rh/RHTabRail'

const TABS: RHTab[] = [
  { key: 'apuracao',        label: 'Apuração',          icon: Calculator,  cor: 'blue' },
  { key: 'verificacao',     label: 'Verificação',       icon: SearchCheck, cor: 'sky' },
  { key: 'correcoes',       label: 'Correções',         icon: FileEdit,    cor: 'amber' },
  { key: 'fechamento',      label: 'Fechamento Folha',  icon: Lock,        cor: 'violet' },
  { key: 'envio_pagamento', label: 'Envio Pagamento',   icon: Send,        cor: 'teal' },
  { key: 'concluido',       label: 'Concluído',         icon: CheckCircle2, cor: 'emerald' },
]

export default function DPFolha() {
  return <DPFluxoPage titulo="Folha de Pagamento" subtitulo="Apuração, verificação, fechamento e envio" icon={Receipt} iconColor="text-blue-400" tabs={TABS} />
}
