import { Users } from 'lucide-react'
import EGPPortfolioHub from './EGPPortfolioHub'

export default function HistogramaHub() {
  return (
    <EGPPortfolioHub
      screen="histograma"
      title="Histograma"
      icon={Users}
      accent="text-amber-500"
      description="Recursos humanos e maquinário — selecione um portfólio"
    />
  )
}
