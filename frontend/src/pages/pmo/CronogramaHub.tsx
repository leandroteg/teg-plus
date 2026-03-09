import { CalendarDays } from 'lucide-react'
import EGPPortfolioHub from './EGPPortfolioHub'

export default function CronogramaHub() {
  return (
    <EGPPortfolioHub
      screen="cronograma"
      title="Cronograma"
      icon={CalendarDays}
      accent="text-blue-500"
      description="Tarefas e prazos do projeto — selecione um portfólio"
    />
  )
}
