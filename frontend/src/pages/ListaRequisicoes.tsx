import { useState } from 'react'
import { Search, Filter } from 'lucide-react'
import { useRequisicoes } from '../hooks/useRequisicoes'
import StatusBadge from '../components/StatusBadge'
import type { StatusRequisicao } from '../types'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const STATUS_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'em_aprovacao', label: 'Em Aprovacao' },
  { value: 'aprovada', label: 'Aprovadas' },
  { value: 'rejeitada', label: 'Rejeitadas' },
  { value: 'pendente', label: 'Pendentes' },
]

export default function ListaRequisicoes() {
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const { data: requisicoes, isLoading } = useRequisicoes(statusFilter || undefined)

  const filtradas = (requisicoes ?? []).filter(r => {
    if (!busca) return true
    const termo = busca.toLowerCase()
    return (
      r.numero.toLowerCase().includes(termo) ||
      r.descricao.toLowerCase().includes(termo) ||
      r.solicitante_nome.toLowerCase().includes(termo) ||
      r.obra_nome.toLowerCase().includes(termo)
    )
  })

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-800">Requisicoes</h2>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
          placeholder="Buscar por numero, descricao, obra..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Filtro status */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
        <Filter className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
        {STATUS_OPTS.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
              statusFilter === s.value ? 'bg-primary text-white' : 'bg-white text-gray-600 border'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">Nenhuma requisicao encontrada</p>
      ) : (
        <div className="space-y-2">
          {filtradas.map(r => (
            <div key={r.id} className="bg-white rounded-lg p-3 shadow-sm border border-gray-50">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-mono text-gray-500">{r.numero}</span>
                <StatusBadge status={r.status as StatusRequisicao} />
              </div>
              <p className="text-sm font-medium truncate">{r.descricao}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400">{r.obra_nome}</span>
                <span className="text-sm font-bold text-primary">{fmt(r.valor_estimado)}</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-xs text-gray-400">
                <span>{r.solicitante_nome}</span>
                <span>{fmtData(r.created_at)}</span>
              </div>
              {r.urgencia !== 'normal' && (
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  r.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {r.urgencia}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-300 py-2">{filtradas.length} requisicoes</p>
    </div>
  )
}
