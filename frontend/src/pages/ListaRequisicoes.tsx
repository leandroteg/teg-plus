import { useState } from 'react'
import { Search } from 'lucide-react'
import { useRequisicoes } from '../hooks/useRequisicoes'
import StatusBadge from '../components/StatusBadge'
import type { StatusRequisicao } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_OPTS = [
  { value: '',             label: 'Todos'        },
  { value: 'pendente',     label: 'Pendentes'    },
  { value: 'em_aprovacao', label: 'Aprovação'    },
  { value: 'aprovada',     label: 'Aprovadas'    },
  { value: 'em_cotacao',   label: 'Em Cotação'   },
  { value: 'comprada',     label: 'Compradas'    },
  { value: 'rejeitada',    label: 'Rejeitadas'   },
]

const STATUS_BORDER: Record<string, string> = {
  pendente:     'border-l-amber-400',
  em_aprovacao: 'border-l-blue-400',
  aprovada:     'border-l-emerald-400',
  rejeitada:    'border-l-red-400',
  em_cotacao:   'border-l-violet-400',
  comprada:     'border-l-green-400',
  cancelada:    'border-l-gray-300',
  rascunho:     'border-l-gray-300',
}

const AVATAR_COLORS = [
  ['bg-violet-500', 'bg-violet-50', 'text-violet-700'],
  ['bg-indigo-500', 'bg-indigo-50', 'text-indigo-700'],
  ['bg-sky-500',    'bg-sky-50',    'text-sky-700'   ],
  ['bg-emerald-500','bg-emerald-50','text-emerald-700'],
  ['bg-amber-500',  'bg-amber-50',  'text-amber-700' ],
  ['bg-rose-500',   'bg-rose-50',   'text-rose-700'  ],
]

function CompradorRow({ nome }: { nome: string }) {
  const [avatarBg, chipBg, chipText] = AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length]
  const initials = nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${chipBg}`}>
      <div className={`w-5 h-5 rounded-full ${avatarBg} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-[9px] font-extrabold">{initials}</span>
      </div>
      <span className={`text-xs font-semibold ${chipText}`}>{nome.split(' ')[0]}</span>
    </div>
  )
}

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
      r.obra_nome.toLowerCase().includes(termo) ||
      (r.comprador_nome ?? '').toLowerCase().includes(termo)
    )
  })

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold text-gray-800 tracking-tight">Requisições</h2>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          placeholder="Buscar número, descrição, obra, comprador..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Filtro status */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
        {STATUS_OPTS.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === s.value
                ? 'bg-navy text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">Nenhuma requisição encontrada</p>
      ) : (
        <div className="space-y-2">
          {filtradas.map(r => (
            <div
              key={r.id}
              className={`bg-white rounded-2xl shadow-card border-l-4 ${STATUS_BORDER[r.status] ?? 'border-l-gray-200'} pl-3 pr-4 py-3`}
            >
              {/* Linha 1: número + badge */}
              <div className="flex justify-between items-center gap-2">
                <span className="text-[10px] font-mono text-gray-400">{r.numero}</span>
                <StatusBadge status={r.status as StatusRequisicao} />
              </div>

              {/* Descrição */}
              <p className="text-sm font-semibold text-gray-800 mt-1 line-clamp-2 leading-snug">
                {r.descricao}
              </p>

              {/* Obra + Valor */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400 truncate max-w-[55%]">{r.obra_nome}</span>
                <span className="text-sm font-extrabold text-primary">{fmt(r.valor_estimado)}</span>
              </div>

              {/* Solicitante + Data */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-xs text-gray-400 truncate">{r.solicitante_nome}</span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{fmtData(r.created_at)}</span>
              </div>

              {/* Comprador em destaque */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                {r.comprador_nome
                  ? <CompradorRow nome={r.comprador_nome} />
                  : <span className="text-xs text-gray-300 italic">Sem comprador alocado</span>
                }
              </div>

              {/* Urgência */}
              {r.urgencia !== 'normal' && (
                <div className="mt-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                    r.urgencia === 'critica'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    ⚡ {r.urgencia}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-300 py-2">
        {filtradas.length} requisição{filtradas.length !== 1 ? 'ões' : ''}
      </p>
    </div>
  )
}
