import { useNavigate } from 'react-router-dom'
import { Target, AlertTriangle, FileText, ChevronRight, Plus } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

interface Opcao {
  key: string
  label: string
  desc: string
  icon: typeof Target
  tone: string
  rota?: string
  ativo: boolean
}

const OPCOES: Opcao[] = [
  { key: 'checkin', label: 'Check-in de Meta',  desc: 'Lançar realizado vs. alvo de uma meta', icon: Target,        tone: 'emerald', rota: '/sgi/objetivos', ativo: true },
  { key: 'anomalia', label: 'Anomalia / Falha',  desc: 'Registrar desvio, falha ou ocorrência', icon: AlertTriangle, tone: 'amber',   rota: '/sgi/melhoria',  ativo: true },
  { key: 'documento', label: 'Documento',         desc: 'Criar documento (política, procedimento, IT…)', icon: FileText, tone: 'indigo', rota: '/sgi/padronizacao', ativo: true },
]

export default function SgiNovoRegistro() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'

  const tones: Record<string, string> = {
    emerald: isDark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50',
    amber:   isDark ? 'text-amber-400 bg-amber-500/10'     : 'text-amber-600 bg-amber-50',
    indigo:  isDark ? 'text-indigo-400 bg-indigo-500/10'   : 'text-indigo-600 bg-indigo-50',
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
          <Plus size={22} className="text-violet-500" /> Novo Registro
        </h1>
        <p className={`text-xs mt-0.5 ${muted}`}>O que você quer registrar?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPCOES.map(o => {
          const Icon = o.icon
          return (
            <button
              key={o.key}
              disabled={!o.ativo}
              onClick={() => o.rota && nav(o.rota)}
              className={`text-left rounded-2xl border p-5 transition-all ${
                isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
              } ${o.ativo ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 ${tones[o.tone]}`}>
                <Icon size={20} />
              </div>
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-bold ${txt}`}>{o.label}</p>
                {!o.ativo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-500">em breve</span>}
              </div>
              <p className={`text-xs mt-1 ${muted}`}>{o.desc}</p>
              {o.ativo && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 mt-3">
                  Continuar <ChevronRight size={13} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
