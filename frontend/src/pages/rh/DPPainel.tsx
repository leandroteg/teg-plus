// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/DPPainel.tsx — Painel do DP (padrão dos dashboards TEG+)
// Alimentado pelo espelho do Ponto (Secullum). Indicadores em HORAS — valores em
// R$ (folha/custo-hora) ainda não integrados, então NÃO são exibidos (nada fake).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import {
  Timer, Fingerprint, TrendingUp, ChevronRight, Zap, Clock, AlertTriangle,
  AlarmClock, Activity, Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { usePontoResumoIntervalo, usePontoColabAtivos, janelaPadrao } from '../../hooks/usePonto'
import { intervalToMin } from '../../lib/ponto'
import { SpotlightMetric, MiniInfoCard } from '../../components/rh/DPPainelCards'
import DPFolhaPainel from './DPFolhaPainel'

// horas compactas p/ destaque: "28.080h"
const hAbbr = (min: number) => `${Math.round(min / 60).toLocaleString('pt-BR')}h`
const fmtPct = (p: number) => `${p < 10 ? p.toFixed(1) : Math.round(p)}%`
// banco de horas (não paga hora extra) — hoje só Escritório Central
const ehBanco = (nome?: string | null) => /escrit[óo]rio\s*central/i.test(nome ?? '')

function DataSelect({ value, onChange, isDark, label }: {
  value: string; onChange: (v: string) => void; isDark: boolean; label: string
}) {
  const cls = `rounded-lg px-2 py-1 border text-xs font-semibold cursor-pointer ${
    isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
  }`
  return <input type="date" value={value} onChange={e => onChange(e.target.value)}
    className={cls} aria-label={label} title={label} />
}

