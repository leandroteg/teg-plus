import { Check } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { ENTRADA_PIPELINE_STAGES, SAIDA_PIPELINE_STAGES } from '../../types/locacao'
import type { PipelineStage, StatusEntrada, StatusSaida } from '../../types/locacao'

interface Props<T extends string> {
  stages: PipelineStage<T>[]
  currentStatus: T
}

export default function LocFluxoTimeline<T extends string>({ stages, currentStatus }: Props<T>) {
  const { isDark } = useTheme()
  const currentIndex = stages.findIndex(s => s.key === currentStatus)

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {stages.map((stage, idx) => {
        const isCompleted = idx < currentIndex
        const isCurrent = idx === currentIndex

        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <div
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 transition-all',
                  isCompleted
                    ? 'bg-indigo-600 border-indigo-600'
                    : isCurrent
                    ? 'bg-white border-indigo-600'
                    : isDark
                    ? 'bg-white/5 border-white/20'
                    : 'bg-slate-50 border-slate-200',
                ].join(' ')}
              >
                {isCompleted ? (
                  <Check size={13} className="text-white" />
                ) : (
                  <span
                    className={[
                      'w-2.5 h-2.5 rounded-full',
                      isCurrent
                        ? 'bg-indigo-600'
                        : isDark
                        ? 'bg-white/20'
                        : 'bg-slate-300',
                    ].join(' ')}
                  />
                )}
              </div>
              <span
                className={[
                  'text-[9px] font-semibold text-center leading-tight px-0.5 truncate w-full',
                  isCompleted || isCurrent
                    ? isDark
                      ? 'text-indigo-300'
                      : 'text-indigo-700'
                    : isDark
                    ? 'text-slate-500'
                    : 'text-slate-400',
                ].join(' ')}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < stages.length - 1 && (
              <div
                className={[
                  'h-0.5 flex-1 mx-1 shrink-0',
                  isCompleted
                    ? 'bg-indigo-500'
                    : isDark
                    ? 'bg-white/10'
                    : 'bg-slate-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function EntradaTimeline({ status }: { status: StatusEntrada }) {
  return <LocFluxoTimeline stages={ENTRADA_PIPELINE_STAGES} currentStatus={status} />
}

export function SaidaTimeline({ status }: { status: StatusSaida }) {
  return <LocFluxoTimeline stages={SAIDA_PIPELINE_STAGES} currentStatus={status} />
}
