import { BarChart3 } from 'lucide-react'
import EGPPortfolioHub from './EGPPortfolioHub'

export default function MedicoesHub() {
  return (
    <EGPPortfolioHub
      screen="medicoes"
      title="Medições"
      icon={BarChart3}
      accent="text-emerald-500"
      description="Medições contratuais e faturamento — selecione um portfólio"
    />
  )
}
