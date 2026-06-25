import { useState, useRef, useEffect, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, ChevronDown, Check } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

// ─────────────────────────────────────────────────────────────────────────────
//  KIT MOBILE dos Painéis — primitivas mobile-native, padrão visual da casa.
//  Usado por <Modulo>Mobile.tsx p/ montar dashboards mobile reusando os MESMOS
//  dados do desktop. Componentes pegam o tema internamente (useTheme).
//
//  Tons disponíveis: emerald · teal · amber · red · slate · blue · violet ·
//  indigo · sky · rose. (chave de `Tone`)
// ─────────────────────────────────────────────────────────────────────────────

export type Tone = 'emerald' | 'teal' | 'amber' | 'red' | 'slate' | 'blue' | 'violet' | 'indigo' | 'sky' | 'rose'

const TEXT_TONE: Record<Tone, { light: string; dark: string }> = {
  emerald: { light: 'text-emerald-600', dark: 'text-emerald-400' },
  teal:    { light: 'text-teal-600',    dark: 'text-teal-400' },
  amber:   { light: 'text-amber-600',   dark: 'text-amber-400' },
  red:     { light: 'text-red-600',     dark: 'text-red-400' },
  slate:   { light: 'text-slate-600',   dark: 'text-slate-300' },
  blue:    { light: 'text-blue-600',    dark: 'text-blue-400' },
  violet:  { light: 'text-violet-600',  dark: 'text-violet-400' },
  indigo:  { light: 'text-indigo-600',  dark: 'text-indigo-400' },
  sky:     { light: 'text-sky-600',     dark: 'text-sky-400' },
  rose:    { light: 'text-rose-600',    dark: 'text-rose-400' },
}
const SOFT_TONE: Record<Tone, { light: string; dark: string }> = {
  emerald: { light: 'bg-emerald-50 text-emerald-600', dark: 'bg-emerald-500/12 text-emerald-400' },
  teal:    { light: 'bg-teal-50 text-teal-600',       dark: 'bg-teal-500/12 text-teal-400' },
  amber:   { light: 'bg-amber-50 text-amber-600',     dark: 'bg-amber-500/12 text-amber-400' },
  red:     { light: 'bg-red-50 text-red-600',         dark: 'bg-red-500/12 text-red-400' },
  slate:   { light: 'bg-slate-100 text-slate-600',    dark: 'bg-white/[0.06] text-slate-300' },
  blue:    { light: 'bg-blue-50 text-blue-600',       dark: 'bg-blue-500/12 text-blue-400' },
  violet:  { light: 'bg-violet-50 text-violet-600',   dark: 'bg-violet-500/12 text-violet-400' },
  indigo:  { light: 'bg-indigo-50 text-indigo-600',   dark: 'bg-indigo-500/12 text-indigo-400' },
  sky:     { light: 'bg-sky-50 text-sky-600',         dark: 'bg-sky-500/12 text-sky-400' },
  rose:    { light: 'bg-rose-50 text-rose-600',       dark: 'bg-rose-500/12 text-rose-400' },
}
const BAR_TONE: Record<Tone, string> = {
  emerald: 'from-emerald-400 to-teal-600', teal: 'from-teal-400 to-emerald-600',
  amber: 'from-amber-400 to-orange-500', red: 'from-red-400 to-rose-600',
  slate: 'from-slate-400 to-slate-500', blue: 'from-blue-400 to-indigo-600',
  violet: 'from-violet-400 to-fuchsia-600', indigo: 'from-indigo-400 to-blue-600',
  sky: 'from-sky-400 to-blue-600', rose: 'from-rose-400 to-pink-600',
}

function useT() {
  const { isDark } = useTheme()
  return {
    isDark,
    txt: isDark ? 'text-white' : 'text-slate-900',
    muted: isDark ? 'text-slate-400' : 'text-slate-500',
    faint: isDark ? 'text-slate-500' : 'text-slate-400',
    card: isDark ? 'bg-[#111827] border-white/[0.06]' : 'bg-white border-slate-200',
    soft: isDark ? 'bg-white/[0.03]' : 'bg-slate-50',
    divide: isDark ? 'divide-white/[0.05]' : 'divide-slate-100',
    toneText: (t: Tone) => (isDark ? TEXT_TONE[t].dark : TEXT_TONE[t].light),
    toneSoft: (t: Tone) => (isDark ? SOFT_TONE[t].dark : SOFT_TONE[t].light),
  }
}

