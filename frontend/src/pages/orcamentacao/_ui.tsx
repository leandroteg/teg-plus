import type { OrcStatus } from '../../types/orcamentacao'

// ── Formatadores ──────────────────────────────────────────────────────────────
export const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)

export const fmtMM = (v: number) => {
  const n = v || 0
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MM`
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return fmtBRL(n)
}

export const fmtNum = (v: number, dec = 0) =>
  (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export const fmtData = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

// ── Status ─────────────────────────────────────────────────────────────────────
export const STATUS_META: Record<OrcStatus, { label: string; cls: (dark: boolean) => string; dot: string }> = {
  rascunho:    { label: 'Rascunho',      cls: d => d ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  processando: { label: 'Processando',   cls: d => d ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  concluido:   { label: 'Concluído',     cls: d => d ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  erro:        { label: 'Erro',          cls: d => d ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
}

export function StatusBadge({ status, isDark }: { status: OrcStatus; isDark: boolean }) {
  const m = STATUS_META[status] ?? STATUS_META.rascunho
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${m.cls(isDark)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${status === 'processando' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  )
}

// ── KPI card (standalone, padrão Detalhada) ─────────────────────────────────────
export function Kpi({ label, value, hint, tone, isDark }: {
  label: string; value: string | number; hint?: string; tone: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    amber:   isDark ? 'text-amber-400' : 'text-amber-600',
    teal:    isDark ? 'text-teal-400' : 'text-teal-600',
    indigo:  isDark ? 'text-indigo-400' : 'text-indigo-600',
    sky:     isDark ? 'text-sky-400' : 'text-sky-600',
    rose:    isDark ? 'text-rose-400' : 'text-rose-600',
    slate:   isDark ? 'text-slate-300' : 'text-slate-700',
  }
  return (
    <section className={`rounded-2xl border p-4 ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-2xl font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
      {hint && <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{hint}</p>}
    </section>
  )
}

// ── Barra horizontal (% / valor) ────────────────────────────────────────────────
export function BarRow({ label, value, pct, max, cor, isDark, right }: {
  label: string; value?: string; pct?: number; max: number; cor: string; isDark: boolean; right?: string
}) {
  const w = max > 0 ? Math.max(2, ((pct ?? 0) / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`text-[11px] w-[150px] shrink-0 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
      <div className={`flex-1 h-3.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: cor }} />
      </div>
      <span className={`text-[11px] font-bold w-[88px] text-right shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{right ?? value}</span>
    </div>
  )
}

// ── Markdown enxuto (títulos, negrito, listas) ──────────────────────────────────
export function MiniMarkdown({ text, isDark }: { text: string; isDark: boolean }) {
  const txt = isDark ? 'text-slate-300' : 'text-slate-700'
  const head = isDark ? 'text-white' : 'text-slate-900'
  const lines = (text || '').replace(/\r/g, '').split('\n')
  const out: React.ReactNode[] = []
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i} className={head}>{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>)
  lines.forEach((raw, i) => {
    const l = raw.trimEnd()
    if (!l.trim()) { out.push(<div key={i} className="h-2" />); return }
    if (l.startsWith('### ')) out.push(<h4 key={i} className={`text-xs font-bold mt-2 mb-1 ${head}`}>{inline(l.slice(4))}</h4>)
    else if (l.startsWith('## ')) out.push(<h3 key={i} className={`text-sm font-extrabold mt-3 mb-1 ${head}`}>{inline(l.slice(3))}</h3>)
    else if (l.startsWith('# ')) out.push(<h2 key={i} className={`text-base font-extrabold mt-2 mb-1.5 ${head}`}>{inline(l.slice(2))}</h2>)
    else if (/^[-*]\s/.test(l)) out.push(<div key={i} className={`flex gap-2 text-xs leading-relaxed ${txt}`}><span className="text-amber-500">•</span><span>{inline(l.replace(/^[-*]\s/, ''))}</span></div>)
    else out.push(<p key={i} className={`text-xs leading-relaxed ${txt}`}>{inline(l)}</p>)
  })
  return <div className="space-y-0.5">{out}</div>
}

export const CARD = (isDark: boolean) =>
  `rounded-2xl border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`
