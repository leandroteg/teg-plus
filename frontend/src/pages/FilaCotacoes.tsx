import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Clock, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { useCotacoes } from '../hooks/useCotacoes'
import type { StatusCotacao } from '../types'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_TABS: { value: StatusCotacao | ''; label: string; icon: typeof Clock }[] = [
  { value: '', label: 'Todas', icon: ShoppingCart },
  { value: 'pendente', label: 'Pendentes', icon: Clock },
  { value: 'em_andamento', label: 'Em andamento', icon: AlertTriangle },
  { value: 'concluida', label: 'Concluidas', icon: CheckCircle },
]

const statusColors: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  concluida: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-gray-100 text-gray-500',
}

const urgenciaColors: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-600',
  urgente: 'bg-amber-100 text-amber-700',
  critica: 'bg-red-100 text-red-700',
}

export default function FilaCotacoes() {
  const nav = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusCotacao | ''>('')
  const { data: cotacoes, isLoading } = useCotacoes(undefined, statusFilter || undefined)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-violet-500" />
        Cotacoes
      </h2>

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                statusFilter === tab.value
                  ? 'bg-violet-100 text-violet-700 border-violet-300'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!cotacoes || cotacoes.length === 0) && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Nenhuma cotacao encontrada
        </div>
      )}

      {/* Cards */}
      {cotacoes?.map(cot => (
        <button
          key={cot.id}
          onClick={() => nav(`/cotacoes/${cot.id}`)}
          className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {cot.requisicao?.numero}
              </p>
              <p className="text-xs text-gray-500 truncate">{cot.requisicao?.descricao}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[cot.status] || 'bg-gray-100 text-gray-500'}`}>
              {cot.status === 'em_andamento' ? 'Em andamento' : cot.status.charAt(0).toUpperCase() + cot.status.slice(1)}
            </span>
            {cot.requisicao?.urgencia && cot.requisicao.urgencia !== 'normal' && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${urgenciaColors[cot.requisicao.urgencia]}`}>
                {cot.requisicao.urgencia.charAt(0).toUpperCase() + cot.requisicao.urgencia.slice(1)}
              </span>
            )}
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">{cot.requisicao?.obra_nome}</span>
            <span className="font-semibold text-violet-600">
              {cot.valor_selecionado ? fmt(cot.valor_selecionado) : fmt(cot.requisicao?.valor_estimado ?? 0)}
            </span>
          </div>

          {cot.fornecedor_selecionado_nome && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle className="w-3.5 h-3.5" />
              {cot.fornecedor_selecionado_nome}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
