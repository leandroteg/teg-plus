// ─────────────────────────────────────────────────────────────────────────────
// components/rh/RHTabRail.tsx — Rail de sub-abas reutilizável (padrão Financeiro)
// Scroll horizontal + drag + chevrons + cor por aba. Usado nas telas do RH/DP.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Cor = 'slate' | 'blue' | 'indigo' | 'violet' | 'sky' | 'teal' | 'emerald' | 'green' | 'amber' | 'orange' | 'rose'

export interface RHTab {
  key: string
  label: string
  icon: LucideIcon
  cor: Cor
  count?: number
}

interface AccentSet { bg: string; bgActive: string; text: string; textActive: string; border: string; badge: string; icon: string }

const ACCENT: Record<Cor, AccentSet> = {
  slate:   { bg: 'hover:bg-slate-100',  bgActive: 'bg-slate-100',  text: 'text-slate-600',  textActive: 'text-slate-800',  border: 'border-slate-500',  badge: 'bg-slate-200 text-slate-700',   icon: 'text-slate-500' },
  blue:    { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    border: 'border-blue-500',    badge: 'bg-blue-100 text-blue-700',     icon: 'text-blue-500' },
  indigo:  { bg: 'hover:bg-indigo-50',  bgActive: 'bg-indigo-50',  text: 'text-indigo-600',  textActive: 'text-indigo-800',  border: 'border-indigo-500',  badge: 'bg-indigo-100 text-indigo-700', icon: 'text-indigo-500' },
  violet:  { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600',  textActive: 'text-violet-800',  border: 'border-violet-500',  badge: 'bg-violet-100 text-violet-700', icon: 'text-violet-500' },
  sky:     { bg: 'hover:bg-sky-50',     bgActive: 'bg-sky-50',     text: 'text-sky-600',     textActive: 'text-sky-800',     border: 'border-sky-500',     badge: 'bg-sky-100 text-sky-700',       icon: 'text-sky-500' },
  teal:    { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',    text: 'text-teal-600',    textActive: 'text-teal-800',    border: 'border-teal-500',    badge: 'bg-teal-100 text-teal-700',     icon: 'text-teal-500' },
  emerald: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-500' },
  green:   { bg: 'hover:bg-green-50',   bgActive: 'bg-green-50',   text: 'text-green-600',   textActive: 'text-green-800',   border: 'border-green-500',   badge: 'bg-green-100 text-green-700',   icon: 'text-green-500' },
  amber:   { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',   text: 'text-amber-600',   textActive: 'text-amber-800',   border: 'border-amber-500',   badge: 'bg-amber-100 text-amber-700',   icon: 'text-amber-500' },
  orange:  { bg: 'hover:bg-orange-50',  bgActive: 'bg-orange-50',  text: 'text-orange-600',  textActive: 'text-orange-800',  border: 'border-orange-500',  badge: 'bg-orange-100 text-orange-700', icon: 'text-orange-500' },
  rose:    { bg: 'hover:bg-rose-50',    bgActive: 'bg-rose-50',    text: 'text-rose-600',    textActive: 'text-rose-800',    border: 'border-rose-500',    badge: 'bg-rose-100 text-rose-700',     icon: 'text-rose-500' },
}

const ACCENT_DARK: Record<Cor, AccentSet> = {
  slate:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/15',   text: 'text-slate-400',   textActive: 'text-slate-200',   border: 'border-slate-400/40',   badge: 'bg-slate-500/20 text-slate-200',     icon: 'text-slate-400' },
  blue:    { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300',    border: 'border-blue-400/40',    badge: 'bg-blue-500/15 text-blue-200',       icon: 'text-blue-400' },
  indigo:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-indigo-500/10',  text: 'text-indigo-400',  textActive: 'text-indigo-300',  border: 'border-indigo-400/40',  badge: 'bg-indigo-500/15 text-indigo-200',   icon: 'text-indigo-400' },
  violet:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10',  text: 'text-violet-400',  textActive: 'text-violet-300',  border: 'border-violet-400/40',  badge: 'bg-violet-500/15 text-violet-200',   icon: 'text-violet-400' },
  sky:     { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-sky-500/10',     text: 'text-sky-400',     textActive: 'text-sky-300',     border: 'border-sky-400/40',     badge: 'bg-sky-500/15 text-sky-200',         icon: 'text-sky-400' },
  teal:    { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-teal-500/10',    text: 'text-teal-400',    textActive: 'text-teal-300',    border: 'border-teal-400/40',    badge: 'bg-teal-500/15 text-teal-200',       icon: 'text-teal-400' },
  emerald: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300', border: 'border-emerald-400/40', badge: 'bg-emerald-500/15 text-emerald-200', icon: 'text-emerald-400' },
  green:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-green-500/10',   text: 'text-green-400',   textActive: 'text-green-300',   border: 'border-green-400/40',   badge: 'bg-green-500/15 text-green-200',     icon: 'text-green-400' },
  amber:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',   text: 'text-amber-400',   textActive: 'text-amber-300',   border: 'border-amber-400/40',   badge: 'bg-amber-500/15 text-amber-200',     icon: 'text-amber-400' },
  orange:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-orange-500/10',  text: 'text-orange-400',  textActive: 'text-orange-300',  border: 'border-orange-400/40',  badge: 'bg-orange-500/15 text-orange-200',   icon: 'text-orange-400' },
  rose:    { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-rose-500/10',    text: 'text-rose-400',    textActive: 'text-rose-300',    border: 'border-rose-400/40',    badge: 'bg-rose-500/15 text-rose-200',       icon: 'text-rose-400' },
}

export function corDaAba(cor: Cor, isDark: boolean): AccentSet {
  return (isDark ? ACCENT_DARK : ACCENT)[cor]
}

export default function RHTabRail({ tabs, active, onChange, isDark }: {
  tabs: RHTab[]
  active: string
  onChange: (key: string) => void
  isDark: boolean
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({ active: false, startX: 0, startScrollLeft: 0 })
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const update = () => {
      const maxScroll = rail.scrollWidth - rail.clientWidth
      setCanScrollLeft(rail.scrollLeft > 8)
      setCanScrollRight(maxScroll - rail.scrollLeft > 8)
    }
    update()
    rail.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(rail)
    Array.from(rail.children).forEach(c => ro.observe(c))
    return () => { rail.removeEventListener('scroll', update); ro.disconnect() }
  }, [active])

  const scrollBy = (dir: 'left' | 'right') => {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: dir === 'left' ? -Math.max(rail.clientWidth * 0.72, 220) : Math.max(rail.clientWidth * 0.72, 220), behavior: 'smooth' })
  }

  const arrow = isDark
    ? 'border-white/[0.08] bg-slate-950/80 text-slate-200 hover:bg-slate-900'
    : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50'

  return (
    <div className={`relative min-w-0 rounded-2xl border p-1.5 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
      {canScrollLeft && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 left-1 z-10 w-16 rounded-l-[calc(1rem-2px)] ${isDark ? 'bg-gradient-to-r from-[#0f172a] via-[#0f172a]/80 to-transparent' : 'bg-gradient-to-r from-white via-white/85 to-transparent'}`} />
          <button type="button" aria-label="Rolar para a esquerda" onClick={() => scrollBy('left')}
            className={`absolute left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all ${arrow}`}>
            <ChevronLeft size={16} />
          </button>
        </>
      )}
      {canScrollRight && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 right-1 z-10 w-16 rounded-r-[calc(1rem-2px)] ${isDark ? 'bg-gradient-to-l from-[#0f172a] via-[#0f172a]/80 to-transparent' : 'bg-gradient-to-l from-white via-white/85 to-transparent'}`} />
          <button type="button" aria-label="Rolar para a direita" onClick={() => scrollBy('right')}
            className={`absolute right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all ${arrow}`}>
            <ChevronRight size={16} />
          </button>
        </>
      )}

      <div
        ref={railRef}
        onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button')) return
          const rail = railRef.current; if (!rail) return
          dragRef.current = { active: true, startX: e.clientX, startScrollLeft: rail.scrollLeft }
          rail.setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          if (!dragRef.current.active || !railRef.current) return
          railRef.current.scrollLeft = dragRef.current.startScrollLeft - (e.clientX - dragRef.current.startX)
        }}
        onPointerUp={e => {
          const rail = railRef.current; if (!rail) return
          dragRef.current.active = false
          if (rail.hasPointerCapture(e.pointerId)) rail.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => { dragRef.current.active = false }}
        onWheel={e => {
          const rail = railRef.current; if (!rail) return
          if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
          e.preventDefault(); rail.scrollLeft += e.deltaY
        }}
        className="min-w-0 overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing"
      >
        <div className="flex min-w-max items-stretch gap-1.5 pr-10 md:w-full">
          {tabs.map(t => {
            const isActive = active === t.key
            const a = corDaAba(t.cor, isDark)
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => onChange(t.key)}
                className={`flex min-h-[56px] min-w-fit items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-sm whitespace-nowrap transition-all shrink-0 md:flex-1 ${
                  isActive ? `${a.bgActive} ${a.textActive} border font-bold shadow-sm ${a.border}` : `${a.bg} ${a.text} font-medium`
                }`}>
                <Icon size={15} className="shrink-0" />
                {t.label}
                {(t.count ?? 0) > 0 && (
                  <span className={`rounded-full min-w-[24px] h-[24px] px-1.5 flex items-center justify-center text-[10px] font-bold ${
                    isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-500'
                  }`}>{t.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
