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
import { usePontoResumoPeriodo, usePontoHorasExtrasPeriodo, usePontoColabAtivos } from '../../hooks/usePonto'
import { intervalToMin, minToHoras } from '../../lib/ponto'

// horas compactas p/ destaque: "28.080h"
const hAbbr = (min: number) => `${Math.round(min / 60).toLocaleString('pt-BR')}h`

function ymHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const MESES_OPT: Array<[string, string]> = [
  ['01', 'Jan'], ['02', 'Fev'], ['03', 'Mar'], ['04', 'Abr'], ['05', 'Mai'], ['06', 'Jun'],
  ['07', 'Jul'], ['08', 'Ago'], ['09', 'Set'], ['10', 'Out'], ['11', 'Nov'], ['12', 'Dez'],
]
function PeriodoSelect({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) {
  const [y, m] = value.split('-')
  const anoAtual = new Date().getFullYear()
  const anos: number[] = []
  for (let a = 2021; a <= anoAtual; a++) anos.push(a)
  const cls = `appearance-none rounded-lg pl-2 pr-2 py-1 border text-xs font-semibold cursor-pointer ${
    isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
  }`
  return (
    <span className="inline-flex items-center gap-1">
      <select value={m} onChange={e => onChange(`${y}-${e.target.value}`)} className={cls} aria-label="Mês">
        {MESES_OPT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select value={y} onChange={e => onChange(`${e.target.value}-${m}`)} className={cls} aria-label="Ano">
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </span>
  )
}

function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    blue: isDark ? 'text-blue-400' : 'text-blue-600',
    violet: isDark ? 'text-violet-400' : 'text-violet-600',
    slate: isDark ? 'text-slate-400' : 'text-slate-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: LucideIcon; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 flex-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <Icon size={16} className={iconTone} />
      <p className={`text-2xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {note && <p className={`text-[8px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

export default function DPPainel() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  const [de, setDe] = useState(ymHoje())
  const [ate, setAte] = useState(ymHoje())

  const { data: resumo = [], isLoading } = usePontoResumoPeriodo(de, ate)
  const { data: he = [] } = usePontoHorasExtrasPeriodo(de, ate)
  const { data: ativos } = usePontoColabAtivos()
  const pico = ativos?.pico ?? 0
  const headcount = ativos?.headcount ?? 0

  const agg = useMemo(() => {
    let hhMin = 0, exMin = 0, emAberto = 0, foraHorario = 0
    const ccMap = new Map<string, { nome: string; min: number }>()
    const abertoMap = new Map<string, { nome: string; base: string; dias: number }>()
    const comBatida = new Set<string>(), comApur = new Set<string>()
    for (const r of resumo) {
      hhMin += intervalToMin(r.hh_trabalhada)
      exMin += intervalToMin(r.extras)
      emAberto += r.dias_em_aberto || 0
      foraHorario += r.dias_fora_horario || 0
      if (r.colaborador_id && (r.dias_batidos || 0) > 0) comBatida.add(r.colaborador_id)
      if (r.colaborador_id && intervalToMin(r.hh_trabalhada) > 0) comApur.add(r.colaborador_id)
      const k = r.cc_codigo || r.cc_nome || '—'
      const cur = ccMap.get(k) || { nome: r.cc_nome || r.cc_codigo || 'Sem CC', min: 0 }
      cur.min += intervalToMin(r.hh_trabalhada)
      ccMap.set(k, cur)
      if ((r.dias_em_aberto || 0) > 0) {
        const ak = r.colaborador_id ?? r.colaborador_nome ?? '—'
        const a = abertoMap.get(ak) || { nome: r.colaborador_nome ?? '—', base: r.base_nome ?? '—', dias: 0 }
        a.dias += r.dias_em_aberto || 0
        abertoMap.set(ak, a)
      }
    }
    const porCC = [...ccMap.values()].filter(c => c.min > 0).sort((a, b) => b.min - a.min)
    const listaAberto = [...abertoMap.entries()].map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.dias - a.dias).slice(0, 8)
    return { hhMin, exMin, emAberto, foraHorario, porCC, listaAberto, comBatida: comBatida.size, comApur: comApur.size }
  }, [resumo])

  const heAprovar = he.filter(h => h.aprov_status === 'pendente' || h.aprov_status === 'em_aprovacao').length
  const listaHE = he.slice(0, 8)
  const maxCC = Math.max(...agg.porCC.map(c => c.min), 1)

  return (
    <div className="space-y-3">
      {/* Header + filtro de período (topo direito) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel DP</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ponto — horas, em aberto e fora do horário</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <PeriodoSelect value={de} onChange={v => { setDe(v); if (v > ate) setAte(v) }} isDark={isDark} />
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
            <PeriodoSelect value={ate} onChange={v => { setAte(v); if (v < de) setDe(v) }} isDark={isDark} />
          </div>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />} Secullum conectado
          </span>
        </div>
      </div>

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
              <SpotlightMetric label="Colaboradores Ativos" value={headcount ? `${pico}/${headcount}` : pico} tone="amber" isDark={isDark} note="pico 7 dias · vs headcount" />
              <SpotlightMetric label="HH Trabalhada" value={hAbbr(agg.hhMin)} tone="violet" isDark={isDark} note={`parcial · ${agg.comApur}/${agg.comBatida} apurados`} />
              <SpotlightMetric label="Horas Extras" value={hAbbr(agg.exMin)} tone="blue" isDark={isDark} note={`parcial · ${agg.comApur}/${agg.comBatida} apurados`} />
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
              <MiniInfoCard label="Fora do Horário" value={agg.foraHorario} icon={AlarmClock}
                iconTone={agg.foraHorario > 0 ? 'text-rose-500' : 'text-slate-400'} note="dias-pessoa" isDark={isDark} />
              <MiniInfoCard label="HE a Aprovar" value={heAprovar} icon={AlertTriangle}
                iconTone={heAprovar > 0 ? 'text-amber-500' : 'text-slate-400'} note="pendentes" isDark={isDark} />
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

      {/* Listas: Pontos em aberto + Apontamentos de HE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Fingerprint size={14} className="text-blue-500" /> Pontos em Aberto
            </h2>
            <button onClick={() => nav('/rh/dp/ponto')} className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">Ir para Ponto <ChevronRight size={11} /></button>
          </div>
          {agg.listaAberto.length === 0 ? (
            <div className="py-10 text-center">
              <Clock size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem pontos em aberto</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {agg.listaAberto.map(r => (
                <li key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.nome}</p>
                    <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.base}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                    {r.dias} {r.dias === 1 ? 'dia' : 'dias'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Timer size={14} className="text-orange-500" /> Apontamentos de Hora Extra
            </h2>
            <button onClick={() => nav('/rh/dp/ponto')} className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">Ver todos <ChevronRight size={11} /></button>
          </div>
          {listaHE.length === 0 ? (
            <div className="py-10 text-center">
              <Timer size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum apontamento recente</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {listaHE.map((h, i) => (
                <li key={`${h.data}-${h.secullum_func_id}-${i}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{h.colaborador_nome ?? '—'}</p>
                    <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(h.data + 'T00:00:00').toLocaleDateString('pt-BR')} · {h.base_nome ?? '—'}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-extrabold text-orange-500">{minToHoras(intervalToMin(h.extras_total))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
