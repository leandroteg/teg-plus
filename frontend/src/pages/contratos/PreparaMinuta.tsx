import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Plus, Upload, ExternalLink, Check,
  ChevronRight, Clock, Tag, Building2, DollarSign, Calendar,
  Sparkles, ShieldAlert, Lightbulb, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, Settings2, ToggleLeft, ToggleRight,
  Loader2, Brain, Scale, FileSearch,
} from 'lucide-react'
import {
  useSolicitacao,
  useMinutas,
  useCriarMinuta,
  useAvancarEtapa,
  useAnalisarMinuta,
  useConfigAnalise,
  useAtualizarConfigAnalise,
} from '../../hooks/useSolicitacoes'
import type { Minuta, TipoMinuta, StatusMinuta, MinutaAiAnalise, ConfigAnalise } from '../../types/contratos'

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

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-200', light: 'bg-emerald-50' }
  if (score >= 60) return { bg: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-200', light: 'bg-amber-50' }
  return { bg: 'bg-red-500', text: 'text-red-700', ring: 'ring-red-200', light: 'bg-red-50' }
}

const SEV_CONFIG: Record<string, { label: string; bg: string; text: string; icon: typeof ShieldAlert }> = {
  critico: { label: 'Critico', bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  alto:    { label: 'Alto',    bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
  medio:   { label: 'Medio',   bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  baixo:   { label: 'Baixo',   bg: 'bg-slate-100', text: 'text-slate-600', icon: ShieldAlert },
}

const PRIO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  alta:  { label: 'Alta',  bg: 'bg-red-50',   text: 'text-red-700' },
  media: { label: 'Media', bg: 'bg-amber-50', text: 'text-amber-700' },
  baixa: { label: 'Baixa', bg: 'bg-slate-50', text: 'text-slate-600' },
}

const CL_STATUS: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  ok:      { label: 'OK',      bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  atencao: { label: 'Atencao', bg: 'bg-amber-50',   text: 'text-amber-700',   icon: AlertTriangle },
  risco:   { label: 'Risco',   bg: 'bg-red-50',     text: 'text-red-700',     icon: XCircle },
  ausente: { label: 'Ausente', bg: 'bg-slate-100',  text: 'text-slate-500',   icon: XCircle },
}

// ── AI Analysis Panel ───────────────────────────────────────────────────────

function AnalisePanel({ analise }: { analise: MinutaAiAnalise }) {
  const [tab, setTab] = useState<'riscos' | 'sugestoes' | 'clausulas' | 'conformidade'>('riscos')
  const sc = scoreColor(analise.score)

  return (
    <div className="mt-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white overflow-hidden">
      {/* Score header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-indigo-100">
        <div className={`w-11 h-11 rounded-xl ${sc.light} ring-2 ${sc.ring} flex items-center justify-center`}>
          <span className={`text-base font-extrabold ${sc.text}`}>{analise.score}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Brain size={12} className="text-indigo-500" />
            <p className="text-xs font-extrabold text-slate-800">Analise por IA</p>
          </div>
          {analise.resumo && (
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">{analise.resumo}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
            {analise.riscos?.length ?? 0} riscos
          </span>
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
            {analise.sugestoes?.length ?? 0} sugestoes
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-indigo-100 px-2">
        {([
          { key: 'riscos' as const, label: 'Riscos', icon: ShieldAlert, count: analise.riscos?.length },
          { key: 'sugestoes' as const, label: 'Sugestoes', icon: Lightbulb, count: analise.sugestoes?.length },
          { key: 'clausulas' as const, label: 'Clausulas', icon: FileSearch, count: analise.clausulas_analisadas?.length },
          { key: 'conformidade' as const, label: 'Conformidade', icon: Scale, count: undefined as number | undefined },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-3 py-2 text-[10px] font-bold border-b-2 transition-all ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <t.icon size={10} />
            {t.label}
            {t.count != null && (
              <span className="bg-slate-100 rounded-full px-1.5 text-[9px]">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-3 max-h-80 overflow-y-auto">
        {tab === 'riscos' && (
          <div className="space-y-2">
            {(analise.riscos ?? []).length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-4">Nenhum risco identificado</p>
            ) : analise.riscos.map((r, i) => {
              const sev = SEV_CONFIG[r.severidade] ?? SEV_CONFIG.baixo
              const Icon = sev.icon
              return (
                <div key={i} className={`rounded-xl ${sev.bg} p-3`}>
                  <div className="flex items-start gap-2">
                    <Icon size={13} className={sev.text} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-[11px] font-bold ${sev.text}`}>{r.titulo}</p>
                        <span className={`text-[9px] font-semibold ${sev.bg} ${sev.text} border rounded-full px-1.5 py-0.5`}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-1 leading-snug">{r.descricao}</p>
                      {r.clausula_ref && (
                        <p className="text-[9px] text-slate-400 mt-1 font-mono">Ref: {r.clausula_ref}</p>
                      )}
                      {r.sugestao_mitigacao && (
                        <p className="text-[10px] text-emerald-700 mt-1.5 bg-emerald-50 rounded-lg px-2 py-1">
                          Mitigacao: {r.sugestao_mitigacao}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'sugestoes' && (
          <div className="space-y-2">
            {(analise.sugestoes ?? []).length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-4">Nenhuma sugestao</p>
            ) : analise.sugestoes.map((s, i) => {
              const pr = PRIO_CONFIG[s.prioridade] ?? PRIO_CONFIG.baixa
              return (
                <div key={i} className={`rounded-xl ${pr.bg} p-3`}>
                  <div className="flex items-center gap-1.5">
                    <Lightbulb size={11} className={pr.text} />
                    <p className={`text-[11px] font-bold ${pr.text}`}>{s.titulo}</p>
                    <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${pr.bg} ${pr.text} border`}>
                      {pr.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1 leading-snug">{s.descricao}</p>
                  {s.texto_sugerido && (
                    <div className="mt-2 bg-white/60 rounded-lg px-2.5 py-1.5 border border-slate-200">
                      <p className="text-[9px] text-slate-400 font-semibold uppercase mb-0.5">Texto sugerido</p>
                      <p className="text-[10px] text-slate-700 italic leading-snug">{s.texto_sugerido}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'clausulas' && (
          <div className="space-y-1.5">
            {(analise.clausulas_analisadas ?? []).length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-4">Nenhuma clausula analisada</p>
            ) : analise.clausulas_analisadas!.map((c, i) => {
              const st = CL_STATUS[c.status] ?? CL_STATUS.ok
              const Icon = st.icon
              return (
                <div key={i} className={`flex items-start gap-2 rounded-xl ${st.bg} px-3 py-2`}>
                  <Icon size={12} className={`${st.text} mt-0.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[11px] font-bold ${st.text}`}>{c.nome}</p>
                      <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${st.bg} ${st.text} border`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{c.comentario}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'conformidade' && (
          <div className="grid grid-cols-2 gap-2">
            {analise.conformidade ? Object.entries(analise.conformidade).map(([key, val]) => {
              const label = key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
              return (
                <div key={key} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  val ? 'bg-emerald-50' : 'bg-red-50'
                }`}>
                  {val
                    ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    : <XCircle size={13} className="text-red-500 shrink-0" />}
                  <p className={`text-[10px] font-semibold ${val ? 'text-emerald-700' : 'text-red-700'}`}>
                    {label}
                  </p>
                </div>
              )
            }) : (
              <p className="text-[11px] text-slate-400 col-span-2 text-center py-4">Sem dados de conformidade</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Config Rules Panel ──────────────────────────────────────────────────────

function RegrasConfig({ regras, onUpdate }: {
  regras: ConfigAnalise[]
  onUpdate: (id: string, valor: string, ativo?: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const categorias = ['geral', 'clausulas', 'limites', 'penalidades', 'compliance'] as const
  const CATEG_LABELS: Record<string, string> = {
    geral: 'Geral', clausulas: 'Clausulas', limites: 'Limites', penalidades: 'Penalidades', compliance: 'Compliance',
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 size={13} className="text-indigo-500" />
          <span className="text-xs font-extrabold text-slate-800">Regras de Analise IA</span>
          <span className="text-[10px] text-slate-400 font-medium">
            ({regras.filter(r => r.ativo).length} ativas)
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-4 max-h-96 overflow-y-auto">
          {categorias.map(cat => {
            const items = regras.filter(r => r.categoria === cat)
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  {CATEG_LABELS[cat]}
                </p>
                <div className="space-y-2">
                  {items.map(r => (
                    <div key={r.id} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      <button
                        onClick={() => onUpdate(r.id, r.valor, !r.ativo)}
                        className="mt-0.5 shrink-0"
                      >
                        {r.ativo
                          ? <ToggleRight size={18} className="text-indigo-500" />
                          : <ToggleLeft size={18} className="text-slate-300" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold ${r.ativo ? 'text-slate-700' : 'text-slate-400'}`}>
                          {r.descricao || r.chave}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {r.tipo === 'booleano' ? (
                            <select
                              value={r.valor}
                              onChange={e => onUpdate(r.id, e.target.value)}
                              disabled={!r.ativo}
                              className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50"
                            >
                              <option value="true">Sim</option>
                              <option value="false">Nao</option>
                            </select>
                          ) : (
                            <input
                              value={r.valor}
                              onChange={e => onUpdate(r.id, e.target.value)}
                              disabled={!r.ativo}
                              className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600
                                w-full max-w-[200px] disabled:opacity-50"
                            />
                          )}
                          <span className="text-[9px] text-slate-400 font-mono shrink-0">{r.chave}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── MinutaCard ───────────────────────────────────────────────────────────────

function MinutaCard({ minuta, onAnalisar, analisando }: {
  minuta: Minuta
  onAnalisar: (m: Minuta) => void
  analisando: boolean
}) {
  const [showAnalise, setShowAnalise] = useState(false)
  const hasAnalise = minuta.ai_analise && typeof minuta.ai_analise.score === 'number'

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

          {/* AI Action row */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onAnalisar(minuta)}
              disabled={analisando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold
                bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm
                hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50"
            >
              {analisando
                ? <Loader2 size={11} className="animate-spin" />
                : <Sparkles size={11} />}
              {analisando ? 'Analisando...' : hasAnalise ? 'Re-analisar com IA' : 'Analisar com IA'}
            </button>

            {hasAnalise && (
              <button
                onClick={() => setShowAnalise(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold
                  bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
              >
                {showAnalise ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showAnalise ? 'Ocultar' : 'Ver Analise'}
                <span className={`ml-1 w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-extrabold ${
                  scoreColor(minuta.ai_analise!.score).light
                } ${scoreColor(minuta.ai_analise!.score).text}`}>
                  {minuta.ai_analise!.score}
                </span>
              </button>
            )}

            {minuta.ai_analisado_em && (
              <p className="text-[9px] text-slate-400 ml-auto">
                Analisado: {fmtDataHora(minuta.ai_analisado_em)}
              </p>
            )}
          </div>

          {/* Expanded analysis */}
          {showAnalise && hasAnalise && (
            <AnalisePanel analise={minuta.ai_analise!} />
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
  const { data: regras = [] } = useConfigAnalise()
  const criarMinuta = useCriarMinuta()
  const avancarEtapa = useAvancarEtapa()
  const analisarMinuta = useAnalisarMinuta()
  const atualizarConfig = useAtualizarConfigAnalise()

  // Form state
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoMinuta>('rascunho')
  const [descricao, setDescricao] = useState('')
  const [arquivoUrl, setArquivoUrl] = useState('')
  const [arquivoNome, setArquivoNome] = useState('')
  const [formError, setFormError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [analisandoId, setAnalisandoId] = useState<string | null>(null)

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

  const handleAnalisarMinuta = async (minuta: Minuta) => {
    if (!solicitacao || analisandoId) return
    setAnalisandoId(minuta.id)
    try {
      await analisarMinuta.mutateAsync({
        minuta_id: minuta.id,
        solicitacao_id: solicitacao.id,
        texto_minuta: minuta.descricao,
        descricao_minuta: minuta.titulo,
        contexto: {
          objeto: solicitacao.objeto,
          contraparte: solicitacao.contraparte_nome,
          valor: solicitacao.valor_estimado ?? undefined,
          tipo_contrato: solicitacao.tipo_contrato,
          data_inicio: solicitacao.data_inicio_prevista ?? undefined,
          data_fim: solicitacao.data_fim_prevista ?? undefined,
          obra: solicitacao.obra?.nome ?? undefined,
        },
        regras: regras.filter(r => r.ativo),
      })
    } catch {
      // Mutation error is handled by TanStack Query
    } finally {
      setAnalisandoId(null)
    }
  }

  const handleUpdateConfig = (ruleId: string, valor: string, ativo?: boolean) => {
    atualizarConfig.mutate({ id: ruleId, valor, ativo })
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
                <MinutaCard
                  key={m.id}
                  minuta={m}
                  onAnalisar={handleAnalisarMinuta}
                  analisando={analisandoId === m.id}
                />
              ))}
            </div>
          )}

          {/* Regras de Analise IA */}
          {regras.length > 0 && (
            <RegrasConfig regras={regras} onUpdate={handleUpdateConfig} />
          )}
        </div>
      </div>
    </div>
  )
}
