import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileText, RefreshCw, AlertTriangle, Clock, Target, RefreshCcw, ArrowRight, TrendingUp } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useSgiKPIs, useDocumentos, useObjetivos } from '../../hooks/useSgi'
import { STATUS_DOC_LABEL, TIPO_DOC_LABEL, FAROL_CFG } from '../../types/sgi'
import type { SgiMeta, SgiCheckin, SgiObjetivo, Farol } from '../../types/sgi'

type MetaFull = SgiMeta & { checkins: SgiCheckin[] }
type ObjFull = SgiObjetivo & { metas: MetaFull[] }

const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
const ultimoCheckin = (m: MetaFull): SgiCheckin | null =>
  m.checkins?.length ? [...m.checkins].sort((a, b) => (b.competencia || '').localeCompare(a.competencia || ''))[0] : null
const fmtVal = (v: number | null | undefined, unidade?: string | null) => {
  if (v == null) return '—'
  const n = v.toLocaleString('pt-BR')
  if (!unidade) return n
  return unidade === '%' ? `${n}%` : `${n} ${unidade}`
}

const FAROL_ORDER: Farol[] = ['verde', 'amarelo', 'vermelho', 'cinza']
const FAROL_BAR: Record<Farol, string> = { verde: 'bg-emerald-500', amarelo: 'bg-amber-500', vermelho: 'bg-red-500', cinza: 'bg-slate-300' }

