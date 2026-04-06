import EGPPortfolioHub from './EGPPortfolioHub'
import { Rocket } from 'lucide-react'

export default function EGPIniciacaoHub() {
  return (
    <EGPPortfolioHub
      screen="iniciacao"
      title="Iniciacao"
      icon={Rocket}
      accent="text-amber-500"
      description="TAP, Stakeholders e Comunicacao"
    />
  )
}
