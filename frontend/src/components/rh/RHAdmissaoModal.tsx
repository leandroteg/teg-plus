// ─────────────────────────────────────────────────────────────────────────────
// components/rh/RHAdmissaoModal.tsx — Revisão da requisição + candidatos + aprovação
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  X, Send, CheckCircle2, XCircle, HelpCircle, FileText, ExternalLink, Loader2,
  Building2, Calendar, Briefcase, AlertTriangle, User, Users, Smartphone, Circle, MinusCircle,
  Pencil,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLookupCentrosCusto } from '../../hooks/useLookups'
import {
  useTransicaoAdmissao, getAnexoSignedUrl, useEnviarMissaoDocs, useMissoesDocsStatus,
  useEditarAdmissao, useBasesAdmissao, useLiberarAdmissao, useUploadAnexoCandidato,
  type AcaoAdmissao,
} from '../../hooks/useRHAdmissaoFluxo'
import { TIPOS_ANEXO_ADMISSAO, TIPOS_CONTRATO } from '../../types/rh'
import type { RHAdmissao, RHAdmissaoCandidato } from '../../types/rh'

const EDIT_INPUT = 'w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none'

// Chip âmbar nos campos corrigidos pelo RH
function TagRH() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold align-middle" title="Corrigido pelo RH">
      <Pencil size={8} /> RH
    </span>
  )
}

const tipoLabel = (t: string) => TIPOS_ANEXO_ADMISSAO.find(x => x.value === t)?.label ?? t
const fmtMoney = (v?: number) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
const movLabel = (m?: string) => m === 'substituicao' ? 'Substituição' : m === 'aumento_quadro' ? 'Aumento de quadro' : ''

