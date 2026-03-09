import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, ClipboardList, BarChart3,
  FileText, AlertTriangle, Users, ArrowRight, RefreshCw,
  DollarSign, TrendingUp, Activity, Briefcase,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolios } from '../../hooks/usePMO'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

const STATUS_LABELS: Record<string, string> = {
  em_analise_ate: 'Em Analise ATE',
  revisao_cliente: 'Revisao Cliente',
  liberado_iniciar: 'Liberado Iniciar',
  obra_andamento: 'Em Andamento',
  obra_paralisada: 'Paralisada',
  obra_concluida: 'Concluida',
  cancelada: 'Cancelada',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  em_analise_ate:    { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  revisao_cliente:   { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  liberado_iniciar:  { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  obra_andamento:    { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  obra_paralisada:   { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  obra_concluida:    { bg: 'bg-slate-100 dark:bg-slate-500/15', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-500' },
  cancelada:         { bg: 'bg-gray-100 dark:bg-gray-500/15', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
}

const QUICK_LINKS = [
  { icon: FolderKanban, label: 'Portfolios',  to: '/pmo/portfolio',    color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { icon: ClipboardList, label: 'Fluxo OS',   to: '/pmo/fluxo-os',    color: 'text-blue-600',   bg: 'bg-blue-50' },
  { icon: BarChart3,     label: 'Indicadores', to: '/pmo/indicadores', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: FileText,      label: 'Reunioes',   to: '/pmo/reunioes',    color: 'text-violet-600', bg: 'bg-violet-50' },
  { icon: AlertTriangle, label: 'Multas',     to: '/pmo/multas',      color: 'text-amber-600',  bg: 'bg-amber-50' },
  { icon: Users,         label: 'Histograma', to: '/pmo/histograma',  color: 'text-teal-600',   bg: 'bg-teal-50' },
]

export default function PMOHome() {
  const { isLightSidebar: isLight } = useTheme()
  const nav = useNavigate()
  const { data: portfolios, isLoading, refetch } = usePortfolios()

  const items = portfolios ?? []
  const emAndamento = items.filter(p => p.status === 'obra_andamento').length
  const valorTotal = items.reduce((s, p) => s + (p.valor_total_osc ?? 0), 0)
  const margemMedia = items.length > 0
    ? items.reduce((s, p) => s + ((p.valor_total_osc - p.custo_real) / (p.valor_total_osc || 1)), 0) / items.length
    : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <LayoutDashboard size={20} className="text-indigo-500" />
            PMO - Escritorio de Projetos
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Visao geral do portfolio de obras e indicadores
          </p>
        </div>
        <button onClick={() => refetch()}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isLight ? 'text-slate-400 hover:text-indigo-600' : 'text-slate-500 hover:text-indigo-400'}`}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard isLight={isLight} titulo="Total OSCs" valor={items.length}
          icon={Briefcase} hexCor="#6366F1" subtitulo="portfolios cadastrados" />
        <KpiCard isLight={isLight} titulo="Em Andamento" valor={emAndamento}
          icon={Activity} hexCor="#10B981" subtitulo={`de ${items.length} total`} />
        <KpiCard isLight={isLight} titulo="Valor Total" valor={fmt(valorTotal)}
          icon={DollarSign} hexCor="#0EA5E9" subtitulo="soma dos portfolios" />
        <KpiCard isLight={isLight} titulo="Margem Media" valor={fmtPct(margemMedia)}
          icon={TrendingUp} hexCor="#8B5CF6" subtitulo="(receita - custo) / receita" />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {QUICK_LINKS.map(({ icon: Icon, label, to, color, bg }) => (
          <button key={to} onClick={() => nav(to)}
            className={`rounded-2xl p-3 border transition-all text-center group hover:-translate-y-0.5 ${
              isLight
                ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
            }`}>
            <div className={`w-9 h-9 ${isLight ? bg : 'bg-white/[0.06]'} rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
              <Icon size={16} className={isLight ? color : 'text-slate-300'} />
            </div>
            <p className={`text-[10px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{label}</p>
          </button>
        ))}
      </div>

      {/* Recent Portfolios */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          isLight ? 'border-slate-100' : 'border-white/[0.04]'
        }`}>
          <h2 className={`text-sm font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <FolderKanban size={14} className="text-indigo-500" /> Portfolios Recentes
          </h2>
          <button onClick={() => nav('/pmo/portfolio')}
            className="text-[10px] text-indigo-500 font-semibold flex items-center gap-0.5 hover:underline">
            Ver todos <ArrowRight size={10} />
          </button>
        </div>
        <div className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
          {items.length === 0 ? (
            <p className={`text-center text-sm py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Nenhum portfolio cadastrado
            </p>
          ) : (
            items.slice(0, 5).map(p => {
              const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS.cancelada
              return (
                <button key={p.id}
                  onClick={() => nav(`/pmo/portfolio/${p.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/15 text-indigo-400'
                  }`}>
                    {p.numero_osc?.slice(0, 3) ?? 'OSC'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      {p.nome_obra}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{p.numero_osc}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${isLight ? sc.bg.split(' ')[0] : sc.bg.split(' ')[1] ?? sc.bg.split(' ')[0]} ${isLight ? sc.text.split(' ')[0] : sc.text.split(' ')[1] ?? sc.text.split(' ')[0]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      {fmt(p.valor_total_osc)}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ isLight, titulo, valor, icon: Icon, hexCor, subtitulo }: {
  isLight: boolean; titulo: string; valor: number | string; icon: typeof DollarSign;
  hexCor: string; subtitulo?: string
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden flex ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}>
          <Icon size={14} style={{ color: hexCor }} />
        </div>
        <p className={`text-xl font-extrabold leading-none ${isLight ? 'text-slate-800' : 'text-white'}`} style={{ color: hexCor }}>
          {valor}
        </p>
        <p className={`text-[10px] font-semibold mt-1 uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {titulo}
        </p>
        {subtitulo && (
          <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{subtitulo}</p>
        )}
      </div>
    </div>
  )
}
