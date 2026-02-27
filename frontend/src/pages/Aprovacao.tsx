import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, XCircle, Shield } from 'lucide-react'
import { useProcessarAprovacao } from '../hooks/useRequisicoes'

export default function Aprovacao() {
  const { token } = useParams<{ token: string }>()
  const mutation = useProcessarAprovacao()
  const [observacao, setObservacao] = useState('')

  const processar = (decisao: 'aprovada' | 'rejeitada') => {
    if (!token) return
    mutation.mutate({ token, decisao, observacao: observacao || undefined })
  }

  if (mutation.isSuccess) {
    const msg = (mutation.data as { message?: string })?.message
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-sm w-full">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Processado!</h2>
          <p className="text-gray-500 text-sm">{msg || 'Sua decisao foi registrada.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full space-y-4">
        <div className="text-center">
          <Shield className="w-12 h-12 text-primary mx-auto mb-2" />
          <h2 className="text-lg font-bold text-gray-800">Aprovacao de Compra</h2>
          <p className="text-xs text-gray-400 mt-1 font-mono">{token}</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Observacao (opcional)</label>
          <textarea
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Comentario sobre a decisao..."
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => processar('rejeitada')}
            disabled={mutation.isPending}
            className="flex-1 bg-danger text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Rejeitar
          </button>
          <button
            onClick={() => processar('aprovada')}
            disabled={mutation.isPending}
            className="flex-1 bg-success text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" /> Aprovar
          </button>
        </div>

        {mutation.isPending && (
          <div className="flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {mutation.isError && (
          <p className="text-danger text-sm text-center">Erro ao processar. Token invalido ou ja utilizado.</p>
        )}
      </div>
    </div>
  )
}
