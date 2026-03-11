import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, AlertTriangle, FileCheck2,
  ArrowRight, RefreshCw, BarChart3, PieChart,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useCustoPorObra,
  useAlertasDesvio,
  useOrcamentos,
} from '../../hooks/useControladoria'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const BRL0 = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

const pct = (v: number) => v.toFixed(1) + '%'

const SEVERIDADE_CFG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  amarelo: { label: 'Amarelo', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
  vermelho: { label: 'Vermelho', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  critico: { label: 'Critico', dot: 'bg-red-600 animate-pulse', text: 'text-red-800', bg: 'bg-red-100' },
}

// ── Quick Actions ─────────────────────────────────────────────────────────────
const ACTIONS = [
  { icon: BarChart3,   label: 'Orcamentos',  to: '/controladoria/orcamentos', color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { icon: PieChart,    label: 'DRE',          to: '/controladoria/dre',        color: 'text-violet-600', bg: 'bg-violet-50' },
  { icon: TrendingUp,  label: 'KPIs',         to: '/controladoria/kpis',       color: 'text-emerald-600',bg: 'bg-emerald-50'},
  { icon: AlertTriangle,label:'Alertas',       to: '/controladoria/alertas',    color: 'text-red-600',    bg: 'bg-red-50'    },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function ControladoriaHome() {
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()

  const { data: custos = [], isLoading: loadingCustos, refetch } = useCustoPorObra()
  const { data: alertas = [] } = useAlertasDesvio({ resolvido: false })
  const { data: orcamentos = [] } = useOrcamentos()

  // KPI calculations
  const custoTotal = custos.reduce((s, c) => s + (Number(c.custo_total) || 0), 0)
  const margemMedia = custos.length > 0
    ? custos.reduce((s, c) => s + (Number(c.margem_bruta) || 0), 0) / custos.length
    : 0
  const alertasAtivos = alertas.length
  const orcamentosAprovados = orcamentos.filter(o => o.status === 'aprovado').length

  const alertasNaoLidos = alertas.filter(a => !a.lido).slice(0, 5)

  if (loadingCustos) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Painel — Controladoria
          </h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Visao geral de custos, margens e alertas
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            isLight ? 'text-slate-400 hover:text-teal-600' : 'text-slate-500 hover:text-teal-400'
          }`}
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          titulo="Custo Total"
          valor={BRL0(custoTotal)}
          icon={DollarSign}
          cor="text-teal-600"
          hexCor="#0D9488"
          isLight={isLight}
        />
        <KpiCard
          titulo="Margem Media"
          valor={pct(margemMedia)}
          icon={TrendingUp}
          cor={margemMedia >= 0 ? 'text-emerald-600' : 'text-red-600'}
          hexCor={margemMedia >= 0 ? '#059669' : '#DC2626'}
          isLight={isLight}
        />
        <KpiCard
          titulo="Alertas Ativos"
          valor={alertasAtivos}
          icon={AlertTriangle}
          cor={alertasAtivos > 0 ? 'text-amber-600' : 'text-slate-400'}
          hexCor={alertasAtivos > 0 ? '#D97706' : '#94A3B8'}
          subtitulo={alertasAtivos > 0 ? 'Requer atencao' : 'Nenhum'}
          isLight={isLight}
        />
        <KpiCard
          titulo="Orc. Aprovados"
          valor={orcamentosAprovados}
          icon={FileCheck2}
          cor="text-blue-600"
          hexCor="#2563EB"
          subtitulo={`de ${orcamentos.length} total`}
          isLight={isLight}
        />
      </div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ icon: Icon, label, to, color, bg }) => (
          <button
            key={to}
            onClick={() => nav(to)}
            className={`rounded-2xl p-3 border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center group ${
              isLight
                ? 'bg-white border-slate-200'
                : 'bg-white/[0.03] border-white/[0.06]'
            }`}
          >
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2
              group-hover:scale-110 transition-transform`}>
              <Icon size={16} className={color} />
            </div>
            <p className={`text-[10px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{label}</p>
          </button>
        ))}
      </div>

      {/* ── Two columns: Alertas Recentes + Custo por Obra ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Alertas recentes */}
        <section className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${
            isLight ? 'border-slate-100' : 'border-white/[0.04]'
          }`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${
              isLight ? 'text-slate-800' : 'text-white'
            }`}>
              <AlertTriangle size={14} className="text-amber-500" />
              Alertas Recentes
              {alertasNaoLidos.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                  {alertasNaoLidos.length}
                </span>
              )}
            </h2>
            <button
              onClick={() => nav('/controladoria/alertas')}
              className="text-[10px] text-teal-600 font-semibold flex items-center gap-0.5"
            >
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
            {alertasNaoLidos.length === 0 ? (
              <p className={`text-center text-sm py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                Nenhum alerta pendente
              </p>
            ) : (
              alertasNaoLidos.map(a => {
                const cfg = SEVERIDADE_CFG[a.severidade] ?? SEVERIDADE_CFG.amarelo
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-700' : 'text-white'}`}>
                        {a.obra?.nome ?? 'Geral'}
                      </p>
                      <p className={`text-[11px] truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {a.mensagem}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                        {pct(a.desvio_pct)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Custo por Obra */}
        <section className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${
              isLight ? 'text-slate-800' : 'text-white'
            }`}>
              <DollarSign size={14} className="text-teal-500" />
              Custo por Obra
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'} text-xs font-semibold uppercase tracking-wider`}>
                  <th className="px-4 py-2.5">Obra</th>
                  <th className="px-4 py-2.5 text-right">Custo Total</th>
                  <th className="px-4 py-2.5 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {custos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`text-center py-8 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      Nenhum dado disponivel
                    </td>
                  </tr>
                ) : (
                  custos.map((c, i) => {
                    const margem = Number(c.margem_bruta) || 0
                    return (
                      <tr
                        key={i}
                        className={`border-b ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}
                      >
                        <td className={`px-4 py-2.5 text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>
                          {String(c.obra_nome ?? c.nome ?? '—')}
                        </td>
                        <td className={`px-4 py-2.5 text-sm text-right font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                          {BRL(Number(c.custo_total) || 0)}
                        </td>
                        <td className={`px-4 py-2.5 text-sm text-right font-semibold ${
                          margem >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {pct(margem)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ titulo, valor, icon: Icon, cor, hexCor, subtitulo, isLight }: {
  titulo: string
  valor: number | string
  icon: typeof DollarSign
  cor: string
  hexCor: string
  subtitulo?: string
  isLight: boolean
}) {
  return (
    <div className={`rounded-2xl overflow-hidden flex border ${
      isLight ? 'bg-white shadow-sm border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}
        >
          <Icon size={14} className={cor} />
        </div>
        <p className={`text-xl font-extrabold leading-none ${cor}`}>{valor}</p>
        <p className={`text-[10px] font-semibold mt-1 uppercase tracking-widest ${
          isLight ? 'text-slate-400' : 'text-slate-500'
        }`}>{titulo}</p>
        {subtitulo && (
          <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{subtitulo}</p>
        )}
      </div>
    </div>
  )
}
