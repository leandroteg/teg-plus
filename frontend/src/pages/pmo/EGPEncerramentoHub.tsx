import EGPPortfolioHub from './EGPPortfolioHub'
import { CheckCircle2 } from 'lucide-react'

export default function EGPEncerramentoHub() {
  return (
    <EGPPortfolioHub
      screen="encerramento"
      title="Encerramento"
      icon={CheckCircle2}
      accent="text-teal-500"
      description="Status Report, Lições Aprendidas, Aceite e Desmobilização"
    />
  )
}
