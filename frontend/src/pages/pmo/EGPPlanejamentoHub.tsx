import EGPPortfolioHub from './EGPPortfolioHub'
import { Compass } from 'lucide-react'

export default function EGPPlanejamentoHub() {
  return (
    <EGPPortfolioHub
      screen="planejamento"
      title="Planejamento"
      icon={Compass}
      accent="text-blue-500"
      description="EAP, Cronograma, Histograma, Orçamento e Riscos"
    />
  )
}
