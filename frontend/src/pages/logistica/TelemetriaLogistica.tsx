import { useMemo, lazy, Suspense } from 'react'
import { MapPin, AlertTriangle, Gauge } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import AlertasTelemetria from '../../components/logistica/telemetria/AlertasTelemetria'
import KmUtilizacao from '../../components/logistica/telemetria/KmUtilizacao'

const MapaAoVivo = lazy(() => import('../../components/logistica/telemetria/MapaAoVivo'))

const STEPS: FlowStep[] = [
  {
    key: 'mapa',
    label: 'Mapa ao Vivo',
    description: 'Acompanhe a posição em tempo real de todos os veículos da frota.',
    icon: MapPin,
    accent: {
      bg: 'hover:bg-orange-50',
      bgActive: 'bg-orange-50',
      text: 'text-orange-600',
      textActive: 'text-orange-800',
      border: 'border-orange-500',
      badge: 'bg-orange-100 text-orange-700',
    },
  },
  {
    key: 'alertas',
    label: 'Alertas',
    description: 'Eventos de telemetria como excesso de velocidade, frenagens bruscas e desvios de rota.',
    icon: AlertTriangle,
    accent: {
      bg: 'hover:bg-red-50',
      bgActive: 'bg-red-50',
      text: 'text-red-600',
      textActive: 'text-red-800',
      border: 'border-red-500',
      badge: 'bg-red-100 text-red-700',
    },
  },
  {
    key: 'km',
    label: 'Utilização',
    description: 'Quilometragem, horas ligadas, dias de uso e percentual de alocação por veículo.',
    icon: Gauge,
    accent: {
      bg: 'hover:bg-blue-50',
      bgActive: 'bg-blue-50',
      text: 'text-blue-600',
      textActive: 'text-blue-800',
      border: 'border-blue-500',
      badge: 'bg-blue-100 text-blue-700',
    },
  },
]

function getStepComponent(step: string) {
  switch (step) {
    case 'alertas':
      return <AlertasTelemetria />
    case 'km':
      return <KmUtilizacao />
    case 'mapa':
    default:
      return (
        <Suspense fallback={<div className="flex items-center justify-center py-20 text-sm text-slate-400">Carregando mapa...</div>}>
          <MapaAoVivo />
        </Suspense>
      )
  }
}

export default function TelemetriaLogistica() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeStep = useMemo(() => {
    const etapa = searchParams.get('etapa')
    return STEPS.some(step => step.key === etapa) ? etapa! : 'mapa'
  }, [searchParams])

  return (
    <ControladoriaFlow
      title="Telemetria"
      subtitle="Rastreamento em tempo real, alertas e indicadores de utilização da frota."
      steps={STEPS}
      activeStep={activeStep}
      onStepChange={(step) => setSearchParams({ etapa: step })}
    >
      {getStepComponent(activeStep)}
    </ControladoriaFlow>
  )
}
