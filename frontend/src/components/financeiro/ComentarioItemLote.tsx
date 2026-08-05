import { useState } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { useComentarItemLote, type LoteItemComentario } from '../../hooks/useLotesPagamento'

/**
 * Esclarecimento de UM título do lote de pagamento (mig 229).
 *
 * O esclarecimento que já existia é do lote inteiro — devolve os 7 títulos por
 * causa de dúvida em 1. Aqui aprovador e Financeiro conversam sobre a linha,
 * sem travar o resto do lote.
 */

const fmtQuando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function ComentarioItemLote({
  cpId,
  loteId,
  comentarios = [],
  dark = false,
  align = 'left',
}: {
  cpId: string
  loteId?: string | null
  comentarios?: LoteItemComentario[]
  dark?: boolean
  /** 'right' encosta o painel à direita — usado nas listas em grade. */
  align?: 'left' | 'right'
}) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const comentar = useComentarItemLote()

  const enviar = async () => {
    if (!texto.trim()) { setErro('Escreva o comentário antes de enviar.'); return }
    setErro('')
    try {
      await comentar.mutateAsync({ cpId, loteId, texto })
      setTexto('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar o comentário.')
    }
  }

  const total = comentarios.length

  return (
    <div className={align === 'right' ? 'flex flex-col items-end' : ''}>
      <button
        type="button"
        title={total > 0 ? `${total} comentário(s) neste lançamento` : 'Comentar este lançamento'}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setAberto(v => !v) }}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
          total > 0
            ? dark ? 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25' : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
            : dark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
        }`}
      >
        <MessageSquare size={11} />
        {total > 0 ? total : 'Comentar'}
      </button>

      {aberto && (
        <div
          onClick={e => { e.preventDefault(); e.stopPropagation() }}
          className={`mt-1.5 w-full rounded-xl border p-2.5 space-y-2 text-left ${
            dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          {total > 0 && (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {comentarios.map(c => (
                <div
                  key={c.id}
                  className={`rounded-lg px-2.5 py-1.5 ${
                    c.autor_papel === 'aprovador'
                      ? dark ? 'bg-amber-500/10' : 'bg-amber-50 border border-amber-100'
                      : dark ? 'bg-sky-500/10' : 'bg-white border border-slate-200'
                  }`}
                >
                  <p className={`text-[10px] font-bold ${
                    c.autor_papel === 'aprovador'
                      ? dark ? 'text-amber-300' : 'text-amber-700'
                      : dark ? 'text-sky-300' : 'text-sky-700'
                  }`}>
                    {c.autor_nome}
                    <span className="font-normal opacity-70">
                      {' · '}{c.autor_papel === 'aprovador' ? 'Aprovador' : 'Financeiro'}
                      {' · '}{fmtQuando(c.created_at)}
                    </span>
                  </p>
                  <p className={`text-[11px] leading-snug whitespace-pre-wrap break-words ${dark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {c.texto}
                  </p>
                </div>
              ))}
            </div>
          )}

          <textarea
            autoFocus
            rows={2}
            value={texto}
            onChange={e => { setTexto(e.target.value); setErro('') }}
            placeholder="Ex: falta o boleto atualizado deste título..."
            className={`w-full rounded-lg border px-2.5 py-1.5 text-[11px] resize-none outline-none focus:ring-2 focus:ring-sky-300 ${
              dark ? 'bg-white/[0.05] border-white/10 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700'
            }`}
          />

          {erro && <p className="text-[10px] font-bold text-red-600">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAberto(false); setTexto(''); setErro('') }}
              className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold border ${
                dark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-white'
              }`}
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={comentar.isPending}
              className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50"
            >
              {comentar.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
