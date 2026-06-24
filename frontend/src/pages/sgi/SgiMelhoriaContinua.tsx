import { RefreshCcw, Construction } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

const ETAPAS = ['Pendente', 'Análise de Causa', 'Plano de Ação', 'Execução', 'Verificação e Revisão', 'Encerrado']

export default function SgiMelhoriaContinua() {
  const { isDark } = useTheme()
  const card = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
          <RefreshCcw size={22} className="text-amber-500" /> Melhoria Contínua
        </h1>
        <p className={`text-xs mt-0.5 ${muted}`}>Não conformidades e ações corretivas (PDCA)</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ETAPAS.map((e, i) => (
          <span key={e} className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
            {i + 1}. {e}
          </span>
        ))}
      </div>
      <div className={`rounded-2xl border shadow-sm p-12 flex flex-col items-center justify-center text-center gap-2 ${card}`}>
        <Construction size={40} className="text-amber-500/70" />
        <p className={`text-sm font-semibold ${txt}`}>Em construção</p>
        <p className={`text-xs ${muted}`}>Fase 2 do módulo SGI — kanban PDCA + backbone único de ações com SLA.</p>
      </div>
    </div>
  )
}
