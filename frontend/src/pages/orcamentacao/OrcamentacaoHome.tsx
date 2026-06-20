import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map as MapIcon, Plus, RefreshCw, ArrowRight, FileText, Activity } from 'lucide-react'
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

  const kpis = useMemo(() => {
    const concl = orcamentos.filter(o => o.status === 'concluido')
    const proc = orcamentos.filter(o => o.status === 'processando').length
    const ext = concl.reduce((s, o) => s + (o.resultado?.resumo?.extensao_km ?? 0), 0)
    const fat = concl.reduce((s, o) => s + (o.resultado?.resumo?.faturamento_total ?? 0), 0)
    return { total: orcamentos.length, concl: concl.length, proc, ext, fat }
  }, [orcamentos])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
            <MapIcon size={22} className="text-amber-500" /> Orçamentação
          </h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>Estimativa paramétrica de LT — KMZ + especificações → custo, prazo e recursos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => nav('/orcamentacao/novo')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Plus size={16} /> Novo Orçamento
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Orçamentos" value={kpis.total} hint={`${kpis.concl} concluído(s) · ${kpis.proc} processando`} tone="indigo" isDark={isDark} />
        <Kpi label="Extensão estimada" value={`${fmtNum(kpis.ext, 0)} km`} hint="soma das LTs concluídas" tone="sky" isDark={isDark} />
        <Kpi label="Faturamento estimado" value={fmtMM(kpis.fat)} hint="preços contratados CEMIG" tone="emerald" isDark={isDark} />
        <Kpi label="Custo TEG estimado" value={fmtMM(kpis.fat * 0.6)} hint="60% do faturamento" tone="amber" isDark={isDark} />
      </div>

      {/* Lista */}
      <section className={`${CARD(isDark)} overflow-hidden`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}>
            <FileText size={14} className="text-amber-500" /> Orçamentos
          </h2>
          <span className={`text-[11px] ${txtMuted}`}>{orcamentos.length} registro(s)</span>
        </div>

        {orcamentos.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
              <MapIcon size={26} className="text-amber-500" />
            </div>
            <p className={`text-sm font-bold ${txt}`}>Nenhum orçamento ainda</p>
            <p className={`text-xs mt-1 mb-4 ${txtMuted}`}>Envie um KMZ (e as especificações, se tiver) e o SuperTEG estima custo, prazo e recursos.</p>
            <button onClick={() => nav('/orcamentacao/novo')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
              <Plus size={16} /> Criar primeiro orçamento
            </button>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
            {orcamentos.map(o => {
              const r = o.resultado?.resumo
              return (
                <button
                  key={o.id}
                  onClick={() => nav(`/orcamentacao/${o.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{o.numero ?? '—'}</span>
                      <StatusBadge status={o.status} isDark={isDark} />
                    </div>
                    <p className={`text-sm font-semibold truncate ${txt}`}>{o.nome}</p>
                    <p className={`text-[11px] truncate ${txtMuted}`}>
                      {r ? `${fmtNum(r.extensao_km, 1)} km · ${fmtNum(r.torres)} torres · prazo ~${fmtNum(r.prazo_meses, 1)} m` : (o.descricao || 'Aguardando estimativa')}
                      {' · '}{fmtData(o.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {r && (
                      <>
                        <p className={`text-sm font-extrabold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmtMM(r.faturamento_total)}</p>
                        <p className={`text-[10px] ${txtMuted}`}>faturamento · {fmtNum(r.margem_operacional_pct, 0)}% margem</p>
                      </>
                    )}
                  </div>
                  <ArrowRight size={16} className={`shrink-0 ${txtMuted}`} />
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Rodapé informativo */}
      <div className={`flex items-start gap-2 text-[11px] rounded-xl px-3 py-2.5 ${isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        <Activity size={13} className="text-amber-500 mt-0.5 shrink-0" />
        <span>Classe de precisão ~±30% (AACE 4-5) — para viabilidade, comparação de traçados e proposta comercial. Não substitui orçamento executivo.</span>
      </div>
    </div>
  )
}
