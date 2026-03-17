import { Lightbulb, Sparkles } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function CenariosHub() {
  const { isLightSidebar: isLight } = useTheme()

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Cenários</h1>
        <p className={`mt-1 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Frente reservada para simulações, sensitividade e reforecast.
        </p>
      </div>

      <section className={`rounded-3xl border p-6 sm:p-8 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="max-w-2xl">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
            isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/10 text-amber-300'
          }`}>
            <Lightbulb size={24} />
          </div>
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Em breve</h2>
          <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Aqui entraremos com cenários base, otimista e estressado, além de impactos em margem, caixa e orçamento.
          </p>
          <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.04] text-slate-300'
          }`}>
            <Sparkles size={14} />
            Base pronta para forecast e simulação
          </div>
        </div>
      </section>
    </div>
  )
}
