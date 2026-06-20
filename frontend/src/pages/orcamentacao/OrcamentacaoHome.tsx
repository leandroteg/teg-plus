import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map as MapIcon, Plus, RefreshCw, ArrowRight, FileText, Target, Sparkles, CheckCircle2, Scale } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrcamentos } from '../../hooks/useOrcamentacao'
import { fmtMM, fmtNum, fmtData, Kpi, StatusBadge, CARD } from './_ui'

export default function OrcamentacaoHome() {
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: orcamentos = [], isLoading, refetch } = useOrcamentos()

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const m = useMemo(() => {
    const concl = orcamentos.filter(o => o.status === 'concluido')
    const proc = orcamentos.filter(o => o.status === 'processando').length
    const ext = concl.reduce((s, o) => s + (o.resultado?.resumo?.extensao_km ?? 0), 0)
    const custo = concl.reduce((s, o) => s + (o.resultado?.resumo?.custo_total ?? 0), 0)
    const us = concl.reduce((s, o) => s + (o.resultado?.resumo?.us ?? 0), 0)
    // assertividade
    const exatos = concl.filter(o => (o.resultado?.premissas_usadas as Record<string, unknown> | undefined)?.us_exato === true).length
    const comIA = concl.filter(o => String((o.resultado?.premissas_usadas as Record<string, unknown> | undefined)?.analise_por ?? '').includes('Claude')).length
    const desvios = concl.map(o => o.resultado?.comparacao?.desvio_vs_frente_pct).filter((v): v is number => typeof v === 'number').map(Math.abs)
    const desvioMedio = desvios.length ? desvios.reduce((a, b) => a + b, 0) / desvios.length : null
    return { total: orcamentos.length, concl: concl.length, proc, ext, custo, us, exatos, comIA, desvioMedio }
  }, [orcamentos])

  const recentes = orcamentos.slice(0, 5)

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
            <MapIcon size={22} className="text-amber-500" /> Painel — Orçamentação
          </h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>Visão geral da carteira de orçamentos de LT (custo, US e assertividade)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
            <RefreshCw size={16} />
          </button>
          <button onClick={() => nav('/orcamentacao/novo')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm">
            <Plus size={16} /> Novo Orçamento
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Orçamentos" value={m.total} hint={`${m.concl} concluído(s) · ${m.proc} processando`} tone="indigo" isDark={isDark} />
        <Kpi label="Extensão estimada" value={`${fmtNum(m.ext, 0)} km`} hint="soma das LTs concluídas" tone="sky" isDark={isDark} />
        <Kpi label="Total de US" value={fmtNum(m.us)} hint="unidades de serviço CEMIG" tone="teal" isDark={isDark} />
        <Kpi label="Custo estimado" value={fmtMM(m.custo)} hint="custo real Nibo+TOTVS" tone="amber" isDark={isDark} />
      </div>

      {/* Assertividade */}
      <section className={`${CARD(isDark)} p-4`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txt}`}><Target size={14} className="text-amber-500" /> Assertividade</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`rounded-xl p-3 flex items-center gap-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            <div>
              <p className={`text-lg font-extrabold leading-none ${txt}`}>{m.concl ? Math.round(100 * m.exatos / m.concl) : 0}%</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Custo exato (US do edital)</p>
              <p className={`text-[10px] ${txtMuted}`}>{m.exatos} de {m.concl} · resto estimado pela geometria</p>
            </div>
          </div>
          <div className={`rounded-xl p-3 flex items-center gap-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
            <Sparkles size={20} className="text-amber-500 shrink-0" />
            <div>
              <p className={`text-lg font-extrabold leading-none ${txt}`}>{m.concl ? Math.round(100 * m.comIA / m.concl) : 0}%</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Analisado pelo SuperTEG</p>
              <p className={`text-[10px] ${txtMuted}`}>terreno por obra/região</p>
            </div>
          </div>
          <div className={`rounded-xl p-3 flex items-center gap-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
            <Scale size={20} className="text-sky-500 shrink-0" />
            <div>
              <p className={`text-lg font-extrabold leading-none ${txt}`}>{m.desvioMedio == null ? '—' : `±${fmtNum(m.desvioMedio, 0)}%`}</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Desvio médio vs carteira</p>
              <p className={`text-[10px] ${txtMuted}`}>custo/torre vs frentes reais</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recentes */}
      <section className={`${CARD(isDark)} overflow-hidden`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}><FileText size={14} className="text-amber-500" /> Recentes</h2>
          <button onClick={() => nav('/orcamentacao/orcamentos')} className="text-xs text-amber-500 hover:text-amber-600 font-semibold flex items-center gap-1">Ver todos <ArrowRight size={12} /></button>
        </div>
        {recentes.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className={`text-sm font-bold ${txt}`}>Nenhum orçamento ainda</p>
            <button onClick={() => nav('/orcamentacao/novo')} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
              <Plus size={16} /> Criar primeiro orçamento
            </button>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
            {recentes.map(o => {
              const r = o.resultado?.resumo
              return (
                <button key={o.id} onClick={() => nav(`/orcamentacao/${o.id}`)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{o.numero ?? '—'}</span>
                      <StatusBadge status={o.status} isDark={isDark} />
                    </div>
                    <p className={`text-sm font-semibold truncate ${txt}`}>{o.nome}</p>
                    <p className={`text-[11px] truncate ${txtMuted}`}>{r ? `${fmtNum(r.extensao_km, 1)} km · ${fmtNum(r.us)} US` : (o.descricao || 'Aguardando estimativa')} · {fmtData(o.created_at)}</p>
                  </div>
                  {r && (
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className={`text-sm font-extrabold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{fmtMM(r.custo_total)}</p>
                      <p className={`text-[10px] ${txtMuted}`}>custo</p>
                    </div>
                  )}
                  <ArrowRight size={16} className={`shrink-0 ${txtMuted}`} />
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
