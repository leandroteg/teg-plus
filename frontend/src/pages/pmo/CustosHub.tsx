import { DollarSign } from 'lucide-react'
import EGPPortfolioHub from './EGPPortfolioHub'

export default function CustosHub() {
  return (
    <EGPPortfolioHub
      screen="custos"
      title="Controle de Custos"
      icon={DollarSign}
      accent="text-emerald-500"
      description="Orçamento, custos reais e margens — selecione um portfólio"
    />
  )
}
