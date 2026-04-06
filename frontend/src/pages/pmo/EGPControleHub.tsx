import EGPPortfolioHub from './EGPPortfolioHub'
import { BarChart3 } from 'lucide-react'

export default function EGPControleHub() {
  return (
    <EGPPortfolioHub
      screen="controle"
      title="Controle"
      icon={BarChart3}
      accent="text-emerald-500"
      description="Medicoes, Eventos, Status Report e Indicadores"
    />
  )
}
