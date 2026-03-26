// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/CulturaHome.tsx — Home do sub-módulo Cultura
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'
import { Heart, ImagePlay, Megaphone, BarChart3, Lock } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'

export default function CulturaHome() {
  const { isLightSidebar: isLight } = useTheme()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const features = [
    {
      label: 'Mural de Recados',
      desc: 'Banners e campanhas na tela inicial',
      icon: ImagePlay,
      route: '/rh/cultura/mural',
      active: true,
      adminOnly: true,
      color: 'text-violet-500',
      bg: isLight ? 'bg-violet-50 border-violet-200' : 'bg-violet-500/10 border-violet-500/25',
    },
    {
      label: 'Comunicados',
      desc: 'Comunicados internos e avisos',
      icon: Megaphone,
      route: '',
      active: false,
      color: 'text-blue-500',
      bg: isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/25',
    },
    {
      label: 'Pesquisa de Clima',
      desc: 'Pesquisas de engajamento e satisfação',
      icon: BarChart3,
      route: '',
      active: false,
      color: 'text-emerald-500',
      bg: isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/25',
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Heart size={20} className="text-pink-400" />
          Cultura
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Engajamento, clima organizacional e endomarketing
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map(f => {
          const disabled = !f.active || (f.adminOnly && !isAdmin)
          return (
            <button
              key={f.label}
              onClick={() => !disabled && navigate(f.route)}
              disabled={disabled}
              className={`group relative text-left p-5 rounded-2xl border transition-all ${
                disabled
                  ? isLight ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-white/[0.02] border-white/[0.06] opacity-40 cursor-not-allowed'
                  : `${f.bg} hover:shadow-lg hover:scale-[1.02] cursor-pointer`
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                isLight ? 'bg-white shadow-sm' : 'bg-white/[0.08]'
              }`}>
                {f.active ? <f.icon size={22} className={f.color} /> : <Lock size={18} className="text-slate-400" />}
              </div>
              <h3 className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>{f.label}</h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{f.desc}</p>
              {!f.active && (
                <span className={`absolute top-4 right-4 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/[0.08] text-slate-500'
                }`}>Em breve</span>
              )}
              {f.adminOnly && f.active && (
                <span className={`absolute top-4 right-4 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  isLight ? 'bg-violet-100 text-violet-600' : 'bg-violet-500/20 text-violet-300'
                }`}>Admin</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
