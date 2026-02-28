import { useState } from 'react'
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  Clock, Building, AlertTriangle, Sparkles,
} from 'lucide-react'
import { useAprovacoesPendentes, useProcessarAprovacaoAi } from '../hooks/useAprovacoes'
import type { AprovacaoPendente } from '../types'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const urgenciaConfig: Record<string, { bg: string; text: string; label: string }> = {
  normal: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Normal' },
  urgente: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Urgente' },
  critica: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critica' },
}

function timeLeft(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Expirado'
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h restantes`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

function AprovacaoCard({ aprovacao }: { aprovacao: AprovacaoPendente }) {
  const mutation = useProcessarAprovacaoAi()
  const [expanded, setExpanded] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [action, setAction] = useState<'aprovada' | 'rejeitada' | null>(null)

  const req = aprovacao.requisicao
  const cot = aprovacao.cotacao_resumo
  const urg = urgenciaConfig[req.urgencia] || urgenciaConfig.normal

  const handleDecision = async (decisao: 'aprovada' | 'rejeitada') => {
    try {
      await mutation.mutateAsync({ token: aprovacao.token, decisao, observacao })
    } catch {
      // error displayed below
    }
  }

  if (mutation.isSuccess) {
    return (
      <div className={`rounded-2xl p-6 text-center ${
        action === 'aprovada' ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-red-50 border-2 border-red-200'
      }`}>
        {action === 'aprovada' ? (
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        ) : (
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
        )}
        <p className={`text-sm font-semibold ${action === 'aprovada' ? 'text-emerald-700' : 'text-red-700'}`}>
          {req.numero} — {action === 'aprovada' ? 'Aprovada' : 'Rejeitada'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-sm font-bold text-gray-800">{req.numero}</p>
            <p className="text-xs text-gray-500">{req.solicitante_nome}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${urg.bg} ${urg.text}`}>
            {urg.label}
          </span>
        </div>

        <p className="text-sm text-gray-700 mb-2">{req.descricao}</p>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <Building className="w-3.5 h-3.5" /> {req.obra_nome}
          </span>
          {aprovacao.data_limite && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {timeLeft(aprovacao.data_limite)}
            </span>
          )}
        </div>

        {/* Valor + Cotacao */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Valor estimado</span>
            <span className="text-base font-bold text-violet-600">{fmt(req.valor_estimado)}</span>
          </div>
          {cot && (
            <>
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Menor cotacao</span>
                  <span className="text-base font-bold text-emerald-600">{fmt(cot.valor)}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-gray-400">{cot.fornecedor_nome}</span>
                  <span className="text-[10px] text-gray-400">
                    {cot.prazo_dias}d | {cot.total_cotados} cotados
                  </span>
                </div>
              </div>
              {cot.valor < req.valor_estimado && (
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <Sparkles className="w-3 h-3" />
                  Economia de {fmt(req.valor_estimado - cot.valor)} ({Math.round((1 - cot.valor / req.valor_estimado) * 100)}%)
                </div>
              )}
            </>
          )}
        </div>

        {/* Expand */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-violet-500 mt-2 mx-auto"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Menos detalhes' : 'Mais detalhes'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="text-xs text-gray-400">Observacao (opcional)</label>
              <textarea
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="Adicionar observacao..."
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 border-t border-gray-100">
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => { setAction('rejeitada'); handleDecision('rejeitada') }}
          className="flex items-center justify-center gap-2 py-4 text-sm font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition border-r border-gray-100 disabled:opacity-50"
        >
          {mutation.isPending && action === 'rejeitada' ? (
            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          Rejeitar
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => { setAction('aprovada'); handleDecision('aprovada') }}
          className="flex items-center justify-center gap-2 py-4 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition disabled:opacity-50"
        >
          {mutation.isPending && action === 'aprovada' ? (
            <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle className="w-5 h-5" />
          )}
          Aprovar
        </button>
      </div>

      {mutation.isError && (
        <p className="text-red-500 text-xs text-center py-2">Erro ao processar. Tente novamente.</p>
      )}
    </div>
  )
}

export default function AprovAi() {
  const { data: aprovacoes, isLoading } = useAprovacoesPendentes()

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-600 via-indigo-600 to-violet-700">
      {/* Header */}
      <header className="px-4 pt-8 pb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="w-6 h-6 text-violet-200" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Aprova<span className="text-violet-200">Ai</span>
          </h1>
        </div>
        <p className="text-violet-200 text-xs">Aprovacoes inteligentes com 1 toque</p>
        {aprovacoes && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5">
            <span className="text-white text-sm font-bold">{aprovacoes.length}</span>
            <span className="text-violet-200 text-xs">pendente{aprovacoes.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="px-4 pb-8 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && (!aprovacoes || aprovacoes.length === 0) && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-violet-300 mx-auto mb-3" />
            <p className="text-white text-sm font-medium">Tudo aprovado!</p>
            <p className="text-violet-200 text-xs mt-1">Nenhuma aprovacao pendente</p>
          </div>
        )}

        {aprovacoes?.map(apr => (
          <AprovacaoCard key={apr.id} aprovacao={apr} />
        ))}
      </div>

      {/* Footer */}
      <footer className="text-center pb-6">
        <p className="text-violet-300 text-[10px]">TEG+ | TEG Uniao Engenharia</p>
      </footer>
    </div>
  )
}
