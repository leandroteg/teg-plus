import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Save,
  Send,
  Sparkles,
} from 'lucide-react'
import {
  useAtualizarResumo,
  useAvancarEtapa,
  useCriarResumo,
  useGerarResumoAI,
  useMinutas,
  useResumoExecutivo,
  useSolicitacao,
} from '../../hooks/useSolicitacoes'
import type { ResumoExecutivo as TResumo } from '../../types/contratos'
import {
  buildResumoNarrativo,
  buildResumoPayloadFromAnalise,
  mapResumoAiToPayload,
  type ResumoExecutivoPayloadDraft,
} from '../../utils/contratosResumoExecutivo'
import { sanitizeAiText } from '../../utils/sanitizeAiText'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  rascunho: { label: 'Rascunho', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  enviado: { label: 'Enviado', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  aprovado: { label: 'Aprovado', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rejeitado: { label: 'Rejeitado', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function ResumoView({ resumo }: { resumo: TResumo }) {
  const parecer = useMemo(() => {
    const raw = resumo.recomendacao || buildResumoNarrativo({
      partesEnvolvidas: resumo.partes_envolvidas,
      objetoResumo: resumo.objeto_resumo,
      valorTotal: resumo.valor_total,
      vigencia: resumo.vigencia,
      riscos: resumo.riscos,
      oportunidades: resumo.oportunidades,
    })
    return sanitizeAiText(raw)
  }, [resumo])

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
              <Eye size={13} className="text-indigo-600" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-800">{sanitizeAiText(resumo.titulo)}</h2>
          </div>
          <StatusBadge status={resumo.status} />
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {resumo.valor_total != null && (
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                Valor: {fmt(resumo.valor_total)}
              </span>
            )}
            {resumo.vigencia && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                Vigência: {resumo.vigencia}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Partes Envolvidas
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {resumo.partes_envolvidas}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Objeto
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {resumo.objeto_resumo}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
              Resumo Executivo
            </p>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {parecer}
            </p>
          </div>
        </div>
      </div>

      <p className="text-right text-[10px] text-slate-400">
        Criado em {fmtData(resumo.created_at)}
      </p>
    </div>
  )
}

function ContextCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{value}</p>
    </div>
  )
}

export default function ResumoExecutivoPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()

  const { data: solicitacao, isLoading: loadingSol } = useSolicitacao(id)
  const { data: resumo, isLoading: loadingResumo } = useResumoExecutivo(id)
  const { data: minutas = [] } = useMinutas(id)
  const criarResumo = useCriarResumo()
  const atualizarResumo = useAtualizarResumo()
  const avancarEtapa = useAvancarEtapa()
  const gerarResumoAI = useGerarResumoAI()

  const [titulo, setTitulo] = useState('')
  const [partesEnvolvidas, setPartesEnvolvidas] = useState('')
  const [objetoResumo, setObjetoResumo] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [vigencia, setVigencia] = useState('')
  const [riscos, setRiscos] = useState<TResumo['riscos']>([])
  const [oportunidades, setOportunidades] = useState<TResumo['oportunidades']>([])
  const [recomendacao, setRecomendacao] = useState('')
  const [formError, setFormError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const autoDraftStartedRef = useRef(false)

  const isLoading = loadingSol || loadingResumo

  useEffect(() => {
    if (resumo && resumo.status === 'rascunho') {
      setTitulo(resumo.titulo)
      setPartesEnvolvidas(resumo.partes_envolvidas)
      setObjetoResumo(resumo.objeto_resumo)
      setValorTotal(resumo.valor_total != null ? String(resumo.valor_total) : '')
      setVigencia(resumo.vigencia ?? '')
      setRiscos(resumo.riscos ?? [])
      setOportunidades(resumo.oportunidades ?? [])
      setRecomendacao(
        resumo.recomendacao || buildResumoNarrativo({
          partesEnvolvidas: resumo.partes_envolvidas,
          objetoResumo: resumo.objeto_resumo,
          valorTotal: resumo.valor_total,
          vigencia: resumo.vigencia,
          riscos: resumo.riscos,
          oportunidades: resumo.oportunidades,
        })
      )
      setIsEditing(true)
      return
    }

    if (!resumo && solicitacao) {
      setTitulo(`Resumo Executivo - ${solicitacao.objeto}`)
      setPartesEnvolvidas(`TEG Engenharia e ${solicitacao.contraparte_nome}`)
      setObjetoResumo(solicitacao.objeto)
      setValorTotal(solicitacao.valor_estimado != null ? String(solicitacao.valor_estimado) : '')
      setVigencia(
        solicitacao.data_inicio_prevista && solicitacao.data_fim_prevista
          ? `${fmtData(solicitacao.data_inicio_prevista)} a ${fmtData(solicitacao.data_fim_prevista)}`
          : solicitacao.prazo_meses
            ? `${solicitacao.prazo_meses} meses`
            : ''
      )
      setRiscos([])
      setOportunidades([])
      setRecomendacao('')
      setIsEditing(false)
    }
  }, [resumo, solicitacao])

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400'

  const buildPayload = (status: 'rascunho' | 'enviado'): ResumoExecutivoPayloadDraft => ({
    solicitacao_id: id!,
    titulo: titulo.trim(),
    partes_envolvidas: partesEnvolvidas.trim(),
    objeto_resumo: objetoResumo.trim(),
    valor_total: valorTotal ? parseFloat(valorTotal) : undefined,
    vigencia: vigencia.trim() || undefined,
    riscos: riscos.filter((risco) => risco.descricao.trim()),
    oportunidades: oportunidades.filter((oportunidade) => oportunidade.descricao.trim()),
    recomendacao: recomendacao.trim() || undefined,
    status,
  })

  const applyPayload = (payload: ResumoExecutivoPayloadDraft) => {
    setTitulo(payload.titulo)
    setPartesEnvolvidas(payload.partes_envolvidas)
    setObjetoResumo(payload.objeto_resumo)
    setValorTotal(payload.valor_total != null ? String(payload.valor_total) : '')
    setVigencia(payload.vigencia ?? '')
    setRiscos(payload.riscos)
    setOportunidades(payload.oportunidades)
    setRecomendacao(payload.recomendacao ?? '')
  }

  const validate = () => {
    setFormError('')
    if (!titulo.trim()) return setFormError('Não foi possível montar o título do resumo'), false
    if (!partesEnvolvidas.trim()) return setFormError('Não foi possível identificar as partes envolvidas'), false
    if (!objetoResumo.trim()) return setFormError('Não foi possível identificar o objeto do contrato'), false
    if (!recomendacao.trim()) return setFormError('Informe o resumo executivo'), false
    return true
  }

  const gerarPayloadAutomatico = async (status: 'rascunho' | 'enviado') => {
    if (!solicitacao) return null

    const minutaComAnalise = minutas
      .filter((minuta) => minuta.ai_analise)
      .sort((a, b) => b.versao - a.versao)[0]

    try {
      const result = await gerarResumoAI.mutateAsync({
        solicitacao_id: solicitacao.id,
        analise: minutaComAnalise?.ai_analise ?? undefined,
        dados_contrato: {
          contratante: solicitacao.obra?.nome ?? 'TEG Engenharia',
          contratada: solicitacao.contraparte_nome,
          objeto: solicitacao.objeto,
          valor_total: solicitacao.valor_estimado ?? undefined,
          prazo_meses: solicitacao.prazo_meses ?? undefined,
          titulo: `Resumo Executivo - ${solicitacao.objeto}`,
          cnpj_contratante: undefined,
          cnpj_contratada: solicitacao.contraparte_cnpj ?? undefined,
        },
      })

      const payload = mapResumoAiToPayload({
        solicitacaoId: solicitacao.id,
        tituloPadrao: `Resumo Executivo - ${solicitacao.objeto}`,
        resumo: result.resumo,
        status,
      })

      applyPayload(payload)
      return payload
    } catch {
      const payload = buildResumoPayloadFromAnalise({
        solicitacaoId: solicitacao.id,
        titulo: `Resumo Executivo - ${solicitacao.objeto}`,
        partesEnvolvidas: `TEG Engenharia e ${solicitacao.contraparte_nome}`,
        objetoResumo: solicitacao.objeto,
        valorTotal: solicitacao.valor_estimado ?? undefined,
        vigencia: solicitacao.data_inicio_prevista && solicitacao.data_fim_prevista
          ? `${fmtData(solicitacao.data_inicio_prevista)} a ${fmtData(solicitacao.data_fim_prevista)}`
          : solicitacao.prazo_meses
            ? `${solicitacao.prazo_meses} meses`
            : undefined,
        analise: minutaComAnalise?.ai_analise ?? undefined,
        status,
      })

      applyPayload(payload)
      return payload
    }
  }

  const persistPayload = async (payload: ResumoExecutivoPayloadDraft) => {
    if (isEditing && resumo) {
      await atualizarResumo.mutateAsync({ id: resumo.id, ...payload })
    } else {
      await criarResumo.mutateAsync(payload)
      setIsEditing(true)
    }
  }

  useEffect(() => {
    if (!solicitacao || isLoading || autoDraftStartedRef.current) return
    if (resumo && resumo.status !== 'rascunho') return

    const parecerAtual = (resumo?.recomendacao ?? recomendacao).trim()
    if (resumo && parecerAtual) return

    autoDraftStartedRef.current = true

    void (async () => {
      try {
        const payload = await gerarPayloadAutomatico('rascunho')
        if (!payload) return
        await persistPayload(payload)
      } catch (e: unknown) {
        setFormError(e instanceof Error ? e.message : 'Erro ao gerar resumo automaticamente')
        autoDraftStartedRef.current = false
      }
    })()
  }, [isLoading, recomendacao, resumo, solicitacao])

  const handleSalvarRascunho = async () => {
    if (!validate()) return

    try {
      await persistPayload(buildPayload('rascunho'))
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar')
    }
  }

  const handleEnviarAprovacao = async () => {
    try {
      let payload = buildPayload('enviado')

      if (!payload.recomendacao) {
        const generated = await gerarPayloadAutomatico('enviado')
        if (generated) payload = generated
      }

      applyPayload(payload)
      if (!validate()) return

      await persistPayload(payload)

      if (solicitacao) {
        await avancarEtapa.mutateAsync({
          solicitacaoId: solicitacao.id,
          etapaDe: 'resumo_executivo',
          etapaPara: 'aprovacao_diretoria',
          observacao: 'Resumo executivo enviado para aprovação da diretoria',
        })
      }

      nav(`/contratos/solicitacoes/${id}`)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erro ao enviar')
    }
  }

  const handleGerarComIA = async () => {
    if (!solicitacao || gerarResumoAI.isPending) return
    try {
      const payload = await gerarPayloadAutomatico('rascunho')
      if (payload) await persistPayload(payload)
    } catch {
      setFormError('Erro ao gerar resumo com IA. Tente novamente.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (!solicitacao) {
    return (
      <div className="py-24 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <FileText size={28} className="text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Solicitação não encontrada</p>
      </div>
    )
  }

  const showViewMode = !!(resumo && resumo.status !== 'rascunho')
  const isSaving = criarResumo.isPending || atualizarResumo.isPending
  const isSending = avancarEtapa.isPending
  const isGerandoIA = gerarResumoAI.isPending
  const isAutoGenerating = !showViewMode && !recomendacao.trim() && isGerandoIA

  return (
    <div className="space-y-5" data-no-upper>
      <div className="flex items-start gap-3">
        <button
          onClick={() => nav(`/contratos/solicitacoes/${id}`)}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-slate-300 hover:text-slate-700"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600">
            {solicitacao.numero}
          </p>
          <h1 className="mt-1 text-xl font-extrabold leading-tight text-slate-800">
            Resumo Executivo
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {showViewMode
              ? 'Visualização do resumo executivo'
              : 'Resumo executivo para aprovação da diretoria'}
          </p>
        </div>
      </div>

      {showViewMode && <ResumoView resumo={resumo} />}

      {!showViewMode && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-violet-50 via-indigo-50 to-teal-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
                  <Brain size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Gerar Resumo com IA</h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    O rascunho é gerado automaticamente ao abrir a etapa. Use este botão apenas para regenerar.
                  </p>
                </div>
              </div>

              <button
                onClick={handleGerarComIA}
                disabled={isGerandoIA}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGerandoIA ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Gerar com IA
                  </>
                )}
              </button>
            </div>

            {gerarResumoAI.isSuccess && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 size={12} />
                Resumo gerado com sucesso. Revise o texto abaixo antes de enviar.
              </div>
            )}

            {gerarResumoAI.isError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-[10px] font-semibold text-red-700">
                <AlertTriangle size={12} />
                Não foi possível gerar com IA. O sistema usa fallback automático.
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
              <FileText size={14} className="text-indigo-500" />
              Contexto do Contrato
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <ContextCard label="Título" value={titulo || 'Resumo Executivo'} />
              <ContextCard label="Partes Envolvidas" value={partesEnvolvidas || 'Aguardando geração automática'} />
              <div className="sm:col-span-2">
                <ContextCard label="Objeto" value={objetoResumo || 'Aguardando geração automática'} />
              </div>
              <ContextCard label="Valor Total" value={valorTotal ? fmt(Number(valorTotal)) : 'Não informado'} />
              <ContextCard label="Vigência" value={vigencia || 'Não informada'} />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Resumo Executivo
            </h2>
            <textarea
              value={recomendacao}
              onChange={(e) => setRecomendacao(e.target.value)}
              placeholder="Resumo do contrato: partes, objeto, valor, prazo, pontos de atenção e recomendação"
              rows={8}
              className={`${inputClass} resize-none`}
            />
            <p className="text-[11px] text-slate-400">
              Este resumo será enviado para aprovação da diretoria. Riscos e oportunidades ficam salvos para auditoria.
            </p>
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-xs font-medium text-red-700">{formError}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => nav(`/contratos/solicitacoes/${id}`)}
              className="flex-1 rounded-xl border-2 border-slate-200 py-3.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvarRascunho}
              disabled={isSaving || isAutoGenerating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 py-3.5 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-100 disabled:opacity-50"
            >
              {isSaving
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400/40 border-t-indigo-400" />
                : <Save size={14} />}
              Salvar Rascunho
            </button>
            <button
              onClick={handleEnviarAprovacao}
              disabled={isSaving || isSending || isAutoGenerating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSending || isAutoGenerating
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                : <Send size={14} />}
              Enviar para Aprovação
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
