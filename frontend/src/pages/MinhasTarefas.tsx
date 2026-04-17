import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, CheckSquare, Zap, ChevronRight, ShoppingCart, Wallet, Building2,
  Package, FileText, Receipt, Truck, Clock, AlertCircle, Filter,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useMinhasTarefas, type Tarefa, type ModuloTarefa } from '../hooks/useMinhasTarefas'

// ── Config ──────────────────────────────────────────────────────────────────────

const MODULO_ICON: Record<ModuloTarefa, typeof ShoppingCart> = {
  compras:    ShoppingCart,
  financeiro: Wallet,
  locacao:    Building2,
  estoque:    Package,
  contratos:  FileText,
  despesas:   Receipt,
  transporte: Truck,
}

const MODULO_COLOR: Record<ModuloTarefa, { dot: string; text: string; bg: string; bgDark: string; textDark: string }> = {
  compras:    { dot: 'bg-indigo-500', text: 'text-indigo-600', bg: 'bg-indigo-50',  textDark: 'text-indigo-300', bgDark: 'bg-indigo-500/10' },
  financeiro: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', textDark: 'text-emerald-300', bgDark: 'bg-emerald-500/10' },
  locacao:    { dot: 'bg-blue-500',    text: 'text-blue-600',    bg: 'bg-blue-50',    textDark: 'text-blue-300',    bgDark: 'bg-blue-500/10' },
  estoque:    { dot: 'bg-amber-500',   text: 'text-amber-600',   bg: 'bg-amber-50',   textDark: 'text-amber-300',   bgDark: 'bg-amber-500/10' },
  contratos:  { dot: 'bg-violet-500',  text: 'text-violet-600',  bg: 'bg-violet-50',  textDark: 'text-violet-300',  bgDark: 'bg-violet-500/10' },
  despesas:   { dot: 'bg-rose-500',    text: 'text-rose-600',    bg: 'bg-rose-50',    textDark: 'text-rose-300',    bgDark: 'bg-rose-500/10' },
  transporte: { dot: 'bg-cyan-500',    text: 'text-cyan-600',    bg: 'bg-cyan-50',    textDark: 'text-cyan-300',    bgDark: 'bg-cyan-500/10' },
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const dias = Math.floor(hrs / 24)
  if (dias < 30) return `${dias}d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function MinhasTarefas() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const navigate = useNavigate()
  const { data: tarefas = [], isLoading } = useMinhasTarefas()

  const [filtroModulo, setFiltroModulo] = useState<ModuloTarefa | 'todos'>('todos')

  const bg      = isDark ? 'bg-[#0f172a]' : 'bg-slate-50'
  const cardBg  = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt     = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  // Stats by module
  const stats = useMemo(() => {
    const m: Partial<Record<ModuloTarefa, number>> = {}
    tarefas.forEach(t => { m[t.modulo] = (m[t.modulo] || 0) + 1 })
    return m
  }, [tarefas])

  const alta = useMemo(() => tarefas.filter(t => t.prioridade === 'alta').length, [tarefas])

  const filtered = useMemo(() => {
    if (filtroModulo === 'todos') return tarefas
    return tarefas.filter(t => t.modulo === filtroModulo)
  }, [tarefas, filtroModulo])

  const modulosAtivos = useMemo(
    () => (Object.keys(stats) as ModuloTarefa[]).sort(),
    [stats],
  )

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className={`text-lg font-extrabold ${txt}`}>Minhas Tarefas</h1>
            <p className={`text-xs ${txtMuted}`}>
              {tarefas.length} pendente{tarefas.length !== 1 ? 's' : ''}
              {alta > 0 && <span className="text-red-500 font-bold"> • {alta} urgente{alta !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>

        {/* Stats grid by module */}
        {tarefas.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {modulosAtivos.map(mod => {
              const Icon = MODULO_ICON[mod]
              const clr = MODULO_COLOR[mod]
              const active = filtroModulo === mod
              return (
                <button
                  key={mod}
                  onClick={() => setFiltroModulo(active ? 'todos' : mod)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    active
                      ? isDark
                        ? `${clr.bgDark} border-white/[0.12]`
                        : `${clr.bg} border-slate-300 shadow-sm`
                      : cardBg
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon size={14} className={isDark ? clr.textDark : clr.text} strokeWidth={2.2} />
                    <span className={`text-xs font-extrabold ${txt}`}>{stats[mod]}</span>
                  </div>
                  <p className={`text-[10px] font-semibold capitalize ${isDark ? clr.textDark : clr.text}`}>
                    {mod}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {/* Filter chip (if active) */}
        {filtroModulo !== 'todos' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltroModulo('todos')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Filter size={10} />
              Filtrado: <span className="capitalize">{filtroModulo}</span>
              <span className="opacity-60 ml-1">×</span>
            </button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tarefas.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <CheckSquare size={48} className="mb-3" />
            <p className="text-sm font-medium">Nenhuma tarefa pendente</p>
            <p className="text-xs mt-1 opacity-70">Aproveite para respirar ✨</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <TarefaCard key={t.id} tarefa={t} isDark={isDark} onClick={() => navigate(t.link)} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────────

function TarefaCard({ tarefa: t, isDark, onClick }: { tarefa: Tarefa; isDark: boolean; onClick: () => void }) {
  const Icon = MODULO_ICON[t.modulo]
  const clr  = MODULO_COLOR[t.modulo]
  const isPriority = t.prioridade === 'alta'

  const cardBg = isDark
    ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
    : 'bg-white border-slate-200 hover:shadow-md'
  const txt    = isDark ? 'text-white' : 'text-slate-800'
  const muted  = isDark ? 'text-slate-500' : 'text-slate-400'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all flex items-start gap-3 ${cardBg} ${
        isPriority ? 'ring-1 ring-red-400/30' : ''
      }`}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
        isDark ? clr.bgDark : clr.bg
      }`}>
        <Icon size={16} className={isDark ? clr.textDark : clr.text} strokeWidth={2.3} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? clr.textDark : clr.text}`}>
            {t.moduloLabel}
          </span>
          <span className={muted}>•</span>
          <span className={`text-[10px] font-semibold ${muted}`}>{t.tipo}</span>
          {t.numero && t.numero !== 'N/A' && (
            <>
              <span className={muted}>•</span>
              <span className={`text-[10px] font-mono ${muted}`}>{t.numero}</span>
            </>
          )}
          {isPriority && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 text-[9px] font-bold uppercase">
              <Zap size={8} /> Urgente
            </span>
          )}
        </div>
        <p className={`text-[13px] font-semibold truncate ${txt}`}>{t.titulo}</p>
        {t.descricao && (
          <p className={`text-[11px] mt-0.5 line-clamp-1 ${muted}`}>{t.descricao}</p>
        )}
        <p className={`text-[10px] mt-1 inline-flex items-center gap-1 ${muted}`}>
          <Clock size={9} /> há {timeAgo(t.criadoEm)}
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight size={16} className={`shrink-0 mt-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
    </button>
  )
}

// Silence unused import if AlertCircle is not used anywhere else
void AlertCircle
