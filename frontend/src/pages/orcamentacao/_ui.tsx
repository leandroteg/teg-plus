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
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
  const splitCells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
  const isSep = (l: string) => isRow(l) && splitCells(l).every(c => /^:?-+:?$/.test(c))
  const isNum = (s: string) => /\d/.test(s) && /^[\s\d.,%+\-/xX]*(R\$|US)?[\s\d.,%+\-/xX]*$/.test(s)

  let i = 0
  while (i < lines.length) {
    const l = (lines[i] || '').trimEnd()
    // ── Tabela GFM: linha "| a | b |" seguida de separador "|---|---|" ──
    if (isRow(l) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = splitCells(l)
      const rows: string[][] = []
      let j = i + 2
      while (j < lines.length && isRow(lines[j]) && !isSep(lines[j])) { rows.push(splitCells(lines[j])); j++ }
      const alignRight = header.map((_, k) => isNum(rows[0]?.[k] ?? ''))
      out.push(
        <div key={i} className="overflow-x-auto my-2 -mx-1">
          <table className={`w-full text-[11px] border-collapse rounded-lg overflow-hidden border ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
            <thead>
              <tr className={isDark ? 'bg-white/[0.04]' : 'bg-slate-100/70'}>
                {header.map((h, k) => (
                  <th key={k} className={`px-2.5 py-1.5 font-bold whitespace-nowrap ${alignRight[k] ? 'text-right' : 'text-left'} ${head}`}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={`${ri ? (isDark ? 'border-t border-white/[0.05]' : 'border-t border-slate-100') : ''} ${ri % 2 ? (isDark ? 'bg-white/[0.015]' : 'bg-slate-50/40') : ''}`}>
                  {header.map((_, k) => (
                    <td key={k} className={`px-2.5 py-1 whitespace-nowrap ${alignRight[k] ? 'text-right tabular-nums font-semibold' : 'text-left'} ${txt}`}>{inline(r[k] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      i = j
      continue
    }
    if (!l.trim()) { out.push(<div key={i} className="h-2" />); i++; continue }
    const hMatch = l.match(/^(#{1,6})\s+(.*)/)
    if (hMatch) {
      const nivel = hMatch[1].length
      const cls = nivel <= 1 ? `text-base font-extrabold mt-2 mb-1.5 ${head}`
        : nivel === 2 ? `text-sm font-extrabold mt-3 mb-1 ${head}`
        : nivel === 3 ? `text-xs font-bold mt-2 mb-1 ${head}`
        : `text-[11px] font-bold uppercase tracking-wide mt-2 mb-0.5 ${head}`
      out.push(<p key={i} className={cls}>{inline(hMatch[2])}</p>)
    } else if (/^\d+\.\s/.test(l)) {
      const m = l.match(/^(\d+)\.\s(.*)/)!
      out.push(<div key={i} className={`flex gap-2 text-xs leading-relaxed ${txt}`}><span className="text-amber-500 font-bold tabular-nums shrink-0">{m[1]}.</span><span>{inline(m[2])}</span></div>)
    } else if (/^[-*]\s/.test(l)) {
      out.push(<div key={i} className={`flex gap-2 text-xs leading-relaxed ${txt}`}><span className="text-amber-500">•</span><span>{inline(l.replace(/^[-*]\s/, ''))}</span></div>)
    } else {
      out.push(<p key={i} className={`text-xs leading-relaxed ${txt}`}>{inline(l)}</p>)
    }
    i++
  }
  return <div className="space-y-0.5">{out}</div>
}

export const CARD = (isDark: boolean) =>
  `rounded-2xl border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`
