import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, CheckSquare, Zap, ChevronRight, ShoppingCart, Wallet, Building2,
  Package, FileText, Receipt, Truck, Clock, AlertCircle, Filter, Target, X, CheckCircle2, Circle, Loader2,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useMinhasTarefas, type Tarefa, type ModuloTarefa } from '../hooks/useMinhasTarefas'
import { useSgiObjetivoContexto, useAtualizarAcao } from '../hooks/useSgi'
import { FAROL_CFG, STATUS_ACAO_LABEL } from '../types/sgi'

// ── Config ──────────────────────────────────────────────────────────────────────

const MODULO_ICON: Record<ModuloTarefa, typeof ShoppingCart> = {
  compras:    ShoppingCart,
  financeiro: Wallet,
  locacao:    Building2,
  estoque:    Package,
  contratos:  FileText,
  despesas:   Receipt,
  transporte: Truck,
  gestao:     Target,
}

const MODULO_COLOR: Record<ModuloTarefa, { dot: string; text: string; bg: string; bgDark: string; textDark: string }> = {
  compras:    { dot: 'bg-indigo-500', text: 'text-indigo-600', bg: 'bg-indigo-50',  textDark: 'text-indigo-300', bgDark: 'bg-indigo-500/10' },
  financeiro: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', textDark: 'text-emerald-300', bgDark: 'bg-emerald-500/10' },
  locacao:    { dot: 'bg-blue-500',    text: 'text-blue-600',    bg: 'bg-blue-50',    textDark: 'text-blue-300',    bgDark: 'bg-blue-500/10' },
  estoque:    { dot: 'bg-amber-500',   text: 'text-amber-600',   bg: 'bg-amber-50',   textDark: 'text-amber-300',   bgDark: 'bg-amber-500/10' },
  contratos:  { dot: 'bg-violet-500',  text: 'text-violet-600',  bg: 'bg-violet-50',  textDark: 'text-violet-300',  bgDark: 'bg-violet-500/10' },
  despesas:   { dot: 'bg-rose-500',    text: 'text-rose-600',    bg: 'bg-rose-50',    textDark: 'text-rose-300',    bgDark: 'bg-rose-500/10' },
  transporte: { dot: 'bg-cyan-500',    text: 'text-cyan-600',    bg: 'bg-cyan-50',    textDark: 'text-cyan-300',    bgDark: 'bg-cyan-500/10' },
  gestao:     { dot: 'bg-violet-500',  text: 'text-violet-600',  bg: 'bg-violet-50',  textDark: 'text-violet-300',  bgDark: 'bg-violet-500/10' },
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
  const [sgiModal, setSgiModal] = useState<{ metaId: string; acaoId: string } | null>(null)
  const abrir = (t: Tarefa) => {
    if (t.sgiMetaId) setSgiModal({ metaId: t.sgiMetaId, acaoId: t.id.replace('sgiacao-', '') })
    else navigate(t.link)
  }

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
              <TarefaCard key={t.id} tarefa={t} isDark={isDark} onClick={() => abrir(t)} />
            ))}
          </div>
        )}

      </div>

      {sgiModal && (
        <TarefaSgiModal metaId={sgiModal.metaId} focoAcaoId={sgiModal.acaoId} isDark={isDark} onClose={() => setSgiModal(null)} />
      )}
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

// ── Modal SGI: objetivo da área + KRs do período + ações (aberto in-place) ────────
function TarefaSgiModal({ metaId, focoAcaoId, isDark, onClose }: {
  metaId: string; focoAcaoId: string; isDark: boolean; onClose: () => void
}) {
  const { data, isLoading } = useSgiObjetivoContexto(metaId)
  const atualizar = useAtualizarAcao()
  const panel = isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const sub = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
  const fmt = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className={`w-full max-w-2xl my-6 rounded-2xl border shadow-2xl ${panel}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-start justify-between gap-2 px-5 py-4 border-b sticky top-0 rounded-t-2xl ${panel} ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1"><Target size={12} /> {data?.objetivo?.area_processo || 'Gestão'} · {data?.trimestre ? `T${data.trimestre}/${data.ano}` : `${data?.ano ?? ''}`}</p>
            <h3 className={`text-base font-extrabold leading-tight ${txt}`}>{data?.objetivo?.titulo || 'Objetivo'}</h3>
            {data?.objetivo?.descricao && <p className={`text-xs mt-0.5 ${muted}`}>{data.objetivo.descricao}</p>}
          </div>
          <button onClick={onClose} className={`shrink-0 p-1 rounded-lg ${muted} hover:bg-slate-500/10`}><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          {isLoading && <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-violet-500" /></div>}
          {!isLoading && (data?.metas ?? []).length === 0 && <p className={`text-sm ${muted}`}>Sem KRs no período.</p>}
          {(data?.metas ?? []).map(m => {
            const ck = [...(m.checkins ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            const farol = FAROL_CFG[(ck?.farol ?? 'cinza') as keyof typeof FAROL_CFG]
            const acoesKr = (data?.acoes ?? []).filter(a => a.origem_id === m.id)
            const isFoco = m.id === metaId
            return (
              <div key={m.id} className={`rounded-xl border p-3 ${sub} ${isFoco ? 'ring-1 ring-violet-400/50' : ''}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${farol.dot}`} title={farol.label} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold leading-snug ${txt}`}>{m.descricao || (m.alvo != null ? `Alvo ${m.alvo}` : 'KR')}</p>
                    <p className={`text-[11px] ${muted}`}>{m.prazo ? `Prazo ${fmt(m.prazo)}` : 'sem prazo'} · {farol.label}{ck?.realizado != null ? ` · realizado ${ck.realizado}` : ''}</p>
                  </div>
                </div>
                <div className="space-y-1.5 pl-4">
                  {acoesKr.length === 0 && <p className={`text-[11px] ${muted}`}>Nenhuma ação planejada.</p>}
                  {acoesKr.map(a => {
                    const sa = STATUS_ACAO_LABEL[a.status]
                    const done = a.status === 'concluida'
                    const isClicked = a.id === focoAcaoId
                    return (
                      <div key={a.id} className={`flex items-center gap-2 rounded-lg p-2 ${isClicked ? (isDark ? 'bg-violet-500/10' : 'bg-violet-50') : (isDark ? 'bg-white/[0.03]' : 'bg-white')}`}>
                        <button onClick={() => atualizar.mutate({ id: a.id, status: done ? 'aberta' : 'concluida', concluida_em: done ? null : new Date().toISOString() })} className="shrink-0">
                          {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-400" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium ${done ? 'line-through ' + muted : txt}`}>{a.titulo}</p>
                          {a.prazo && <p className={`text-[10px] ${muted}`}>Prazo {fmt(a.prazo)}</p>}
                        </div>
                        <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sa.bg} ${sa.text}`}>{sa.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Silence unused import if AlertCircle is not used anywhere else
void AlertCircle
