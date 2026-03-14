import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import PlanoOrcamentario from './PlanoOrcamentario'
import Orcamentos from './Orcamentos'
import ControleOrcamentario from './ControleOrcamentario'
import AlertasDesvio from './AlertasDesvio'

const STEPS: FlowStep[] = [
  { key: 'plano', label: 'Plano Orçamentário', description: 'Defina a base anual e a distribuição trimestral do orçamento.' },
  { key: 'budget-area', label: 'Budget por Área', description: 'Organize os budgets por obra, área e responsáveis.' },
  { key: 'acompanhamento', label: 'Acompanhamento', description: 'Compare orçado x realizado e entenda desvios rapidamente.' },
  { key: 'acoes', label: 'Ações', description: 'Transforme alertas e desvios em ações com prioridade clara.' },
]

function getStepComponent(step: string) {
  switch (step) {
    case 'plano':
      return <PlanoOrcamentario />
    case 'budget-area':
      return <Orcamentos />
    case 'acoes':
      return <AlertasDesvio />
    case 'acompanhamento':
    default:
      return <ControleOrcamentario />
  }
}

export default function ControleOrcamentarioHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeStep = useMemo(() => {
    const etapa = searchParams.get('etapa')
    return STEPS.some(step => step.key === etapa) ? etapa! : 'plano'
  }, [searchParams])

  return (
    <ControladoriaFlow
      title="Controle Orçamentário"
      subtitle="Fluxo completo do planejamento até o acompanhamento das ações corretivas."
      steps={STEPS}
      activeStep={activeStep}
      onStepChange={(step) => setSearchParams({ etapa: step })}
    >
      {getStepComponent(activeStep)}
    </ControladoriaFlow>
  )
}
