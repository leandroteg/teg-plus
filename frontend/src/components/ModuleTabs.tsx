import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'

// Componente único de "rail" de abas — padrão visual dos módulos (extraído do
// StatusFilterRail do financeiro). Reaproveitar SEMPRE este, não recriar inline.

export type TabTone = 'slate' | 'blue' | 'violet' | 'emerald' | 'teal' | 'green' | 'amber' | 'orange' | 'rose' | 'sky' | 'indigo'
export type TabState = 'done' | 'active' | 'todo' | 'locked'

export interface ModuleTab {
  value: string
  label: string
  icon?: LucideIcon
  badge?: ReactNode          // chip à direita (contagem, etc.)
  leading?: ReactNode        // elemento à esquerda (ex.: círculo de etapa no stepper)
  tone?: TabTone             // cor quando ativo
  state?: TabState           // p/ stepper: done | active | todo | locked. Se ausente, ativo = value === tab.value
  disabled?: boolean
}

const TONE: Record<TabTone, { activeL: string; activeD: string; badgeL: string; badgeD: string }> = {
  slate:   { activeL: 'bg-slate-100 text-slate-700 border-slate-300',     activeD: 'bg-white/[0.06] text-slate-200 border-white/[0.10]',     badgeL: 'bg-slate-200 text-slate-600',     badgeD: 'bg-white/[0.10] text-slate-300' },
  blue:    { activeL: 'bg-blue-50 text-blue-700 border-blue-400',         activeD: 'bg-blue-500/10 text-blue-300 border-blue-500/40',       badgeL: 'bg-blue-100 text-blue-700',       badgeD: 'bg-blue-500/20 text-blue-300' },
  violet:  { activeL: 'bg-violet-50 text-violet-700 border-violet-400',   activeD: 'bg-violet-500/10 text-violet-300 border-violet-500/40',   badgeL: 'bg-violet-100 text-violet-700',   badgeD: 'bg-violet-500/20 text-violet-300' },
  emerald: { activeL: 'bg-emerald-50 text-emerald-700 border-emerald-400', activeD: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40', badgeL: 'bg-emerald-100 text-emerald-700', badgeD: 'bg-emerald-500/20 text-emerald-300' },
  teal:    { activeL: 'bg-teal-50 text-teal-700 border-teal-400',         activeD: 'bg-teal-500/10 text-teal-300 border-teal-500/40',       badgeL: 'bg-teal-100 text-teal-700',       badgeD: 'bg-teal-500/20 text-teal-300' },
  green:   { activeL: 'bg-green-50 text-green-700 border-green-400',       activeD: 'bg-green-500/10 text-green-300 border-green-500/40',     badgeL: 'bg-green-100 text-green-700',     badgeD: 'bg-green-500/20 text-green-300' },
  amber:   { activeL: 'bg-amber-50 text-amber-700 border-amber-400',       activeD: 'bg-amber-500/10 text-amber-300 border-amber-500/40',     badgeL: 'bg-amber-100 text-amber-700',     badgeD: 'bg-amber-500/20 text-amber-300' },
  orange:  { activeL: 'bg-orange-50 text-orange-700 border-orange-400',     activeD: 'bg-orange-500/10 text-orange-300 border-orange-500/40',   badgeL: 'bg-orange-100 text-orange-700',   badgeD: 'bg-orange-500/20 text-orange-300' },
  rose:    { activeL: 'bg-rose-50 text-rose-700 border-rose-400',           activeD: 'bg-rose-500/10 text-rose-300 border-rose-500/40',       badgeL: 'bg-rose-100 text-rose-700',       badgeD: 'bg-rose-500/20 text-rose-300' },
  sky:     { activeL: 'bg-sky-50 text-sky-700 border-sky-400',             activeD: 'bg-sky-500/10 text-sky-300 border-sky-500/40',         badgeL: 'bg-sky-100 text-sky-700',         badgeD: 'bg-sky-500/20 text-sky-300' },
  indigo:  { activeL: 'bg-indigo-50 text-indigo-700 border-indigo-400',     activeD: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/40',   badgeL: 'bg-indigo-100 text-indigo-700',   badgeD: 'bg-indigo-500/20 text-indigo-300' },
}

export default function ModuleTabs({ tabs, value, onChange, isDark, className }: {
  tabs: ModuleTab[]
  value?: string
  onChange?: (value: string) => void
  isDark: boolean
  className?: string
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false })
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const el = railRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }

  useEffect(() => {
    updateScrollState()
    const el = railRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect() }
  }, [tabs.length])

  const scrollByAmount = (dir: -1 | 1) => railRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })

  return (
    <div className={`relative w-full min-w-0 ${className ?? ''}`}>
      {canScrollLeft && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 left-1 z-10 w-10 rounded-l-2xl bg-gradient-to-r ${isDark ? 'from-[#0f172a]' : 'from-slate-50'} to-transparent`} />
          <button type="button" onClick={() => scrollByAmount(-1)} aria-label="Rolar para a esquerda"
            className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 h-8 w-8 rounded-full border backdrop-blur-sm transition-all ${isDark ? 'border-white/[0.10] bg-slate-900/85 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
            <ChevronLeft size={14} className="mx-auto" />
          </button>
        </>
      )}
      {canScrollRight && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 right-1 z-10 w-10 rounded-r-2xl bg-gradient-to-l ${isDark ? 'from-[#0f172a]' : 'from-slate-50'} to-transparent`} />
          <button type="button" onClick={() => scrollByAmount(1)} aria-label="Rolar para a direita"
            className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 h-8 w-8 rounded-full border backdrop-blur-sm transition-all ${isDark ? 'border-white/[0.10] bg-slate-900/85 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
            <ChevronRight size={14} className="mx-auto" />
          </button>
        </>
      )}

      <div
        ref={railRef}
        onMouseDown={e => { dragRef.current = { active: true, startX: e.clientX, startScrollLeft: railRef.current?.scrollLeft ?? 0, moved: false } }}
        onMouseMove={e => {
          if (!dragRef.current.active || !railRef.current) return
          const delta = e.clientX - dragRef.current.startX
          if (Math.abs(delta) > 4) dragRef.current.moved = true
          railRef.current.scrollLeft = dragRef.current.startScrollLeft - delta
        }}
        onMouseUp={() => { window.setTimeout(() => { dragRef.current.active = false }, 0) }}
        onMouseLeave={() => { dragRef.current.active = false }}
        onClickCapture={e => { if (dragRef.current.moved) { e.preventDefault(); e.stopPropagation(); dragRef.current.moved = false } }}
        onWheel={e => {
          const el = railRef.current
          if (!el) return
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY }
        }}
        className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar ${canScrollRight ? 'pr-12' : ''} ${canScrollLeft ? 'pl-12' : ''} ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'} cursor-grab active:cursor-grabbing`}
      >
        {tabs.map(t => {
          const tone = TONE[t.tone ?? 'slate']
          const locked = t.disabled || t.state === 'locked'
          const done = t.state === 'done'
          const active = t.state ? t.state === 'active' : value === t.value
          const Icon = t.icon

          const cls = locked
            ? (isDark ? 'text-slate-600 border-transparent cursor-not-allowed' : 'text-slate-300 border-transparent cursor-not-allowed')
            : done
              ? `${isDark ? TONE.emerald.activeD : TONE.emerald.activeL}`
              : active
                ? `${isDark ? tone.activeD : tone.activeL} shadow-sm`
                : (isDark ? 'text-slate-400 border-transparent hover:bg-white/[0.04]' : 'text-slate-500 border-transparent hover:bg-white hover:shadow-sm')

          const badgeCls = active
            ? (isDark ? tone.badgeD : tone.badgeL)
            : done
              ? (isDark ? TONE.emerald.badgeD : TONE.emerald.badgeL)
              : (isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-500')

          return (
            <button key={t.value} disabled={locked} onClick={() => !locked && onChange?.(t.value)}
              className={`min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${cls}`}>
              {t.leading}
              {Icon && <Icon size={15} className="shrink-0" />}
              {t.label}
              {t.badge != null && (
                <span className={`ml-1 min-w-[22px] px-1.5 py-0.5 rounded-full text-[10px] font-bold text-center ${badgeCls}`}>{t.badge}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