// ── Container da página ───────────────────────────────────────────────────────
export function MobilePanel({ children }: { children: ReactNode }) {
  return <div className="space-y-3 pb-4">{children}</div>
}

// ── Cabeçalho ────────────────────────────────────────────────────────────────
export function MobileHeader({ title, subtitle, icon: Icon, tone = 'emerald', right }: {
  title: string; subtitle?: string; icon?: LucideIcon; tone?: Tone; right?: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex items-center justify-between gap-2 pt-0.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${t.toneSoft(tone)}`}>
            <Icon size={18} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className={`text-lg font-extrabold leading-tight truncate ${t.txt}`}>{title}</h1>
          {subtitle && <p className={`text-[11px] ${t.faint} truncate`}>{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

// ── Controle segmentado (período, abas) — à prova de overflow (scroll horiz.) ──
export function Segmented<T extends string>({ value, onChange, options, tone = 'emerald' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; tone?: Tone
}) {
  const { isDark } = useTheme()
  return (
    <div className={`flex items-center gap-0.5 p-0.5 rounded-xl border max-w-full overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200'}`}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              active
                ? (tone === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white')
                : (isDark ? 'text-slate-400' : 'text-slate-500')
            }`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Dropdown compacto (ícone + valor atual + chevron → abre lista) ────────────
//  Para filtros/seletores que não cabem no segmentado (muitas opções ou labels
//  longos). Não estoura horizontalmente. Usado ex.: seletor de sub-painel.
export function MobileSelect<T extends string>({ value, onChange, options, tone = 'emerald', icon: Icon, align = 'left' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; tone?: Tone; icon?: LucideIcon; align?: 'left' | 'right'
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const ativo = options.find(o => o.value === value)
  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-bold max-w-[60vw] ${t.card} ${t.txt}`}>
        {Icon && <Icon size={14} className={`${t.toneText(tone)} shrink-0`} />}
        <span className="truncate">{ativo?.label ?? '—'}</span>
        <ChevronDown size={14} className={`${t.faint} shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute z-30 mt-1 min-w-[170px] max-w-[80vw] rounded-xl border shadow-xl overflow-hidden ${t.card} ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {options.map(o => {
            const active = o.value === value
            return (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-[12px] ${active ? `${t.toneText(tone)} font-bold` : t.txt} ${t.isDark ? 'active:bg-white/[0.05]' : 'active:bg-slate-50'}`}>
                <span className="truncate">{o.label}</span>
                {active && <Check size={14} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── KPI grande (card destaque) ───────────────────────────────────────────────
export function KpiCard({ label, value, tone = 'slate', note, icon: Icon }: {
  label: string; value: ReactNode; tone?: Tone; note?: string; icon?: LucideIcon
}) {
  const t = useT()
  return (
    <div className={`rounded-2xl border p-4 ${t.card}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${t.faint}`}>{label}</p>
        {Icon && <Icon size={15} className={t.toneText(tone)} />}
      </div>
      <p className={`mt-1.5 text-2xl font-extrabold leading-none ${t.toneText(tone)}`}>{value}</p>
      {note && <p className={`mt-1 text-[10px] ${t.muted}`}>{note}</p>}
    </div>
  )
}

// ── Grid de KPIs (2 colunas) ─────────────────────────────────────────────────
export function KpiGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid gap-2.5 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{children}</div>
}

// ── Tile compacto (ícone + valor + label) ────────────────────────────────────
export function StatTile({ label, value, icon: Icon, tone = 'slate', note }: {
  label: string; value: ReactNode; icon?: LucideIcon; tone?: Tone; note?: string
}) {
  const t = useT()
  return (
    <div className={`rounded-2xl border p-3.5 flex flex-col items-center justify-center text-center gap-1 ${t.card}`}>
      {Icon && <Icon size={16} className={t.toneText(tone)} />}
      <p className={`text-xl font-extrabold leading-none ${t.txt}`}>{value}</p>
      <p className={`text-[9px] font-bold uppercase tracking-wider ${t.faint}`}>{label}</p>
      {note && <p className={`text-[9px] ${t.muted}`}>{note}</p>}
    </div>
  )
}

// ── Seção titulada (com ação opcional "ver todos") ───────────────────────────
export function Section({ title, icon: Icon, tone = 'slate', action, children }: {
  title: string; icon?: LucideIcon; tone?: Tone; action?: { label: string; onClick: () => void }; children: ReactNode
}) {
  const t = useT()
  return (
    <section className={`rounded-2xl border overflow-hidden ${t.card}`}>
      <div className={`px-4 py-3 flex items-center justify-between border-b ${t.isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${t.txt}`}>
          {Icon && <Icon size={14} className={t.toneText(tone)} />} {title}
        </h2>
        {action && (
          <button onClick={action.onClick} className={`flex items-center gap-0.5 text-[11px] font-semibold ${t.toneText(tone)}`}>
            {action.label} <ChevronRight size={12} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

// ── Linha de lista (leading + título/subtítulo + valor à direita) ────────────
export function ListRow({ leading, title, subtitle, value, valueSub, valueTone, onClick }: {
  leading?: ReactNode; title: string; subtitle?: string; value?: ReactNode; valueSub?: string; valueTone?: Tone; onClick?: () => void
}) {
  const t = useT()
  const Comp: any = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={`w-full text-left flex items-center gap-3 px-4 py-3 ${onClick ? (t.isDark ? 'active:bg-white/[0.04]' : 'active:bg-slate-50') : ''}`}>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${t.txt}`}>{title}</p>
        {subtitle && <p className={`text-[10px] truncate ${t.faint}`}>{subtitle}</p>}
      </div>
      {value !== undefined && (
        <div className="text-right shrink-0">
          <p className={`text-sm font-extrabold ${valueTone ? t.toneText(valueTone) : t.txt}`}>{value}</p>
          {valueSub && <p className={`text-[10px] ${t.faint}`}>{valueSub}</p>}
        </div>
      )}
    </Comp>
  )
}

// Badge circular com número/dia (leading de ListRow)
export function LeadingBadge({ children, tone = 'emerald' }: { children: ReactNode; tone?: Tone }) {
  const t = useT()
  return <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${t.toneSoft(tone)}`}>{children}</div>
}

// Wrapper p/ dividir linhas de lista
export function RowList({ children }: { children: ReactNode }) {
  const t = useT()
  return <div className={`divide-y ${t.divide}`}>{children}</div>
}

// ── Barra de progresso rotulada (ranking: label · barra · valor) ─────────────
export function BarStat({ label, value, pct, tone = 'emerald' }: {
  label: string; value: ReactNode; pct: number; tone?: Tone
}) {
  const t = useT()
  return (
    <div className="flex items-center gap-2.5">
      <p className={`text-[11px] font-semibold w-[78px] shrink-0 truncate ${t.muted}`}>{label}</p>
      <div className={`flex-1 h-5 rounded-full overflow-hidden ${t.isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${BAR_TONE[tone]} transition-all duration-500`}
          style={{ width: `${Math.max(Math.min(pct, 100), 3)}%` }} />
      </div>
      <p className={`text-[11px] font-extrabold w-[64px] text-right shrink-0 ${t.txt}`}>{value}</p>
    </div>
  )
}

// ── Pill / badge ─────────────────────────────────────────────────────────────
export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: Tone }) {
  const t = useT()
  return <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${t.toneSoft(tone)}`}>{children}</span>
}

// ── Estado vazio ─────────────────────────────────────────────────────────────
export function Empty({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  const t = useT()
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${t.faint}`}>
      {Icon && <Icon size={28} className="opacity-50" />}
      <p className="text-xs">{children}</p>
    </div>
  )
}

// ── Spinner de carregamento ──────────────────────────────────────────────────
export function MobileLoading({ tone = 'emerald' }: { tone?: Tone }) {
  const cls = tone === 'indigo' ? 'border-indigo-500' : tone === 'violet' ? 'border-violet-500' : tone === 'amber' ? 'border-amber-500' : tone === 'sky' ? 'border-sky-500' : 'border-emerald-500'
  return (
    <div className="flex items-center justify-center py-16">
      <div className={`w-7 h-7 border-[3px] ${cls} border-t-transparent rounded-full animate-spin`} />
    </div>
  )
}

// padding helper p/ seções com conteúdo livre
export function SectionBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}
