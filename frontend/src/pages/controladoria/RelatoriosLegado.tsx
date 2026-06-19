import { useMemo, useState } from 'react'
import {
  Archive, RefreshCw, Filter, Building2, MapPin, Layers3,
  CalendarRange, Tags, X,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useLegadoResumo, type LegadoResumo } from '../../hooks/useLegado'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
const fmtFull = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v: number, t: number) => (t > 0 ? ((v / t) * 100).toFixed(1) + '%' : '—')
const MESES = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const NAT_CFG: Record<string, { label: string; color: string; bar: string }> = {
  custo_direto:    { label: 'Custo Direto',     color: 'text-teal-500',    bar: 'from-teal-400 to-teal-600' },
  despesa_fixa:    { label: 'Despesa Fixa/Adm', color: 'text-violet-500',  bar: 'from-violet-400 to-violet-600' },
  imposto:         { label: 'Impostos',         color: 'text-amber-500',   bar: 'from-amber-400 to-amber-600' },
  nao_operacional: { label: 'Não Operacional',  color: 'text-rose-500',    bar: 'from-rose-400 to-rose-600' },
  receita:         { label: 'Receita',          color: 'text-emerald-500', bar: 'from-emerald-400 to-emerald-600' },
}

type View = 'polo' | 'obra' | 'grupo' | 'mes' | 'natureza'
const VIEWS: Array<{ key: View; label: string; icon: React.ElementType }> = [
  { key: 'polo',     label: 'Por Polo',      icon: MapPin },
  { key: 'obra',     label: 'Por Obra',      icon: Building2 },
  { key: 'grupo',    label: 'Por Grupo DRE', icon: Layers3 },
  { key: 'mes',      label: 'Por Mês',       icon: CalendarRange },
  { key: 'natureza', label: 'Por Natureza',  icon: Tags },
]

function inPeriodoReal(r: LegadoResumo) {
  // jun/2025 a mai/2026 (período efetivo; resto é ruído de digitação)
  if (r.ano === 2025) return (r.mes ?? 0) >= 6
  if (r.ano === 2026) return (r.mes ?? 0) <= 5
  return false
}

