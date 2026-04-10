import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, AlertTriangle, FileCheck2,
  RefreshCw, BarChart3, PieChart, Zap, CalendarClock,
  ChevronRight, ArrowRight,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useCustoPorObra, useAlertasDesvio, useOrcamentos } from '../../hooks/useControladoria'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
const pct = (v: number) => v.toFixed(1) + '%'

const SEVERIDADE_CFG: Record<string, { dot: string; text: string; bg: string }> = {
  amarelo: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
  vermelho: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  critico: { dot: 'bg-red-600 animate-pulse', text: 'text-red-800', bg: 'bg-red-100' },
}

// ── SpotlightMetric ──────────────────────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    teal: isDark ? 'text-teal-400' : 'text-teal-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    blue: isDark ? 'text-blue-400' : 'text-blue-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
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

// ── MiniInfoCard ─────────────────────────────────────────────────────────────
function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof DollarSign; iconTone: string; isDark: boolean
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

// ── Quick Actions ────────────────────────────────────────────────────────────
const ACTIONS = [
  { icon: BarChart3, label: 'Controle Orcamentario', to: '/controladoria/controle-orcamentario', color: 'text-blue-600', bg: 'bg-blue-50', darkBg: 'bg-blue-500/10' },
  { icon: PieChart, label: 'Controle de Custos', to: '/controladoria/controle-custos', color: 'text-violet-600', bg: 'bg-violet-50', darkBg: 'bg-violet-500/10' },
  { icon: TrendingUp, label: 'Controle Projetos', to: '/controladoria/controle-projetos', color: 'text-emerald-600', bg: 'bg-emerald-50', darkBg: 'bg-emerald-500/10' },
  { icon: AlertTriangle, label: 'Cenarios', to: '/controladoria/cenarios', color: 'text-amber-600', bg: 'bg-amber-50', darkBg: 'bg-amber-500/10' },
]

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ControladoriaHome() {
  const nav = useNavigate()
  const { isDark } = useTheme()

  const { data: custos = [], isLoading, refetch } = useCustoPorObra()
  const { data: alertas = [] } = useAlertasDesvio({ resolvido: false })
  const { data: orcamentos = [] } = useOrcamentos()

  const custoTotal = custos.reduce((s, c) => s + (Number(c.custo_total) || 0), 0)
  const margemMedia = custos.length > 0
    ? custos.reduce((s, c) => s + (Number(c.margem_bruta) || 0), 0) / custos.length : 0
  const alertasAtivos = alertas.length
  const orcamentosAprovados = orcamentos.filter(o => o.status === 'aprovado').length
  const alertasNaoLidos = alertas.filter(a => !a.lido).slice(0, 5)

  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  // Custo por obra for bar chart
  const maxCusto = Math.max(...custos.map(c => Number(c.custo_total) || 0), 1)

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel — Controladoria</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Visao geral orcamentaria, indicadores e custos</p>
        </div>
        <button onClick={() => refetch()} className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-500 hover:text-teal-400' : 'text-slate-400 hover:text-teal-600'}`}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Controladoria</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores do portfolio</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                <BarChart3 size={18} className="text-teal-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Custo Total" value={fmt(custoTotal)} tone="teal" isDark={isDark} note={`${custos.length} obras`} />
              <SpotlightMetric label="Margem Media" value={pct(margemMedia)} tone={margemMedia >= 0 ? 'emerald' : 'red'} isDark={isDark} note={margemMedia >= 0 ? 'positiva' : 'negativa'} />
              <SpotlightMetric label="Orcamentos" value={`${orcamentosAprovados}/${orcamentos.length}`} tone="blue" isDark={isDark} note="aprovados / total" />
            </div>
          </div>
        </section>

        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Janela Critica</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>O que exige acao agora</h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${alertasAtivos > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Zap size={14} className={alertasAtivos > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Alertas Ativos" value={alertasAtivos} icon={AlertTriangle}
                iconTone={alertasAtivos > 0 ? (isDark ? 'text-amber-400' : 'text-amber-500') : 'text-slate-400'}
                note={alertasAtivos > 0 ? 'requer atencao' : 'tudo ok'} isDark={isDark} />
              <MiniInfoCard label="Orc. Pendentes" value={orcamentos.length - orcamentosAprovados} icon={CalendarClock}
                iconTone={(orcamentos.length - orcamentosAprovados) > 0 ? (isDark ? 'text-blue-400' : 'text-blue-500') : 'text-slate-400'}
                note="aguardando aprovacao" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {ACTIONS.map(({ icon: Icon, label, to, color, bg, darkBg }) => (
          <button key={to} onClick={() => nav(to)}
            className={`rounded-2xl p-3 border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center group ${
              isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
            }`}>
            <div className={`w-9 h-9 ${isDark ? darkBg : bg} rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
              <Icon size={16} className={color} />
            </div>
            <p className={`text-[10px] font-bold leading-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</p>
          </button>
        ))}
      </div>

      {/* Row: Alertas + Custo por Obra */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Alertas Recentes */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <AlertTriangle size={14} className="text-amber-500" /> Alertas Recentes
              {alertasNaoLidos.length > 0 && (
                <span className="ml-1 text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">{alertasNaoLidos.length}</span>
              )}
            </h2>
            <button onClick={() => nav('/controladoria/alertas')} className="flex items-center gap-0.5 text-[10px] text-teal-600 font-semibold">
              Ver todos <ChevronRight size={11} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {alertasNaoLidos.length === 0 ? (
              <p className={`text-center text-sm py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum alerta pendente</p>
            ) : alertasNaoLidos.map(a => {
              const cfg = SEVERIDADE_CFG[a.severidade] ?? SEVERIDADE_CFG.amarelo
              return (
                <div key={a.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{a.obra?.nome ?? 'Geral'}</p>
                    <p className={`text-[11px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{a.mensagem}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${cfg.bg} ${cfg.text}`}>{pct(a.desvio_pct)}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Custo por Obra */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <DollarSign size={14} className="text-teal-500" /> Custo por Obra
            </h2>
          </div>
          <div className="p-4 space-y-2.5">
            {custos.length === 0 ? (
              <p className={`text-center text-sm py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum dado disponivel</p>
            ) : custos.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <p className={`text-[11px] font-semibold text-right shrink-0 w-[100px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {String(c.obra_nome ?? c.nome ?? '—')}
                </p>
                <div className="flex-1 relative">
                  <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-500"
                      style={{ width: `${Math.max(((Number(c.custo_total) || 0) / maxCusto) * 100, 4)}%` }} />
                  </div>
                </div>
                <p className={`text-[11px] font-extrabold shrink-0 w-[70px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {fmt(Number(c.custo_total) || 0)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
