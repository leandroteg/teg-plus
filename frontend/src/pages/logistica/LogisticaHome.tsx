import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Truck, CheckCircle2, AlertTriangle,
  Package2, FileText, Building2, RefreshCw, ArrowRight,
  Clock,
} from 'lucide-react'
import { useLogisticaKPIs, useSolicitacoes } from '../../hooks/useLogistica'
import { useTheme } from '../../contexts/ThemeContext'
import type { LogisticaKPIs } from '../../types/logistica'

const EMPTY_KPIS: LogisticaKPIs = {
  total_solicitacoes: 0, abertas: 0, em_transito: 0,
  entregues_hoje: 0, confirmadas_hoje: 0, urgentes_pendentes: 0,
  nfe_emitidas_mes: 0, custo_total_mes: 0,
  taxa_entrega_prazo: 0, taxa_avarias: 0, tempo_medio_confirmacao_h: 0,
}

const STATUS_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  solicitado:             { label: 'Solicitado',      dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600'   },
  planejado:              { label: 'Planejado',       dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  aguardando_aprovacao:   { label: 'Aguard. Aprov.',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  aprovado:               { label: 'Aprovado',        dot: 'bg-indigo-400',  bg: 'bg-indigo-50',   text: 'text-indigo-700'  },
  romaneio_emitido:       { label: 'Romaneio',        dot: 'bg-teal-400',    bg: 'bg-teal-50',     text: 'text-teal-700'    },
  nfe_emitida:            { label: 'NF-e Emitida',    dot: 'bg-violet-400',  bg: 'bg-violet-50',   text: 'text-violet-700'  },
  aguardando_coleta:      { label: 'Aguard. Coleta',  dot: 'bg-cyan-400',    bg: 'bg-cyan-50',     text: 'text-cyan-700'    },
  em_transito:            { label: 'Em Trânsito',     dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700'  },
  entregue:               { label: 'Entregue',        dot: 'bg-teal-400',    bg: 'bg-teal-50',     text: 'text-teal-700'    },
  concluido:              { label: 'Concluído',       dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700'   },
  recusado:               { label: 'Recusado',        dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-700'     },
  cancelado:              { label: 'Cancelado',       dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500'    },
}

export function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme()
  const c = STATUS_LABEL[status] ?? { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${isDark ? 'bg-white/10' : c.bg} ${isDark ? 'text-slate-200' : c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

const TIPO_LABEL: Record<string, string> = {
  viagem: 'Viagem',
  mobilizacao: 'Mobilização',
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
  const { isDark } = useTheme()
  const { data: kpis = EMPTY_KPIS, isLoading, refetch } = useLogisticaKPIs()
  const { data: urgentes = [] } = useSolicitacoes({
    urgente: true,
    status: ['solicitado', 'planejado', 'aguardando_aprovacao'],
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
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-navy'}`}>Painel — Logística</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Transportes, NF-e e rastreamento de entregas</p>
        </div>
        <button onClick={() => refetch()}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-slate-500 hover:text-orange-400' : 'text-slate-400 hover:text-orange-600'}`}>
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
        <div className={`rounded-2xl shadow-sm p-4 ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Truck size={14} className="text-teal-500" />
            <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Entregues Hoje</p>
          </div>
          <p className="text-3xl font-extrabold text-teal-600">{kpis.entregues_hoje}</p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{kpis.confirmadas_hoje} confirmadas</p>
        </div>
        <div className={`rounded-2xl shadow-sm p-4 ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber-500" />
            <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aguard. Confirmação</p>
          </div>
          <p className={`text-3xl font-extrabold ${kpis.entregues_hoje - kpis.confirmadas_hoje > 0 ? 'text-amber-600' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {Math.max(0, kpis.entregues_hoje - kpis.confirmadas_hoje)}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>SLA: até 4h após entrega</p>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ icon: Icon, label, to, color, bg }) => (
          <button key={to} onClick={() => nav(to)}
            className={`rounded-2xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center group ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
            <div className={`w-9 h-9 ${isDark ? 'bg-white/10' : bg} rounded-xl flex items-center justify-center mx-auto mb-2
              group-hover:scale-110 transition-transform`}>
              <Icon size={16} className={color} />
            </div>
            <p className={`text-[10px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</p>
          </button>
        ))}
      </div>

      {/* ── Em Trânsito ───────────────────────────────────────── */}
      {emTransito.length > 0 && (
        <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Truck size={14} className="text-orange-500" /> Em Trânsito Agora
            </h2>
            <button onClick={() => nav('/logistica/transportes')}
              className="text-[10px] text-orange-600 font-semibold flex items-center gap-0.5">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {emTransito.slice(0, 5).map(s => (
              <div key={s.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                  <Truck size={14} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.numero}</p>
                    {s.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">URGENTE</span>}
                  </div>
                  <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {s.origem} → {s.destino}
                    {s.obra_nome ? ` · ${s.obra_nome}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {s.transporte?.motorista_nome ?? s.motorista_nome ?? '—'}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.transporte?.placa ?? s.veiculo_placa ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Urgentes Pendentes ────────────────────────────────── */}
      {urgentes.length > 0 && (
        <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-red-500/30' : 'bg-white border border-red-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-red-500/20' : 'border-b border-red-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-red-400' : 'text-red-800'}`}>
              <AlertTriangle size={14} className="text-red-500" /> Solicitações Urgentes
            </h2>
            <button onClick={() => nav('/logistica/solicitacoes')}
              className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
              Ver todas <ArrowRight size={10} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-red-50'}`}>
            {urgentes.slice(0, 4).map(s => (
              <div key={s.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-red-50/50'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                  <AlertTriangle size={14} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.numero}</p>
                  <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {TIPO_LABEL[s.tipo] ?? s.tipo} · {s.origem} → {s.destino}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={s.status} />
                  {s.data_desejada && (
                    <p className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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
  const { isDark } = useTheme()
  return (
    <div className={`rounded-2xl shadow-sm overflow-hidden flex ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}>
          <Icon size={14} className={cor} />
        </div>
        <p className={`text-xl font-extrabold ${cor} leading-none`}>{valor}</p>
        <p className={`text-[10px] font-semibold mt-1 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{titulo}</p>
        {subtitulo && <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{subtitulo}</p>}
      </div>
    </div>
  )
}
