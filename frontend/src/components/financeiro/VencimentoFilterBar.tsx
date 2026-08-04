import { useState } from 'react'
import { Filter } from 'lucide-react'

/**
 * Barra de filtro por data de vencimento — mesma mecânica do Contas a Pagar
 * (CPPipeline): atalhos rápidos + período personalizado De/Até (between).
 *
 * O filtro é puro (filterByVencimento) para que a tela use o MESMO resultado
 * na lista, nos contadores, nos totais e no CSV.
 */

export type VencFilterId =
  | 'all' | 'overdue' | 'today' | 'week' | 'this_month' | 'next_month' | 'future' | 'custom'

export interface VencRange { from: string; to: string }

export const VENC_RANGE_VAZIO: VencRange = { from: '', to: '' }

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Limites em ISO (yyyy-mm-dd), calculados no fuso local. */
export function vencBounds(base = new Date()) {
  const y = base.getFullYear()
  const m = base.getMonth()
  return {
    hoje:   ymd(base),
    semana: ymd(new Date(y, m, base.getDate() + 7)),
    mStart: ymd(new Date(y, m, 1)),
    mEnd:   ymd(new Date(y, m + 1, 0)),
    nStart: ymd(new Date(y, m + 1, 1)),
    nEnd:   ymd(new Date(y, m + 2, 0)),
  }
}

/**
 * Aplica o filtro de vencimento.
 * `isSettled` marca títulos já baixados (pago/recebido/conciliado/cancelado),
 * que nunca contam como vencido/hoje/7 dias.
 */
export function filterByVencimento<T>(
  items: T[],
  filter: VencFilterId,
  range: VencRange,
  getVencimento: (item: T) => string,
  isSettled?: (item: T) => boolean,
): T[] {
  if (filter === 'all') return items
  const b = vencBounds()
  const aberto = (it: T) => !isSettled?.(it)

  switch (filter) {
    case 'overdue':    return items.filter(it => aberto(it) && getVencimento(it) < b.hoje)
    case 'today':      return items.filter(it => aberto(it) && getVencimento(it) === b.hoje)
    case 'week':       return items.filter(it => aberto(it) && getVencimento(it) >= b.hoje && getVencimento(it) <= b.semana)
    case 'this_month': return items.filter(it => getVencimento(it) >= b.mStart && getVencimento(it) <= b.mEnd)
    case 'next_month': return items.filter(it => getVencimento(it) >= b.nStart && getVencimento(it) <= b.nEnd)
    case 'future':     return items.filter(it => getVencimento(it) > b.nEnd)
    case 'custom':
      return items.filter(it => {
        const v = getVencimento(it)
        if (range.from && v < range.from) return false
        if (range.to && v > range.to) return false
        return true
      })
    default: return items
  }
}

/** 2026-08-04 → 04/08 */
const curto = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/')

interface Props<T> {
  /** Universo da aba ANTES do filtro de vencimento (usado para os contadores). */
  items: T[]
  value: VencFilterId
  onChange: (id: VencFilterId) => void
  range: VencRange
  onRangeChange: (r: VencRange) => void
  getVencimento: (item: T) => string
  isSettled?: (item: T) => boolean
  isDark: boolean
  /** Rótulo à esquerda dos chips. */
  label?: string
}

export default function VencimentoFilterBar<T>({
  items, value, onChange, range, onRangeChange, getVencimento, isSettled, isDark, label = 'Vencimento',
}: Props<T>) {
  const [showCustom, setShowCustom] = useState(false)

  const count = (id: VencFilterId) =>
    filterByVencimento(items, id, range, getVencimento, isSettled).length

  const chips: { id: VencFilterId; label: string; activeAccent: string }[] = [
    { id: 'all',        label: 'Todos',     activeAccent: isDark ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { id: 'overdue',    label: 'Vencidos',  activeAccent: isDark ? 'bg-red-500/15 border-red-400/30 text-red-300'             : 'bg-red-50 border-red-200 text-red-700' },
    { id: 'today',      label: 'Hoje',      activeAccent: isDark ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'       : 'bg-amber-50 border-amber-200 text-amber-700' },
    { id: 'week',       label: '7 dias',    activeAccent: isDark ? 'bg-blue-500/15 border-blue-400/30 text-blue-300'          : 'bg-blue-50 border-blue-200 text-blue-700' },
    { id: 'this_month', label: 'Mês Atual', activeAccent: isDark ? 'bg-violet-500/15 border-violet-400/30 text-violet-300'    : 'bg-violet-50 border-violet-200 text-violet-700' },
    { id: 'next_month', label: 'Próx. Mês', activeAccent: isDark ? 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300'    : 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    { id: 'future',     label: 'Futuros',   activeAccent: isDark ? 'bg-slate-500/15 border-slate-400/30 text-slate-200'       : 'bg-slate-100 border-slate-300 text-slate-700' },
  ]

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {label}
      </span>

      {chips.map(chip => {
        const active = value === chip.id
        return (
          <button
            key={chip.id}
            onClick={() => onChange(active ? 'all' : chip.id)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              active ? chip.activeAccent : isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {chip.label}
            <span className={`text-[10px] tabular-nums ${active ? 'opacity-80' : 'opacity-50'}`}>{count(chip.id)}</span>
          </button>
        )
      })}

      {/* Período personalizado (between) */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowCustom(v => !v)}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
            value === 'custom'
              ? isDark ? 'bg-teal-500/15 border-teal-400/30 text-teal-300' : 'bg-teal-50 border-teal-200 text-teal-700'
              : isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Filter size={10} />
          {value === 'custom' && (range.from || range.to)
            ? <span className="tabular-nums">{range.from ? curto(range.from) : '...'} — {range.to ? curto(range.to) : '...'}</span>
            : 'Personalizado'}
        </button>

        {/* Overlay fixo para escapar do overflow-hidden do painel */}
        {showCustom && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setShowCustom(false)} />
            <div
              className={`fixed z-50 rounded-2xl border p-4 shadow-2xl space-y-3 w-[300px] ${isDark ? 'bg-slate-900 border-white/[0.08]' : 'bg-white border-slate-200'}`}
              style={{ top: 'calc(50% - 100px)', left: 'calc(50% - 150px)' }}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Período personalizado
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className={`text-[10px] font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>De</label>
                  <input
                    type="date" value={range.from}
                    onChange={e => onRangeChange({ ...range, from: e.target.value })}
                    className={`w-full px-2.5 py-1.5 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-white/[0.1] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                  />
                </div>
                <div className="flex-1">
                  <label className={`text-[10px] font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Até</label>
                  <input
                    type="date" value={range.to}
                    onChange={e => onRangeChange({ ...range, to: e.target.value })}
                    className={`w-full px-2.5 py-1.5 rounded-xl border text-xs ${isDark ? 'bg-slate-800 border-white/[0.1] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { onRangeChange(VENC_RANGE_VAZIO); onChange('all'); setShowCustom(false) }}
                  className={`text-[11px] font-medium px-3 py-1.5 rounded-xl transition-all ${isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Limpar
                </button>
                <button
                  onClick={() => { onChange('custom'); setShowCustom(false) }}
                  disabled={!range.from && !range.to}
                  className="text-[11px] font-bold px-4 py-1.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
