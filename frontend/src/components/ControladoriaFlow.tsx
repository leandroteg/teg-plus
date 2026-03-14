import type { ReactNode } from 'react'
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

      <section className={`rounded-[28px] border p-2 sm:p-3 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => {
            const isActive = step.key === activeStep

            return (
              <button
                key={step.key}
                onClick={() => onStepChange(step.key)}
                className={`flex min-w-[180px] flex-1 items-center justify-between gap-3 rounded-[22px] border px-5 py-4 text-left transition-all ${
                  isActive
                    ? isLight
                      ? 'border-slate-300 bg-slate-50 shadow-sm'
                      : 'border-white/[0.14] bg-white/[0.06]'
                    : isLight
                      ? 'border-transparent bg-white text-slate-500 hover:bg-slate-50'
                      : 'border-transparent bg-transparent text-slate-400 hover:bg-white/[0.03]'
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${
                    isActive
                      ? isLight ? 'text-slate-800' : 'text-white'
                      : isLight ? 'text-slate-500' : 'text-slate-300'
                  }`}>
                    {step.label}
                  </p>
                </div>

                <div className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold ${
                  isActive
                    ? isLight
                      ? 'bg-white text-slate-500 border border-slate-200'
                      : 'bg-white/[0.08] text-slate-200 border border-white/[0.1]'
                    : isLight
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-white/[0.06] text-slate-400'
                }`}>
                  {index + 1}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className={`text-[10px] font-bold uppercase tracking-[0.24em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Subaba atual
          </p>
          <h2 className={`mt-1 text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{currentStep.label}</h2>
          <p className={`mt-1 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{currentStep.description}</p>
        </div>
        {children}
      </section>
    </div>
  )
}
