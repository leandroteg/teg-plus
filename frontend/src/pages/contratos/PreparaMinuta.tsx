import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Plus, Upload, ExternalLink, Check,
  ChevronRight, Clock, Tag, Building2, DollarSign, Calendar,
} from 'lucide-react'
import {
  useSolicitacao,
  useMinutas,
  useCriarMinuta,
  useAvancarEtapa,
} from '../../hooks/useSolicitacoes'
import type { Minuta, TipoMinuta, StatusMinuta } from '../../types/contratos'

// ── Formatters ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

const fmtDataHora = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const fmtBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Config ──────────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  modelo:   { label: 'Modelo',   bg: 'bg-slate-100', text: 'text-slate-600' },
  rascunho: { label: 'Rascunho', bg: 'bg-amber-50',  text: 'text-amber-700' },
  revisado: { label: 'Revisado', bg: 'bg-blue-50',   text: 'text-blue-700' },
  final:    { label: 'Final',    bg: 'bg-emerald-50', text: 'text-emerald-700' },
  assinado: { label: 'Assinado', bg: 'bg-violet-50',  text: 'text-violet-700' },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  rascunho:   { label: 'Rascunho',   bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  em_revisao: { label: 'Em Revisao', bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  aprovado:   { label: 'Aprovado',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  obsoleto:   { label: 'Obsoleto',   bg: 'bg-slate-100', text: 'text-slate-500',  dot: 'bg-slate-400' },
}

const TIPOS_SELECT: { value: TipoMinuta; label: string }[] = [
  { value: 'modelo',   label: 'Modelo' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'revisado', label: 'Revisado' },
  { value: 'final',    label: 'Final' },
]

// ── Sub-components ──────────────────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo: string }) {
  const c = TIPO_CONFIG[tipo] ?? TIPO_CONFIG.rascunho
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function MinutaCard({ minuta }: { minuta: Minuta }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <FileText size={16} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800 truncate">{minuta.titulo}</p>
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 rounded-full px-2 py-0.5 shrink-0">
              v{minuta.versao}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <TipoBadge tipo={minuta.tipo} />
            <StatusBadge status={minuta.status} />
          </div>

          {minuta.descricao && (
            <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-snug">{minuta.descricao}</p>
          )}

          <div className="flex items-center justify-between mt-3">
            <a
              href={minuta.arquivo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600
                hover:text-indigo-800 transition-colors group"
            >
              <ExternalLink size={11} className="group-hover:scale-110 transition-transform" />
              {minuta.arquivo_nome}
              {minuta.tamanho_bytes != null && (
                <span className="text-slate-400 font-normal">({fmtBytes(minuta.tamanho_bytes)})</span>
              )}
            </a>
            <p className="text-[10px] text-slate-400">{fmtDataHora(minuta.created_at)}</p>
          </div>

          {/* AI Analysis indicator */}
          {minuta.ai_analise && typeof minuta.ai_analise.score === 'number' && (
            <div className="mt-3 bg-slate-50 rounded-xl p-2.5 flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${
                minuta.ai_analise.score >= 80 ? 'bg-emerald-100 text-emerald-700'
                : minuta.ai_analise.score >= 50 ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
              }`}>
                {minuta.ai_analise.score}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-600">Analise AI</p>
                <p className="text-[9px] text-slate-400">
                  {Array.isArray(minuta.ai_analise.riscos) ? minuta.ai_analise.riscos.length : 0} riscos,{' '}
                  {Array.isArray(minuta.ai_analise.sugestoes) ? minuta.ai_analise.sugestoes.length : 0} sugestoes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function PreparaMinuta() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()

  const { data: solicitacao, isLoading: loadingSol } = useSolicitacao(id)
  const { data: minutas = [], isLoading: loadingMinutas } = useMinutas(id)
  const criarMinuta = useCriarMinuta()
  const avancarEtapa = useAvancarEtapa()

  // Form state
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoMinuta>('rascunho')
  const [descricao, setDescricao] = useState('')
  const [arquivoUrl, setArquivoUrl] = useState('')
  const [arquivoNome, setArquivoNome] = useState('')
  const [formError, setFormError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const isLoading = loadingSol || loadingMinutas

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400'
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1 block'

  const hasFinalMinuta = minutas.some(m => m.tipo === 'final')
  const nextVersion = minutas.length > 0 ? Math.max(...minutas.map(m => m.versao)) + 1 : 1

  const handleCriarMinuta = async () => {
    setFormError('')
    if (!titulo.trim()) return setFormError('Informe o titulo da minuta')
    if (!arquivoUrl.trim()) return setFormError('Informe a URL do arquivo')
    if (!arquivoNome.trim()) return setFormError('Informe o nome do arquivo')

    try {
      await criarMinuta.mutateAsync({
        solicitacao_id: id!,
        titulo: titulo.trim(),
        tipo,
        descricao: descricao.trim() || undefined,
        arquivo_url: arquivoUrl.trim(),
        arquivo_nome: arquivoNome.trim(),
        versao: nextVersion,
      })
      // Reset form
      setTitulo('')
      setTipo('rascunho')
      setDescricao('')
      setArquivoUrl('')
      setArquivoNome('')
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erro ao criar minuta')
    }
  }

  const handleAvancarResumo = async () => {
    if (!solicitacao) return
    await avancarEtapa.mutateAsync({
      solicitacaoId: solicitacao.id,
      etapaDe: 'preparar_minuta',
      etapaPara: 'resumo_executivo',
      observacao: 'Minuta final registrada, avancando para resumo executivo',
    })
    nav(`/contratos/solicitacoes/${id}`)
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

  const s = solicitacao

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
            {s.numero}
          </p>
          <h1 className="text-xl font-extrabold text-slate-800 mt-1 leading-tight">
            Preparacao de Minuta
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie as versoes da minuta contratual
          </p>
        </div>
      </div>

      {/* ── Layout: sidebar + main ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left sidebar: Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={11} className="text-indigo-500" /> Resumo da Solicitacao
            </h3>

            <div className="space-y-2.5">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Objeto</p>
                <p className="text-sm text-slate-700 font-medium mt-0.5 leading-snug">{s.objeto}</p>
              </div>

              <div className="flex items-center gap-2">
                <Building2 size={11} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Contraparte</p>
                  <p className="text-xs text-slate-700 font-medium">{s.contraparte_nome}</p>
                </div>
              </div>

              {s.valor_estimado != null && (
                <div className="flex items-center gap-2">
                  <DollarSign size={11} className="text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">Valor Estimado</p>
                    <p className="text-xs text-indigo-600 font-bold">{fmt(s.valor_estimado)}</p>
                  </div>
                </div>
              )}

              {(s.data_inicio_prevista || s.data_fim_prevista) && (
                <div className="flex items-center gap-2">
                  <Calendar size={11} className="text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">Vigencia</p>
                    <p className="text-xs text-slate-700 font-medium">
                      {s.data_inicio_prevista ? fmtData(s.data_inicio_prevista) : '???'}
                      {' \u2014 '}
                      {s.data_fim_prevista ? fmtData(s.data_fim_prevista) : '???'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advance button */}
          {hasFinalMinuta && (
            <button
              onClick={handleAvancarResumo}
              disabled={avancarEtapa.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600
                text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm
                disabled:opacity-50"
            >
              {avancarEtapa.isPending
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <ChevronRight size={14} />}
              Avancar para Resumo Executivo
            </button>
          )}

          {!hasFinalMinuta && minutas.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
              <p className="text-[10px] text-amber-700 font-semibold">
                Adicione uma minuta com tipo "Final" para avancar para o Resumo Executivo.
              </p>
            </div>
          )}
        </div>

        {/* Main content: Minutas list + Upload */}
        <div className="lg:col-span-2 space-y-4">

          {/* Add button */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Tag size={13} className="text-indigo-500" />
              Minutas
              {minutas.length > 0 && (
                <span className="text-[10px] text-slate-400 font-medium ml-1">
                  ({minutas.length} {minutas.length === 1 ? 'versao' : 'versoes'})
                </span>
              )}
            </h2>
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white
                text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-sm"
            >
              {showForm ? <Check size={12} /> : <Plus size={12} />}
              {showForm ? 'Fechar Formulario' : 'Adicionar Minuta'}
            </button>
          </div>

          {/* Upload form */}
          {showForm && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Upload size={14} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Nova Minuta</h3>
                  <p className="text-[10px] text-slate-400">Versao {nextVersion}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Titulo *</label>
                  <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ex: Minuta de Contrato de Prestacao de Servico"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select
                    value={tipo}
                    onChange={e => setTipo(e.target.value as TipoMinuta)}
                    className={inputClass}
                  >
                    {TIPOS_SELECT.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Nome do Arquivo *</label>
                  <input
                    value={arquivoNome}
                    onChange={e => setArquivoNome(e.target.value)}
                    placeholder="minuta-v1.pdf"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>URL do Arquivo *</label>
                  <input
                    value={arquivoUrl}
                    onChange={e => setArquivoUrl(e.target.value)}
                    placeholder="https://storage.example.com/minutas/arquivo.pdf"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Upload de arquivo sera disponibilizado em breve. Por enquanto, cole a URL do documento.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Descricao</label>
                  <textarea
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    placeholder="Observacoes sobre esta versao da minuta..."
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <p className="text-[11px] text-red-700 font-medium">{formError}</p>
                </div>
              )}

              <button
                onClick={handleCriarMinuta}
                disabled={criarMinuta.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600
                  text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm
                  disabled:opacity-50"
              >
                {criarMinuta.isPending
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Plus size={14} />}
                Adicionar Minuta
              </button>
            </div>
          )}

          {/* Minutas list */}
          {minutas.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-indigo-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Nenhuma minuta registrada</p>
              <p className="text-xs text-slate-400 mt-1">
                Adicione a primeira versao da minuta contratual
              </p>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold
                    hover:bg-indigo-700 transition-all"
                >
                  <Plus size={12} className="inline mr-1" />
                  Adicionar Minuta
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {minutas.map(m => (
                <MinutaCard key={m.id} minuta={m} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
