import { ClipboardCheck } from 'lucide-react'
import EGPPortfolioHub from './EGPPortfolioHub'

export default function TapHub() {
  return (
    <EGPPortfolioHub
      screen="tap"
      title="TAP"
      icon={ClipboardCheck}
      accent="text-indigo-500"
      description="Termo de Abertura do Projeto — selecione um portfólio"
    />
  )
}
