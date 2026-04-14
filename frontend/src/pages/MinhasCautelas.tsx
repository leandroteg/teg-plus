import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, HandHelping, Package, Calendar, Building2, Clock,
  AlertTriangle, CheckCircle2, PackageOpen, Archive,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useMinhasCautelas } from '../hooks/useCautelas'
import { CAUTELA_PIPELINE_STAGES } from '../types/cautela'
import type { Cautela } from '../types/cautela'

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

export default function MinhasCautelas() {
  const { perfil } = useAuth()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const navigate = useNavigate()
  const { data: cautelas = [], isLoading } = useMinhasCautelas(perfil?.id)

  const ativas = useMemo(() => cautelas.filter(c => c.status !== 'encerrada'), [cautelas])
  const encerradas = useMemo(() => cautelas.filter(c => c.status === 'encerrada').slice(0, 10), [cautelas])

  const bg = isDark ? 'bg-[#0f172a]' : 'bg-slate-50'
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className={`text-lg font-extrabold ${txt}`}>Minhas Cautelas</h1>
            <p className={`text-xs ${txtMuted}`}>{ativas.length} ativa{ativas.length !== 1 ? 's' : ''} sob sua custódia</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : ativas.length === 0 && encerradas.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <HandHelping size={48} className="mb-3" />
            <p className="text-sm font-medium">Nenhuma cautela vinculada a você</p>
          </div>
        ) : (
          <>
            {/* Ativas */}
            {ativas.length > 0 && (
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                  Em aberto ({ativas.length})
                </p>
                <div className="space-y-2">
                  {ativas.map(c => <CautelaCard key={c.id} cautela={c} isDark={isDark} />)}
                </div>
              </div>
            )}

            {/* Encerradas */}
            {encerradas.length > 0 && (
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider mb-2 mt-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Encerradas recentes
                </p>
                <div className="space-y-2">
                  {encerradas.map(c => <CautelaCard key={c.id} cautela={c} isDark={isDark} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CautelaCard({ cautela, isDark }: { cautela: Cautela; isDark: boolean }) {
  const stage = CAUTELA_PIPELINE_STAGES.find(s => s.status === cautela.status)
  const isOverdue = cautela.data_devolucao_prevista && new Date(cautela.data_devolucao_prevista) < new Date() && cautela.status === 'em_aberto'
  const itemCount = cautela.itens?.length ?? 0

  return (
    <div className={`rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'} ${isOverdue ? (isDark ? 'border-red-500/30' : 'border-red-200') : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{cautela.numero || 'Cautela'}</p>
          {cautela.obra_nome && <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><Building2 size={11} /> {cautela.obra_nome}</p>}
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${stage?.badgeClass || 'bg-slate-100 text-slate-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${stage?.dotClass || 'bg-slate-400'}`} />
          {stage?.label || cautela.status}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <span className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Package size={10} /> {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
        <span className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Calendar size={10} /> {fmtDate(cautela.criado_em)}
        </span>
        {cautela.data_devolucao_prevista && (
          <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Clock size={10} /> Dev: {fmtDate(cautela.data_devolucao_prevista)}
            {isOverdue && <AlertTriangle size={9} />}
          </span>
        )}
      </div>
    </div>
  )
}
