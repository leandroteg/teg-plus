import { useNavigate } from 'react-router-dom'
import {
  Landmark, TrendingDown, Wrench, FileText,
  ArrowLeftRight, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { usePatrimonialKPIs, useImobilizados, useMovimentacoesPatrimonial } from '../../hooks/usePatrimonial'
import { useTheme } from '../../contexts/ThemeContext'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function PatrimonialHome() {
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const { data: kpis } = usePatrimonialKPIs()
  const { data: imobilizados = [] } = useImobilizados()
  const { data: movimentacoes = [] } = useMovimentacoesPatrimonial()

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  const aguardandoEntrada = imobilizados.filter(i => i.status === 'pendente_registro').length
  const depreciados = imobilizados.filter(i => (i.percentual_depreciado ?? 0) >= 100).length
  const baixados = imobilizados.filter(i => i.status === 'baixado').length
  const recentes = movimentacoes.slice(0, 6)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Painel Patrimonial</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{'Vis\u00e3o geral dos ativos, deprecia\u00e7\u00e3o e movimenta\u00e7\u00f5es'}</p>
        </div>
        <button
          onClick={() => nav('/patrimonial/movimentacoes?nova=1')}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeftRight size={15} /> {'Nova Movimenta\u00e7\u00e3o'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard titulo="Ativos" valor={kpis?.total_imobilizados ?? 0} icon={Landmark} cor="text-amber-600" hexCor="#D97706" isLight={isLight} />
        <KpiCard titulo={'Valor L\u00edquido'} valor={fmt(kpis?.valor_total_liquido ?? 0)} icon={CheckCircle2} cor="text-yellow-700" hexCor="#CA8A04" isLight={isLight} />
        <KpiCard titulo="Depreciados" valor={depreciados} icon={TrendingDown} cor="text-red-600" hexCor="#DC2626" isLight={isLight} />
        <KpiCard titulo={'Em Manuten\u00e7\u00e3o'} valor={kpis?.imobilizados_em_manutencao ?? 0} icon={Wrench} cor="text-orange-600" hexCor="#EA580C" isLight={isLight} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MiniCard title="Aguardando Entrada" value={aguardandoEntrada} tone="violet" isLight={isLight} />
        <MiniCard title="Baixados" value={baixados} tone="slate" isLight={isLight} />
        <MiniCard title="Termos Pendentes" value={kpis?.termos_pendentes ?? 0} tone="red" isLight={isLight} />
      </div>

      <section className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className={`px-4 py-3 border-b flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <ArrowLeftRight size={14} className="text-amber-600" />
            {'Movimenta\u00e7\u00f5es Recentes'}
          </h2>
          <button onClick={() => nav('/patrimonial/movimentacoes')} className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
            Ver todas <ArrowRight size={10} />
          </button>
        </div>
        {recentes.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className={`${isLight ? 'text-slate-400' : 'text-slate-500'} text-sm`}>{'Nenhuma movimenta\u00e7\u00e3o registrada'}</p>
          </div>
        ) : (
          <div className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
            {recentes.map(mov => (
              <div key={mov.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                    {mov.imobilizado?.numero_patrimonio ?? '--'} - {mov.imobilizado?.descricao ?? 'Sem descri\u00e7\u00e3o'}
                  </p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {mov.tipo} {mov.responsavel_destino ? `- ${mov.responsavel_destino}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold ${mov.confirmado ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {mov.confirmado ? 'Confirmado' : 'Pendente'}
                  </p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function KpiCard({ titulo, valor, icon: Icon, cor, hexCor, isLight }: {
  titulo: string
  valor: number | string
  icon: typeof Landmark
  cor: string
  hexCor: string
  isLight: boolean
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden flex ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${hexCor}18` }}>
          <Icon size={14} className={cor} />
        </div>
        <p className={`text-xl font-extrabold ${cor} leading-none`}>{valor}</p>
        <p className={`text-[10px] font-semibold mt-1 uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{titulo}</p>
      </div>
    </div>
  )
}

function MiniCard({ title, value, tone, isLight }: { title: string; value: number; tone: 'violet' | 'slate' | 'red'; isLight: boolean }) {
  const tones = {
    violet: 'text-violet-600 bg-violet-50',
    slate: 'text-slate-600 bg-slate-100',
    red: 'text-red-600 bg-red-50',
  }
  return (
    <div className={`rounded-2xl border p-4 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${tones[tone]}`}>
        <Landmark size={14} />
      </div>
      <p className={`text-2xl font-extrabold ${tone === 'red' ? 'text-red-600' : tone === 'violet' ? 'text-violet-600' : isLight ? 'text-slate-700' : 'text-slate-200'}`}>{value}</p>
      <p className={`text-[10px] font-semibold mt-1 uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
    </div>
  )
}
