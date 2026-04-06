import EGPPortfolioHub from './EGPPortfolioHub'
import { Zap } from 'lucide-react'

export default function EGPExecucaoHub() {
  return (
    <EGPPortfolioHub
      screen="execucao"
      title="Execucao"
      icon={Zap}
      accent="text-violet-500"
      description="Cronograma, Histograma, Custos, Riscos e Plano de Acao"
    />
  )
}
