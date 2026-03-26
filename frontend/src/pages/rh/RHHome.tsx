// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHHome.tsx — Hub de sub-módulos do RH
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'
import {
  Users, UserSearch, Target, Heart, Calculator,
  ChevronRight, Lock, type LucideIcon,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

interface SubModule {
  key: string
  label: string
  desc: string
  icon: LucideIcon
  route: string
  active: boolean
  color: string
  bgLight: string
  bgDark: string
}

const SUB_MODULES: SubModule[] = [
  {
    key: 'headcount',
    label: 'Headcount',
    desc: 'Admissão, gestão de colaboradores, movimentações e desligamento',
    icon: Users,
    route: '/rh/headcount',
    active: true,
    color: 'text-violet-500',
    bgLight: 'bg-violet-50 border-violet-200',
    bgDark: 'bg-violet-500/10 border-violet-500/25',
  },
  {
    key: 'rs',
    label: 'R&S',
    desc: 'Recrutamento e seleção de talentos',
    icon: UserSearch,
    route: '/rh/rs',
    active: false,
    color: 'text-blue-500',
    bgLight: 'bg-blue-50 border-blue-200',
    bgDark: 'bg-blue-500/10 border-blue-500/25',
  },
  {
    key: 'performance',
    label: 'Performance',
    desc: 'Avaliações de desempenho, metas e feedbacks',
    icon: Target,
    route: '/rh/performance',
    active: false,
    color: 'text-emerald-500',
    bgLight: 'bg-emerald-50 border-emerald-200',
    bgDark: 'bg-emerald-500/10 border-emerald-500/25',
  },
  {
    key: 'cultura',
    label: 'Cultura',
    desc: 'Engajamento, clima organizacional e endomarketing',
    icon: Heart,
    route: '/rh/cultura',
    active: false,
    color: 'text-pink-500',
    bgLight: 'bg-pink-50 border-pink-200',
    bgDark: 'bg-pink-500/10 border-pink-500/25',
  },
  {
    key: 'dp',
    label: 'DP',
    desc: 'Folha de pagamento, ponto, benefícios e obrigações',
    icon: Calculator,
    route: '/rh/dp',
    active: false,
    color: 'text-amber-500',
    bgLight: 'bg-amber-50 border-amber-200',
    bgDark: 'bg-amber-500/10 border-amber-500/25',
  },
]

export default function RHHome() {
  const { isLightSidebar: isLight } = useTheme()
  const navigate = useNavigate()

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Users size={22} className="text-violet-400" />
          Recursos Humanos
        </h1>
        <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Selecione o sub-módulo para começar
        </p>
      </div>

      {/* Sub-módulos grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUB_MODULES.map(mod => (
          <button
            key={mod.key}
            onClick={() => mod.active && navigate(mod.route)}
            disabled={!mod.active}
            className={`group relative text-left p-5 rounded-2xl border transition-all ${
              mod.active
                ? isLight
                  ? `${mod.bgLight} hover:shadow-lg hover:scale-[1.02] cursor-pointer`
                  : `${mod.bgDark} hover:bg-opacity-20 cursor-pointer`
                : isLight
                  ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                  : 'bg-white/[0.02] border-white/[0.06] opacity-40 cursor-not-allowed'
            }`}
          >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${
              mod.active
                ? isLight ? 'bg-white shadow-sm' : 'bg-white/[0.08]'
                : isLight ? 'bg-slate-100' : 'bg-white/[0.04]'
            }`}>
              {mod.active ? (
                <mod.icon size={22} className={mod.color} />
              ) : (
                <Lock size={18} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
              )}
            </div>

            {/* Text */}
            <h3 className={`text-base font-bold mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {mod.label}
            </h3>
            <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {mod.desc}
            </p>

            {/* Arrow or badge */}
            {mod.active ? (
              <ChevronRight size={16} className={`absolute top-5 right-5 ${
                isLight ? 'text-slate-300 group-hover:text-violet-500' : 'text-slate-600 group-hover:text-violet-400'
              } transition-colors`} />
            ) : (
              <span className={`absolute top-5 right-5 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/[0.08] text-slate-500'
              }`}>
                Em breve
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
