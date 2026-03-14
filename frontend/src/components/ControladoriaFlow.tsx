import type { ReactNode } from 'react'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export interface FlowStep {
  key: string
  label: string
  description: string
}

interface ControladoriaFlowProps {
  title: string
  subtitle: string
  steps: FlowStep[]
  activeStep: string
  onStepChange: (step: string) => void
  children: ReactNode
  badge?: string
}

export default function ControladoriaFlow({
  title,
  subtitle,
  steps,
  activeStep,
  onStepChange,
  children,
  badge,
}: ControladoriaFlowProps) {
  const { isLightSidebar: isLight } = useTheme()
  const currentStep = steps.find(step => step.key === activeStep) ?? steps[0]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{title}</h1>
            {badge && (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25'
              }`}>
                {badge}
              </span>
            )}
          </div>
          <p className={`mt-1 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
        </div>
      </div>

      <section className={`rounded-3xl border p-4 sm:p-5 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => {
            const isActive = step.key === activeStep
            return (
              <button
                key={step.key}
                onClick={() => onStepChange(step.key)}
                className={`group flex min-w-[180px] flex-1 items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                  isActive
                    ? isLight
                      ? 'border-emerald-200 bg-emerald-50 shadow-sm'
                      : 'border-emerald-500/30 bg-emerald-500/10'
                    : isLight
                      ? 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                }`}
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : isLight
                      ? 'bg-white text-slate-500 border border-slate-200'
                      : 'bg-white/[0.06] text-slate-300 border border-white/[0.08]'
                }`}>
                  {isActive ? <CheckCircle2 size={14} /> : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-100'}`}>{step.label}</p>
                  <p className={`mt-1 text-[11px] leading-relaxed ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{step.description}</p>
                </div>
                <ChevronRight className={`mt-1 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                  isActive ? 'text-emerald-500' : isLight ? 'text-slate-300' : 'text-slate-600'
                }`} size={16} />
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className={`text-[10px] font-bold uppercase tracking-[0.24em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Etapa atual
          </p>
          <h2 className={`mt-1 text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{currentStep.label}</h2>
          <p className={`mt-1 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{currentStep.description}</p>
        </div>
        {children}
      </section>
    </div>
  )
}
