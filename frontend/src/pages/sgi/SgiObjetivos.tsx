import { Target, Construction } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function SgiObjetivos() {
  const { isDark } = useTheme()
  const card = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
          <Target size={22} className="text-emerald-500" /> Objetivos e Metas
        </h1>
        <p className={`text-xs mt-0.5 ${muted}`}>Metas Anuais · Trimestrais · Check-in Mensal</p>
      </div>
      <div className={`rounded-2xl border shadow-sm p-12 flex flex-col items-center justify-center text-center gap-2 ${card}`}>
        <Construction size={40} className="text-emerald-500/70" />
        <p className={`text-sm font-semibold ${txt}`}>Em construção</p>
        <p className={`text-xs ${muted}`}>Fase 3 do módulo SGI — desdobramento de metas com farol e gatilho de ação.</p>
      </div>
    </div>
  )
}