export default function SgiPainel() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const { data: kpis, isLoading, refetch } = useSgiKPIs()
  const { data: objetivos = [] } = useObjetivos()
  const { data: documentos = [] } = useDocumentos()

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const faint = isDark ? 'text-slate-500' : 'text-slate-400'
  const card = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const soft = isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'

  // Metas anuais (scorecard estratégico) + faróis
  const anuais = useMemo(() => objetivos
    .flatMap(o => o.metas.filter(m => m.periodo === 'anual').map(m => ({ o, m, u: ultimoCheckin(m) })))
    , [objetivos])
  const faroisAnuais = useMemo(() => {
    const c: Record<Farol, number> = { verde: 0, amarelo: 0, vermelho: 0, cinza: 0 }
    anuais.forEach(a => { c[(a.u?.farol as Farol) || 'cinza']++ })
    return c
  }, [anuais])

  // Saúde por trimestre (check-in dos KRs)
  const tris = useMemo(() => [1, 2, 3, 4].map(t => {
    const ms = objetivos.flatMap(o => o.metas.filter(m => m.periodo === 'trimestral' && m.trimestre === t).map(m => ultimoCheckin(m)))
    const c: Record<Farol, number> = { verde: 0, amarelo: 0, vermelho: 0, cinza: 0 }
    ms.forEach(u => { c[(u?.farol as Farol) || 'cinza']++ })
    return { t, total: ms.length, c }
  }).filter(x => x.total > 0), [objetivos])

  const recentes = useMemo(() => [...documentos].slice(0, 5), [documentos])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
            <ClipboardCheck size={22} className="text-violet-500" /> SGI · Gestão
          </h1>
          <p className={`text-xs mt-0.5 ${muted}`}>Governança: objetivos, metas, melhoria contínua e documentos</p>
        </div>
        <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Scorecard estratégico — Metas Anuais */}
      <section className={`rounded-3xl border shadow-sm overflow-hidden ${card}`}>
        <div className={`px-4 md:px-5 pt-4 pb-3 flex items-center justify-between gap-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${faint}`}>Scorecard Estratégico 2026</p>
            <h2 className={`mt-0.5 text-base font-black ${txt}`}>Metas Anuais</h2>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <span className="inline-flex items-center gap-1 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />{faroisAnuais.verde}</span>
            <span className="inline-flex items-center gap-1 text-amber-500"><span className="w-2 h-2 rounded-full bg-amber-500" />{faroisAnuais.amarelo}</span>
            <span className="inline-flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded-full bg-red-500" />{faroisAnuais.vermelho}</span>
          </div>
        </div>
        {anuais.length === 0 ? (
          <p className={`text-xs p-5 ${muted}`}>Nenhuma meta anual cadastrada.</p>
        ) : (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {anuais.map(({ o, m, u }) => {
              const fr = FAROL_CFG[(u?.farol as Farol) || 'cinza']
              return (
                <div key={m.id} className={`rounded-xl p-3 ${soft}`}>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${faint}`}>{o.area_processo || '—'}</p>
                  <p className={`text-sm font-bold leading-tight truncate ${txt}`}>{o.titulo}</p>
                  <div className="flex items-end justify-between gap-2 mt-2">
                    <div className="min-w-0">
                      <p className={`text-[8px] font-bold uppercase tracking-wider ${faint}`}>Realizado</p>
                      <p className={`text-xl font-extrabold leading-none ${fr.text}`}>{fmtVal(u?.realizado, o.unidade)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[8px] font-bold uppercase tracking-wider ${faint}`}>Meta</p>
                      <p className={`text-xs font-bold ${muted}`}>{o.direcao === 'menor_melhor' ? '≤' : '≥'} {fmtVal(m.alvo, o.unidade)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${fr.bg} ${fr.text}`}><span className={`w-1.5 h-1.5 rounded-full ${fr.dot}`} />{fr.label}</span>
                    {u && <span className={`text-[9px] ${faint}`}>{u.competencia}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <button onClick={() => nav('/sgi/objetivos')} className={`w-full px-4 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1 border-t ${isDark ? 'border-white/[0.06] text-violet-400 hover:bg-white/[0.03]' : 'border-slate-100 text-violet-600 hover:bg-slate-50'}`}>
          Ver Objetivos e Metas <ArrowRight size={12} />
        </button>
      </section>

      {/* OKRs por trimestre — saúde dos KRs */}
      {tris.length > 0 && (
        <section className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
          <div className={`px-4 py-3 flex items-center gap-2 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <Target size={15} className="text-teal-500" />
            <h2 className={`text-sm font-extrabold ${txt}`}>OKRs por Trimestre</h2>
          </div>
          <div className="p-4 space-y-3">
            {tris.map(({ t, total, c }) => (
              <div key={t} className="flex items-center gap-3">
                <span className={`text-xs font-bold w-20 shrink-0 ${txt}`}>Trim. {t}</span>
                <div className={`flex-1 flex h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  {FAROL_ORDER.map(fk => c[fk] > 0 ? <div key={fk} className={FAROL_BAR[fk]} style={{ width: `${(c[fk] / total) * 100}%` }} title={`${FAROL_CFG[fk].label}: ${c[fk]}`} /> : null)}
                </div>
                <span className={`text-[10px] font-semibold w-28 text-right shrink-0 ${faint}`}>
                  {c.verde}✓ · {c.amarelo}~ · {c.vermelho}✕ {c.cinza > 0 ? `· ${c.cinza}—` : ''}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => nav('/sgi/objetivos')} className={`w-full px-4 py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1 border-t ${isDark ? 'border-white/[0.06] text-teal-400 hover:bg-white/[0.03]' : 'border-slate-100 text-teal-600 hover:bg-slate-50'}`}>
            Ver Check-in e Revisão <ArrowRight size={12} />
          </button>
        </section>
      )}

      {/* Melhoria Contínua + Padronização */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={() => nav('/sgi/melhoria')} className={`rounded-2xl border shadow-sm p-4 text-left transition-all ${card} ${isDark ? 'hover:bg-white/[0.02]' : 'hover:shadow-md'}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}><RefreshCcw size={15} className="text-amber-500" /> Melhoria Contínua</h2>
            <ArrowRight size={13} className={faint} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`rounded-xl p-3 ${soft}`}>
              <p className={`text-2xl font-extrabold leading-none ${(kpis?.ncsAbertas ?? 0) > 0 ? 'text-amber-500' : txt}`}>{kpis?.ncsAbertas ?? 0}</p>
              <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${faint}`}>NCs / registros abertos</p>
            </div>
            <div className={`rounded-xl p-3 ${soft}`}>
              <p className={`text-2xl font-extrabold leading-none ${(kpis?.acoesAtrasadas ?? 0) > 0 ? 'text-red-500' : txt}`}>{kpis?.acoesAtrasadas ?? 0}</p>
              <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${faint}`}>Ações atrasadas</p>
            </div>
          </div>
        </button>

        <button onClick={() => nav('/sgi/padronizacao')} className={`rounded-2xl border shadow-sm p-4 text-left transition-all ${card} ${isDark ? 'hover:bg-white/[0.02]' : 'hover:shadow-md'}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}><FileText size={15} className="text-violet-500" /> Padronização</h2>
            <ArrowRight size={13} className={faint} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-xl p-3 ${soft}`}>
              <p className={`text-xl font-extrabold leading-none text-emerald-500`}>{kpis?.vigentes ?? 0}</p>
              <p className={`text-[8px] font-bold uppercase tracking-wider mt-1 ${faint}`}>Vigentes</p>
            </div>
            <div className={`rounded-xl p-3 ${soft}`}>
              <p className={`text-xl font-extrabold leading-none text-sky-500`}>{kpis?.emFluxo ?? 0}</p>
              <p className={`text-[8px] font-bold uppercase tracking-wider mt-1 ${faint}`}>Em fluxo</p>
            </div>
            <div className={`rounded-xl p-3 ${soft}`}>
              <p className={`text-xl font-extrabold leading-none ${((kpis?.revisaoVencendo ?? 0) + (kpis?.revisaoVencida ?? 0)) > 0 ? 'text-amber-500' : txt}`}>{(kpis?.revisaoVencendo ?? 0) + (kpis?.revisaoVencida ?? 0)}</p>
              <p className={`text-[8px] font-bold uppercase tracking-wider mt-1 ${faint}`}>Revisão a vencer</p>
            </div>
          </div>
        </button>
      </div>

      {/* Documentos recentes */}
      <div className={`rounded-2xl border shadow-sm p-4 ${card}`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`text-sm font-bold flex items-center gap-1.5 ${txt}`}><Clock size={14} className="text-violet-500" /> Documentos recentes</p>
          <button onClick={() => nav('/sgi/padronizacao')} className="text-xs text-violet-500 hover:text-violet-600 font-semibold flex items-center gap-1">Ver todos <ArrowRight size={12} /></button>
        </div>
        {recentes.length === 0 ? (
          <p className={`text-xs ${muted}`}>Nenhum documento cadastrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentes.map(doc => {
              const st = STATUS_DOC_LABEL[doc.status]
              return (
                <div key={doc.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{doc.codigo ? `${doc.codigo} · ` : ''}{doc.titulo}</span>
                    <p className={`text-[10px] ${faint}`}>{TIPO_DOC_LABEL[doc.tipo]} · v{doc.versao} · {fmtDate(doc.updated_at?.split('T')[0])}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${st.bg} ${st.text}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
