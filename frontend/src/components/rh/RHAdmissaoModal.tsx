// ─────────────────────────────────────────────────────────────────────────────
// components/rh/RHAdmissaoModal.tsx — Revisão + ações de aprovação (RH-only)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  X, Send, CheckCircle2, XCircle, HelpCircle, FileText, ExternalLink, Loader2,
  Briefcase, Building2, Calendar, DollarSign, User, AlertTriangle, Paperclip,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTransicaoAdmissao, getAnexoSignedUrl, type AcaoAdmissao } from '../../hooks/useRHAdmissaoFluxo'
import { TIPOS_ANEXO_ADMISSAO } from '../../types/rh'
import type { RHAdmissao } from '../../types/rh'

const tipoLabel = (t: string) => TIPOS_ANEXO_ADMISSAO.find(x => x.value === t)?.label ?? t

export default function RHAdmissaoModal({ adm, onClose }: { adm: RHAdmissao; onClose: () => void }) {
  const { perfil } = useAuth()
  const transicao = useTransicaoAdmissao()
  const [motivoAcao, setMotivoAcao] = useState('')
  const [pedindo, setPedindo] = useState<'rejeitar' | 'esclarecer' | null>(null)
  const [abrindo, setAbrindo] = useState<string | null>(null)

  const autorNome = perfil?.nome || perfil?.email || 'Usuário'
  const etapa = adm.etapa ?? 'requisicao'

  async function executar(acao: AcaoAdmissao, motivo?: string) {
    await transicao.mutateAsync({ adm, acao, autorId: perfil?.id, autorNome, motivo })
    onClose()
  }

  async function abrirAnexo(path: string, id: string) {
    setAbrindo(id)
    const w = window.open('', '_blank')
    const url = await getAnexoSignedUrl(path)
    if (url && w) w.location.href = url
    else if (w) w.close()
    setAbrindo(null)
  }

  const anexos = adm.anexos ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
              <User size={18} className="text-teal-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">{adm.nome_candidato}</h2>
              <p className="text-xs text-slate-500 truncate">{adm.cargo_previsto || 'Cargo não informado'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Flags de aprovação */}
          {adm.status_aprovacao === 'rejeitado' && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-red-700"><XCircle size={14} /> Rejeitado na aprovação</p>
              {adm.motivo_decisao && <p className="text-xs text-red-600 mt-1">{adm.motivo_decisao}</p>}
            </div>
          )}
          {adm.status_aprovacao === 'esclarecimento' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700"><HelpCircle size={14} /> Esclarecimento solicitado</p>
              {adm.motivo_decisao && <p className="text-xs text-amber-700 mt-1">{adm.motivo_decisao}</p>}
            </div>
          )}
          {adm.urgente && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-2.5 flex items-center gap-1.5 text-xs font-bold text-orange-700">
              <AlertTriangle size={14} /> Solicitação urgente
            </div>
          )}

          {/* Motivo */}
          {adm.motivo && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Motivo</p>
              <p className="text-sm text-slate-700">{adm.motivo}</p>
            </div>
          )}

          {/* Grid de dados */}
          <div className="grid grid-cols-2 gap-3">
            <Info icon={User} label="CPF" value={adm.cpf} />
            <Info icon={Briefcase} label="Cargo" value={adm.cargo_previsto} />
            <Info icon={Building2} label="Obra" value={adm.obra_prevista ? `${adm.obra_prevista.codigo ?? ''} ${adm.obra_prevista.nome}`.trim() : undefined} />
            <Info icon={Calendar} label="Início previsto" value={adm.data_prevista_inicio ? new Date(adm.data_prevista_inicio).toLocaleDateString('pt-BR') : undefined} />
            <Info icon={DollarSign} label="Salário previsto" value={adm.salario_previsto ? adm.salario_previsto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : undefined} />
            <Info icon={Briefcase} label="Tipo" value={[adm.tipo_contrato, adm.tipo_movimentacao === 'substituicao' ? 'Substituição' : adm.tipo_movimentacao === 'aumento_quadro' ? 'Aumento de quadro' : null].filter(Boolean).join(' · ')} />
          </div>

          {adm.solicitante_nome && (
            <p className="text-[11px] text-slate-400">Solicitado por <span className="font-semibold text-slate-600">{adm.solicitante_nome}</span></p>
          )}

          {/* Anexos */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
              <Paperclip size={11} /> Documentos ({anexos.length})
            </p>
            {anexos.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum documento anexado.</p>
            ) : (
              <div className="space-y-1.5">
                {anexos.map(a => (
                  <button key={a.id} onClick={() => abrirAnexo(a.arquivo_path, a.id)}
                    className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 transition-all text-left">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 shrink-0">
                      <FileText size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-700">{a.arquivo_nome}</p>
                      <p className="text-[10px] text-slate-400">{tipoLabel(a.tipo)}{a.tipo === 'ctps' ? ' · obrigatório' : ''}</p>
                    </div>
                    {abrindo === a.id ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <ExternalLink size={13} className="text-slate-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Caixa de motivo (rejeitar/esclarecer) */}
          {pedindo && (
            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <label className="text-xs font-semibold text-slate-600">
                {pedindo === 'rejeitar' ? 'Motivo da rejeição' : 'O que precisa ser esclarecido?'}
              </label>
              <textarea rows={2} value={motivoAcao} onChange={e => setMotivoAcao(e.target.value)} autoFocus
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setPedindo(null); setMotivoAcao('') }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100">Cancelar</button>
                <button onClick={() => executar(pedindo, motivoAcao)} disabled={!motivoAcao.trim() || transicao.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${pedindo === 'rejeitar' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ações por etapa */}
        {!pedindo && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
            {etapa === 'requisicao' && (
              <button onClick={() => executar('solicitar_aprovacao')} disabled={transicao.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 shadow-sm">
                {transicao.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Solicitar Aprovação
              </button>
            )}
            {etapa === 'aprovacao' && (
              <>
                <button onClick={() => { setPedindo('esclarecer'); setMotivoAcao('') }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                  <HelpCircle size={15} /> Esclarecer
                </button>
                <button onClick={() => { setPedindo('rejeitar'); setMotivoAcao('') }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                  <XCircle size={15} /> Rejeitar
                </button>
                <button onClick={() => executar('aprovar')} disabled={transicao.isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 shadow-sm">
                  {transicao.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Aprovar
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ icon: Icon, label, value }: { icon: typeof User; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm text-slate-700 truncate">{value}</p>
      </div>
    </div>
  )
}
