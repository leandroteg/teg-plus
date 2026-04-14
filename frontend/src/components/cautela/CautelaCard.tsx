import { Calendar, Package2, Clock, AlertTriangle } from 'lucide-react'
import type { Cautela, StatusCautela } from '../../types/cautela'

const fmtDate = (d?: string) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

const STATUS_CFG: Record<StatusCautela, { label: string; dot: string; bg: string; text: string; bgDark: string; textDark: string }> = {
  rascunho:           { label: 'Rascunho',    dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600',   bgDark: 'bg-slate-500/20',   textDark: 'text-slate-300' },
  pendente_aprovacao: { label: 'Pendente',    dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',   bgDark: 'bg-amber-500/20',   textDark: 'text-amber-300' },
  aprovada:           { label: 'Aprovada',    dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700',    bgDark: 'bg-blue-500/20',    textDark: 'text-blue-300' },
  em_separacao:       { label: 'Separando',   dot: 'bg-violet-500',  bg: 'bg-violet-50',   text: 'text-violet-700',  bgDark: 'bg-violet-500/20',  textDark: 'text-violet-300' },
  retirada:           { label: 'Retirada',    dot: 'bg-teal-500',    bg: 'bg-teal-50',     text: 'text-teal-700',    bgDark: 'bg-teal-500/20',    textDark: 'text-teal-300' },
  parcial_devolvida:  { label: 'Parcial',     dot: 'bg-orange-500',  bg: 'bg-orange-50',   text: 'text-orange-700',  bgDark: 'bg-orange-500/20',  textDark: 'text-orange-300' },
  devolvida:          { label: 'Devolvida',   dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', bgDark: 'bg-emerald-500/20', textDark: 'text-emerald-300' },
  vencida:            { label: 'Vencida',     dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-700',     bgDark: 'bg-red-500/20',     textDark: 'text-red-300' },
  cancelada:          { label: 'Cancelada',   dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600',   bgDark: 'bg-slate-500/20',   textDark: 'text-slate-300' },
}

function getProgressInfo(cautela: Cautela) {
  if (!cautela.data_retirada || !cautela.data_devolucao_prevista) return null
  const start = new Date(cautela.data_retirada).getTime()
  const end = new Date(cautela.data_devolucao_prevista + 'T23:59:59').getTime()
  const now = Date.now()
  const total = end - start
  if (total <= 0) return null
  const elapsed = Math.max(0, now - start)
  const pct = Math.min(100, (elapsed / total) * 100)
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000))
  return { pct, daysLeft }
}

function progressColor(pct: number) {
  if (pct < 60) return 'bg-emerald-500'
  if (pct < 85) return 'bg-amber-500'
  return 'bg-red-500'
}

interface Props {
  cautela: Cautela
  onClick?: () => void
  isDark: boolean
}

export default function CautelaCard({ cautela, onClick, isDark }: Props) {
  const st = STATUS_CFG[cautela.status] ?? STATUS_CFG.rascunho
  const progress = getProgressInfo(cautela)
  const totalItens = cautela.itens?.length ?? 0
  const descricaoItens = cautela.itens
    ?.slice(0, 2)
    .map(i => i.item?.descricao || i.descricao_livre || '—')
    .join(', ') || 'Sem itens'
  const moreCount = totalItens > 2 ? totalItens - 2 : 0

  const cardBg = isDark ? 'bg-white/[0.04] hover:bg-white/[0.06] border-white/[0.06]' : 'bg-white hover:bg-slate-50 border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all ${cardBg}`}
    >
      {/* Top row: number + status */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${txtMain}`}>{cautela.numero || '—'}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isDark ? st.bgDark : st.bg} ${isDark ? st.textDark : st.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </div>

      {/* Urgency badge */}
      {cautela.urgencia !== 'normal' && (
        <div className="mb-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            cautela.urgencia === 'emergencia'
              ? 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400'
              : 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400'
          }`}>
            <AlertTriangle size={10} />
            {cautela.urgencia === 'emergencia' ? 'EMERGENCIA' : 'URGENTE'}
          </span>
        </div>
      )}

      {/* Items summary */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <Package2 size={12} className={txtMuted} />
        <span className={`text-xs truncate ${txtMuted}`}>
          {descricaoItens}{moreCount > 0 ? ` +${moreCount}` : ''}
        </span>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-3 text-[10px] mb-2">
        {cautela.data_retirada && (
          <span className={`flex items-center gap-1 ${txtMuted}`}>
            <Calendar size={10} /> Ret. {fmtDate(cautela.data_retirada)}
          </span>
        )}
        {cautela.data_devolucao_prevista && (
          <span className={`flex items-center gap-1 ${txtMuted}`}>
            <Clock size={10} /> Dev. {fmtDate(cautela.data_devolucao_prevista)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {progress && (cautela.status === 'retirada' || cautela.status === 'parcial_devolvida') && (
        <div className="mt-1">
          <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.08]' : 'bg-slate-100'}`}>
            <div
              className={`h-full rounded-full transition-all ${progressColor(progress.pct)}`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className={`text-[9px] mt-0.5 ${txtMuted}`}>
            {progress.daysLeft === 0
              ? 'Vence hoje'
              : progress.pct >= 100
                ? 'Vencida'
                : `${progress.daysLeft}d restantes`}
          </p>
        </div>
      )}

      {/* Obra */}
      {cautela.obra_nome && (
        <p className={`text-[10px] mt-1 truncate ${txtMuted}`}>{cautela.obra_nome}</p>
      )}
    </button>
  )
}
