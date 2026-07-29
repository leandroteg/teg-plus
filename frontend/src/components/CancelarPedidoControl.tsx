import { useState } from 'react'
import { Ban, Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCancelarPedido, podeCancelarPedido, pedidoEhCancelavel } from '../hooks/useCancelarPedido'

interface Props {
  pedidoId: string
  status?: string
  dark?: boolean
  /** Chamado após cancelar com sucesso (ex.: fechar o detalhe). Recebe quantos CP foram cancelados. */
  onDone?: (cpsCanceladas: number) => void
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Erro inesperado')

/**
 * Botão "Cancelar Pedido" — visível só para quem tem pode_cancelar_pedido
 * (supervisor de Compras) e apenas em estágio cancelável (emitido/confirmado/em_entrega).
 * Cancela o pedido e cascateia o cancelamento dos lançamentos financeiros (CP) não pagos.
 */
export default function CancelarPedidoControl({ pedidoId, status, dark = false, onDone }: Props) {
  const { perfil } = useAuth()
  const cancelar = useCancelarPedido()
  const [aberto, setAberto] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  if (!podeCancelarPedido(perfil) || !pedidoEhCancelavel(status)) return null

  async function handleConfirmar() {
    setErro(null)
    if (justificativa.trim().length < 3) { setErro('Descreva o motivo do cancelamento.'); return }
    try {
      const res = await cancelar.mutateAsync({ pedidoId, justificativa: justificativa.trim() })
      setAberto(false); setJustificativa('')
      onDone?.(res?.cps_canceladas ?? 0)
    } catch (e) { setErro(errMsg(e)) }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => { setErro(null); setAberto(true) }}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border ${dark ? 'border-rose-400/30 text-rose-300 hover:bg-rose-500/10' : 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100'}`}
      >
        <Ban size={16} /> Cancelar Pedido
      </button>
    )
  }

  return (
    <div className={`rounded-xl border px-3 py-3 ${dark ? 'border-rose-400/30 bg-rose-500/10' : 'border-rose-200 bg-rose-50'}`}>
      <p className={`text-xs font-bold ${dark ? 'text-rose-200' : 'text-rose-700'}`}>Cancelar pedido</p>
      <p className={`text-[11px] mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        Cancela o pedido e os lançamentos financeiros (não pagos) ligados a ele. Não pode ser desfeito.
      </p>
      <textarea
        value={justificativa}
        onChange={e => setJustificativa(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Motivo do cancelamento (obrigatório)"
        className={`mt-2 w-full text-xs rounded-lg px-2.5 py-2 border outline-none focus:ring-2 focus:ring-rose-300 ${dark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-slate-200'}`}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleConfirmar}
          disabled={cancelar.isPending}
          className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {cancelar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
          Confirmar cancelamento
        </button>
        <button
          onClick={() => { setAberto(false); setJustificativa(''); setErro(null) }}
          disabled={cancelar.isPending}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border disabled:opacity-50 ${dark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-500'}`}
        >
          Voltar
        </button>
      </div>
      {erro && (
        <p className="mt-2 text-[11px] text-red-600 flex items-center gap-1">
          <AlertTriangle size={12} /> {erro}
        </p>
      )}
    </div>
  )
}
