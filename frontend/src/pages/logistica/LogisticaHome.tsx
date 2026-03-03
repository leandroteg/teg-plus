import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Truck, CheckCircle2, AlertTriangle,
  Package2, FileText, Building2, RefreshCw, ArrowRight,
  Clock,
} from 'lucide-react'
import { useLogisticaKPIs, useSolicitacoes } from '../../hooks/useLogistica'
import type { LogisticaKPIs } from '../../types/logistica'

const EMPTY_KPIS: LogisticaKPIs = {
  total_solicitacoes: 0, abertas: 0, em_transito: 0,
  entregues_hoje: 0, confirmadas_hoje: 0, urgentes_pendentes: 0,
  nfe_emitidas_mes: 0, custo_total_mes: 0,
  taxa_entrega_prazo: 0, taxa_avarias: 0, tempo_medio_confirmacao_h: 0,
}

const STATUS_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  solicitado:             { label: 'Solicitado',      dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600'   },
  validando:              { label: 'Validando',       dot: 'bg-sky-400',     bg: 'bg-sky-50',      text: 'text-sky-700'     },
  planejado:              { label: 'Planejado',       dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  aguardando_aprovacao:   { label: 'Aguard. Aprov.',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  aprovado:               { label: 'Aprovado',        dot: 'bg-indigo-400',  bg: 'bg-indigo-50',   text: 'text-indigo-700'  },
  nfe_emitida:            { label: 'NF-e Emitida',    dot: 'bg-violet-400',  bg: 'bg-violet-50',   text: 'text-violet-700'  },
  em_transito:            { label: 'Em Trânsito',     dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700'  },
  entregue:               { label: 'Entregue',        dot: 'bg-teal-400',    bg: 'bg-teal-50',     text: 'text-teal-700'    },
  confirmado:             { label: 'Confirmado',      dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  concluido:              { label: 'Concluído',       dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700'   },
  recusado:               { label: 'Recusado',        dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-700'     },
  cancelado:              { label: 'Cancelado',       dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500'    },
}

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_LABEL[status] ?? { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

const TIPO_LABEL: Record<string, string> = {
  viagem: 'Viagem',
  mobilizacao: 'Mobilização',
  transferencia_material: 'Transf. Material',
  transferencia_maquina: 'Transf. Máquina',
}

const ACTIONS = [
  { icon: ClipboardList, label: 'Solicitações',    to: '/logistica/solicitacoes',    color: 'text-orange-600',  bg: 'bg-orange-50'  },
  { icon: Package2,      label: 'Expedição',       to: '/logistica/expedicao',       color: 'text-amber-600',   bg: 'bg-amber-50'   },
  { icon: Truck,         label: 'Transportes',     to: '/logistica/transportes',     color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { icon: CheckCircle2,  label: 'Recebimentos',    to: '/logistica/recebimentos',    color: 'text-emerald-600', bg: 'bg-emerald-50' },
]

export default function LogisticaHome() {
  const nav = useNavigate()
  const { data: kpis = EMPTY_KPIS, isLoading, refetch } = useLogisticaKPIs()
  const { data: urgentes = [] } = useSolicitacoes({
    urgente: true,
    status: ['solicitado', 'validando', 'planejado', 'aguardando_aprovacao'],
  })
  const { data: emTransito = [] } = useSolicitacoes({ status: 'em_transito' })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Painel — Logística</h1>
          <p className="text-xs text-slate-400 mt-0.5">Transportes, NF-e e rastreamento de entregas</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-orange-600 transition-colors">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard titulo="Abertas" valor={kpis.abertas}
          icon={ClipboardList} cor="text-orange-600" hexCor="#EA580C" />
        <KpiCard titulo="Em Trânsito" valor={kpis.em_transito}
          icon={Truck} cor="text-blue-600" hexCor="#2563EB" />
        <KpiCard titulo="Urgentes Pendentes" valor={kpis.urgentes_pendentes}
          icon={AlertTriangle}
          cor={kpis.urgentes_pendentes > 0 ? 'text-red-600' : 'text-slate-400'}
          hexCor={kpis.urgentes_pendentes > 0 ? '#DC2626' : '#94A3B8'}
          subtitulo={kpis.urgentes_pendentes > 0 ? 'Atenção!' : 'Nenhuma'} />
        <KpiCard titulo="NF-e no Mês" valor={kpis.nfe_emitidas_mes}
          icon={FileText} cor="text-violet-600" hexCor="#7C3AED" />
      </div>

      {/* ── Entregas do dia ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={14} className="text-teal-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Entregues Hoje</p>
          </div>
          <p className="text-3xl font-extrabold text-teal-600">{kpis.entregues_hoje}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kpis.confirmadas_hoje} confirmadas</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aguard. Confirmação</p>
          </div>
          <p className={`text-3xl font-extrabold ${kpis.entregues_hoje - kpis.confirmadas_hoje > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {Math.max(0, kpis.entregues_hoje - kpis.confirmadas_hoje)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">SLA: até 4h após entrega</p>
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

      {/* ── Em Trânsito ───────────────────────────────────────── */}
      {emTransito.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Truck size={14} className="text-orange-500" /> Em Trânsito Agora
            </h2>
            <button onClick={() => nav('/logistica/transportes')}
              className="text-[10px] text-orange-600 font-semibold flex items-center gap-0.5">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {emTransito.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  <Truck size={14} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-extrabold text-slate-700 font-mono">{s.numero}</p>
                    {s.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">URGENTE</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {s.origem} → {s.destino}
                    {s.obra_nome ? ` · ${s.obra_nome}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-slate-600">
                    {s.transporte?.motorista_nome ?? s.motorista_nome ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-400">{s.transporte?.placa ?? s.veiculo_placa ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Urgentes Pendentes ────────────────────────────────── */}
      {urgentes.length > 0 && (
        <section className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-red-100 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-red-800 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-500" /> Solicitações Urgentes
            </h2>
            <button onClick={() => nav('/logistica/solicitacoes')}
              className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
              Ver todas <ArrowRight size={10} />
            </button>
          </div>
          <div className="divide-y divide-red-50">
            {urgentes.slice(0, 4).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-red-50/50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-slate-700 font-mono">{s.numero}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {TIPO_LABEL[s.tipo] ?? s.tipo} · {s.origem} → {s.destino}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={s.status} />
                  {s.data_desejada && (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      Prazo: {new Date(s.data_desejada + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function KpiCard({ titulo, valor, icon: Icon, cor, hexCor, subtitulo }: {
  titulo: string; valor: number | string; icon: typeof ClipboardList;
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