// ── Component ────────────────────────────────────────────────────────────────
export default function RelatoriosLegado() {
  const { isDark } = useTheme()
  const { data: rows = [], isLoading, isError, refetch, isFetching } = useLegadoResumo()

  const [periodo, setPeriodo] = useState<'real' | 'tudo'>('real')
  const [polo, setPolo] = useState<string>('')
  const [grupo, setGrupo] = useState<string>('')
  const [nat, setNat] = useState<string>('')
  const [view, setView] = useState<View>('polo')

  const polos = useMemo(() => [...new Set(rows.map(r => r.polo).filter(Boolean))].sort() as string[], [rows])
  const grupos = useMemo(() => [...new Set(rows.map(r => r.grupo_dre).filter(Boolean))].sort() as string[], [rows])
  const nats = useMemo(() => [...new Set(rows.map(r => r.natureza_dre).filter(Boolean))].sort() as string[], [rows])

  const filtered = useMemo(() => rows.filter(r =>
    (periodo === 'tudo' || inPeriodoReal(r)) &&
    (!polo || r.polo === polo) &&
    (!grupo || r.grupo_dre === grupo) &&
    (!nat || r.natureza_dre === nat),
  ), [rows, periodo, polo, grupo, nat])

  const total = useMemo(() => filtered.reduce((s, r) => s + r.valor, 0), [filtered])
  const porNatDre = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) m.set(r.natureza_dre ?? '—', (m.get(r.natureza_dre ?? '—') ?? 0) + r.valor)
    return m
  }, [filtered])
  const obrasCount = useMemo(() => new Set(filtered.filter(r => r.obra_id).map(r => r.obra_id)).size, [filtered])

  const agg = useMemo(() => {
    const sum = (keyFn: (r: LegadoResumo) => string): Array<{ k: string; v: number; label?: string }> => {
      const m = new Map<string, number>()
      for (const r of filtered) { const k = keyFn(r); m.set(k, (m.get(k) ?? 0) + r.valor) }
      return [...m.entries()].map(([k, v]) => ({ k, v }))
    }
    const polo = sum(r => r.polo ?? '— (sem polo)').sort((a, b) => b.v - a.v)
    const obra = sum(r => r.obra_nome ?? (r.tipo_cc === 'estrutura' ? 'Estrutura (overhead)' : r.tipo_cc === 'frota' ? 'Frota (geral)' : '— sem obra')).sort((a, b) => b.v - a.v)
    const grupo = sum(r => r.grupo_dre ?? '—').sort((a, b) => b.v - a.v)
    const natureza = sum(r => r.classe_desc ?? '—').sort((a, b) => b.v - a.v)
    const mes = sum(r => `${r.ano}-${String(r.mes).padStart(2, '0')}`)
      .sort((a, b) => a.k.localeCompare(b.k))
      .map(x => ({ ...x, label: x.k.split('-')[1] && MESES[+x.k.split('-')[1]] ? `${MESES[+x.k.split('-')[1]]}/${x.k.split('-')[0].slice(2)}` : x.k }))
    return { polo, obra, grupo, natureza, mes }
  }, [filtered])

  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const selCls = `text-xs rounded-xl px-2.5 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 [&>option]:bg-slate-900' : 'bg-white border-slate-200 text-slate-700'}`

  const activeData = view === 'polo' ? agg.polo : view === 'obra' ? agg.obra.slice(0, 20) : view === 'grupo' ? agg.grupo : view === 'mes' ? agg.mes : agg.natureza.slice(0, 25)
  const maxV = Math.max(...activeData.map(d => Math.abs(d.v)), 1)
  const barColor = view === 'grupo' ? 'from-violet-400 to-violet-600' : view === 'mes' ? 'from-sky-400 to-sky-600' : view === 'natureza' ? 'from-amber-400 to-amber-600' : 'from-teal-400 to-teal-600'

  if (isLoading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (isError) return <div className={`rounded-2xl p-8 text-center text-sm ${cardClass} text-rose-500`}>Erro ao carregar os dados do legado.</div>

  const hasFilter = polo || grupo || nat || periodo !== 'real'

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
            <Archive size={18} className="text-amber-500" />
          </div>
          <div>
            <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Relatórios Legado</h1>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Custos históricos (TOTVS/NIBO) — {fmt(total)} no recorte</p>
          </div>
        </div>
        <button onClick={() => refetch()} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border ${isDark ? 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className={`rounded-2xl p-3 flex flex-wrap items-center gap-2 ${cardClass}`}>
        <span className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Filter size={12} /> Filtros</span>
        <div className={`flex rounded-xl p-0.5 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          {(['real', 'tudo'] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${periodo === p ? 'bg-teal-600 text-white' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {p === 'real' ? 'jun/25–mai/26' : 'Tudo'}
            </button>
          ))}
        </div>
        <select className={selCls} value={polo} onChange={e => setPolo(e.target.value)}>
          <option value="">Todos os polos</option>
          {polos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={selCls} value={grupo} onChange={e => setGrupo(e.target.value)}>
          <option value="">Todos os grupos</option>
          {grupos.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className={selCls} value={nat} onChange={e => setNat(e.target.value)}>
          <option value="">Todas as naturezas</option>
          {nats.map(n => <option key={n} value={n}>{NAT_CFG[n]?.label ?? n}</option>)}
        </select>
        {hasFilter && (
          <button onClick={() => { setPolo(''); setGrupo(''); setNat(''); setPeriodo('real') }} className="flex items-center gap-1 text-[11px] text-rose-500 font-semibold ml-auto">
            <X size={11} /> Limpar
          </button>
        )}
      </div>

      {/* KPIs por natureza DRE */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className={`rounded-2xl p-3 ${cardClass}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Custo Total</p>
          <p className={`text-xl font-extrabold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(total)}</p>
          <p className="text-[9px] text-slate-500 mt-0.5">{obrasCount} obras · {filtered.length} grupos</p>
        </div>
        {['custo_direto', 'despesa_fixa', 'imposto', 'nao_operacional'].map(k => {
          const v = porNatDre.get(k) ?? 0
          const cfg = NAT_CFG[k]
          return (
            <div key={k} className={`rounded-2xl p-3 ${cardClass}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cfg.label}</p>
              <p className={`text-xl font-extrabold mt-1 ${cfg.color}`}>{fmt(v)}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">{pct(v, total)}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs de visão */}
      <div className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {VIEWS.map(v => {
          const active = view === v.key
          return (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`min-w-fit flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all md:flex-1 ${
                active ? 'bg-teal-600 text-white shadow-sm' : isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-white'
              }`}>
              <v.icon size={14} /> {v.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {VIEWS.find(v => v.key === view)?.label}
            {view === 'obra' && <span className="text-[10px] font-normal text-slate-500 ml-1">(top 20)</span>}
            {view === 'natureza' && <span className="text-[10px] font-normal text-slate-500 ml-1">(top 25)</span>}
          </h2>
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{activeData.length} itens · {fmt(total)}</span>
        </div>
        <div className="p-4 space-y-2">
          {activeData.length === 0 ? (
            <p className={`text-center text-sm py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum dado no recorte selecionado</p>
          ) : activeData.map((d, i) => (
            <div key={i} className="flex items-center gap-3" title={`${d.label ?? d.k}: ${fmtFull(d.v)}`}>
              <p className={`text-[11px] font-semibold text-right shrink-0 w-[140px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.label ?? d.k}</p>
              <div className="flex-1 relative">
                <div className={`h-6 rounded-lg overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                  <div className={`h-full rounded-lg bg-gradient-to-r ${barColor} transition-all duration-500`} style={{ width: `${Math.max((Math.abs(d.v) / maxV) * 100, 1.5)}%` }} />
                </div>
              </div>
              <p className={`text-[11px] font-extrabold shrink-0 w-[78px] text-right tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmt(d.v)}</p>
              <p className="text-[10px] text-slate-500 shrink-0 w-[44px] text-right tabular-nums">{pct(d.v, total)}</p>
            </div>
          ))}
        </div>
      </section>

      <p className={`text-[10px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        Fonte: <code>fin_legado_custos</code> · TOTVS jun/25–mai/26 (R$ 26,95 mi) · valores diretos por lançamento; Estrutura/Frota = overhead (rateio em aba própria)
      </p>
    </div>
  )
}
