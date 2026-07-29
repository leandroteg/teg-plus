import { useState } from 'react'
import { Ban, XCircle, CheckCircle2, Loader2, AlertTriangle, Clock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  useCancelamentoPendente,
  useSolicitarCancelamento,
  useDecidirCancelamento,
  podeAprovarCancelamentoFin,
  podeSolicitarCancelamento,
  isDocLiquidado,
  type TipoDocFin,
} from '../../hooks/useCancelamentosFin'

interface Props {
  tipo: TipoDocFin
  docId: string
  status?: string
  cancelamentoPendente?: boolean
  dark?: boolean
  /** Chamado após uma decisão/solicitação bem-sucedida (ex.: fechar o detalhe pai). */
  onChanged?: () => void
  className?: string
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Erro inesperado')

/**
 * Controle de cancelamento de um documento financeiro (CP/CR).
 * - Documento cancelável e sem pendência: botão "Solicitar cancelamento" (justificativa).
 * - Pendência + aprovador: botões Aprovar / Recusar (recusa exige motivo).
 * - Pendência + não-aprovador: badge "aguardando aprovação".
 * - Documento liquidado (pago/recebido/conciliado) ou já cancelado: não renderiza (Fase 1).
 */
export default function CancelamentoDocControl({
  tipo, docId, status, cancelamentoPendente, dark = false, onChanged, className = '',
}: Props) {
  const { perfil } = useAuth()
  const isApprover = podeAprovarCancelamentoFin(perfil)

  const [mode, setMode] = useState<null | 'solicitar' | 'recusar'>(null)
  const [justificativa, setJustificativa] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const solicitar = useSolicitarCancelamento()
  const decidir = useDecidirCancelamento()
  const pendenteQuery = useCancelamentoPendente(tipo, docId, !!cancelamentoPendente)
  const pendente = pendenteQuery.data

  // Fase 1: documento já cancelado ou liquidado não tem ação de cancelamento aqui.
  if (status === 'cancelado' || isDocLiquidado(tipo, status)) return null

  const subtext = dark ? 'text-slate-400' : 'text-slate-500'

  async function handleSolicitar() {
    setErro(null)
    if (justificativa.trim().length < 3) { setErro('Descreva o motivo do cancelamento.'); return }
    try {
      await solicitar.mutateAsync({ tipo, docId, justificativa: justificativa.trim() })
      setMode(null); setJustificativa('')
      onChanged?.()
    } catch (e) { setErro(errMsg(e)) }
  }

  async function handleAprovar() {
    if (!pendente) return
    setErro(null)
    try {
      await decidir.mutateAsync({ cancelamentoId: pendente.id, aprovar: true, tipo })
      onChanged?.()
    } catch (e) { setErro(errMsg(e)) }
  }

  async function handleRecusar() {
    if (!pendente) return
    setErro(null)
    if (motivo.trim().length < 3) { setErro('Informe o motivo da recusa.'); return }
    try {
      await decidir.mutateAsync({ cancelamentoId: pendente.id, aprovar: false, motivo: motivo.trim(), tipo })
      setMode(null); setMotivo('')
      onChanged?.()
    } catch (e) { setErro(errMsg(e)) }
  }

  const busy = solicitar.isPending || decidir.isPending

  // ── Com pendência ──────────────────────────────────────────────────────────
  if (cancelamentoPendente) {
    return (
      <div className={`rounded-xl border px-3 py-2.5 ${dark ? 'border-amber-400/30 bg-amber-400/10' : 'border-amber-200 bg-amber-50'} ${className}`}>
        <div className="flex items-center gap-2 text-amber-700">
          <Clock size={14} className="shrink-0" />
          <span className="text-xs font-bold">Cancelamento solicitado — aguardando aprovação</span>
        </div>
        {pendente && (
          <p className={`mt-1 text-[11px] ${subtext}`}>
            Por {pendente.solicitante_nome ?? '—'}: “{pendente.justificativa}”
          </p>
        )}

        {isApprover && mode !== 'recusar' && (
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={handleAprovar}
              disabled={busy}
              className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {decidir.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Aprovar cancelamento
            </button>
            <button
              onClick={() => { setErro(null); setMode('recusar') }}
              disabled={busy}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border disabled:opacity-50 ${dark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Recusar
            </button>
          </div>
        )}

        {isApprover && mode === 'recusar' && (
          <div className="mt-2.5 space-y-2">
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              placeholder="Motivo da recusa (obrigatório)"
              className={`w-full text-xs rounded-lg px-2.5 py-2 border outline-none focus:ring-2 focus:ring-rose-300 ${dark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-slate-200'}`}
            />
            <div className="flex gap-2">
              <button
                onClick={handleRecusar}
                disabled={busy}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {decidir.isPending ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                Confirmar recusa
              </button>
              <button
                onClick={() => { setMode(null); setMotivo(''); setErro(null) }}
                disabled={busy}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border disabled:opacity-50 ${dark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-500'}`}
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {erro && (
          <p className="mt-2 text-[11px] text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} /> {erro}
          </p>
        )}
      </div>
    )
  }

  // ── Sem pendência: só quem NÃO está cancelando pode solicitar ────────────────
  if (!podeSolicitarCancelamento(tipo, status)) return null

  if (mode === 'solicitar') {
    return (
      <div className={`rounded-xl border px-3 py-2.5 ${dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'} ${className}`}>
        <p className={`text-xs font-bold ${dark ? 'text-slate-200' : 'text-slate-700'}`}>Solicitar cancelamento</p>
        <p className={`text-[11px] mt-0.5 ${subtext}`}>Um aprovador financeiro precisa confirmar. O documento não é excluído.</p>
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
            onClick={handleSolicitar}
            disabled={busy}
            className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {solicitar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
            Enviar solicitação
          </button>
          <button
            onClick={() => { setMode(null); setJustificativa(''); setErro(null) }}
            disabled={busy}
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

  return (
    <button
      onClick={() => { setErro(null); setMode('solicitar') }}
      className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border ${dark ? 'border-rose-400/30 text-rose-300 hover:bg-rose-500/10' : 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100'} ${className}`}
    >
      <Ban size={15} /> Solicitar cancelamento
    </button>
  )
}
