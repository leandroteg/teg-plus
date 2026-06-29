import { useState } from 'react'
import { X, FileText, Download, Printer, Loader2, PenLine, User, Building2, CheckCircle2, ThumbsUp, ThumbsDown, AlertTriangle, PackageCheck } from 'lucide-react'
import type { Cautela } from '../../types/cautela'
import { abrirTermoPdf, downloadTermoPdf, getTermoPdfFileName } from '../../utils/termo-aceite-cautela-pdf'
import { useAtualizarCautela, podeDevolverCautela } from '../../hooks/useCautelas'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabase'
import { UpperTextarea } from '../UpperInput'
import DevolucaoModal from './DevolucaoModal'

interface Props {
  cautela: Cautela
  isDark: boolean
  onClose: () => void
  baseNome?: string
}

export default function TermoAceiteModal({ cautela, isDark, onClose, baseNome }: Props) {
  const [busy, setBusy] = useState<'open' | 'download' | 'aprovar' | 'rejeitar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const atualizarMutation = useAtualizarCautela()
  const { perfil, isAdmin } = useAuth()
  const jaSalvo = !!cautela.assinatura_retirada_url
  const isPendente = cautela.status === 'pendente'
  const isAprovadaSemAssinatura = cautela.status === 'aprovada' && !jaSalvo
  // Status permite devolver E o usuário tem permissão (admin / comprador na Sede /
  // almoxarife lotado na obra; o próprio detentor não, salvo admin). Espelha a RPC.
  const statusPermiteDevolver = cautela.status === 'em_aberto' || cautela.status === 'em_devolucao'
  const podeDevolver = statusPermiteDevolver && podeDevolverCautela({ cautela, perfil, isAdmin })
  const [showRejeitar, setShowRejeitar] = useState(false)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [decisao, setDecisao] = useState<null | 'aprovada' | 'rejeitada'>(null)
  const [showDevolucao, setShowDevolucao] = useState(false)

  const totalItens = cautela.itens?.length ?? 0

  const handle = async (mode: 'open' | 'download') => {
    if (busy) return
    setBusy(mode)
    try {
      // Termo já salvo → abre/baixa o PDF arquivado direto do Storage
      if (jaSalvo && cautela.termo_url) {
        const { data: signed } = await supabase.storage
          .from('cautelas-termos')
          .createSignedUrl(cautela.termo_url, 60)
        if (signed?.signedUrl) {
          if (mode === 'open') {
            window.open(signed.signedUrl, '_blank')
          } else {
            const a = document.createElement('a')
            a.href = signed.signedUrl
            a.download = getTermoPdfFileName({ cautela, baseNome })
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }
          return
        }
      }
      // Cautela sem assinatura ainda — gera preview do termo SEM assinatura
      // (para revisao). A assinatura real e capturada exclusivamente na NovaCautela.
      const data = { cautela, baseNome, assinaturaDataUrl: undefined }
      if (mode === 'open') await abrirTermoPdf(data)
      else await downloadTermoPdf(data)
    } finally {
      setBusy(null)
    }
  }

  async function handleAprovar() {
    if (busy) return
    setErro(null)
    setBusy('aprovar')
    try {
      await atualizarMutation.mutateAsync({
        id: cautela.id,
        status: 'aprovada',
        aprovador_id: perfil?.id,
        aprovador_nome: perfil?.nome,
      })
      setDecisao('aprovada')
      setTimeout(() => onClose(), 1500)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao aprovar cautela.')
    } finally {
      setBusy(null)
    }
  }

  async function handleRejeitar() {
    if (busy) return
    setErro(null)
    if (motivoRejeicao.trim().length < 3) {
      setErro('Informe um motivo de pelo menos 3 caracteres.')
      return
    }
    setBusy('rejeitar')
    try {
      await atualizarMutation.mutateAsync({
        id: cautela.id,
        status: 'rejeitada',
        motivo_rejeicao: motivoRejeicao.trim(),
        aprovador_id: perfil?.id,
        aprovador_nome: perfil?.nome,
      })
      setDecisao('rejeitada')
      setTimeout(() => onClose(), 1500)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao rejeitar cautela.')
    } finally {
      setBusy(null)
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const panelCls = isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border shadow-2xl max-h-[92vh] overflow-y-auto ${panelCls}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-teal-500" />
          </div>
          <div className="min-w-0">
            <h2 className={`text-sm font-extrabold truncate ${txtMain}`}>Termo de Aceite</h2>
            <p className={`text-xs ${txtMuted}`}>Cautela {cautela.numero || '—'}</p>
          </div>
          <button
            onClick={onClose}
            className={`ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Banner Devolver (cautela liberada, aguardando ou em devolução parcial) */}
          {podeDevolver && (
            <div className={`rounded-xl border p-3 ${isDark ? 'bg-violet-500/10 border-violet-500/30' : 'bg-violet-50 border-violet-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <PackageCheck size={14} className="text-violet-600" />
                <p className={`text-sm font-bold ${isDark ? 'text-violet-300' : 'text-violet-800'}`}>
                  {cautela.status === 'em_devolucao' ? 'Devolução em andamento' : 'Material em poder do colaborador'}
                </p>
              </div>
              <p className={`text-[11px] mb-3 ${isDark ? 'text-violet-200/80' : 'text-violet-700'}`}>
                Registre a devolução total ou parcial. O estoque volta automaticamente conforme a quantidade devolvida.
              </p>
              <button
                onClick={() => setShowDevolucao(true)}
                disabled={!!busy}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                <PackageCheck size={13} /> Registrar devolução
              </button>
            </div>
          )}

          {/* Banner de decisao (cautela pendente) */}
          {isPendente && decisao !== 'aprovada' && decisao !== 'rejeitada' && (
            <div className={`rounded-xl border p-3 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-600" />
                <p className={`text-sm font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                  Cautela aguardando decisão
                </p>
              </div>
              <p className={`text-[11px] mb-3 ${isDark ? 'text-amber-200/80' : 'text-amber-700'}`}>
                Aprove pra liberar a retirada (depois assina o termo); rejeite com motivo se não puder atender.
              </p>
              {!showRejeitar ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleAprovar}
                    disabled={!!busy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {busy === 'aprovar' ? <Loader2 size={13} className="animate-spin" /> : <ThumbsUp size={13} />}
                    Aprovar
                  </button>
                  <button
                    onClick={() => setShowRejeitar(true)}
                    disabled={!!busy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold transition disabled:opacity-50"
                  >
                    <ThumbsDown size={13} /> Rejeitar
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <UpperTextarea
                    rows={2}
                    value={motivoRejeicao}
                    onChange={e => setMotivoRejeicao(e.target.value)}
                    placeholder="Motivo da rejeição (obrigatório)"
                    className="w-full border border-red-300 bg-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowRejeitar(false); setMotivoRejeicao(''); setErro(null) }}
                      disabled={!!busy}
                      className="flex-1 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition disabled:opacity-50"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleRejeitar}
                      disabled={!!busy || motivoRejeicao.trim().length < 3}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      {busy === 'rejeitar' ? <Loader2 size={13} className="animate-spin" /> : <ThumbsDown size={13} />}
                      Confirmar rejeição
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {decisao === 'aprovada' && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={14} /> Cautela aprovada. Próximo passo: assinar o termo na retirada.
            </div>
          )}
          {decisao === 'rejeitada' && (
            <div className="rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-bold px-3 py-2 flex items-center gap-2">
              <ThumbsDown size={14} /> Cautela rejeitada.
            </div>
          )}

          {/* Resumo */}
          <div className={`rounded-xl border p-3 space-y-1.5 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
            <div className={`flex items-center gap-2 text-sm font-semibold ${txtMain}`}>
              <User size={14} className="text-teal-500" />
              {cautela.solicitante_nome || 'Colaborador não informado'}
            </div>
            {cautela.obra_nome && (
              <div className={`flex items-center gap-2 text-xs ${txtMuted}`}>
                <Building2 size={12} /> {cautela.obra_nome}
              </div>
            )}
            <div className={`text-xs ${txtMuted}`}>
              {totalItens} {totalItens === 1 ? 'item' : 'itens'} · Retirada {cautela.data_retirada ? new Date(cautela.data_retirada).toLocaleDateString('pt-BR') : new Date(cautela.criado_em).toLocaleDateString('pt-BR')}
            </div>
            {cautela.status === 'rejeitada' && cautela.motivo_rejeicao && (
              <div className={`mt-1 pt-1.5 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>Motivo da rejeição</p>
                <p className={`text-[11px] ${isDark ? 'text-red-300' : 'text-red-700'}`}>{cautela.motivo_rejeicao}</p>
              </div>
            )}
          </div>

          {/* Status da assinatura — apenas leitura. A assinatura SÓ é capturada
              na entrega via NovaCautela. */}
          <div>
            <div className="flex items-center mb-1.5">
              <label className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${txtMuted}`}>
                <PenLine size={13} /> Assinatura do colaborador
              </label>
            </div>
            {jaSalvo ? (
              <div className={`rounded-xl border p-3 text-center ${
                isDark ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                  <p className={`text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                    Termo assinado e arquivado
                  </p>
                </div>
                <p className={`text-[11px] ${isDark ? 'text-emerald-200/80' : 'text-emerald-700'}`}>
                  Use os botões abaixo para visualizar ou baixar o PDF.
                </p>
              </div>
            ) : isAprovadaSemAssinatura ? (
              <div className={`rounded-xl border p-3 ${
                isDark ? 'bg-violet-500/10 border-violet-500/30' : 'bg-violet-50 border-violet-200'
              }`}>
                <p className={`text-xs font-bold ${isDark ? 'text-violet-300' : 'text-violet-800'}`}>
                  Cautela aprovada — pronta para retirada
                </p>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-violet-200/80' : 'text-violet-700'}`}>
                  A assinatura do colaborador é capturada na entrega via tela <strong>Nova Cautela</strong>.
                </p>
              </div>
            ) : (
              <div className={`rounded-xl border p-3 ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
              }`}>
                <p className={`text-xs ${txtMuted}`}>
                  Sem assinatura registrada. Termo será assinado na entrega via <strong>Nova Cautela</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Histórico de devoluções (cada etapa, inclusive parciais) */}
          {(cautela.devolucoes?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center mb-1.5">
                <label className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${txtMuted}`}>
                  <PackageCheck size={13} /> Histórico de devoluções
                </label>
              </div>
              <ul className="space-y-1.5">
                {cautela.devolucoes!.map((ev, i) => (
                  <li key={i} className={`rounded-xl border p-2.5 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-bold ${txtMain}`}>
                        {new Date(ev.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`text-[10px] ${txtMuted}`}>
                        {(ev.itens ?? []).reduce((s, it) => s + (Number(it.quantidade) || 0), 0)} un
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${txtMuted}`}>
                      {(ev.itens ?? []).map(it => `${it.quantidade}× ${it.descricao || 'item'}`).join(', ') || '—'}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${txtMuted}`}>
                      Devolvido por <strong>{ev.devolvido_por_nome || '—'}</strong> · Recebido por <strong>{ev.recebedor_nome || '—'}</strong>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {erro && (
            <div className="rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-semibold px-3 py-2">
              {erro}
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={() => handle('open')}
              disabled={!!busy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.98] ${
                isDark ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              {busy === 'open' ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              Pré-visualizar
            </button>
            <button
              onClick={() => handle('download')}
              disabled={!!busy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.98] ${
                isDark ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              {busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Baixar PDF
            </button>
          </div>
        </div>
      </div>

      {showDevolucao && (
        <DevolucaoModal
          cautela={cautela}
          isDark={isDark}
          onClose={() => {
            setShowDevolucao(false)
            onClose()
          }}
        />
      )}
    </div>
  )
}
