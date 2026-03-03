import { useNavigate } from 'react-router-dom'
import {
  Package2, AlertTriangle, TrendingDown, DollarSign,
  ClipboardList, ArrowRight, RefreshCw, BarChart3,
  ArrowLeftRight, Landmark, CheckCircle2,
} from 'lucide-react'
import { useEstoqueKPIs, useSaldosAbaixoMinimo } from '../../hooks/useEstoque'
import type { EstoqueKPIs } from '../../types/estoque'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const EMPTY_KPIS: EstoqueKPIs = {
  total_itens: 0,
  itens_abaixo_minimo: 0,
  itens_parados: 0,
  valor_estoque_total: 0,
  movimentacoes_mes: 0,
  taxa_ruptura: 0,
  solicitacoes_abertas: 0,
}

const ACTIONS = [
  { icon: Package2,       label: 'Itens',          to: '/estoque/itens',         color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { icon: ArrowLeftRight, label: 'Movimentações',   to: '/estoque/movimentacoes', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { icon: ClipboardList,  label: 'Inventário',      to: '/estoque/inventario',    color: 'text-violet-600', bg: 'bg-violet-50' },
  { icon: Landmark,       label: 'Patrimonial',     to: '/estoque/patrimonial',   color: 'text-cyan-600',   bg: 'bg-cyan-50'   },
]

export default function EstoqueHome() {
  const nav = useNavigate()
  const { data: kpis = EMPTY_KPIS, isLoading, refetch } = useEstoqueKPIs()
  const { data: abaixoMinimo = [] } = useSaldosAbaixoMinimo()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Painel — Estoque</h1>
          <p className="text-xs text-slate-400 mt-0.5">Visão geral do almoxarifado e patrimônio</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          titulo="Total de Itens"
          valor={kpis.total_itens}
          icon={Package2}
          cor="text-blue-600"
          hexCor="#2563EB"
        />
        <KpiCard
          titulo="Abaixo do Mínimo"
          valor={kpis.itens_abaixo_minimo}
          icon={AlertTriangle}
          cor={kpis.itens_abaixo_minimo > 0 ? 'text-red-600' : 'text-slate-400'}
          hexCor={kpis.itens_abaixo_minimo > 0 ? '#DC2626' : '#94A3B8'}
          subtitulo={kpis.itens_abaixo_minimo > 0 ? 'Reposição urgente' : 'Tudo ok'}
        />
        <KpiCard
          titulo="Valor em Estoque"
          valor={fmt(kpis.valor_estoque_total)}
          icon={DollarSign}
          cor="text-indigo-600"
          hexCor="#4F46E5"
        />
        <KpiCard
          titulo="Moviment. no Mês"
          valor={kpis.movimentacoes_mes}
          icon={BarChart3}
          cor="text-cyan-600"
          hexCor="#0891B2"
          subtitulo={`${kpis.solicitacoes_abertas} sol. abertas`}
        />
      </div>

      {/* ── Acurácia + Itens Parados ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Acurácia Inventário</p>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">
            {kpis.acuracia_ultimo_inventario != null
              ? `${kpis.acuracia_ultimo_inventario.toFixed(1)}%`
              : '—'
            }
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Último inventário concluído</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={14} className="text-amber-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Itens Parados</p>
          </div>
          <p className={`text-3xl font-extrabold ${kpis.itens_parados > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {kpis.itens_parados}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Sem movimentação há 90+ dias</p>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ icon: Icon, label, to, color, bg }) => (
          <button key={to} onClick={() => nav(to)}
            className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm
              hover:shadow-md hover:-translate-y-0.5 transition-all text-center group">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2
              group-hover:scale-110 transition-transform`}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-[10px] font-bold text-slate-600">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Alertas: Itens Abaixo do Mínimo ──────────────────── */}
      {abaixoMinimo.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-500" />
              Itens para Reposição
            </h2>
            <button onClick={() => nav('/estoque/itens')}
              className="text-[10px] text-blue-600 font-semibold flex items-center gap-0.5">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {abaixoMinimo.slice(0, 8).map(saldo => (
              <div key={saldo.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <Package2 size={14} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {saldo.item?.descricao ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {saldo.base?.nome ?? '—'} · Cód: {saldo.item?.codigo ?? '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-red-600">{saldo.saldo} {saldo.item?.unidade}</p>
                  <p className="text-[10px] text-slate-400">mín: {saldo.item?.estoque_minimo}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ titulo, valor, icon: Icon, cor, hexCor, subtitulo }: {
  titulo: string; valor: number | string; icon: typeof Package2;
  cor: string; hexCor: string; subtitulo?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex">
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}>
          <Icon size={14} className={cor} />
        </div>
        <p className={`text-xl font-extrabold ${cor} leading-none`}>{valor}</p>
        <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-widest">{titulo}</p>
        {subtitulo && <p className="text-[10px] text-slate-400 mt-0.5">{subtitulo}</p>}
      </div>
    </div>
  )
}
