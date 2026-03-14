import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import KPIs from './KPIs'
import PainelIndicadores from './PainelIndicadores'
import DRE from './DRE'
import AlertasDesvio from './AlertasDesvio'

const STEPS: FlowStep[] = [
  { key: 'definicao-indicadores', label: 'Definição de Indicadores', description: 'Ajuste os indicadores que traduzem custo, eficiência e desvio.' },
  { key: 'painel-indicadores', label: 'Painel de Indicadores', description: 'Acompanhe os indicadores consolidados no mesmo padrão executivo dos demais módulos.' },
  { key: 'evolucao-despesas', label: 'Evolução das Despesas', description: 'Leia tendência, composição e comportamento das despesas ao longo do tempo.' },
  { key: 'acoes', label: 'Ações', description: 'Priorize o que precisa ser atacado primeiro com base em risco e impacto financeiro.' },
]

function getStepComponent(step: string) {
  switch (step) {
    case 'definicao-indicadores':
      return <KPIs />
    case 'evolucao-despesas':
      return <DRE />
    case 'acoes':
      return <AlertasDesvio />
    case 'painel-indicadores':
    default:
      return <PainelIndicadores />
  }
}

export default function ControleCustosHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeStep = useMemo(() => {
    const etapa = searchParams.get('etapa')
    return STEPS.some(step => step.key === etapa) ? etapa! : 'definicao-indicadores'
  }, [searchParams])

  return (
    <ControladoriaFlow
      title="Controle de Custos"
      subtitle="Indicadores, leitura executiva e atuação sobre a evolução das despesas."
      steps={STEPS}
      activeStep={activeStep}
      onStepChange={(step) => setSearchParams({ etapa: step })}
    >
      {getStepComponent(activeStep)}
    </ControladoriaFlow>
  )
}
