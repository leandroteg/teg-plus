import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { PAINEIS } from './registry'

// Landing do hub: launcher grande e claro (pensado p/ acesso executivo).
// Cada card abre o painel real do módulo embedado em /paineis/:moduleKey.
export default function PaineisOverview() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { isAdmin, hasModule } = useAuth()
  const acessiveis = PAINEIS.filter(p => isAdmin || hasModule(p.key))

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const card = isDark
    ? 'bg-[#0f172a] border-white/[0.06] hover:border-white/[0.14]'
    : 'bg-white border-slate-200 hover:border-slate-300'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-extrabold flex items-center gap-2.5 ${txt}`}>
          <span>📊</span> Painéis
        </h1>
        <p className={`text-sm mt-1 ${muted}`}>
          Escolha um módulo para abrir o painel completo
          {acessiveis.length > 0 && ` · ${acessiveis.length} ${acessiveis.length === 1 ? 'painel disponível' : 'painéis disponíveis'}`}.
        </p>
      </div>

      {/* Grid de cards grandes */}
      {acessiveis.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <p className={`text-sm ${muted}`}>Você ainda não tem módulos liberados com painel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {acessiveis.map(p => (
            <button
              key={p.key}
              onClick={() => navigate(`/paineis/${p.key}`)}
              className={`group text-left rounded-2xl border p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${card}`}
              style={{ borderTopWidth: 3, borderTopColor: p.accent }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                  style={{ backgroundColor: p.accent + (isDark ? '22' : '1f') }}
                >
                  {p.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-base font-bold leading-tight ${txt}`}>{p.label}</p>
                  <p className={`text-xs mt-1 ${muted}`}>{p.desc}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: p.accent }}>
                  Abrir painel <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
