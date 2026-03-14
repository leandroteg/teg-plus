import { useMemo } from 'react'
import { BriefcaseBusiness, ClipboardList, ScanSearch, Siren } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import PlanoOrcamentario from './PlanoOrcamentario'
import Orcamentos from './Orcamentos'
import ControleOrcamentario from './ControleOrcamentario'
import AlertasDesvio from './AlertasDesvio'

const STEPS: FlowStep[] = [
  {
    key: 'plano',
    label: 'Plano Orçamentário',
    description: 'Defina a base anual e a distribuição trimestral do orçamento.',
    icon: ClipboardList,
    accent: { bg: 'hover:bg-slate-50', bgActive: 'bg-slate-100', text: 'text-slate-600', textActive: 'text-slate-800', border: 'border-slate-400', badge: 'bg-slate-200 text-slate-700' },
  },
  {
    key: 'budget-area',
    label: 'Budget por Área',
    description: 'Organize os budgets por obra, área e responsáveis.',
    icon: BriefcaseBusiness,
    accent: { bg: 'hover:bg-violet-50', bgActive: 'bg-violet-50', text: 'text-violet-600', textActive: 'text-violet-800', border: 'border-violet-500', badge: 'bg-violet-100 text-violet-700' },
  },
  {
    key: 'acompanhamento',
    label: 'Acompanhamento',
    description: 'Compare orçado x realizado e entenda desvios rapidamente.',
    icon: ScanSearch,
    accent: { bg: 'hover:bg-blue-50', bgActive: 'bg-blue-50', text: 'text-blue-600', textActive: 'text-blue-800', border: 'border-blue-500', badge: 'bg-blue-100 text-blue-700' },
  },
  {
    key: 'acoes',
    label: 'Ações',
    description: 'Transforme alertas e desvios em ações com prioridade clara.',
    icon: Siren,
    accent: { bg: 'hover:bg-amber-50', bgActive: 'bg-amber-50', text: 'text-amber-600', textActive: 'text-amber-800', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700' },
  },
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
