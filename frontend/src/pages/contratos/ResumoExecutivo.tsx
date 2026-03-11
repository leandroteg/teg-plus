import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Plus, Trash2, Save, Send,
  AlertTriangle, Shield, Lightbulb, CheckCircle2,
  Clock, ChevronRight, Eye, Sparkles, Loader2, Brain,
} from 'lucide-react'
import {
  useSolicitacao,
  useResumoExecutivo,
  useCriarResumo,
  useAtualizarResumo,
  useAvancarEtapa,
  useMinutas,
  useGerarResumoAI,
} from '../../hooks/useSolicitacoes'
import type { ResumoAiGerado } from '../../hooks/useSolicitacoes'
import type { ResumoExecutivo as TResumo, StatusResumo } from '../../types/contratos'
import { sanitizeAiText } from '../../utils/sanitizeAiText'

// ── Formatters ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

// ── Config ──────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  rascunho:  { label: 'Rascunho',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  enviado:   { label: 'Enviado',   bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  aprovado:  { label: 'Aprovado',  bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rejeitado: { label: 'Rejeitado', bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500' },
}

const NIVEL_RISCO_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  baixo: { label: 'Baixo', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' },
  medio: { label: 'Medio', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: 'text-amber-500' },
  alto:  { label: 'Alto',  bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: 'text-red-500' },
}

// ── Types ───────────────────────────────────────────────────────────────────────

interface RiscoForm {
  nivel: string
  descricao: string
  mitigacao: string
}

interface OportunidadeForm {
  descricao: string
  impacto: string
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-bold px-2.5 py-1 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function RiscoCard({ risco }: { risco: { nivel: string; descricao: string; mitigacao?: string } }) {
  const c = NIVEL_RISCO_CONFIG[risco.nivel] ?? NIVEL_RISCO_CONFIG.medio
  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <Shield size={13} className={c.icon} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>
          Risco {c.label}
        </span>
      </div>
      <p className={`text-sm font-medium ${c.text} leading-snug`}>{risco.descricao}</p>
      {risco.mitigacao && (
        <div className="mt-2 pt-2 border-t border-white/50">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Mitigacao</p>
          <p className="text-xs text-slate-600 leading-snug">{risco.mitigacao}</p>
        </div>
      )}
    </div>
  )
}

function OportunidadeCard({ item }: { item: { descricao: string; impacto?: string } }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb size={13} className="text-blue-500" />
        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
          Oportunidade
        </span>
      </div>
      <p className="text-sm font-medium text-blue-800 leading-snug">{item.descricao}</p>
      {item.impacto && (
        <div className="mt-2 pt-2 border-t border-blue-100">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-0.5">Impacto</p>
          <p className="text-xs text-blue-700 leading-snug">{item.impacto}</p>
        </div>
      )}
    </div>
  )
}

// ── View Mode ───────────────────────────────────────────────────────────────────

