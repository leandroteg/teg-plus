// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/paineis/_ui.tsx — primitivos visuais dos painéis de Headcount.
// Gráficos 100% nativos (Tailwind/SVG), no padrão dos dashboards TEG+.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react'

export function card(isDark: boolean) {
  return isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'
}

export function PanelCard({ title, icon, right, children, isDark, pad = true }: {
  title?: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; isDark: boolean; pad?: boolean
}) {
  return (
    <section className={`rounded-2xl shadow-sm overflow-hidden ${card(isDark)}`}>
      {title && (
        <div className={`px-4 py-3 flex items-center justify-between gap-2 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {icon}{title}
          </h2>
          {right}
        </div>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

const TONES: Record<string, { light: string; dark: string }> = {
  violet:  { light: 'text-violet-600',  dark: 'text-violet-400' },
  emerald: { light: 'text-emerald-600', dark: 'text-emerald-400' },
  red:     { light: 'text-red-600',     dark: 'text-red-400' },
  amber:   { light: 'text-amber-600',   dark: 'text-amber-400' },
  sky:     { light: 'text-sky-600',     dark: 'text-sky-400' },
  orange:  { light: 'text-orange-600',  dark: 'text-orange-400' },
  slate:   { light: 'text-slate-500',   dark: 'text-slate-400' },
}
export function Kpi({ label, value, note, tone = 'violet', isDark }: {
  label: string; value: string | number; note?: string; tone?: string; isDark: boolean
}) {
  const t = TONES[tone] || TONES.slate
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.6rem] font-extrabold leading-none ${isDark ? t.dark : t.light}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

/** Barras verticais empilhadas por mês. series: [{label,color,valores[]}] alinhado a `meses`. */
export function StackedMonthChart({ meses, series, isDark, height = 200 }: {
  meses: string[]; series: Array<{ label: string; color: string; valores: number[] }>; isDark: boolean; height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const n = meses.length
  const totais = meses.map((_, i) => series.reduce((s, sr) => s + (sr.valores[i] || 0), 0))
  const max = Math.max(...totais, 1)
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {meses.map((m, i) => (
          <div key={m} className="flex-1 flex flex-col items-center justify-end h-full relative"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className={`absolute top-0 z-30 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap ${i <= 1 ? 'left-0' : i >= n - 2 ? 'right-0' : 'left-1/2 -translate-x-1/2'} ${isDark ? 'bg-slate-800 border border-white/10' : 'bg-white border border-slate-200'}`}>
                <p className={`text-xs font-extrabold mb-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{m}</p>
                {series.map(sr => (sr.valores[i] ? (
                  <div key={sr.label} className="flex items-center gap-2 text-[11px] leading-5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: sr.color }} />
                    <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{sr.label}</span>
                    <span className={`ml-3 font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{sr.valores[i]}</span>
                  </div>
                ) : null))}
                <div className={`flex items-center gap-2 text-[11px] mt-1 pt-1 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                  <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Total</span>
                  <span className={`ml-auto font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totais[i]}</span>
                </div>
              </div>
            )}
            <span className={`text-[11px] font-extrabold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{totais[i] || ''}</span>
            <div className={`w-full flex flex-col-reverse rounded-t overflow-hidden cursor-pointer transition-opacity ${hover !== null && hover !== i ? 'opacity-50' : ''}`} style={{ height: `${(totais[i] / max) * 100}%` }}>
              {series.map(sr => {
                const v = sr.valores[i] || 0
                if (!v) return null
                return <div key={sr.label} style={{ height: `${(v / (totais[i] || 1)) * 100}%`, background: sr.color }} />
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {meses.map((m, i) => (
          <span key={`${m}-${i}`} className={`flex-1 text-center text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.split('/')[0]}</span>
        ))}
      </div>
    </div>
  )
}

/** Legenda de séries coloridas. */
export function Legenda({ items, isDark }: { items: Array<{ label: string; color: string }>; isDark: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(it => (
        <span key={it.label} className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: it.color }} />
          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{it.label}</span>
        </span>
      ))}
    </div>
  )
}

/** Barra horizontal 100% empilhada (proporção). */
export function ProporcaoBar({ segments, isDark }: { segments: Array<{ label: string; value: number; color: string }>; isDark: boolean }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div className={`flex h-9 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
      {segments.map(s => {
        const pct = (s.value / total) * 100
        if (pct <= 0) return null
        return (
          <div key={s.label} className="flex items-center justify-center" style={{ width: `${pct}%`, background: s.color }} title={`${s.label}: ${s.value} (${pct.toFixed(1)}%)`}>
            {pct >= 8 && <span className="text-[9px] font-bold text-white drop-shadow-sm truncate px-1">{Math.round(pct)}%</span>}
          </div>
        )
      })}
    </div>
  )
}

/** Linha "rótulo — barra — valor" (ranking horizontal). */
export function HBarRow({ label, value, max, color, suffix, isDark }: {
  label: string; value: number; max: number; color: string; suffix?: string; isDark: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <p className={`text-[13px] font-semibold text-right shrink-0 w-[190px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={label}>{label}</p>
      <div className={`flex-1 h-6 rounded-md overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
        <div className="h-full rounded-md transition-all" style={{ width: `${Math.max((value / (max || 1)) * 100, 3)}%`, background: color }} />
      </div>
      <p className={`text-[13px] font-extrabold shrink-0 w-[80px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{suffix ?? value}</p>
    </div>
  )
}

const MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
/** Heatmap setor × mês (12 colunas). */
export function Heatmap({ linhas, totalMes, isDark }: {
  linhas: Array<{ label: string; color: string; valores: number[]; total: number }>; totalMes: number[]; isDark: boolean
}) {
  const max = Math.max(...linhas.flatMap(l => l.valores), 1)
  const cellTxt = isDark ? 'text-slate-300' : 'text-slate-600'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th />
            {MESES.map((m, i) => <th key={i} className={`text-[12px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m}</th>)}
            <th className={`text-[12px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Σ</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.label}>
              <td className={`text-[13px] font-semibold pr-2 whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{l.label}</td>
              {l.valores.map((v, i) => {
                const a = v ? 0.18 + 0.82 * (v / max) : 0
                return (
                  <td key={i} className="w-9 h-9 text-center text-[13px] font-bold rounded" style={{ background: v ? hexA(l.color, a) : (isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'), color: v && a > 0.55 ? '#fff' : undefined }}>
                    <span className={v && a > 0.55 ? '' : cellTxt}>{v || ''}</span>
                  </td>
                )
              })}
              <td className={`text-[13px] font-extrabold text-center ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{l.total}</td>
            </tr>
          ))}
          <tr>
            <td className={`text-[13px] font-extrabold pr-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total</td>
            {totalMes.map((t, i) => <td key={i} className={`text-[13px] font-extrabold text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t || ''}</td>)}
            <td className={`text-[13px] font-extrabold text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>{totalMes.reduce((a, b) => a + b, 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
