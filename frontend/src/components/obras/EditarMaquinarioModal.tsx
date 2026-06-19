// ─────────────────────────────────────────────────────────────────────────────
// EditarMaquinarioModal — Modal de edição de alocação (contexto Obras)
// Mostra: dados do veículo, alocação atual, próxima alocação (demanda) e histórico
// Usado em: AlocacaoRecursos.tsx (Kanban / Gantt / Lista)
// NÃO toca em fluxos de Frotas — apenas preenche fro_alocacoes.proxima_*
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import {
  X, Calendar, Building2, ArrowRight, History, AlertCircle,
  Loader2, Check, Trash2, MapPin, User, Tag, Truck,
} from 'lucide-react'
import { useObras } from '../../hooks/useFinanceiro'
import {
  useSolicitarMovimentoObras,
  useRejeitarDemandaObras,
  useAlocacaoHistorico,
} from '../../hooks/useFrotas'
import type { FroAlocacao, FroAlocacaoHist } from '../../types/frotas'

interface Props {
  alocacao: FroAlocacao
  isLight: boolean
  onClose: () => void
}

const STATUS_LABEL: Record<string, { label: string; cls: string; clsDark: string }> = {
  ativa:     { label: 'Em uso',     cls: 'bg-emerald-50 text-emerald-700', clsDark: 'bg-emerald-500/10 text-emerald-400' },
  encerrada: { label: 'Encerrada',  cls: 'bg-slate-100 text-slate-600',    clsDark: 'bg-slate-500/10 text-slate-400'    },
  cancelada: { label: 'Cancelada',  cls: 'bg-rose-50 text-rose-700',       clsDark: 'bg-rose-500/10 text-rose-400'      },
}

const ACAO_LABEL: Record<FroAlocacaoHist['acao'], { label: string; color: string }> = {
  criada:             { label: 'Alocação criada',          color: 'text-emerald-600' },
  editada:            { label: 'Editada',                  color: 'text-slate-600'   },
  demanda_obras:      { label: 'Movimentação solicitada',  color: 'text-amber-600'   },
  demanda_cancelada:  { label: 'Movimentação cancelada',   color: 'text-rose-600'    },
  encerrada:          { label: 'Alocação encerrada',       color: 'text-slate-700'   },
  rejeitada:          { label: 'Rejeitada por Frotas',     color: 'text-rose-600'    },
  automatica:         { label: 'Próxima criada automaticamente', color: 'text-blue-600' },
}

function fmtData(s?: string | null): string {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return d.toLocaleDateString('pt-BR')
  } catch {
    return s
  }
}

function fmtDataHora(s?: string): string {
  if (!s) return ''
  try {
    return new Date(s).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return s
  }
}

