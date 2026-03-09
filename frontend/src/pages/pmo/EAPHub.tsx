import { GitBranch } from 'lucide-react'
import EGPPortfolioHub from './EGPPortfolioHub'

export default function EAPHub() {
  return (
    <EGPPortfolioHub
      screen="eap"
      title="EAP"
      icon={GitBranch}
      accent="text-violet-500"
      description="Estrutura Analítica do Projeto — selecione um portfólio"
    />
  )
}