export default function DPPainel() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  const [view, setView] = useState<'ponto' | 'folha'>('ponto')
  // abre na COMPETENCIA DA FOLHA (26 do mes anterior ao 25), nao no mes civil:
  // e a janela que o DP fecha, paga e manda assinar
  const padrao = () => {
    const d = new Date()
    return janelaPadrao(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }
  const [de, setDe] = useState(() => padrao().ini)
  const [ate, setAte] = useState(() => padrao().fim)

  const { data: resumo = [], isLoading } = usePontoResumoIntervalo(de, ate)
  const { data: ativos } = usePontoColabAtivos()
  const pico = ativos?.pico ?? 0
  const headcount = ativos?.headcount ?? 0

  const agg = useMemo(() => {
    let hhMin = 0, exMin = 0, hhPagavel = 0, emAberto = 0, foraHorario = 0
    let diasBatidos = 0, diasRetif = 0, faltasMin = 0, cargaMin = 0
    const ccMap = new Map<string, { nome: string; min: number }>()
    const baseMap = new Map<string, { nome: string; emAberto: number; diasBatidos: number; exMin: number; hhMin: number }>()
    const comBatida = new Set<string>(), comApur = new Set<string>()
    for (const r of resumo) {
      // HH e extras TOTAIS. Os campos _real descartavam o dia inteiro quando a
      // Entrada1 era lançada à mão (Origem 2) — critério que errava nos dois
      // sentidos: jogava fora ~11,6 mil h de dias cujas outras batidas eram do
      // relógio, e ainda assim deixava passar metade das extras vindas de dias
      // com lançamento manual em OUTRA batida (a Saída2, justamente a que mais
      // se retifica e a que define a hora extra). A hora é paga de todo jeito.
      const hh = intervalToMin(r.hh_trabalhada)
      const exV = intervalToMin(r.extras_validos)   // sem dias em aberto
      const banco = ehBanco(r.base_nome)            // banco de horas não paga extra
      hhMin += hh
      if (!banco) { exMin += exV; hhPagavel += hh } // hora extra A PAGAR + base do %
      emAberto += r.dias_em_aberto_real || 0
      foraHorario += r.dias_fora_horario_real || 0
      // retificação conta o dia com QUALQUER batida manual; falta é medida em
      // horas sobre a carga prevista — dia não serve de denominador porque meio
      // período e dia inteiro pesariam igual
      diasBatidos += r.dias_batidos || 0
      diasRetif += r.dias_retificados || 0
      faltasMin += intervalToMin(r.faltas)
      cargaMin += intervalToMin(r.carga ?? null)
      // anota os cards de HH/extras, então acompanha o mesmo critério deles
      if (r.colaborador_id && (r.dias_batidos || 0) > 0) comBatida.add(r.colaborador_id)
      if (r.colaborador_id && hh > 0) comApur.add(r.colaborador_id)
      const ck = r.cc_codigo || r.cc_nome || '—'
      const cc = ccMap.get(ck) || { nome: r.cc_nome || r.cc_codigo || 'Sem CC', min: 0 }
      cc.min += hh; ccMap.set(ck, cc)
      const bk = r.base_id ?? r.base_nome ?? '—'
      const b = baseMap.get(bk) || { nome: r.base_nome ?? 'Sem base', emAberto: 0, diasBatidos: 0, exMin: 0, hhMin: 0 }
      b.emAberto += r.dias_em_aberto_real || 0
      b.diasBatidos += r.dias_batidos_real || 0
      b.exMin += exV
      b.hhMin += hh
      baseMap.set(bk, b)
    }
    const porCC = [...ccMap.values()].filter(c => c.min > 0).sort((a, b) => b.min - a.min)
    const bases = [...baseMap.values()]
    // em aberto: todas as bases (independe de banco de horas)
    const abertoPorBase = bases
      .map(b => ({ nome: b.nome, abs: b.emAberto, pct: b.diasBatidos > 0 ? (b.emAberto / b.diasBatidos) * 100 : 0 }))
      .filter(b => b.abs > 0).sort((a, b) => b.pct - a.pct)
    // horas extras a pagar: exclui banco de horas
    const extraPorBase = bases
      .filter(b => !ehBanco(b.nome))
      .map(b => ({ nome: b.nome, absMin: b.exMin, pct: b.hhMin > 0 ? (b.exMin / b.hhMin) * 100 : 0 }))
      .filter(b => b.absMin > 0).sort((a, b) => b.pct - a.pct)
    const pctRetif = diasBatidos > 0 ? (diasRetif / diasBatidos) * 100 : 0
    const pctFaltas = cargaMin > 0 ? (faltasMin / cargaMin) * 100 : 0
    return { hhMin, exMin, hhPagavel, emAberto, foraHorario, porCC, abertoPorBase, extraPorBase,
      comBatida: comBatida.size, comApur: comApur.size,
      diasBatidos, diasRetif, faltasMin, cargaMin, pctRetif, pctFaltas }
  }, [resumo])

  const maxCC = Math.max(...agg.porCC.map(c => c.min), 1)
  const maxAbertoPct = Math.max(...agg.abertoPorBase.map(b => b.pct), 1)
  const maxExtraPct = Math.max(...agg.extraPorBase.map(b => b.pct), 1)
  const pctExtra = agg.hhPagavel > 0 ? Math.round((agg.exMin / agg.hhPagavel) * 100) : null
  const pctAtivos = headcount > 0 ? Math.round((pico / headcount) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Header + seletor de visão + filtro de período (topo direito) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel DP</h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {view === 'ponto' ? <>Ponto · <span className="font-semibold">apuração do Secullum</span> (inclui retificação)</> : 'Folha · custo de pessoal, conferência e pagamento'}
            </p>
          </div>
          <select value={view} onChange={e => setView(e.target.value as 'ponto' | 'folha')}
            className={`appearance-none rounded-lg pl-3 pr-7 py-1.5 border text-xs font-bold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
            <option value="ponto">Ponto</option>
            <option value="folha">Folha</option>
          </select>
        </div>
        {view === 'ponto' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <DataSelect value={de} label="Data inicial" onChange={v => { setDe(v); if (v > ate) setAte(v) }} isDark={isDark} />
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
              <DataSelect value={ate} label="Data final" onChange={v => { setAte(v); if (v < de) setDe(v) }} isDark={isDark} />
            </div>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />} Secullum conectado
            </span>
          </div>
        )}
      </div>

      {view === 'folha' && <DPFolhaPainel isDark={isDark} cardClass={cardClass} />}
      {view === 'ponto' && <>


      {/* Hero: Indicadores do mês + Janela Crítica */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Núcleo do Ponto</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores do período</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                <Fingerprint size={18} className="text-violet-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Colaboradores Ativos" value={headcount ? `${pctAtivos}%` : pico} tone="amber" isDark={isDark} note={`${pico}/${headcount} ativos · pico 7d`} />
              <SpotlightMetric label="HH Trabalhada" value={hAbbr(agg.hhMin)} tone="violet" isDark={isDark} note={`parcial · ${agg.comApur}/${agg.comBatida} apurados`} />
              <SpotlightMetric label="Horas Extras" value={hAbbr(agg.exMin)} tone="blue" isDark={isDark}
                aside={pctExtra != null ? `${pctExtra}%` : undefined}
                asideTitle="Horas extras a pagar (exclui dias em aberto e banco de horas) ÷ HH apurado"
                note={`a pagar · parcial ${agg.comApur}/${agg.comBatida}`} />
            </div>
          </div>
        </section>

        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Janela Crítica</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>O que exige ação agora</h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${agg.emAberto > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Zap size={14} className={agg.emAberto > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniInfoCard label="Em Aberto" value={agg.emAberto} icon={Clock}
                iconTone={agg.emAberto > 0 ? 'text-red-500' : 'text-slate-400'} note={agg.emAberto > 0 ? 'regularizar' : 'tudo ok'} isDark={isDark} />
              <MiniInfoCard label="Faltas" value={fmtPct(agg.pctFaltas)} icon={AlarmClock}
                iconTone={agg.pctFaltas >= 5 ? 'text-rose-500' : 'text-slate-400'}
                note={`${hAbbr(agg.faltasMin)} de ${hAbbr(agg.cargaMin)}`} isDark={isDark} />
              <MiniInfoCard label="Retificações" value={fmtPct(agg.pctRetif)} icon={AlertTriangle}
                iconTone={agg.pctRetif >= 20 ? 'text-amber-500' : 'text-slate-400'}
                note={`${agg.diasRetif.toLocaleString('pt-BR')} de ${agg.diasBatidos.toLocaleString('pt-BR')} dias`} isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso: HHt por centro de custo */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-violet-500" /> HHt por Centro de Custo
          </h2>
        </div>
        <div className="px-4 py-3">
          {agg.porCC.length === 0 ? (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              Sem horas de ponto no período
            </div>
          ) : (
            <div className="space-y-2.5">
              {agg.porCC.slice(0, 8).map(cc => (
                <div key={cc.nome} className="flex items-center gap-3">
                  <p className={`text-[11px] font-semibold text-right shrink-0 w-[110px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cc.nome}</p>
                  <div className="flex-1 relative">
                    <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-500" style={{ width: `${Math.max((cc.min / maxCC) * 100, 4)}%` }} />
                    </div>
                  </div>
                  <p className={`text-[11px] font-extrabold shrink-0 w-[70px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{hAbbr(cc.min)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Por base: pontos em aberto + horas extras (absoluto + %, ordenado por % desc) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <div>
              <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <Fingerprint size={14} className="text-blue-500" /> Pontos em Aberto por Base
              </h2>
              <p className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>abs · % sobre dias batidos · ordenado por %</p>
            </div>
            <button onClick={() => nav('/rh/dp/ponto')} className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold shrink-0">Ponto <ChevronRight size={11} /></button>
          </div>
          {agg.abertoPorBase.length === 0 ? (
            <div className="py-10 text-center">
              <Clock size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem pontos em aberto</p>
            </div>
          ) : (
            <ul className="px-2 py-1.5">
              {agg.abertoPorBase.map(b => (
                <li key={b.nome} className="flex items-center gap-2.5 px-2 py-1.5">
                  <span title={b.nome}
                    className={`w-[104px] sm:w-[170px] shrink-0 text-[11px] font-semibold leading-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{b.nome}</span>
                  <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500" style={{ width: `${Math.max((b.pct / maxAbertoPct) * 100, 4)}%` }} />
                  </div>
                  <span className={`w-[36px] text-right text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{b.abs}</span>
                  <span className="w-[46px] text-right text-[11px] font-extrabold text-amber-600">{fmtPct(b.pct)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <div>
              <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <Timer size={14} className="text-orange-500" /> Horas Extras por Base
              </h2>
              <p className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>a pagar · exclui dia em aberto e banco de horas · ord. por %</p>
            </div>
            <button onClick={() => nav('/rh/dp/ponto')} className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold shrink-0">Ponto <ChevronRight size={11} /></button>
          </div>
          {agg.extraPorBase.length === 0 ? (
            <div className="py-10 text-center">
              <Timer size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem horas extras no período</p>
            </div>
          ) : (
            <ul className="px-2 py-1.5">
              {agg.extraPorBase.map(b => (
                <li key={b.nome} className="flex items-center gap-2.5 px-2 py-1.5">
                  <span title={b.nome}
                    className={`w-[104px] sm:w-[170px] shrink-0 text-[11px] font-semibold leading-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{b.nome}</span>
                  <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500" style={{ width: `${Math.max((b.pct / maxExtraPct) * 100, 4)}%` }} />
                  </div>
                  <span className={`w-[46px] text-right text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{hAbbr(b.absMin)}</span>
                  <span className="w-[46px] text-right text-[11px] font-extrabold text-orange-500">{fmtPct(b.pct)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      </>}
    </div>
  )
}
