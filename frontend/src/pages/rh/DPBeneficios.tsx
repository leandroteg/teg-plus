// pages/rh/DPBeneficios.tsx — DP > Benefícios
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HeartPulse, UtensilsCrossed, Bus, Home, MoreHorizontal, Gift } from 'lucide-react'
import DPFluxoPage from '../../components/rh/DPFluxoPage'
import DPPlanoSaudePanel from '../../components/rh/DPPlanoSaudePanel'
import DPValePanel from '../../components/rh/DPValePanel'
import DPBeneficioUploadModal from '../../components/rh/DPBeneficioUploadModal'
import type { Beneficio } from '../../hooks/useBeneficioRelatorios'
import type { RHTab } from '../../components/rh/RHTabRail'

const TABS: RHTab[] = [
  { key: 'plano_saude', label: 'Plano de Saúde', icon: HeartPulse,       cor: 'emerald' },
  { key: 'alimentacao', label: 'Alimentação',    icon: UtensilsCrossed,  cor: 'amber' },
  { key: 'transporte',  label: 'Transporte',     icon: Bus,              cor: 'sky' },
  { key: 'moradia',     label: 'Moradia',        icon: Home,             cor: 'violet' },
  { key: 'outros',      label: 'Outros',         icon: MoreHorizontal,   cor: 'slate' },
]

export default function DPBeneficios() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [lancamento, setLancamento] = useState<Beneficio | null>(null)

  // Novo Registro › Lançamento Benefícios chega por ?lancamento=1 (&beneficio=vr).
  // Limpa o parâmetro ao abrir para que um segundo clique reabra o modal.
  const pedido = searchParams.get('lancamento')
  useEffect(() => {
    if (!pedido) return
    const b = searchParams.get('beneficio')
    setLancamento(b === 'vr' || b === 'vt' ? b : 'plano_saude')
    const p = new URLSearchParams(searchParams)
    p.delete('lancamento'); p.delete('beneficio')
    setSearchParams(p, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido])

  return (
    <>
      <DPFluxoPage titulo="Benefícios" subtitulo="Gestão dos benefícios dos colaboradores" icon={Gift} iconColor="text-amber-400" tabs={TABS}
        renderPanel={k =>
          k === 'plano_saude' ? <DPPlanoSaudePanel />
          : k === 'alimentacao' ? <DPValePanel beneficio="vr" icon={UtensilsCrossed} accent="amber" />
          : k === 'transporte' ? <DPValePanel beneficio="vt" icon={Bus} accent="sky" />
          : null} />
      {lancamento && <DPBeneficioUploadModal inicial={lancamento} onClose={() => setLancamento(null)} />}
    </>
  )
}
