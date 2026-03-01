import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Clock, CheckCircle, AlertTriangle, ChevronRight, Info } from 'lucide-react'
import { useCotacoes } from '../hooks/useCotacoes'
import type { StatusCotacao } from '../types'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_TABS: { value: StatusCotacao | ''; label: string; icon: typeof Clock }[] = [
  { value: '',           label: 'Todas',         icon: ShoppingCart  },
  { value: 'pendente',   label: 'Pendentes',     icon: Clock         },
  { value: 'em_andamento', label: 'Em andamento', icon: AlertTriangle },
  { value: 'concluida', label: 'Concluídas',    icon: CheckCircle   },
]

const statusCotConfig: Record<string, { bg: string; text: string; label: string }> = {
  pendente:    { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Pendente'     },
  em_andamento:{ bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Em andamento' },
  concluida:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Concluída'    },
  cancelada:   { bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Cancelada'    },
}

const urgenciaConfig: Record<string, { bg: string; text: string }> = {
  normal:  { bg: 'bg-slate-100', text: 'text-slate-600'  },
  urgente: { bg: 'bg-amber-100', text: 'text-amber-700'  },
  critica: { bg: 'bg-red-100',   text: 'text-red-700'    },
}

// Calcula dias em aberto
function diasEmAberto(createdAt: string) {
  const dias = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return dias
}

// Alerta de cotações mínimas baseado no valor
function AlertaCotacoes({ valor }: { valor: number }) {
  const minCot = valor <= 500 ? 1 : valor <= 2000 ? 2 : 3
  if (minCot === 1) return null
  return (
    <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      <Info size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
      <p className="text-[11px] text-amber-700">
        Mín. <strong>{minCot} cotações</strong> obrigatórias{' '}
        ({valor <= 2000 ? 'valor acima de R$500' : 'valor acima de R$2.000'})
      </p>
    </div>
  )
}

export default function FilaCotacoes() {
  const nav = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusCotacao | ''>('')
  const { data: cotacoes, isLoading } = useCotacoes(undefined, statusFilter || undefined)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
        <ShoppingCart size={18} className="text-teal-500" />
        Fila de Cotações
      </h2>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0 ${
                statusFilter === tab.value
                  ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}>
              <Icon size={12} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!cotacoes || cotacoes.length === 0) && (
        <div className="text-center py-12 text-slate-400">
          <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma cotação encontrada</p>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {cotacoes?.map(cot => {
          const st = statusCotConfig[cot.status] || statusCotConfig.pendente
          const urgCfg = cot.requisicao?.urgencia ? urgenciaConfig[cot.requisicao.urgencia] : urgenciaConfig.normal
          const valor = cot.valor_selecionado ?? (cot.requisicao as any)?.valor_estimado ?? 0
          const dias = diasEmAberto(cot.created_at)
          const concluida = cot.status === 'concluida'

          return (
            <div key={cot.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${concluida ? 'border-emerald-200' : 'border-slate-200'}`}>
              {/* Header */}
              <div className={`px-4 py-3 ${concluida ? 'bg-emerald-50' : 'bg-slate-50'} border-b ${concluida ? 'border-emerald-100' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-sm text-slate-800">{cot.requisicao?.numero ?? '—'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                    {cot.requisicao?.urgencia && cot.requisicao.urgencia !== 'normal' && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${urgCfg.bg} ${urgCfg.text}`}>
                        ⚡ {cot.requisicao.urgencia}
                      </span>
                    )}
                  </div>
                  {dias > 0 && !concluida && (
                    <span className={`text-[10px] font-semibold flex-shrink-0 ${dias > 5 ? 'text-red-500' : 'text-slate-400'}`}>
                      {dias}d aberta
                    </span>
                  )}
                </div>
              </div>

              {/* Conteúdo */}
              <div className="px-4 py-3 space-y-2.5">
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                  {cot.requisicao?.descricao}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{cot.requisicao?.obra_nome}</span>
                  <span className={`font-extrabold text-sm ${concluida ? 'text-emerald-600' : 'text-teal-600'}`}>
                    {fmt(valor)}
                  </span>
                </div>

                {/* Alerta de cotações mínimas */}
                {!concluida && <AlertaCotacoes valor={valor} />}

                {/* Fornecedor selecionado */}
                {cot.fornecedor_selecionado_nome && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                    <CheckCircle size={13} /> {cot.fornecedor_selecionado_nome}
                  </div>
                )}

                {/* Categoria badge */}
                {cot.requisicao?.categoria && (
                  <span className="inline-block text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                    {cot.requisicao.categoria.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              {/* Botão de ação */}
              <button onClick={() => nav(`/cotacoes/${cot.id}`)}
                className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-bold border-t transition-all ${
                  concluida
                    ? 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                    : 'border-slate-100 text-teal-600 hover:bg-teal-50'
                }`}>
                {concluida ? 'Ver detalhes' : 'Abrir e Cotar'}
                <ChevronRight size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
