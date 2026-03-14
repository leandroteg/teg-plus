import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export interface FlowStep {
  key: string
  label: string
  description: string
  icon: LucideIcon
  accent: {
    bg: string
    bgActive: string
    text: string
    textActive: string
    border: string
    badge: string
  }
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

      <div className={`flex gap-1 p-1 pb-2 rounded-2xl border overflow-x-auto hide-scrollbar ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
      }`}>
        {steps.map((step, index) => {
          const isActive = step.key === activeStep
          const Icon = step.icon
          const accent = step.accent

          return (
            <button
              key={step.key}
              onClick={() => onStepChange(step.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? `${accent.bgActive} ${accent.textActive} ${accent.border} font-bold shadow-sm`
                  : isLight
                    ? `${accent.bg} ${accent.text} font-medium border-transparent hover:bg-white hover:shadow-sm`
                    : `${accent.bg} ${accent.text} font-medium border-transparent`
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {step.label}
              <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 flex items-center justify-center ${
                isActive
                  ? accent.badge
                  : isLight
                    ? 'bg-slate-200/80 text-slate-500'
                    : 'bg-white/[0.06] text-slate-500'
              }`}>
                {index + 1}
              </span>
            </button>
          )
        })}
      </div>

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