function ResumoView({ resumo }: { resumo: TResumo }) {
  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Eye size={13} className="text-indigo-600" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-800">{resumo.titulo}</h2>
          </div>
          <StatusBadge status={resumo.status} />
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
              Partes Envolvidas
            </p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {resumo.partes_envolvidas}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
              Objeto
            </p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {resumo.objeto_resumo}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {resumo.valor_total != null && (
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Valor Total
                </p>
                <p className="text-lg font-extrabold text-indigo-600">{fmt(resumo.valor_total)}</p>
              </div>
            )}
            {resumo.vigencia && (
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Vigencia
                </p>
                <p className="text-sm text-slate-700 font-medium">{resumo.vigencia}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Riscos */}
      {resumo.riscos && resumo.riscos.length > 0 && (
        <div>
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Shield size={12} /> Riscos Identificados
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resumo.riscos.map((r, idx) => (
              <RiscoCard key={idx} risco={r} />
            ))}
          </div>
        </div>
      )}

      {/* Oportunidades */}
      {resumo.oportunidades && resumo.oportunidades.length > 0 && (
        <div>
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Lightbulb size={12} /> Oportunidades
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resumo.oportunidades.map((o, idx) => (
              <OportunidadeCard key={idx} item={o} />
            ))}
          </div>
        </div>
      )}

      {/* Recomendacao */}
      {resumo.recomendacao && (
        <div className="bg-indigo-50 rounded-2xl border border-indigo-200 px-5 py-4">
          <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider mb-1">
            Recomendacao da Equipe
          </p>
          <p className="text-sm text-indigo-800 leading-relaxed whitespace-pre-wrap">
            {resumo.recomendacao}
          </p>
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-right">
        Criado em {fmtData(resumo.created_at)}
      </p>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────────

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

  // Form state
  const [titulo, setTitulo] = useState('')
  const [partesEnvolvidas, setPartesEnvolvidas] = useState('')
  const [objetoResumo, setObjetoResumo] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [vigencia, setVigencia] = useState('')
  const [riscos, setRiscos] = useState<RiscoForm[]>([])
  const [oportunidades, setOportunidades] = useState<OportunidadeForm[]>([])
  const [recomendacao, setRecomendacao] = useState('')
  const [formError, setFormError] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const isLoading = loadingSol || loadingResumo

  // Pre-fill form when data loads
  useEffect(() => {
    if (resumo && resumo.status === 'rascunho') {
      setTitulo(resumo.titulo)
      setPartesEnvolvidas(resumo.partes_envolvidas)
      setObjetoResumo(resumo.objeto_resumo)
      setValorTotal(resumo.valor_total != null ? String(resumo.valor_total) : '')
      setVigencia(resumo.vigencia ?? '')
      setRiscos(
        resumo.riscos?.map(r => ({
          nivel: r.nivel,
          descricao: r.descricao,
          mitigacao: r.mitigacao ?? '',
        })) ?? []
      )
      setOportunidades(
        resumo.oportunidades?.map(o => ({
          descricao: o.descricao,
          impacto: o.impacto ?? '',
        })) ?? []
      )
      setRecomendacao(resumo.recomendacao ?? '')
      setIsEditing(true)
    } else if (!resumo && solicitacao) {
      // Pre-fill from solicitacao
      setTitulo(`Resumo Executivo \u2014 ${solicitacao.objeto}`)
      setObjetoResumo(solicitacao.objeto)
      setValorTotal(solicitacao.valor_estimado != null ? String(solicitacao.valor_estimado) : '')
      const vig =
        solicitacao.data_inicio_prevista && solicitacao.data_fim_prevista
          ? `${fmtData(solicitacao.data_inicio_prevista)} a ${fmtData(solicitacao.data_fim_prevista)}`
          : solicitacao.prazo_meses
          ? `${solicitacao.prazo_meses} meses`
          : ''
      setVigencia(vig)
      setIsEditing(false)
    }
  }, [resumo, solicitacao])

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400'
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1 block'

  // ── Riscos CRUD ────────────────────────────────────────────────────────
  const addRisco = () => setRiscos(prev => [...prev, { nivel: 'medio', descricao: '', mitigacao: '' }])
  const removeRisco = (idx: number) => setRiscos(prev => prev.filter((_, i) => i !== idx))
  const updateRisco = (idx: number, field: keyof RiscoForm, val: string) =>
    setRiscos(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))

  // ── Oportunidades CRUD ─────────────────────────────────────────────────
  const addOportunidade = () => setOportunidades(prev => [...prev, { descricao: '', impacto: '' }])
  const removeOportunidade = (idx: number) => setOportunidades(prev => prev.filter((_, i) => i !== idx))
  const updateOportunidade = (idx: number, field: keyof OportunidadeForm, val: string) =>
    setOportunidades(prev => prev.map((o, i) => i === idx ? { ...o, [field]: val } : o))

  // ── Save / Submit ──────────────────────────────────────────────────────

  const buildPayload = (status: StatusResumo) => {
    const riscosClean = riscos
      .filter(r => r.descricao.trim())
      .map(r => ({
        nivel: r.nivel,
        descricao: r.descricao.trim(),
        mitigacao: r.mitigacao.trim() || undefined,
      }))
    const opClean = oportunidades
      .filter(o => o.descricao.trim())
      .map(o => ({
        descricao: o.descricao.trim(),
        impacto: o.impacto.trim() || undefined,
      }))

    return {
      solicitacao_id: id!,
      titulo: titulo.trim(),
      partes_envolvidas: partesEnvolvidas.trim(),
      objeto_resumo: objetoResumo.trim(),
      valor_total: valorTotal ? parseFloat(valorTotal) : undefined,
      vigencia: vigencia.trim() || undefined,
      riscos: riscosClean,
      oportunidades: opClean,
      recomendacao: recomendacao.trim() || undefined,
      status,
    }
  }

  const validate = (): boolean => {
    setFormError('')
    if (!titulo.trim()) { setFormError('Informe o titulo'); return false }
    if (!partesEnvolvidas.trim()) { setFormError('Informe as partes envolvidas'); return false }
    if (!objetoResumo.trim()) { setFormError('Informe o objeto do resumo'); return false }
    return true
  }

  const handleSalvarRascunho = async () => {
    if (!validate()) return
    const payload = buildPayload('rascunho')

    try {
      if (isEditing && resumo) {
        await atualizarResumo.mutateAsync({ id: resumo.id, ...payload })
      } else {
        await criarResumo.mutateAsync(payload)
        setIsEditing(true)
      }
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar')
    }
  }

  const handleEnviarAprovacao = async () => {
    if (!validate()) return
    const payload = buildPayload('enviado')

    try {
      if (isEditing && resumo) {
        await atualizarResumo.mutateAsync({ id: resumo.id, ...payload })
      } else {
        await criarResumo.mutateAsync(payload)
      }

      // Advance etapa
      if (solicitacao) {
        await avancarEtapa.mutateAsync({
          solicitacaoId: solicitacao.id,
          etapaDe: 'resumo_executivo',
          etapaPara: 'aprovacao_diretoria',
          observacao: 'Resumo executivo enviado para aprovacao da diretoria',
        })
      }
      nav(`/contratos/solicitacoes/${id}`)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erro ao enviar')
    }
  }

  const isSaving = criarResumo.isPending || atualizarResumo.isPending
  const isSending = avancarEtapa.isPending
  const isGerandoIA = gerarResumoAI.isPending

  // ── Gerar Resumo com IA ─────────────────────────────────────────────
  const handleGerarComIA = async () => {
    if (!solicitacao || isGerandoIA) return
    try {
      // Find latest minuta with analysis
      const minutaComAnalise = minutas
        .filter(m => m.ai_analise)
        .sort((a, b) => b.versao - a.versao)[0]

      const result = await gerarResumoAI.mutateAsync({
        solicitacao_id: solicitacao.id,
        analise: minutaComAnalise?.ai_analise ?? undefined,
        dados_contrato: {
          contratante: solicitacao.obra?.nome ?? 'TEG Engenharia',
          contratada: solicitacao.contraparte_nome,
          objeto: solicitacao.objeto,
          valor_total: solicitacao.valor_estimado ?? undefined,
          prazo_meses: solicitacao.prazo_meses ?? undefined,
          titulo: `Resumo Executivo — ${solicitacao.objeto}`,
          cnpj_contratante: undefined,
          cnpj_contratada: solicitacao.contraparte_cnpj ?? undefined,
        },
      })

      // Pre-fill form with AI-generated data (sanitize special characters)
      const r = result.resumo
      if (r.titulo) setTitulo(sanitizeAiText(r.titulo))
      if (r.objeto_resumo) setObjetoResumo(sanitizeAiText(r.objeto_resumo))
      if (r.valor_total != null) setValorTotal(String(r.valor_total))
      if (r.prazo_meses) setVigencia(`${r.prazo_meses} meses`)
      if (r.recomendacao) setRecomendacao(sanitizeAiText(r.recomendacao))

      // partes_envolvidas can be string or array
      if (r.partes_envolvidas) {
        if (typeof r.partes_envolvidas === 'string') {
          setPartesEnvolvidas(sanitizeAiText(r.partes_envolvidas))
        } else if (Array.isArray(r.partes_envolvidas)) {
          setPartesEnvolvidas(
            r.partes_envolvidas.map(p => `${sanitizeAiText(p.papel)}: ${sanitizeAiText(p.nome)}${p.cnpj ? ` (${p.cnpj})` : ''}`).join('\n')
          )
        }
      }

      // Map riscos
      if (r.riscos && r.riscos.length > 0) {
        setRiscos(
          r.riscos.map(rk => ({
            nivel: rk.nivel ?? rk.impacto?.toLowerCase() ?? 'medio',
            descricao: sanitizeAiText(rk.descricao),
            mitigacao: sanitizeAiText(rk.mitigacao) ?? '',
          }))
        )
      }

      // Map oportunidades
      if (r.oportunidades && r.oportunidades.length > 0) {
        setOportunidades(
          r.oportunidades.map(op => ({
            descricao: sanitizeAiText(op.descricao),
            impacto: sanitizeAiText(op.impacto) ?? sanitizeAiText(op.beneficio) ?? '',
          }))
        )
      }
    } catch {
      setFormError('Erro ao gerar resumo com IA. Tente novamente.')
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!solicitacao) {
    return (
      <div className="text-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <FileText size={28} className="text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Solicitacao nao encontrada</p>
      </div>
    )
  }

  // Show view mode if resumo exists and not a draft
  const showViewMode = resumo && resumo.status !== 'rascunho'

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => nav(`/contratos/solicitacoes/${id}`)}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center
            justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300
            transition-all shrink-0 mt-0.5"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-0.5 font-mono inline-block">
            {solicitacao.numero}
          </p>
          <h1 className="text-xl font-extrabold text-slate-800 mt-1 leading-tight">
            Resumo Executivo
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {showViewMode
              ? 'Visualizacao do resumo executivo'
              : 'Elabore o resumo executivo para aprovacao da diretoria'}
          </p>
        </div>
      </div>

      {/* ── View Mode ───────────────────────────────────────────────── */}
      {showViewMode && <ResumoView resumo={resumo} />}

      {/* ── Edit / Create Form ──────────────────────────────────────── */}
      {!showViewMode && (
        <div className="space-y-5">

          {/* AI Generate Banner */}
          <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-teal-50 rounded-2xl border border-indigo-200 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Brain size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Gerar com Inteligencia Artificial</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Preenche automaticamente todos os campos com base na analise da minuta
                  </p>
                </div>
              </div>
              <button
                onClick={handleGerarComIA}
                disabled={isGerandoIA}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold
                  bg-gradient-to-r from-violet-600 to-indigo-600 text-white
                  hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm
                  disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-3 py-1.5">
                <CheckCircle2 size={12} />
                Resumo gerado com sucesso! Revise e ajuste os campos abaixo antes de salvar.
              </div>
            )}
            {gerarResumoAI.isError && (
              <div className="mt-3 flex items-center gap-2 text-[10px] text-red-700 font-semibold bg-red-50 rounded-lg px-3 py-1.5">
                <AlertTriangle size={12} />
                Erro ao gerar resumo. Verifique se existe uma minuta analisada.
              </div>
            )}
          </div>

          {/* Main fields */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <FileText size={14} className="text-indigo-500" />
              Dados do Resumo
            </h2>

            <div>
              <label className={labelClass}>Titulo *</label>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Resumo Executivo — ..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Partes Envolvidas *</label>
              <textarea
                value={partesEnvolvidas}
                onChange={e => setPartesEnvolvidas(e.target.value)}
                placeholder="Descreva as partes envolvidas no contrato (contratante, contratada, intervenientes...)"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <label className={labelClass}>Objeto do Contrato *</label>
              <textarea
                value={objetoResumo}
                onChange={e => setObjetoResumo(e.target.value)}
                placeholder="Descricao resumida do objeto contratual..."
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Valor Total</label>
                <input
                  type="number"
                  value={valorTotal}
                  onChange={e => setValorTotal(e.target.value)}
                  placeholder="0,00"
                  className={inputClass}
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className={labelClass}>Vigencia</label>
                <input
                  value={vigencia}
                  onChange={e => setVigencia(e.target.value)}
                  placeholder="Ex: 12 meses, 01/01/2026 a 31/12/2026"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Riscos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Shield size={14} className="text-red-500" />
                Riscos
                {riscos.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-medium">({riscos.length})</span>
                )}
              </h2>
              <button
                onClick={addRisco}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600
                  hover:text-indigo-800 transition-colors"
              >
                <Plus size={13} /> Adicionar Risco
              </button>
            </div>

            {riscos.length === 0 ? (
              <div className="text-center py-6">
                <Shield size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Nenhum risco identificado</p>
                <button
                  onClick={addRisco}
                  className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                >
                  + Adicionar primeiro risco
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {riscos.map((r, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Risco {idx + 1}
                      </p>
                      <button
                        onClick={() => removeRisco(idx)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Nivel</label>
                        <select
                          value={r.nivel}
                          onChange={e => updateRisco(idx, 'nivel', e.target.value)}
                          className={inputClass}
                        >
                          <option value="baixo">Baixo</option>
                          <option value="medio">Medio</option>
                          <option value="alto">Alto</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Descricao *</label>
                        <input
                          value={r.descricao}
                          onChange={e => updateRisco(idx, 'descricao', e.target.value)}
                          placeholder="Descreva o risco identificado..."
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Mitigacao</label>
                      <input
                        value={r.mitigacao}
                        onChange={e => updateRisco(idx, 'mitigacao', e.target.value)}
                        placeholder="Estrategia de mitigacao para este risco..."
                        className={inputClass}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Oportunidades */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Lightbulb size={14} className="text-blue-500" />
                Oportunidades
                {oportunidades.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-medium">({oportunidades.length})</span>
                )}
              </h2>
              <button
                onClick={addOportunidade}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600
                  hover:text-indigo-800 transition-colors"
              >
                <Plus size={13} /> Adicionar Oportunidade
              </button>
            </div>

            {oportunidades.length === 0 ? (
              <div className="text-center py-6">
                <Lightbulb size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Nenhuma oportunidade identificada</p>
                <button
                  onClick={addOportunidade}
                  className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                >
                  + Adicionar primeira oportunidade
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {oportunidades.map((o, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Oportunidade {idx + 1}
                      </p>
                      <button
                        onClick={() => removeOportunidade(idx)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div>
                      <label className={labelClass}>Descricao *</label>
                      <input
                        value={o.descricao}
                        onChange={e => updateOportunidade(idx, 'descricao', e.target.value)}
                        placeholder="Descreva a oportunidade identificada..."
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Impacto</label>
                      <input
                        value={o.impacto}
                        onChange={e => updateOportunidade(idx, 'impacto', e.target.value)}
                        placeholder="Impacto esperado desta oportunidade..."
                        className={inputClass}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recomendacao */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Recomendacao
            </h2>
            <textarea
              value={recomendacao}
              onChange={e => setRecomendacao(e.target.value)}
              placeholder="Parecer da equipe de contratos sobre a viabilidade e recomendacao de prosseguimento..."
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Error */}
          {formError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 font-medium">{formError}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => nav(`/contratos/solicitacoes/${id}`)}
              className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold
                text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvarRascunho}
              disabled={isSaving}
              className="flex-1 py-3.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-sm
                font-bold text-indigo-700 hover:bg-indigo-100 transition-all disabled:opacity-50
                flex items-center justify-center gap-2"
            >
              {isSaving
                ? <div className="w-4 h-4 border-2 border-indigo-400/40 border-t-indigo-400 rounded-full animate-spin" />
                : <Save size={14} />}
              Salvar Rascunho
            </button>
            <button
              onClick={handleEnviarAprovacao}
              disabled={isSaving || isSending}
              className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-bold
                hover:bg-indigo-700 transition-all disabled:opacity-50
                flex items-center justify-center gap-2 shadow-sm"
            >
              {isSending
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send size={14} />}
              Enviar para Aprovacao
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
