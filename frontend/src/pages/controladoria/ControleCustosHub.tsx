import { useMemo } from 'react'
import { Activity, BarChart3, ChartColumnIncreasing, Siren, FileBarChart } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import KPIs from './KPIs'
import PainelIndicadores from './PainelIndicadores'
import PainelIndicadoresVisual from './PainelIndicadoresVisual'
import DRE from './DRE'
import AlertasDesvio from './AlertasDesvio'

const STEPS: FlowStep[] = [
  {
    key: 'definicao-indicadores',
    label: 'Definição de Indicadores',
    description: 'Ajuste os indicadores que traduzem custo, eficiência e desvio.',
    icon: Activity,
    accent: { bg: 'hover:bg-slate-50', bgActive: 'bg-slate-100', text: 'text-slate-600', textActive: 'text-slate-800', border: 'border-slate-400', badge: 'bg-slate-200 text-slate-700' },
  },
  {
    key: 'painel-indicadores',
    label: 'Painel de Indicadores',
    description: 'Acompanhe os indicadores consolidados no mesmo padrão executivo dos demais módulos.',
    icon: BarChart3,
    accent: { bg: 'hover:bg-violet-50', bgActive: 'bg-violet-50', text: 'text-violet-600', textActive: 'text-violet-800', border: 'border-violet-500', badge: 'bg-violet-100 text-violet-700' },
  },
  {
    key: 'follow-up',
    label: 'Follow-up Indicadores',
    description: 'Acompanhamento visual mensal dos indicadores de performance (Abr-Jun 2026).',
    icon: FileBarChart,
    accent: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  },
  {
    key: 'evolucao-despesas',
    label: 'Evolução das Despesas',
    description: 'Leia tendência, composição e comportamento das despesas ao longo do tempo.',
    icon: ChartColumnIncreasing,
    accent: { bg: 'hover:bg-blue-50', bgActive: 'bg-blue-50', text: 'text-blue-600', textActive: 'text-blue-800', border: 'border-blue-500', badge: 'bg-blue-100 text-blue-700' },
  },
  {
    key: 'acoes',
    label: 'Ações',
    description: 'Priorize o que precisa ser atacado primeiro com base em risco e impacto financeiro.',
    icon: Siren,
    accent: { bg: 'hover:bg-amber-50', bgActive: 'bg-amber-50', text: 'text-amber-600', textActive: 'text-amber-800', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700' },
  },
]

function getStepComponent(step: string) {
  switch (step) {
    case 'definicao-indicadores':
      return <KPIs />
    case 'follow-up':
      return <PainelIndicadoresVisual />
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
