// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHPainel.tsx — Painel do Headcount (padrão dos dashboards TEG+)
// Seletor de painel (Visão Geral · Evolução · Composição · Turnover), igual ao Frotas.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, lazy, Suspense } from 'react'
import {
  Users, UserPlus, UserMinus, TrendingUp, RefreshCw, ChevronRight,
  Zap, AlertTriangle, Activity, Building2, ChevronDown,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useRHStats } from '../../hooks/useRH'
import { useAdmissoesFluxo } from '../../hooks/useRHAdmissaoFluxo'
import type { RHStats } from '../../hooks/useRH'
import type { RHAdmissao } from '../../types/rh'

const EvolucaoHeadcount = lazy(() => import('./paineis/EvolucaoHeadcount'))
const ComposicaoHeadcount = lazy(() => import('./paineis/ComposicaoHeadcount'))
const TurnoverHeadcount = lazy(() => import('./paineis/TurnoverHeadcount'))

type PainelKey = 'geral' | 'evolucao' | 'composicao' | 'turnover'
const PAINEIS: Array<{ key: PainelKey; label: string }> = [
  { key: 'geral', label: 'Visão Geral' },
  { key: 'evolucao', label: 'Evolução' },
  { key: 'composicao', label: 'Composição' },
  { key: 'turnover', label: 'Turnover' },
]

const ETAPA_LABEL: Record<string, string> = {
  requisicao: 'Pendente', aprovacao: 'Aprovação', documentacao: 'Documentação',
  exames_treinamentos: 'Exames/Trein.', mobilizacao: 'Mobilização', integracao: 'Integração', liberado: 'Liberado',
}
const EM_ANDAMENTO = ['requisicao', 'aprovacao', 'documentacao', 'exames_treinamentos', 'mobilizacao', 'integracao']

function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    violet: isDark ? 'text-violet-400' : 'text-violet-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
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
  label: string; value: string | number; note?: string; icon: typeof Users; iconTone: string; isDark: boolean
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

function PainelSpinner() {
  return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
}

function ymHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function RHPainel() {
  const { isDark } = useTheme()
  const [painel, setPainel] = useState<PainelKey>('geral')
  const [de, setDe] = useState('2025-01')
  const [ate, setAte] = useState(ymHoje())
  const { data: stats, isLoading, refetch } = useRHStats()
  const { data: admissoes = [] } = useAdmissoesFluxo()

  const inputCls = `rounded-lg px-2 py-1 border text-xs font-semibold cursor-pointer ${
    isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
  }`

  return (
    <div className="space-y-3">
      {/* Header + seletor de painel (padrão Frotas: seletor colado ao título) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel Headcount</h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Admissões, saídas e composição da equipe</p>
          </div>
          <div className="relative">
            <select value={painel} onChange={e => setPainel(e.target.value as PainelKey)}
              className={`appearance-none text-xs font-semibold rounded-lg pl-3 pr-7 py-1.5 cursor-pointer border transition-all ${
                isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}>
              {PAINEIS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
        </div>
        {painel === 'geral' ? (
          <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
            <RefreshCw size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input type="month" value={de} min="2021-01" max={ate} onChange={e => e.target.value && setDe(e.target.value)} className={inputCls} aria-label="Data início" />
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
            <input type="month" value={ate} min={de} max={ymHoje()} onChange={e => e.target.value && setAte(e.target.value)} className={inputCls} aria-label="Data fim" />
          </div>
        )}
      </div>

      {painel === 'evolucao' && <Suspense fallback={<PainelSpinner />}><EvolucaoHeadcount de={de} ate={ate} /></Suspense>}
      {painel === 'composicao' && <Suspense fallback={<PainelSpinner />}><ComposicaoHeadcount de={de} ate={ate} /></Suspense>}
      {painel === 'turnover' && <Suspense fallback={<PainelSpinner />}><TurnoverHeadcount de={de} ate={ate} /></Suspense>}
      {painel === 'geral' && (
        (isLoading || !stats) ? <PainelSpinner /> : <VisaoGeral stats={stats} admissoes={admissoes} isDark={isDark} />
      )}
    </div>
  )
}

function VisaoGeral({ stats, admissoes, isDark }: { stats: RHStats; admissoes: RHAdmissao[]; isDark: boolean }) {
  const nav = useNavigate()
  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  // ── Métricas ───────────────────────────────────────────────────────────────
  const admMes = stats.admissoesMes
  const saiMes = stats.desligamentosMes
  const ativos = stats.totalAtivos || 1
  const turnover = (((admMes + saiMes) / 2) / ativos) * 100

  const emAndamento = admissoes.filter(a => EM_ANDAMENTO.includes(a.etapa ?? 'requisicao'))
  const urgentes = emAndamento.filter(a => a.urgente).length

  const clt = stats.totalCLT
  const pj = stats.totalPJ
  const outros = Math.max(stats.totalAtivos - clt - pj, 0)
  const compTotal = clt + pj + outros || 1
  const comp = [
    { key: 'clt', label: 'CLT', total: clt, color: 'bg-violet-500' },
    { key: 'pj', label: 'PJ', total: pj, color: 'bg-orange-400' },
    { key: 'outros', label: 'Outros', total: outros, color: 'bg-slate-400' },
  ].filter(c => c.total > 0)

  const porDept = stats.porDepartamento ?? []
  const maxDept = Math.max(...porDept.map(d => d.total), 1)

  return (
    <div className="space-y-3">
      {/* Hero: Indicadores + Janela Crítica */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Núcleo de Pessoas</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores do mês</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                <Users size={18} className="text-violet-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Admissões" value={admMes} tone="violet" isDark={isDark} note={`${ativos} ativos`} />
              <SpotlightMetric label="Saídas" value={saiMes} tone={saiMes > 0 ? 'amber' : 'slate'} isDark={isDark} note="no mês" />
              <SpotlightMetric label="Turnover" value={`${turnover.toFixed(1)}%`} tone={turnover >= 5 ? 'red' : 'emerald'} isDark={isDark} note="mensal" />
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
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${urgentes > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Zap size={14} className={urgentes > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Adm. Urgentes" value={urgentes} icon={AlertTriangle}
                iconTone={urgentes > 0 ? 'text-orange-500' : 'text-slate-400'} note={urgentes > 0 ? 'priorizar!' : 'nenhuma'} isDark={isDark} />
              <MiniInfoCard label="Em Andamento" value={emAndamento.length} icon={Activity}
                iconTone={emAndamento.length > 0 ? 'text-violet-500' : 'text-slate-400'} note="no fluxo" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso: composição da equipe */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-violet-500" /> Composição da Equipe
          </h2>
          <div className="flex items-center gap-3">
            {comp.map(c => (
              <span key={c.key} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${c.color}`} />
                <span className="text-[10px] text-slate-500">{c.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          {comp.length === 0 ? (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Sem colaboradores ativos</div>
          ) : (
            <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
              {comp.map(c => {
                const pct = (c.total / compTotal) * 100
                return (
                  <div key={c.key} className={`${c.color} flex items-center justify-center transition-all`} style={{ width: `${Math.max(pct, 4)}%` }} title={`${c.label}: ${c.total}`}>
                    {pct >= 12 && <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-1">{c.label} {c.total}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Listas: Admissões em andamento + Por Departamento */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <UserPlus size={14} className="text-violet-500" /> Admissões em Andamento
            </h2>
            <button onClick={() => nav('/rh/headcount/admissao')} className="flex items-center gap-0.5 text-[10px] text-violet-600 font-semibold">Ver todas <ChevronRight size={11} /></button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {emAndamento.length === 0 ? (
              <p className={`text-center text-sm py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma admissão em andamento</p>
            ) : emAndamento.slice(0, 6).map(a => {
              const cand = a.candidatos?.[0]?.nome || a.nome_candidato || 'Candidato'
              const n = a.candidatos?.length ?? 0
              return (
                <div key={a.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                    <UserPlus size={14} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {cand}{n > 1 && <span className="text-violet-500 font-bold"> +{n - 1}</span>}
                    </p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{a.base || a.centro_custo?.codigo || '—'}</p>
                  </div>
                  {a.urgente && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 shrink-0">URGENTE</span>}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{ETAPA_LABEL[a.etapa ?? 'requisicao']}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Building2 size={14} className="text-violet-500" /> Por Departamento
            </h2>
          </div>
          <div className="p-4 space-y-2.5">
            {porDept.length === 0 ? (
              <p className={`text-center text-sm py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados por departamento</p>
            ) : porDept.slice(0, 8).map(d => (
              <div key={d.departamento} className="flex items-center gap-3">
                <p className={`text-[11px] font-semibold text-right shrink-0 w-[90px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.departamento}</p>
                <div className="flex-1 relative">
                  <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-600 transition-all duration-500" style={{ width: `${Math.max((d.total / maxDept) * 100, 4)}%` }} />
                  </div>
                </div>
                <p className={`text-[11px] font-extrabold shrink-0 w-[36px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{d.total}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
