import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useRequisicoes } from '../hooks/useRequisicoes'
import StatusBadge from '../components/StatusBadge'
import FluxoTimeline from '../components/FluxoTimeline'
import type { StatusRequisicao } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// Pipeline tabs (etapas do fluxo)
const PIPELINE_TABS = [
  { value: '',                label: 'Todos' },
  { value: 'pendente',        label: 'Pendentes' },
  { value: 'em_aprovacao',    label: 'Em Aprov.' },
  { value: 'em_cotacao',      label: 'Em Cotação' },
  { value: 'cotacao_enviada', label: 'Cot. Enviada' },
  { value: 'cotacao_aprovada',label: 'Aprov. Fin.' },
  { value: 'pedido_emitido',  label: 'Pedido' },
  { value: 'em_entrega',      label: 'Entrega' },
  { value: 'pago',            label: 'Pago' },
  { value: 'rejeitada',       label: 'Reprovadas' },
  { value: 'cancelada',       label: 'Canceladas' },
]

const AVATAR_COLORS: Record<string, string> = {
  Lauany:   'bg-violet-500',
  Fernando: 'bg-amber-500',
  Aline:    'bg-emerald-500',
}

function CompradorBadge({ nome }: { nome: string }) {
  const bg = AVATAR_COLORS[nome.split(' ')[0]] ?? 'bg-slate-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-[9px] font-extrabold">{nome.slice(0, 2).toUpperCase()}</span>
      </div>
      <span className="text-xs font-semibold text-slate-700">{nome.split(' ')[0]}</span>
    </div>
  )
}

// Chip contextual por status
function StatusChip({ status, dataPrevista }: { status: string; dataPrevista?: string }) {
  if (status === 'pendente' || status === 'rascunho') {
    return <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-semibold">Aguardando aprovação</span>
  }
  if (status === 'em_cotacao' || status === 'aprovada') {
    return <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 rounded-full px-2 py-0.5 font-semibold">Comprador cotando</span>
  }
  if (status === 'pedido_emitido') {
    return <span className="text-[10px] bg-cyan-50 text-cyan-600 border border-cyan-200 rounded-full px-2 py-0.5 font-semibold">Pedido emitido</span>
  }
  if (status === 'em_entrega') {
    const data = dataPrevista ? `Prev: ${new Date(dataPrevista).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'Em entrega'
    return <span className="text-[10px] bg-teal-50 text-teal-600 border border-teal-200 rounded-full px-2 py-0.5 font-semibold">{data}</span>
  }
  return null
}

export default function ListaRequisicoes() {
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { data: requisicoes, isLoading } = useRequisicoes(statusFilter || undefined)

  const filtradas = (requisicoes ?? []).filter(r => {
    if (!busca) return true
    const termo = busca.toLowerCase()
    return (
      r.numero.toLowerCase().includes(termo) ||
      r.descricao.toLowerCase().includes(termo) ||
      r.solicitante_nome.toLowerCase().includes(termo) ||
      r.obra_nome.toLowerCase().includes(termo) ||
      (r.comprador_nome ?? '').toLowerCase().includes(termo) ||
      (r.categoria ?? '').toLowerCase().includes(termo)
    )
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Requisições</h2>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
            showFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-500'
          }`}>
          <SlidersHorizontal size={12} /> Filtros
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition"
          placeholder="Buscar número, descrição, obra, comprador..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Filtros de pipeline */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {PIPELINE_TABS.map(tab => (
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
      ) : filtradas.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-10">Nenhuma requisição encontrada</p>
      ) : (
        <div className="space-y-2">
          {filtradas.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              {/* Linha 1: número + urgência + status */}
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{r.numero}</span>
                  {r.urgencia !== 'normal' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
                      r.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      ⚡ {r.urgencia}
                    </span>
                  )}
                  {r.categoria && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 truncate max-w-[80px]">
                      {r.categoria.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <StatusBadge status={r.status as StatusRequisicao} size="sm" />
              </div>

              {/* Descrição */}
              <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{r.descricao}</p>

              {/* FluxoTimeline compact */}
              <FluxoTimeline status={r.status} compact />

              {/* Obra + Valor */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 truncate max-w-[55%]">{r.obra_nome}</span>
                <span className="text-sm font-extrabold text-teal-600">{fmt(r.valor_estimado)}</span>
              </div>

              {/* Comprador + data + chip contextual */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  {r.comprador_nome
                    ? <CompradorBadge nome={r.comprador_nome} />
                    : <span className="text-xs text-slate-300 italic">Sem comprador</span>
                  }
                  <StatusChip status={r.status} />
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {r.solicitante_nome.split(' ')[0]} · {fmtData(r.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-300 py-2">
        {filtradas.length} requisição{filtradas.length !== 1 ? 'ões' : ''}
      </p>
    </div>
  )
}