export default function EditarMaquinarioModal({ alocacao, isLight, onClose }: Props) {
  const { data: obras = [] } = useObras()
  const { data: historico = [], isLoading: loadingHist } = useAlocacaoHistorico(alocacao.id)
  const solicitarMov = useSolicitarMovimentoObras()
  const rejeitarDemanda = useRejeitarDemandaObras()

  // ── Estado do formulário "Próxima alocação" ───────────────────────────────
  const [proximaObraId, setProximaObraId] = useState<string>(alocacao.proxima_obra_id ?? '')
  const [proximaInicio, setProximaInicio] = useState<string>(alocacao.proxima_data_inicio?.slice(0, 10) ?? '')
  const [proximaFim,    setProximaFim]    = useState<string>(alocacao.proxima_data_fim?.slice(0, 10)    ?? '')
  const [proximaObs,    setProximaObs]    = useState<string>(alocacao.proxima_observacoes ?? '')

  // Atualiza estado quando trocar de alocação
  useEffect(() => {
    setProximaObraId(alocacao.proxima_obra_id ?? '')
    setProximaInicio(alocacao.proxima_data_inicio?.slice(0, 10) ?? '')
    setProximaFim(alocacao.proxima_data_fim?.slice(0, 10) ?? '')
    setProximaObs(alocacao.proxima_observacoes ?? '')
  }, [alocacao.id, alocacao.proxima_obra_id, alocacao.proxima_data_inicio, alocacao.proxima_data_fim, alocacao.proxima_observacoes])

  // Detecta mudança vs o salvo
  const temDemandaSalva = !!alocacao.proxima_obra_id
  const formMudou = useMemo(() => (
    proximaObraId !== (alocacao.proxima_obra_id ?? '') ||
    proximaInicio !== (alocacao.proxima_data_inicio?.slice(0, 10) ?? '') ||
    proximaFim    !== (alocacao.proxima_data_fim?.slice(0, 10) ?? '') ||
    proximaObs    !== (alocacao.proxima_observacoes ?? '')
  ), [proximaObraId, proximaInicio, proximaFim, proximaObs, alocacao])

  const obraAtualNome = alocacao.obra?.nome ?? '—'
  const status = STATUS_LABEL[alocacao.status] ?? STATUS_LABEL.ativa
  const v = alocacao.veiculo

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSalvarDemanda() {
    if (!proximaObraId) {
      alert('Selecione uma obra de destino')
      return
    }
    try {
      await solicitarMov.mutateAsync({
        alocacao_id: alocacao.id,
        proxima_obra_id: proximaObraId,
        proxima_data_inicio: proximaInicio || undefined,
        proxima_data_fim: proximaFim || undefined,
        proxima_observacoes: proximaObs || undefined,
      })
    } catch (err) {
      alert('Erro ao salvar demanda: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  async function handleCancelarDemanda() {
    const motivo = window.prompt('Motivo do cancelamento (opcional):') ?? undefined
    if (!confirm('Cancelar a movimentação solicitada?')) return
    try {
      await rejeitarDemanda.mutateAsync({ alocacao_id: alocacao.id, motivo })
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  // ── Estilos ───────────────────────────────────────────────────────────────
  const cardCls = isLight
    ? 'bg-white border border-slate-200'
    : 'bg-[#1e293b] border border-white/[0.06]'
  const sectionLabelCls = `text-[10px] font-bold uppercase tracking-[0.18em] mb-2 ${
    isLight ? 'text-slate-400' : 'text-slate-500'
  }`
  const fieldLabelCls = `text-xs font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`
  const inputCls = `w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-white border border-slate-200 text-slate-800'
      : 'bg-white/[0.04] border border-white/[0.08] text-white [&>option]:bg-slate-900'
  }`

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-12 pb-8 overflow-y-auto" onClick={onClose}>
      <div
        className={`w-full max-w-2xl mx-4 rounded-2xl shadow-2xl ${cardCls}`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={`flex items-center justify-between p-5 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isLight ? 'bg-blue-50' : 'bg-blue-500/10'
            }`}>
              <Truck size={18} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            </div>
            <div>
              <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                Editar Maquinário
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {v?.placa ?? '—'} · {v?.marca} {v?.modelo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="p-5 space-y-5">

          {/* Alocação atual (read-only) */}
          <section>
            <h3 className={sectionLabelCls}>
              <Building2 size={11} className="inline mr-1" />
              Alocação atual
            </h3>
            <div className={`rounded-xl p-4 ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={fieldLabelCls}>Status</div>
                  <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                    isLight ? status.cls : status.clsDark
                  }`}>
                    {status.label}
                  </span>
                </div>
                <div>
                  <div className={fieldLabelCls}>Obra atual</div>
                  <div className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    {obraAtualNome}
                  </div>
                </div>
                <div>
                  <div className={fieldLabelCls}>Data início</div>
                  <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    {fmtData(alocacao.data_saida)}
                  </div>
                </div>
                <div>
                  <div className={fieldLabelCls}>Data prevista término</div>
                  <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    {fmtData(alocacao.data_retorno_prev)}
                  </div>
                </div>
              </div>
              {alocacao.observacoes && (
                <div className="mt-3 pt-3 border-t border-current/10">
                  <div className={fieldLabelCls}>Observações</div>
                  <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    {alocacao.observacoes}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Próxima alocação (editável) */}
          <section>
            <h3 className={sectionLabelCls}>
              <ArrowRight size={11} className="inline mr-1" />
              Próxima alocação {temDemandaSalva && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-700 border border-amber-500/30">
                  PENDENTE FROTAS
                </span>
              )}
            </h3>

            {temDemandaSalva && (
              <div className={`mb-3 flex items-start gap-2 p-3 rounded-xl ${
                isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/20'
              }`}>
                <AlertCircle size={14} className={`mt-0.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                <div className="text-xs">
                  <div className={`font-semibold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                    Demanda registrada
                  </div>
                  <div className={isLight ? 'text-amber-700' : 'text-amber-400'}>
                    Frotas confirma essa movimentação ao fazer o checklist de retorno do veículo.
                    A próxima alocação será criada automaticamente.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={fieldLabelCls}>Próxima obra</label>
                <select
                  className={inputCls}
                  value={proximaObraId}
                  onChange={e => setProximaObraId(e.target.value)}
                >
                  <option value="">— Nenhuma —</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={fieldLabelCls}>Data início</label>
                <input
                  type="date"
                  className={inputCls}
                  value={proximaInicio}
                  onChange={e => setProximaInicio(e.target.value)}
                  disabled={!proximaObraId}
                />
              </div>
              <div>
                <label className={fieldLabelCls}>Data término</label>
                <input
                  type="date"
                  className={inputCls}
                  value={proximaFim}
                  onChange={e => setProximaFim(e.target.value)}
                  disabled={!proximaObraId}
                />
              </div>

              <div className="col-span-2">
                <label className={fieldLabelCls}>Observações para Frotas</label>
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={2}
                  value={proximaObs}
                  onChange={e => setProximaObs(e.target.value)}
                  placeholder="Detalhes sobre a movimentação (ex.: motorista, urgência, condições)"
                  disabled={!proximaObraId}
                />
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 mt-4">
              {temDemandaSalva && (
                <button
                  onClick={handleCancelarDemanda}
                  disabled={rejeitarDemanda.isPending}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isLight
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                  } disabled:opacity-50`}
                >
                  {rejeitarDemanda.isPending
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                  Cancelar demanda
                </button>
              )}
              <button
                onClick={handleSalvarDemanda}
                disabled={!proximaObraId || !formMudou || solicitarMov.isPending}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  proximaObraId && formMudou
                    ? 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                } disabled:opacity-60`}
              >
                {solicitarMov.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Check size={13} />}
                {temDemandaSalva ? 'Atualizar demanda' : 'Solicitar movimentação'}
              </button>
            </div>
          </section>

          {/* Histórico */}
          <section>
            <h3 className={sectionLabelCls}>
              <History size={11} className="inline mr-1" />
              Histórico de movimentações
            </h3>
            {loadingHist ? (
              <div className="py-4 flex justify-center">
                <Loader2 size={16} className="animate-spin text-slate-400" />
              </div>
            ) : historico.length === 0 ? (
              <div className={`text-center py-6 text-xs rounded-xl ${
                isLight ? 'text-slate-400 bg-slate-50' : 'text-slate-500 bg-white/[0.02]'
              }`}>
                Nenhum registro ainda.
              </div>
            ) : (
              <ol className="space-y-2">
                {historico.map(h => {
                  const cfg = ACAO_LABEL[h.acao] ?? { label: h.acao, color: 'text-slate-600' }
                  return (
                    <li
                      key={h.id}
                      className={`p-3 rounded-xl flex gap-3 ${
                        isLight ? 'bg-slate-50 border border-slate-100' : 'bg-white/[0.02] border border-white/[0.04]'
                      }`}
                    >
                      <div className={`text-[11px] font-mono shrink-0 mt-0.5 ${
                        isLight ? 'text-slate-500' : 'text-slate-500'
                      }`}>
                        {fmtDataHora(h.feito_em)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</div>
                        {h.descricao && (
                          <div className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            {h.descricao}
                          </div>
                        )}
                        {(h.obra_origem_nome || h.obra_destino_nome) && (
                          <div className={`text-xs mt-1 flex items-center gap-1 ${
                            isLight ? 'text-slate-500' : 'text-slate-500'
                          }`}>
                            <MapPin size={10} />
                            {h.obra_origem_nome ?? '—'}
                            {h.obra_destino_nome && (
                              <>
                                <ArrowRight size={10} />
                                {h.obra_destino_nome}
                              </>
                            )}
                          </div>
                        )}
                        {h.feito_por_nome && (
                          <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${
                            isLight ? 'text-slate-500' : 'text-slate-500'
                          }`}>
                            <User size={10} />
                            {h.feito_por_nome}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
