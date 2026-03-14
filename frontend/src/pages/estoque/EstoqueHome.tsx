import { useNavigate } from 'react-router-dom'
import {
  Package2, AlertTriangle, TrendingDown, DollarSign,
  ClipboardList, ArrowRight, RefreshCw, BarChart3,
  ArrowLeftRight, CheckCircle2,
} from 'lucide-react'
import { useEstoqueKPIs, useSaldosAbaixoMinimo } from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
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

export default function EstoqueHome() {
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const { data: kpis = EMPTY_KPIS, isLoading, refetch } = useEstoqueKPIs()
  const { data: abaixoMinimo = [] } = useSaldosAbaixoMinimo()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  return (
    <div className="space-y-5">

      {/* -- Header --------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Painel de Estoque</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{'Vis\u00e3o geral do almoxarifado'}</p>
        </div>
        <button onClick={() => refetch()}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isLight ? 'text-slate-400 hover:text-blue-600' : 'text-slate-500 hover:text-blue-400'}`}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* -- KPIs --------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          titulo="Total de Itens"
          valor={kpis.total_itens}
          icon={Package2}
          cor="text-blue-600"
          hexCor="#2563EB"
          isLight={isLight}
        />
        <KpiCard
          titulo="Abaixo do Minimo"
          valor={kpis.itens_abaixo_minimo}
          icon={AlertTriangle}
          cor={kpis.itens_abaixo_minimo > 0 ? 'text-red-600' : 'text-slate-400'}
          hexCor={kpis.itens_abaixo_minimo > 0 ? '#DC2626' : '#94A3B8'}
          subtitulo={kpis.itens_abaixo_minimo > 0 ? 'Reposicao urgente' : 'Tudo ok'}
          isLight={isLight}
        />
        <KpiCard
          titulo="Valor em Estoque"
          valor={fmt(kpis.valor_estoque_total)}
          icon={DollarSign}
          cor="text-indigo-600"
          hexCor="#4F46E5"
          isLight={isLight}
        />
        <KpiCard
          titulo="Moviment. no Mes"
          valor={kpis.movimentacoes_mes}
          icon={BarChart3}
          cor="text-cyan-600"
          hexCor="#0891B2"
          subtitulo={`${kpis.solicitacoes_abertas} sol. abertas`}
          isLight={isLight}
        />
      </div>

      {/* -- Acuracia + Itens Parados -------------------------------- */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 ${card}`}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Acuracia Inventario</p>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">
            {kpis.acuracia_ultimo_inventario != null
              ? `${kpis.acuracia_ultimo_inventario.toFixed(1)}%`
              : '--'
            }
          </p>
          <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Ultimo inventario concluido</p>
        </div>

        <div className={`rounded-2xl border p-4 ${card}`}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={14} className="text-amber-500" />
            <p className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Itens Parados</p>
          </div>
          <p className={`text-3xl font-extrabold ${kpis.itens_parados > 0 ? 'text-amber-600' : isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {kpis.itens_parados}
          </p>
          <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Sem movimentacao ha 90+ dias</p>
        </div>
      </div>

      {/* -- Alertas: Itens Abaixo do Minimo ------------------------ */}
      {abaixoMinimo.length > 0 && (
        <section className={`rounded-2xl border overflow-hidden ${card}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <AlertTriangle size={14} className="text-red-500" />
              Itens para Reposicao
            </h2>
            <button onClick={() => nav('/estoque/itens')}
              className="text-[10px] text-blue-600 font-semibold flex items-center gap-0.5">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
            {abaixoMinimo.slice(0, 8).map(saldo => (
              <div key={saldo.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <Package2 size={14} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                    {saldo.item?.descricao ?? '--'}
                  </p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {saldo.base?.nome ?? '--'} - Cod: {saldo.item?.codigo ?? '--'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-red-600">{saldo.saldo} {saldo.item?.unidade}</p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>min: {saldo.item?.estoque_minimo}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// -- KPI Card -------------------------------------------------------------------
function KpiCard({ titulo, valor, icon: Icon, cor, hexCor, subtitulo, isLight }: {
  titulo: string; valor: number | string; icon: typeof Package2;
  cor: string; hexCor: string; subtitulo?: string; isLight: boolean
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden flex ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}>
          <Icon size={14} className={cor} />
        </div>
        <p className={`text-xl font-extrabold ${cor} leading-none`}>{valor}</p>
        <p className={`text-[10px] font-semibold mt-1 uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{titulo}</p>
        {subtitulo && <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{subtitulo}</p>}
      </div>
    </div>
  )
}
