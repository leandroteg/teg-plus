import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Loader2, Send, Lock, UserCircle2, Headset, CheckCircle2,
  PauseCircle, PlayCircle, XCircle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { UpperTextarea } from '../../components/UpperInput'
import AuditoriaCard from '../../components/AuditoriaCard'
import {
  useChamado, useIsAtendenteTi,
  adicionarComentario, atualizarStatus, assumirChamado,
} from './hooks'
import AnexosBox from './AnexosBox'
import {
  STATUS_COLOR, STATUS_LABEL, formatNumero, getCategoria, PRIORIDADE_LABEL,
  type StatusChamado,
} from './types'

export default function ChamadoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { perfil } = useAuth()
  const isAtendente = useIsAtendenteTi()
  const { chamado, comentarios, loading, erro, reload } = useChamado(id)

  const [mensagem, setMensagem] = useState('')
  const [interno, setInterno] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (erro || !chamado) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="max-w-3xl mx-auto">
          <Link to="/ti" className="text-sm text-sky-500">← Voltar</Link>
          <p className="mt-6 text-rose-500">{erro ?? 'Chamado não encontrado.'}</p>
        </div>
      </div>
    )
  }

  const cat = getCategoria(chamado.categoria)
  const ehSolicitante = chamado.solicitante_id === perfil?.id
  const podeComentar = chamado.status !== 'fechado'

  async function handleComentar(e: React.FormEvent) {
    e.preventDefault()
    if (!perfil?.id || !id) return
    if (mensagem.trim().length < 1) return
    setEnviando(true)
    setErroAcao(null)
    try {
      await adicionarComentario({
        chamado_id: id,
        autor_id: perfil.id,
        autor_nome: perfil.nome,
        autor_email: perfil.email,
        autor_eh_atendente: isAtendente,
        mensagem: mensagem.trim(),
        interno: isAtendente ? interno : false,
      })
      // Se atendente respondeu e estava 'aberto', move pra em_atendimento
      if (isAtendente && chamado!.status === 'aberto' && !interno) {
        await atualizarStatus(id, 'em_atendimento', perfil.id)
      }
      // Se solicitante comentou em chamado aguardando, devolve pra em_atendimento
      if (ehSolicitante && chamado!.status === 'aguardando_usuario') {
        await atualizarStatus(id, 'em_atendimento')
      }
      setMensagem('')
      setInterno(false)
      reload()
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Erro ao enviar mensagem.')
    } finally {
      setEnviando(false)
    }
  }

  async function handleStatus(novo: StatusChamado) {
    if (!id) return
    setErroAcao(null)
    try {
      await atualizarStatus(id, novo)
      reload()
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Erro ao mudar status.')
    }
  }

  async function handleAssumir() {
    if (!id || !perfil?.id) return
    setErroAcao(null)
    try {
      await assumirChamado(id, perfil.id)
      reload()
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Erro ao assumir.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link to={isAtendente ? '/ti/fila' : '/ti/meus'} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-sky-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        {/* Header card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
                <cat.Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {formatNumero(chamado.numero)} · {cat.label} · {PRIORIDADE_LABEL[chamado.prioridade]}
                </p>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mt-0.5 break-words">
                  {chamado.titulo}
                </h1>
              </div>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap ${STATUS_COLOR[chamado.status]}`}>
              {STATUS_LABEL[chamado.status]}
            </span>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            {chamado.descricao}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <AuditoriaCard
              createdAt={chamado.created_at}
              updatedAt={chamado.updated_at}
              criadoPor={chamado.criado_por_nome ?? chamado.solicitante?.nome}
              atualizadoPor={chamado.atualizado_por_nome}
              extra={[
                { label: 'Atendente', value: chamado.atendente?.nome },
              ]}
            />
          </div>
        </div>

        {/* Atendente actions */}
        {isAtendente && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300 mb-3">
              Ações de atendimento
            </p>
            <div className="flex flex-wrap gap-2">
              {!chamado.atendente_id && (
                <button onClick={handleAssumir} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium">
                  <Headset className="w-4 h-4" /> Assumir
                </button>
              )}
              {chamado.status !== 'em_atendimento' && chamado.status !== 'fechado' && chamado.status !== 'resolvido' && (
                <button onClick={() => handleStatus('em_atendimento')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm">
                  <PlayCircle className="w-4 h-4" /> Em atendimento
                </button>
              )}
              {chamado.status !== 'aguardando_usuario' && chamado.status !== 'fechado' && chamado.status !== 'resolvido' && (
                <button onClick={() => handleStatus('aguardando_usuario')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm">
                  <PauseCircle className="w-4 h-4" /> Aguardar usuário
                </button>
              )}
              {chamado.status !== 'resolvido' && chamado.status !== 'fechado' && (
                <button onClick={() => handleStatus('resolvido')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Marcar resolvido
                </button>
              )}
              {chamado.status === 'resolvido' && (
                <button onClick={() => handleStatus('fechado')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm">
                  <XCircle className="w-4 h-4" /> Fechar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Resolvido — solicitante confirma */}
        {ehSolicitante && chamado.status === 'resolvido' && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 mb-6">
            <p className="text-sm text-slate-700 dark:text-slate-200 mb-3">
              A TI marcou seu chamado como <strong>resolvido</strong>. Está tudo certo?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatus('fechado')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar e fechar
              </button>
              <button
                onClick={() => handleStatus('em_atendimento')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
              >
                Reabrir — ainda não resolvido
              </button>
            </div>
          </div>
        )}

        {/* Anexos */}
        <div className="mb-6">
          <AnexosBox
            chamadoId={chamado.id}
            podeAnexar={chamado.status !== 'fechado'}
          />
        </div>

        {/* Thread */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
            Conversa
          </h2>
          {comentarios.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">
              Nenhuma resposta ainda. {isAtendente ? 'Seja o primeiro a responder.' : 'A TI vai responder em breve.'}
            </p>
          )}
          <div className="space-y-3">
            {comentarios.map(c => {
              const meuComentario = c.autor_id === perfil?.id
              return (
                <div
                  key={c.id}
                  className={`p-4 rounded-xl border ${
                    c.interno
                      ? 'border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/10'
                      : meuComentario
                        ? 'border-sky-500/30 bg-sky-50/50 dark:bg-sky-500/10'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    <UserCircle2 className="w-4 h-4" />
                    <span className="font-medium text-slate-700 dark:text-slate-200">{c.autor?.nome ?? 'Usuário'}</span>
                    <span>·</span>
                    <span>{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                    {c.interno && (
                      <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] uppercase font-semibold tracking-wide">
                        <Lock className="w-3 h-3" /> Nota interna
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{c.mensagem}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Compose */}
        {podeComentar && (
          <form onSubmit={handleComentar} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <UpperTextarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="ESCREVA UMA RESPOSTA..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y"
            />
            {erroAcao && (
              <p className="mt-2 text-sm text-rose-500">{erroAcao}</p>
            )}
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              {isAtendente ? (
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={interno}
                    onChange={(e) => setInterno(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <Lock className="w-3.5 h-3.5" />
                  Nota interna (só atendentes veem)
                </label>
              ) : <span />}
              <button
                type="submit"
                disabled={enviando || mensagem.trim().length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </button>
            </div>
          </form>
        )}

        {!podeComentar && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 italic">
            Este chamado está fechado. Abra um novo se precisar de mais ajuda.
          </p>
        )}
      </div>
    </div>
  )
}
