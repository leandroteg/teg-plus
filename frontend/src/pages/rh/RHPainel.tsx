// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHPainel.tsx — Dashboard do módulo RH
// ─────────────────────────────────────────────────────────────────────────────
import {
  Users, UserPlus, UserMinus, Briefcase, Building2, Cake,
  TrendingUp, TrendingDown, HardHat, FileText,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useRHStats } from '../../hooks/useRH'

export default function RHPainel() {
  const { isLightSidebar: isLight } = useTheme()
  const navigate = useNavigate()
  const { data: stats, isLoading } = useRHStats()

  const card = (bg: string, border: string) =>
    `rounded-2xl border p-4 ${isLight ? `bg-white ${border} shadow-sm` : `bg-white/[0.03] border-white/[0.06]`}`

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) return null

  const kpis = [
    { label: 'Ativos', value: stats.totalAtivos, icon: Users, color: 'text-emerald-500', bg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/15' },
    { label: 'CLT', value: stats.totalCLT, icon: Briefcase, color: 'text-blue-500', bg: isLight ? 'bg-blue-50' : 'bg-blue-500/15' },
    { label: 'PJ', value: stats.totalPJ, icon: FileText, color: 'text-orange-500', bg: isLight ? 'bg-orange-50' : 'bg-orange-500/15' },
    { label: 'Inativos', value: stats.totalInativos, icon: UserMinus, color: 'text-slate-400', bg: isLight ? 'bg-slate-50' : 'bg-slate-500/15' },
    { label: 'Admissões (mês)', value: stats.admissoesMes, icon: UserPlus, color: 'text-violet-500', bg: isLight ? 'bg-violet-50' : 'bg-violet-500/15' },
    { label: 'Desligamentos (mês)', value: stats.desligamentosMes, icon: TrendingDown, color: 'text-red-500', bg: isLight ? 'bg-red-50' : 'bg-red-500/15' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Users size={20} className="text-violet-400" />
          Painel RH
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Visão geral da gestão de colaboradores</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={card('', 'border-slate-200')}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.bg}`}>
                <k.icon size={15} className={k.color} />
              </div>
            </div>
            <p className={`text-2xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{k.value}</p>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Admissões pendentes alert */}
      {stats.admissoesPendentes > 0 && (
        <button onClick={() => navigate('/rh/admissao')}
          className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
            isLight
              ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
              : 'bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15'
          }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-amber-100' : 'bg-amber-500/20'}`}>
            <UserPlus size={18} className="text-amber-500" />
          </div>
          <div className="text-left flex-1">
            <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {stats.admissoesPendentes} admiss{stats.admissoesPendentes === 1 ? 'ão pendente' : 'ões pendentes'}
            </p>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Clique para gerenciar o pipeline de admissão</p>
          </div>
          <TrendingUp size={16} className="text-amber-500" />
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Por departamento */}
        <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <div className={`px-5 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <Building2 size={14} className="text-violet-400" /> Por Departamento
            </h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {stats.porDepartamento.slice(0, 8).map(d => (
              <div key={d.departamento} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{d.departamento}</p>
                  <div className={`h-1.5 rounded-full mt-1 ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                    <div className="h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.min(100, (d.total / stats.totalAtivos) * 100)}%` }} />
                  </div>
                </div>
                <span className={`text-xs font-bold min-w-[24px] text-right ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{d.total}</span>
              </div>
            ))}
            {stats.porDepartamento.length === 0 && (
              <p className={`text-xs text-center py-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum dado</p>
            )}
          </div>
        </div>

        {/* Por obra */}
        <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <div className={`px-5 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <HardHat size={14} className="text-orange-400" /> Por Obra
            </h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {stats.porObra.slice(0, 8).map(o => (
              <div key={o.obra} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{o.obra}</p>
                  <div className={`h-1.5 rounded-full mt-1 ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                    <div className="h-full rounded-full bg-orange-500"
                      style={{ width: `${Math.min(100, (o.total / stats.totalAtivos) * 100)}%` }} />
                  </div>
                </div>
                <span className={`text-xs font-bold min-w-[24px] text-right ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{o.total}</span>
              </div>
            ))}
            {stats.porObra.length === 0 && (
              <p className={`text-xs text-center py-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum dado</p>
            )}
          </div>
        </div>
      </div>

      {/* Aniversariantes */}
      {stats.aniversariantes.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <div className={`px-5 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <Cake size={14} className="text-pink-400" /> Aniversariantes do Mês
            </h2>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {stats.aniversariantes.map(c => {
              const dia = c.data_nascimento ? new Date(c.data_nascimento).getDate() : '?'
              return (
                <div key={c.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  isLight ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-pink-500/15 text-pink-300 border border-pink-500/25'
                }`}>
                  <span className="font-bold">{dia}</span>
                  <span>{c.nome?.split(' ')[0]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
