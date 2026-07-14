// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHPainel.tsx — Painel do Headcount (padrão dos dashboards TEG+)
// Seletor de painel (Visão Geral · Evolução · Composição · Turnover), igual ao Frotas.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, lazy, Suspense } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Users, UserPlus, TrendingUp, RefreshCw, ChevronRight,
  Zap, AlertTriangle, Activity, Building2, ChevronDown,
  ArrowUp, ArrowDown,
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
const LiberacaoHeadcount = lazy(() => import('./paineis/LiberacaoHeadcount'))

type PainelKey = 'geral' | 'evolucao' | 'composicao' | 'turnover' | 'liberacao'
const PAINEIS: Array<{ key: PainelKey; label: string }> = [
  { key: 'geral', label: 'Visão Geral' },
  { key: 'composicao', label: 'Composição' },
  { key: 'evolucao', label: 'Evolução' },
  { key: 'turnover', label: 'Turnover' },
  { key: 'liberacao', label: 'Liberação' },
]

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
    <div className={`rounded-2xl p-3 flex flex-col ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {/* valor centralizado no espaço restante → alinha com os números do Movimento */}
      <div className="flex-1 flex flex-col justify-center">
        <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
        {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
      </div>
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

const MESES_OPT: Array<[string, string]> = [
  ['01', 'Jan'], ['02', 'Fev'], ['03', 'Mar'], ['04', 'Abr'], ['05', 'Mai'], ['06', 'Jun'],
  ['07', 'Jul'], ['08', 'Ago'], ['09', 'Set'], ['10', 'Out'], ['11', 'Nov'], ['12', 'Dez'],
]

// R$ compacto p/ caber no card estreito: 967757 → "R$ 968 mil"; 1.2mi → "R$ 1,2 mi"
function formatBRLcompacto(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (v >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

// 'YYYY-MM' → 'mmm/aa' (ex.: '2026-06' → 'jun/26')
function fmtComp(ym: string): string {
  const [y, m] = ym.split('-')
  const lbl = MESES_OPT.find(([v]) => v === m)?.[1] ?? m
  return `${lbl.toLowerCase()}/${y.slice(2)}`
}

// Card de Movimento do mês: entradas (↑ verde, esquerda) e saídas (↓ vermelho, direita)
function MovimentoCard({ entradas, saidas, isDark }: { entradas: number; saidas: number; isDark: boolean }) {
  const emerald = isDark ? 'text-emerald-400' : 'text-emerald-600'
  const red = saidas > 0 ? (isDark ? 'text-red-400' : 'text-red-600') : 'text-slate-400'
  const labelCls = `text-[8px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`
  return (
    <div className={`rounded-2xl p-3 flex flex-col gap-1.5 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Movimento</p>
      <div className="flex items-stretch flex-1">
        <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <div className="flex items-center gap-1">
            <ArrowUp size={18} className={emerald} strokeWidth={2.8} />
            <span className={`text-[1.85rem] font-extrabold leading-none ${emerald}`}>{entradas}</span>
          </div>
          <span className={labelCls}>entradas</span>
        </div>
        <div className={`w-px self-stretch ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
        <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <div className="flex items-center gap-1">
            <ArrowDown size={18} className={red} strokeWidth={2.8} />
            <span className={`text-[1.85rem] font-extrabold leading-none ${red}`}>{saidas}</span>
          </div>
          <span className={labelCls}>saídas</span>
        </div>
      </div>
    </div>
  )
}

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

export default function RHPainel() {
  const { isDark } = useTheme()
  const [painel, setPainel] = useState<PainelKey>('geral')
  const [de, setDe] = useState('2026-01')
  const [ate, setAte] = useState(ymHoje())
  const { data: stats, isLoading, refetch } = useRHStats()
  const { data: admissoes = [] } = useAdmissoesFluxo()
  const qc = useQueryClient()
  const atualizar = () => {
    if (painel === 'liberacao') qc.invalidateQueries({ queryKey: ['rh-liberacao-painel'] })
    else refetch()
  }

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
        {painel === 'geral' || painel === 'liberacao' ? (
          <button onClick={atualizar} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
            <RefreshCw size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <PeriodoSelect value={de} onChange={v => { setDe(v); if (v > ate) setAte(v) }} isDark={isDark} />
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
            <PeriodoSelect value={ate} onChange={v => { setAte(v); if (v < de) setDe(v) }} isDark={isDark} />
          </div>
        )}
      </div>

      {painel === 'evolucao' && <Suspense fallback={<PainelSpinner />}><EvolucaoHeadcount de={de} ate={ate} /></Suspense>}
      {painel === 'composicao' && <Suspense fallback={<PainelSpinner />}><ComposicaoHeadcount de={de} ate={ate} /></Suspense>}
      {painel === 'turnover' && <Suspense fallback={<PainelSpinner />}><TurnoverHeadcount de={de} ate={ate} /></Suspense>}
      {painel === 'liberacao' && <Suspense fallback={<PainelSpinner />}><LiberacaoHeadcount /></Suspense>}
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
  // Entradas/saídas do mês = movimento REAL (data_admissao/data_demissao), não requisições.
  const entradas = stats.admitidosMes
  const saidas = stats.desligadosMes
  const ativos = stats.totalAtivos || 1
  // Turnover = desligamentos acumulados do ano ÷ efetivo ativo (definição TEG: só saídas)
  const turnover = (stats.desligadosAno / ativos) * 100
  const folha = stats.folhaTotal

  const emAndamento = admissoes.filter(a => EM_ANDAMENTO.includes(a.etapa ?? 'requisicao'))
  // Liberações atrasadas: pessoas cujo início previsto já venceu e ainda não foram liberadas.
  // (created_at não serve — as requisições foram recriadas em massa; data_prevista_inicio é o sinal real.)
  const hojeStr = new Date().toISOString().slice(0, 10)
  const liberacoesAtrasadas = emAndamento
    .filter(a => a.data_prevista_inicio && a.data_prevista_inicio.slice(0, 10) < hojeStr)
    .reduce((soma, a) => soma + Math.max(a.candidatos?.length ?? 0, 1), 0)

  // Admissões em andamento totalizadas por Centro de Custo (base), com contagem por cargo
  const gruposCC = (() => {
    const map = new Map<string, { cc: string; total: number; cargos: Map<string, number> }>()
    emAndamento.forEach(a => {
      const cc = a.base || a.centro_custo?.codigo || 'Sem centro de custo'
      const g = map.get(cc) ?? { cc, total: 0, cargos: new Map<string, number>() }
      const cands: Array<{ cargo?: string }> = a.candidatos?.length ? a.candidatos : [{ cargo: a.cargo_previsto }]
      cands.forEach(c => {
        g.total += 1
        const cargo = (c.cargo || a.cargo_previsto || 'Sem cargo').trim()
        g.cargos.set(cargo, (g.cargos.get(cargo) ?? 0) + 1)
      })
      map.set(cc, g)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  })()

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
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores-chave</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                <Users size={18} className="text-violet-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Folha" value={folha != null ? formatBRLcompacto(folha) : '—'} tone="violet" isDark={isDark}
                note={stats.folhaComp ? `CLT líq + PJ · ${fmtComp(stats.folhaComp)}` : 'CLT + PJ'} />
              <MovimentoCard entradas={entradas} saidas={saidas} isDark={isDark} />
              <SpotlightMetric label="Turnover" value={`${turnover.toFixed(1)}%`} tone={turnover >= 5 ? 'red' : 'emerald'} isDark={isDark} note={`acum. ${new Date().getFullYear()}`} />
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
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${liberacoesAtrasadas > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Zap size={14} className={liberacoesAtrasadas > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Liberações atrasadas" value={liberacoesAtrasadas} icon={AlertTriangle}
                iconTone={liberacoesAtrasadas > 0 ? 'text-red-500' : 'text-slate-400'} note={liberacoesAtrasadas > 0 ? 'início já vencido' : 'em dia'} isDark={isDark} />
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
                <span className="text-[10px] text-slate-500">{c.label} <span className="font-bold text-slate-600">{c.total}</span></span>
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
                  <div key={c.key} className={`${c.color} flex items-center justify-center transition-all`} style={{ width: `${Math.max(pct, 5)}%` }} title={`${c.label}: ${c.total}`}>
                    <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-1">{pct >= 12 ? `${c.label} ${c.total}` : c.total}</span>
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
            {gruposCC.length === 0 ? (
              <p className={`text-center text-sm py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma admissão em andamento</p>
            ) : gruposCC.slice(0, 6).map(g => {
              const cargosStr = Array.from(g.cargos.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([cargo, n]) => `${n} ${cargo}`)
                .join(' · ')
              return (
                <div key={g.cc} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                    <Building2 size={14} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{g.cc}</p>
                    <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cargosStr}</p>
                  </div>
                  <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${isDark ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-50 text-violet-700'}`}>{g.total}</span>
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
                <p className={`text-[11px] font-semibold text-right shrink-0 w-[132px] leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.departamento}</p>
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