export default function RHAdmissaoModal({ adm, onClose }: { adm: RHAdmissao; onClose: () => void }) {
  const { perfil } = useAuth()
  const transicao = useTransicaoAdmissao()
  const liberar = useLiberarAdmissao()
  const editar = useEditarAdmissao()
  const centrosCusto = useLookupCentrosCusto()
  const { data: bases = [] } = useBasesAdmissao()
  const [motivoAcao, setMotivoAcao] = useState('')
  const [pedindo, setPedindo] = useState<'rejeitar' | 'esclarecer' | null>(null)
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [edReq, setEdReq] = useState<Record<string, string>>({})
  const [edCands, setEdCands] = useState<Record<string, Record<string, string>>>({})

  const autorNome = perfil?.nome || perfil?.email || 'Usuário'
  const etapa = adm.etapa ?? 'requisicao'
  const candidatos = adm.candidatos ?? []
  const ccTxt = adm.centro_custo ? `${adm.centro_custo.codigo} - ${adm.centro_custo.descricao}` : ''
  const baseTxt = adm.base || ''
  const localTxt = [baseTxt, ccTxt].filter(Boolean).join(' · ') || '—'
  const editadoMap = adm.editado_rh ?? {}
  const foiEditado = Object.keys(editadoMap).length > 0
  // Sem edição na Aprovação (decisão é sobre o que foi solicitado) nem em etapas terminais
  const podeEditar = etapa !== 'aprovacao' && etapa !== 'cancelada' && etapa !== 'liberado'
  const criadoPorSuperTEG = (adm.observacoes ?? '').startsWith('[Criado por SuperTEG]')

  async function executar(acao: AcaoAdmissao, motivo?: string) {
    await transicao.mutateAsync({ adm, acao, autorId: perfil?.id, autorNome, motivo })
    onClose()
  }

  function iniciarEdicao() {
    setEdReq({
      base: adm.base ?? '',
      centro_custo_id: adm.centro_custo_id ?? '',
      departamento_previsto: adm.departamento_previsto ?? '',
      tipo_contrato: adm.tipo_contrato ?? '',
      data_prevista_inicio: adm.data_prevista_inicio ? adm.data_prevista_inicio.slice(0, 10) : '',
      motivo: adm.motivo ?? '',
    })
    const c: Record<string, Record<string, string>> = {}
    for (const cand of candidatos) {
      c[cand.id] = {
        nome: cand.nome ?? '',
        cpf: cand.cpf ?? '',
        data_nascimento: cand.data_nascimento ? cand.data_nascimento.slice(0, 10) : '',
        cargo: cand.cargo ?? '',
        salario: cand.salario != null ? String(cand.salario) : '',
      }
    }
    setEdCands(c)
    setEditando(true)
  }

  async function salvarEdicao() {
    await editar.mutateAsync({
      adm,
      patch: edReq,
      candidatos: candidatos.map(c => ({
        id: c.id,
        nome: edCands[c.id]?.nome,
        patch: {
          nome: edCands[c.id]?.nome ?? '',
          cpf: edCands[c.id]?.cpf ?? '',
          data_nascimento: edCands[c.id]?.data_nascimento ?? '',
          cargo: edCands[c.id]?.cargo ?? '',
          salario: edCands[c.id]?.salario ? Number(edCands[c.id].salario) : '',
        },
      })),
      autorId: perfil?.id,
      autorNome,
    })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
              <Users size={18} className="text-teal-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">Solicitação de Admissão</h2>
              <p className="text-xs text-slate-500 truncate">{candidatos.length} candidato(s) · {localTxt}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Flags */}
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
          {criadoPorSuperTEG && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-2.5 flex items-center gap-1.5 text-xs font-bold text-indigo-700">
              <span className="text-sm leading-none">🦸</span> Criada pelo SuperTEG a partir de e-mail
            </div>
          )}
          {foiEditado && !editando && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 flex items-center gap-1.5 text-xs font-bold text-amber-700">
              <Pencil size={13} /> Contém correções do RH (campos marcados com a tag RH)
            </div>
          )}

          {editando ? (
            /* ── Modo edição (alterações ficam tagueadas) ── */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Base</label>
                  <select value={edReq.base} onChange={e => setEdReq(p => ({ ...p, base: e.target.value }))} className={EDIT_INPUT}>
                    <option value="">—</option>
                    {bases.map(b => <option key={b.id} value={b.nome}>{b.nome}</option>)}
                    {edReq.base && !bases.some(b => b.nome === edReq.base) && <option value={edReq.base}>{edReq.base}</option>}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Centro de Custo</label>
                  <select value={edReq.centro_custo_id} onChange={e => setEdReq(p => ({ ...p, centro_custo_id: e.target.value }))} className={EDIT_INPUT}>
                    <option value="">—</option>
                    {centrosCusto.map(cc => <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.descricao}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Departamento</label>
                  <input value={edReq.departamento_previsto} onChange={e => setEdReq(p => ({ ...p, departamento_previsto: e.target.value }))} className={EDIT_INPUT} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tipo de contrato</label>
                  <select value={edReq.tipo_contrato} onChange={e => setEdReq(p => ({ ...p, tipo_contrato: e.target.value }))} className={EDIT_INPUT}>
                    <option value="">—</option>
                    {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    {edReq.tipo_contrato && !TIPOS_CONTRATO.some(t => t.value === edReq.tipo_contrato) && (
                      <option value={edReq.tipo_contrato}>{edReq.tipo_contrato}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Início previsto</label>
                  <input type="date" value={edReq.data_prevista_inicio} onChange={e => setEdReq(p => ({ ...p, data_prevista_inicio: e.target.value }))} className={EDIT_INPUT} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Motivo</label>
                <textarea rows={2} value={edReq.motivo} onChange={e => setEdReq(p => ({ ...p, motivo: e.target.value }))}
                  className={`${EDIT_INPUT} resize-none`} />
              </div>

              {/* Candidatos em edição */}
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                <Users size={11} /> Candidatos
              </p>
              {candidatos.map(c => (
                <div key={c.id} className="rounded-xl border border-slate-200 p-3 grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Nome</label>
                    <input value={edCands[c.id]?.nome ?? ''} onChange={e => setEdCands(p => ({ ...p, [c.id]: { ...p[c.id], nome: e.target.value } }))} className={EDIT_INPUT} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">CPF</label>
                    <input value={edCands[c.id]?.cpf ?? ''} onChange={e => setEdCands(p => ({ ...p, [c.id]: { ...p[c.id], cpf: e.target.value } }))} className={EDIT_INPUT} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Data de nascimento</label>
                    <input type="date" value={edCands[c.id]?.data_nascimento ?? ''} onChange={e => setEdCands(p => ({ ...p, [c.id]: { ...p[c.id], data_nascimento: e.target.value } }))} className={EDIT_INPUT} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cargo</label>
                    <input value={edCands[c.id]?.cargo ?? ''} onChange={e => setEdCands(p => ({ ...p, [c.id]: { ...p[c.id], cargo: e.target.value } }))} className={EDIT_INPUT} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Salário</label>
                    <input type="number" step="0.01" value={edCands[c.id]?.salario ?? ''} onChange={e => setEdCands(p => ({ ...p, [c.id]: { ...p[c.id], salario: e.target.value } }))} className={EDIT_INPUT} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <>
          {/* Motivo */}
          {adm.motivo && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Motivo{editadoMap['motivo'] && <TagRH />}</p>
              <p className="text-sm text-slate-700">{adm.motivo}</p>
            </div>
          )}

          {/* Dados compartilhados */}
          <div className="grid grid-cols-2 gap-3">
            <Info icon={Building2} label="Base" value={baseTxt} tag={editadoMap['base']} />
            <Info icon={Briefcase} label="Centro de Custo" value={ccTxt} tag={editadoMap['centro_custo_id']} />
            <Info icon={Calendar} label="Início previsto" value={adm.data_prevista_inicio ? new Date(adm.data_prevista_inicio).toLocaleDateString('pt-BR') : undefined} tag={editadoMap['data_prevista_inicio']} />
            <Info icon={Briefcase} label="Contrato / Movimentação" value={[adm.tipo_contrato, movLabel(adm.tipo_movimentacao)].filter(Boolean).join(' · ')} tag={editadoMap['tipo_contrato']} />
            <Info icon={Building2} label="Departamento" value={adm.departamento_previsto} tag={editadoMap['departamento_previsto']} />
          </div>

          {adm.solicitante_nome && (
            <p className="text-[11px] text-slate-400">Solicitado por <span className="font-semibold text-slate-600">{adm.solicitante_nome}</span></p>
          )}

          {/* Candidatos */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
              <Users size={11} /> Candidatos ({candidatos.length})
            </p>
            <div className="space-y-2">
              {candidatos.map((c, i) => (
                <CandidatoBloco key={c.id} cand={c} idx={i} abrindo={abrindo} onAbrir={abrirAnexo}
                  etapa={etapa} autorId={perfil?.id} autorNome={autorNome} editadoMap={editadoMap} />
              ))}
              {candidatos.length === 0 && <p className="text-xs text-slate-400">Nenhum candidato.</p>}
            </div>
          </div>
          </>
          )}

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

        {/* Salvar edição */}
        {editando && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
            <button onClick={() => setEditando(false)} disabled={editar.isPending}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100">
              Cancelar
            </button>
            <button onClick={salvarEdicao} disabled={editar.isPending}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-60 shadow-sm">
              {editar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
              Salvar correções
            </button>
          </div>
        )}

        {/* Ações por etapa */}
        {!pedindo && !editando && (
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
            <div>
              {podeEditar && (
                <button onClick={iniciarEdicao} title="Editar dados (fica registrado)"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100">
                  <Pencil size={14} /> Editar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
            {etapa === 'requisicao' && (
              <button onClick={() => executar('solicitar_aprovacao')} disabled={transicao.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 shadow-sm">
                {transicao.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Solicitar Aprovação
              </button>
            )}
            {etapa === 'proposta_alinhamento' && (
              <button onClick={() => executar('enviar_documentacao')} disabled={transicao.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 shadow-sm">
                {transicao.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Enviar para Documentação
              </button>
            )}
            {etapa === 'documentacao' && (
              <button onClick={() => executar('documentacao_recebida')} disabled={transicao.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 shadow-sm">
                {transicao.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Documentação Recebida
              </button>
            )}
            {etapa === 'exames_treinamentos' && (
              <button onClick={() => executar('apto_mobilizacao')} disabled={transicao.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 shadow-sm">
                {transicao.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Apto para Mobilização
              </button>
            )}
            {etapa === 'mobilizacao' && (
              <button onClick={() => executar('mobilizacao_concluida')} disabled={transicao.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 shadow-sm">
                {transicao.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Mobilização Concluída
              </button>
            )}
            {etapa === 'integracao' && (
              <button
                onClick={async () => { await liberar.mutateAsync({ admissaoId: adm.id, autorId: perfil?.id, autorNome }); onClose() }}
                disabled={liberar.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 shadow-sm">
                {liberar.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Concluir Integração e Liberar
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
          </div>
        )}
      </div>
    </div>
  )
}

function CandidatoBloco({ cand, idx, abrindo, onAbrir, etapa, autorId, autorNome, editadoMap }: {
  cand: RHAdmissaoCandidato; idx: number; abrindo: string | null; onAbrir: (path: string, id: string) => void
  etapa: string; autorId?: string; autorNome?: string; editadoMap: Record<string, boolean>
}) {
  const anexos = cand.anexos ?? []
  const dataNasc = cand.data_nascimento ? new Date(cand.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : null
  const ed = (campo: string) => editadoMap[`cand:${cand.id}:${campo}`]
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <User size={14} className="text-slate-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800 truncate">{cand.nome || `Candidato ${idx + 1}`}{ed('nome') && <TagRH />}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {cand.cpf && <span className="text-[10px] text-slate-400">CPF {cand.cpf}{ed('cpf') && <TagRH />}</span>}
            {dataNasc && <span className="text-[10px] text-slate-400">Nasc. {dataNasc}{ed('data_nascimento') && <TagRH />}</span>}
            {cand.cargo && <span className="text-[10px] text-slate-400">{cand.cargo}{ed('cargo') && <TagRH />}</span>}
            {cand.salario ? <span className="text-[10px] text-slate-400">{fmtMoney(cand.salario)}{ed('salario') && <TagRH />}</span> : null}
          </div>
        </div>
      </div>
      {anexos.length > 0 && (
        <div className="mt-2 space-y-1">
          {anexos.map(a => (
            <button key={a.id} onClick={() => onAbrir(a.arquivo_path, a.id)}
              className="w-full flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100 transition-all text-left">
              <FileText size={12} className="text-slate-500 shrink-0" />
              <span className="truncate text-[11px] font-semibold text-slate-600 flex-1">{a.arquivo_nome}</span>
              <span className="text-[9px] text-slate-400 shrink-0">{tipoLabel(a.tipo)}</span>
              {abrindo === a.id ? <Loader2 size={12} className="animate-spin text-slate-400" /> : <ExternalLink size={11} className="text-slate-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
      {etapa === 'documentacao' && (
        <MissaoDocsSection cand={cand} autorId={autorId} autorNome={autorNome} />
      )}
    </div>
  )
}

// ── Missão de envio de documentos (etapa Documentação) ────────────────────────
// Sem missão: botão dispara RPC (cadastra colaborador em admissão + cria missões).
// Com missão: checklist com os checks chegando conforme o SuperTEG valida.
function MissaoDocsSection({ cand, autorId, autorNome }: {
  cand: RHAdmissaoCandidato; autorId?: string; autorNome?: string
}) {
  const enviar = useEnviarMissaoDocs()
  const uploadAnexo = useUploadAnexoCandidato()
  const { data: docs = [], isLoading } = useMissoesDocsStatus(cand.id)
  const [erro, setErro] = useState<string | null>(null)

  const missaoEnviada = docs.length > 0
  // Pesquisa Histórico: documento interno do RH — não vira missão do colaborador
  const temPesquisa = (cand.anexos ?? []).some(a => a.tipo === 'pesquisa_historico')

  async function handleEnviar() {
    setErro(null)
    try {
      await enviar.mutateAsync({ candidatoId: cand.id, autorId, autorNome })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar a missão')
    }
  }

  if (!missaoEnviada) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-slate-100">
        <button onClick={handleEnviar} disabled={enviar.isPending || isLoading}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 transition-all">
          {enviar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />}
          Enviar Missão de Envio Documentos
        </button>
        <p className="text-[10px] text-slate-400 mt-1 text-center">
          Libera o acesso do candidato ao Portal TEG (CPF + data de nascimento) só para enviar os documentos.
        </p>
        {erro && <p className="text-[11px] text-red-600 font-semibold mt-1 text-center">{erro}</p>}
      </div>
    )
  }

  const concluidos = docs.filter(d => d.status === 'concluida').length
  const dispensados = docs.filter(d => d.status === 'dispensada').length
  const total = docs.length

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-100">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 flex items-center gap-1">
          <Smartphone size={11} /> Missão de documentos enviada
        </p>
        <span className="text-[10px] font-bold text-slate-500">{concluidos + dispensados}/{total}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {docs.map(d => (
          <div key={d.missao_id} className="flex items-center gap-1.5 min-w-0">
            {d.status === 'concluida'
              ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              : d.status === 'dispensada'
                ? <MinusCircle size={13} className="text-slate-300 shrink-0" />
                : <Circle size={13} className="text-slate-300 shrink-0" />}
            <span className={`text-[11px] truncate ${
              d.status === 'concluida' ? 'text-slate-700 font-semibold'
              : d.status === 'dispensada' ? 'text-slate-400 line-through'
              : 'text-slate-500'}`}>
              {d.titulo.replace(/^Enviar /, '')}
            </span>
          </div>
        ))}
      </div>

      {/* Pesquisa Histórico — interno do RH (o colaborador não vê) */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
        {temPesquisa
          ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          : <Circle size={13} className="text-slate-300 shrink-0" />}
        <span className={`text-[11px] flex-1 ${temPesquisa ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>
          Pesquisa Histórico <span className="text-[9px] text-slate-400">(interno RH)</span>
        </span>
        {!temPesquisa && (
          <label className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 cursor-pointer">
            {uploadAnexo.isPending ? <Loader2 size={10} className="animate-spin" /> : null} Anexar
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadAnexo.mutate({ admissaoId: cand.admissao_id, candidatoId: cand.id, file, tipo: 'pesquisa_historico', autorId })
                e.currentTarget.value = ''
              }} />
          </label>
        )}
      </div>
    </div>
  )
}

function Info({ icon: Icon, label, value, tag }: { icon: typeof User; label: string; value?: string | null; tag?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}{tag && <TagRH />}</p>
        <p className="text-sm text-slate-700 truncate">{value}</p>
      </div>
    </div>
  )
}
