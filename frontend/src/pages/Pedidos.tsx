import { useState } from 'react'
import { Package, Truck, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { usePedidos, useAtualizarPedido } from '../hooks/usePedidos'
import FluxoTimeline from '../components/FluxoTimeline'
import type { Pedido } from '../types'

const fmt = (v?: number) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

// Dias até a data prevista (negativo = atrasado)
function diasRestantes(data?: string): number | null {
  if (!data) return null
  return Math.round((new Date(data).getTime() - Date.now()) / 86_400_000)
}

const STATUS_TABS = [
  { value: '',          label: 'Todos'     },
  { value: 'emitido',   label: 'Emitidos'  },
  { value: 'confirmado',label: 'Confirmados'},
  { value: 'em_entrega',label: 'Em Entrega'},
  { value: 'entregue',  label: 'Entregues' },
]

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  emitido:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    label: 'Emitido'    },
  confirmado: { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Confirmado' },
  em_entrega: { bg: 'bg-teal-100',    text: 'text-teal-700',    label: 'Em Entrega' },
  entregue:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Entregue'   },
  cancelado:  { bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Cancelado'  },
}

function PedidoCard({ pedido }: { pedido: Pedido }) {
  const mutation = useAtualizarPedido()
  const [expanded, setExpanded] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const dias    = diasRestantes(pedido.data_prevista_entrega)
  const st      = statusConfig[pedido.status] || statusConfig.emitido
  const atrasado = dias !== null && dias < 0 && pedido.status !== 'entregue'
  const entregue = pedido.status === 'entregue'

  const confirmarEntrega = async () => {
    setConfirmando(true)
    try {
      await mutation.mutateAsync({
        id:     pedido.id,
        status: 'entregue',
        data_entrega_real: new Date().toISOString().split('T')[0],
      })
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
      atrasado ? 'border-red-200' : entregue ? 'border-emerald-200' : 'border-slate-200'
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        atrasado ? 'bg-red-50 border-red-100'
        : entregue ? 'bg-emerald-50 border-emerald-100'
        : 'bg-slate-50 border-slate-100'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          {pedido.numero_pedido && (
            <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">#{pedido.numero_pedido}</span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${st.bg} ${st.text}`}>
            {st.label}
          </span>
          {atrasado && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold flex-shrink-0">
              <AlertTriangle size={10} /> {Math.abs(dias!)}d atrasado
            </span>
          )}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-3">
        {/* Fornecedor + valor */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{pedido.fornecedor_nome}</p>
            {pedido.requisicao && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{pedido.requisicao.obra_nome}</p>
            )}
          </div>
          <p className="text-base font-extrabold text-teal-600 flex-shrink-0">{fmt(pedido.valor_total)}</p>
        </div>

        {/* RC origem */}
        {pedido.requisicao && (
          <p className="text-xs text-slate-500 line-clamp-1">
            <span className="font-mono text-slate-300">{pedido.requisicao.numero}</span>
            {' · '}
            {pedido.requisicao.descricao}
          </p>
        )}

        {/* Timeline parcial (etapas 5-7) */}
        <FluxoTimeline status={`pedido_emitido`} compact />

        {/* Datas */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">Pedido em</span>
            <p className="font-semibold text-slate-700">{fmtData(pedido.data_pedido)}</p>
          </div>
          <div>
            <span className="text-slate-400">Prev. entrega</span>
            <p className={`font-semibold ${atrasado ? 'text-red-600' : 'text-slate-700'}`}>
              {fmtData(pedido.data_prevista_entrega)}
              {dias !== null && !entregue && (
                <span className={`ml-1 text-[10px] ${atrasado ? 'text-red-500' : dias <= 2 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {atrasado ? `(${Math.abs(dias)}d atr.)` : `(${dias}d)`}
                </span>
              )}
            </p>
          </div>
          {pedido.data_entrega_real && (
            <div>
              <span className="text-slate-400">Entregue em</span>
              <p className="font-semibold text-emerald-600">{fmtData(pedido.data_entrega_real)}</p>
            </div>
          )}
          {pedido.nf_numero && (
            <div>
              <span className="text-slate-400">NF</span>
              <p className="font-semibold text-slate-700 font-mono">{pedido.nf_numero}</p>
            </div>
          )}
        </div>

        {/* Detalhes expandíveis */}
        {expanded && pedido.observacoes && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[11px] text-slate-500 leading-relaxed">{pedido.observacoes}</p>
          </div>
        )}

        {/* Botão confirmar entrega */}
        {!entregue && pedido.status !== 'cancelado' && (
          <button
            onClick={confirmarEntrega}
            disabled={confirmando || mutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-50 text-teal-700 border border-teal-300 hover:bg-teal-500 hover:text-white transition-all disabled:opacity-50"
          >
            {confirmando
              ? <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              : <CheckCircle size={16} />}
            Confirmar Entrega
          </button>
        )}

        {entregue && (
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
            <CheckCircle size={14} /> Entrega confirmada {pedido.data_entrega_real ? `em ${fmtData(pedido.data_entrega_real)}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Pedidos() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: pedidos, isLoading } = usePedidos(statusFilter || undefined)

  // Ordenar: atrasados primeiro, depois por data prevista
  const sorted = (pedidos ?? []).slice().sort((a, b) => {
    const diasA = diasRestantes(a.data_prevista_entrega) ?? 9999
    const diasB = diasRestantes(b.data_prevista_entrega) ?? 9999
    return diasA - diasB
  })

  const atrasados = sorted.filter(p => {
    const dias = diasRestantes(p.data_prevista_entrega)
    return dias !== null && dias < 0 && p.status !== 'entregue'
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <Truck size={18} className="text-teal-500" />
          Pedidos
        </h2>
        {atrasados.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
            <AlertTriangle size={11} /> {atrasados.length} atrasado{atrasados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map(tab => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              statusFilter === tab.value
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(p => <PedidoCard key={p.id} pedido={p} />)}
        </div>
      )}

      <p className="text-center text-xs text-slate-300 py-2">
        {sorted.length} pedido{sorted.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
