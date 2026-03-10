import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Plus, Upload, ExternalLink, Check,
  ChevronRight, Clock, Tag, Building2, DollarSign, Calendar,
  Sparkles, ShieldAlert, Lightbulb, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, Settings2, ToggleLeft, ToggleRight,
  Loader2, Brain, Scale, FileSearch, FileUp, X, Wand2,
  TrendingUp, ArrowRight, Shield, Edit3, FileDown, Target, Crown, Zap,
} from 'lucide-react'
import {
  useSolicitacao,
  useMinutas,
  useCriarMinuta,
  useAvancarEtapa,
  useAnalisarMinuta,
  useMelhorarMinuta,
  useGerarMinutaPDF,
  useConfigAnalise,
  useAtualizarConfigAnalise,
  useUploadMinutaFile,
} from '../../hooks/useSolicitacoes'
import type { MelhoriaMinuta, MinutaTextoGerado } from '../../hooks/useSolicitacoes'
import type { Minuta, TipoMinuta, StatusMinuta, MinutaAiAnalise, ConfigAnalise } from '../../types/contratos'
import { supabase } from '../../services/supabase'
import { jsPDF } from 'jspdf'

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

const CATEG_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  importante:  { label: 'Importante',  bg: 'bg-red-50',    text: 'text-red-700',   border: 'border-red-200' },
  recomendada: { label: 'Recomendada', bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200' },
  opcional:    { label: 'Opcional',    bg: 'bg-slate-50',  text: 'text-slate-600', border: 'border-slate-200' },
}

const PAPEL_TEG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  contratante: { label: 'TEG Contratante', icon: Crown, color: 'text-emerald-600' },
  contratada:  { label: 'TEG Contratada',  icon: Target, color: 'text-blue-600' },
  indefinido:  { label: 'Papel Indefinido', icon: Target, color: 'text-slate-500' },
}

const CL_STATUS: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  ok:      { label: 'OK',      bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  atencao: { label: 'Atencao', bg: 'bg-amber-50',   text: 'text-amber-700',   icon: AlertTriangle },
  risco:   { label: 'Risco',   bg: 'bg-red-50',     text: 'text-red-700',     icon: XCircle },
  ausente: { label: 'Ausente', bg: 'bg-slate-100',  text: 'text-slate-500',   icon: XCircle },
}

// ── Score Ring SVG ──────────────────────────────────────────────────────────

function ScoreRing({ score, size = 56, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const sc = scoreColor(score)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const colorMap: Record<string, string> = {
    'bg-emerald-500': '#10b981',
    'bg-amber-500': '#f59e0b',
    'bg-red-500': '#ef4444',
  }
  const strokeColor = colorMap[sc.bg] || '#6366f1'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-black ${sc.text}`}>{score}</span>
      </div>
    </div>
  )
}

// ── Animated Score Badge ────────────────────────────────────────────────────

function ScoreComparison({ before, after }: { before: number; after: number }) {
  const diff = after - before
  const bcol = scoreColor(before)
  const acol = scoreColor(after)

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${bcol.light}`}>
        <span className={`text-[10px] font-bold ${bcol.text}`}>{before}</span>
      </div>
      <ArrowRight size={12} className="text-slate-400" />
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${acol.light}`}>
        <span className={`text-[10px] font-bold ${acol.text}`}>{after}</span>
      </div>
      {diff > 0 && (
        <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">
          <TrendingUp size={9} />
          +{diff}
        </span>
      )}
    </div>
  )
}

// ── AI Analysis Panel ───────────────────────────────────────────────────────

function AnalisePanel({ analise, onMelhorar, melhorando }: {
  analise: MinutaAiAnalise
  onMelhorar?: () => void
  melhorando?: boolean
}) {
  const [tab, setTab] = useState<'riscos' | 'sugestoes' | 'oportunidades' | 'clausulas' | 'conformidade'>('riscos')

  const nRiscos = analise.riscos?.length ?? 0
  const nSugestoes = analise.sugestoes?.length ?? 0
  const nOportunidades = analise.oportunidades?.length ?? 0
  const nClausulas = analise.clausulas_analisadas?.length ?? 0
  const conformEntries = analise.conformidade ? Object.entries(analise.conformidade) : []
  const conformOk = conformEntries.filter(([, v]) => v).length
  const conformTotal = conformEntries.length
  const papelInfo = PAPEL_TEG[analise.papel_teg || 'indefinido'] ?? PAPEL_TEG.indefinido

  // Safeguard: if resumo contains stringified JSON, extract the real resumo from it
  const resumoText = (() => {
    const r = analise.resumo
    if (!r) return null
    if (typeof r === 'string' && r.startsWith('{')) {
      try {
        const parsed = JSON.parse(r)
        return typeof parsed.resumo === 'string' ? parsed.resumo : null
      } catch { return r.length > 200 ? null : r }
    }
    return r
  })()

  return (
    <div className="mt-4 rounded-2xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
      {/* Hero header with score ring */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-2">
            <ScoreRing score={analise.score} size={64} strokeWidth={5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Brain size={14} className="text-white/80" />
              <p className="text-sm font-extrabold text-white">Analise Juridica por IA</p>
            </div>

            {/* TEG Role Badge */}
            {analise.papel_teg && analise.papel_teg !== 'indefinido' && (
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex items-center gap-1 text-[10px] font-bold bg-white/25 text-white rounded-lg px-2.5 py-1 backdrop-blur-sm">
                  <papelInfo.icon size={10} /> {papelInfo.label}
                </span>
                {analise.poder_barganha && (
                  <span className="text-[9px] font-semibold text-white/70">
                    Barganha: {analise.poder_barganha.nivel}
                  </span>
                )}
              </div>
            )}

            {resumoText && (
              <p className="text-[11px] text-white/75 leading-snug line-clamp-2">{resumoText}</p>
            )}
            {/* Metric pills */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                <ShieldAlert size={9} /> {nRiscos} risco{nRiscos !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                <Lightbulb size={9} /> {nSugestoes} sugestao{nSugestoes !== 1 ? 'es' : ''}
              </span>
              {nOportunidades > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-400/30 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                  <Zap size={9} /> {nOportunidades} oportunidade{nOportunidades !== 1 ? 's' : ''}
                </span>
              )}
              <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                <FileSearch size={9} /> {nClausulas} clausula{nClausulas !== 1 ? 's' : ''}
              </span>
              {conformTotal > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                  <Shield size={9} /> {conformOk}/{conformTotal} conforme
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CTA for improvement */}
        {onMelhorar && (
          <button
            onClick={onMelhorar}
            disabled={melhorando}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-bold
              transition-all disabled:opacity-50 border border-white/20"
          >
            {melhorando ? (
              <><Loader2 size={13} className="animate-spin" /> Melhorando minuta com IA...</>
            ) : (
              <><Wand2 size={13} /> Melhorar minuta com base nesta analise</>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-1 bg-slate-50/50 overflow-x-auto">
        {([
          { key: 'riscos' as const, label: 'Riscos', icon: ShieldAlert, count: nRiscos, accent: 'red' },
          { key: 'sugestoes' as const, label: 'Sugestoes', icon: Lightbulb, count: nSugestoes, accent: 'amber' },
          ...(nOportunidades > 0 ? [{ key: 'oportunidades' as const, label: 'Oportunidades', icon: Zap, count: nOportunidades, accent: 'emerald' }] : []),
          { key: 'clausulas' as const, label: 'Clausulas', icon: FileSearch, count: nClausulas, accent: 'blue' },
          { key: 'conformidade' as const, label: 'Conformidade', icon: Scale, count: conformTotal || undefined, accent: 'emerald' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-3 py-2.5 text-[10px] font-bold border-b-2 transition-all whitespace-nowrap ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-700 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <t.icon size={10} />
            {t.label}
            {t.count != null && (
              <span className={`rounded-full px-1.5 text-[9px] ${
                tab === t.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {tab === 'riscos' && (
          <div className="space-y-2">
            {nRiscos === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhum risco identificado</p>
              </div>
            ) : analise.riscos.map((r, i) => {
              const sev = SEV_CONFIG[r.severidade] ?? SEV_CONFIG.baixo
              const Icon = sev.icon
              return (
                <div key={i} className={`rounded-xl border ${sev.bg} p-3.5 border-opacity-50`}
                  style={{ borderColor: `var(--tw-${sev.text}-opacity, rgba(0,0,0,0.1))` }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${sev.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon size={14} className={sev.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-[11px] font-bold ${sev.text}`}>{r.titulo}</p>
                        <span className={`text-[9px] font-semibold ${sev.bg} ${sev.text} border rounded-full px-1.5 py-0.5`}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">{r.descricao}</p>
                      {r.clausula_ref && (
                        <p className="text-[9px] text-slate-400 mt-1 font-mono">Ref: {r.clausula_ref}</p>
                      )}
                      {r.sugestao_mitigacao && (
                        <div className="mt-2 flex items-start gap-1.5 bg-emerald-50 rounded-lg px-2.5 py-2 border border-emerald-100">
                          <Lightbulb size={10} className="text-emerald-600 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-emerald-700 leading-snug">{r.sugestao_mitigacao}</p>
                        </div>
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
            {nSugestoes === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhuma sugestao adicional</p>
              </div>
            ) : analise.sugestoes.map((s, i) => {
              const cat = CATEG_CONFIG[s.categoria || 'opcional'] ?? CATEG_CONFIG.opcional
              const pr = PRIO_CONFIG[s.prioridade] ?? PRIO_CONFIG.baixa
              return (
                <div key={i} className={`rounded-xl border ${cat.border} ${cat.bg} p-3.5`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Lightbulb size={11} className={cat.text} />
                    <p className={`text-[11px] font-bold ${cat.text}`}>{s.titulo}</p>
                    <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${cat.bg} ${cat.text} border ${cat.border}`}>
                      {cat.label}
                    </span>
                    {s.prioridade && s.prioridade !== (s.categoria === 'importante' ? 'alta' : s.categoria === 'recomendada' ? 'media' : 'baixa') && (
                      <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${pr.bg} ${pr.text} border`}>
                        {pr.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">{s.descricao}</p>
                  {s.beneficio_teg && (
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <Crown size={9} className="text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-[9px] text-emerald-700 font-medium leading-snug">{s.beneficio_teg}</p>
                    </div>
                  )}
                  {s.texto_sugerido && (
                    <div className="mt-2.5 bg-white/70 rounded-lg px-3 py-2 border border-slate-200">
                      <p className="text-[9px] text-indigo-500 font-bold uppercase mb-0.5">Texto sugerido</p>
                      <p className="text-[10px] text-slate-700 italic leading-snug">{s.texto_sugerido}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'oportunidades' && (
          <div className="space-y-2">
            {nOportunidades === 0 ? (
              <div className="text-center py-6">
                <Zap size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhuma oportunidade identificada</p>
              </div>
            ) : analise.oportunidades!.map((o, i) => {
              const impacto = o.impacto || 'medio'
              const colors = impacto === 'alto' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : impacto === 'medio' ? 'bg-teal-50 border-teal-200 text-teal-700'
                : 'bg-slate-50 border-slate-200 text-slate-600'
              return (
                <div key={i} className={`rounded-xl border p-3.5 ${colors.split(' ').slice(0,2).join(' ')}`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Zap size={11} className="text-emerald-500" />
                    <p className="text-[11px] font-bold text-emerald-800">{o.titulo}</p>
                    <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 bg-emerald-100 text-emerald-600 border border-emerald-200`}>
                      Impacto {impacto}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">{o.descricao}</p>
                  {o.texto_sugerido && (
                    <div className="mt-2.5 bg-white/70 rounded-lg px-3 py-2 border border-emerald-100">
                      <p className="text-[9px] text-emerald-600 font-bold uppercase mb-0.5">Estrategia sugerida</p>
                      <p className="text-[10px] text-slate-700 italic leading-snug">{o.texto_sugerido}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'clausulas' && (
          <div className="space-y-1.5">
            {nClausulas === 0 ? (
              <div className="text-center py-6">
                <FileSearch size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhuma clausula analisada</p>
              </div>
            ) : analise.clausulas_analisadas!.map((c, i) => {
              const st = CL_STATUS[c.status] ?? CL_STATUS.ok
              const Icon = st.icon
              return (
                <div key={i} className={`flex items-start gap-2.5 rounded-xl ${st.bg} px-3.5 py-2.5 border`}>
                  <div className={`w-6 h-6 rounded-md ${st.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon size={12} className={st.text} />
                  </div>
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
            {conformTotal > 0 ? conformEntries.map(([key, val]) => {
              const label = key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
              return (
                <div key={key} className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border ${
                  val ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                }`}>
                  {val
                    ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    : <XCircle size={14} className="text-red-500 shrink-0" />}
                  <p className={`text-[10px] font-semibold ${val ? 'text-emerald-700' : 'text-red-700'}`}>
                    {label}
                  </p>
                </div>
              )
            }) : (
              <div className="col-span-2 text-center py-6">
                <Scale size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Sem dados de conformidade</p>
              </div>
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

// ── Melhorias Panel ──────────────────────────────────────────────────────────

function MelhoriasPanel({ melhorias, scoreOriginal, onGerarMinuta, gerandoMinuta, onMelhoriasChange, pdfUrl, onEnviarAprovacao, enviandoAprovacao }: {
  melhorias: MelhoriaMinuta
  scoreOriginal?: number
  onGerarMinuta?: () => void
  gerandoMinuta?: boolean
  onMelhoriasChange?: (edited: MelhoriaMinuta) => void
  pdfUrl?: string | null
  onEnviarAprovacao?: () => void
  enviandoAprovacao?: boolean
}) {
  const [tab, setTab] = useState<'clausulas' | 'riscos' | 'novas'>('clausulas')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editData, setEditData] = useState<{
    clausulas: Record<number, string>
    novas: Record<number, string>
  }>({ clausulas: {}, novas: {} })
  const [deletedClausulas, setDeletedClausulas] = useState<Set<number>>(new Set())
  const [deletedNovas, setDeletedNovas] = useState<Set<number>>(new Set())

  const getClausulaText = (i: number, original: string) => editData.clausulas[i] ?? original
  const getNovaText = (i: number, original: string) => editData.novas[i] ?? original

  // Build edited melhorias object from current state
  const buildEdited = (
    newEditData?: typeof editData,
    newDeletedCl?: Set<number>,
    newDeletedNo?: Set<number>,
  ): MelhoriaMinuta => {
    const ed = newEditData ?? editData
    const delCl = newDeletedCl ?? deletedClausulas
    const delNo = newDeletedNo ?? deletedNovas

    return {
      ...melhorias,
      clausulas_melhoradas: melhorias.clausulas_melhoradas
        .filter((_, i) => !delCl.has(i))
        .map((c, _oi) => {
          // Find original index
          let origIdx = -1
          let count = 0
          for (let j = 0; j < melhorias.clausulas_melhoradas.length; j++) {
            if (!delCl.has(j)) {
              if (count === _oi) { origIdx = j; break }
              count++
            }
          }
          return {
            ...c,
            texto_melhorado: ed.clausulas[origIdx] ?? c.texto_melhorado,
          }
        }),
      clausulas_novas: melhorias.clausulas_novas
        .filter((_, i) => !delNo.has(i))
        .map((c, _oi) => {
          let origIdx = -1
          let count = 0
          for (let j = 0; j < melhorias.clausulas_novas.length; j++) {
            if (!delNo.has(j)) {
              if (count === _oi) { origIdx = j; break }
              count++
            }
          }
          return {
            ...c,
            texto: ed.novas[origIdx] ?? c.texto,
          }
        }),
    }
  }

  // Notify parent of changes (for local state)
  const propagateChanges = (
    newEditData?: typeof editData,
    newDeletedCl?: Set<number>,
    newDeletedNo?: Set<number>,
  ) => {
    if (!onMelhoriasChange) return
    onMelhoriasChange(buildEdited(newEditData, newDeletedCl, newDeletedNo))
  }

  // Explicit save: build final version + notify parent (which persists to Supabase)
  const handleSave = () => {
    if (!onMelhoriasChange) return
    setSaving(true)
    setSaveSuccess(false)
    const edited = buildEdited()
    onMelhoriasChange(edited)
    // Brief delay to show feedback, then exit editing mode
    setTimeout(() => {
      setSaving(false)
      setSaveSuccess(true)
      setEditing(false)
      // Hide success after 3s
      setTimeout(() => setSaveSuccess(false), 3000)
    }, 400)
  }

  const handleDeleteClausula = (i: number) => {
    const next = new Set(deletedClausulas)
    next.add(i)
    setDeletedClausulas(next)
    propagateChanges(undefined, next, undefined)
  }

  const handleDeleteNova = (i: number) => {
    const next = new Set(deletedNovas)
    next.add(i)
    setDeletedNovas(next)
    propagateChanges(undefined, undefined, next)
  }

  const handleEditClausula = (i: number, value: string) => {
    const next = { ...editData, clausulas: { ...editData.clausulas, [i]: value } }
    setEditData(next)
    propagateChanges(next, undefined, undefined)
  }

  const handleEditNova = (i: number, value: string) => {
    const next = { ...editData, novas: { ...editData.novas, [i]: value } }
    setEditData(next)
    propagateChanges(next, undefined, undefined)
  }

  const visibleClausulas = melhorias.clausulas_melhoradas?.filter((_, i) => !deletedClausulas.has(i)) ?? []
  const visibleNovas = melhorias.clausulas_novas?.filter((_, i) => !deletedNovas.has(i)) ?? []

  const nMelhoradas = visibleClausulas.length
  const nMitigados = melhorias.riscos_mitigados?.length ?? 0
  const nNovas = visibleNovas.length

  return (
    <div className="mt-4 rounded-2xl border border-teal-100 bg-white overflow-hidden shadow-sm">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-2">
            <ScoreRing score={melhorias.score_estimado} size={64} strokeWidth={5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Wand2 size={14} className="text-white/80" />
              <p className="text-sm font-extrabold text-white">Melhorias pela IA</p>
            </div>
            <p className="text-[11px] text-white/75 leading-snug line-clamp-2">{melhorias.resumo_melhorias}</p>
            {/* Score comparison + metric pills */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {scoreOriginal != null && (
                <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                  <TrendingUp size={9} /> {scoreOriginal} → {melhorias.score_estimado}
                  {melhorias.score_estimado > scoreOriginal && (
                    <span className="text-emerald-200">+{melhorias.score_estimado - scoreOriginal}</span>
                  )}
                </span>
              )}
              <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                <Wand2 size={9} /> {nMelhoradas} melhorada{nMelhoradas !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                <Shield size={9} /> {nMitigados} mitigado{nMitigados !== 1 ? 's' : ''}
              </span>
              {nNovas > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                  <Plus size={9} /> {nNovas} nova{nNovas !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-1 bg-slate-50/50">
        {([
          { key: 'clausulas' as const, label: 'Melhoradas', count: nMelhoradas },
          { key: 'riscos' as const, label: 'Riscos Mitigados', count: nMitigados },
          { key: 'novas' as const, label: 'Novas Clausulas', count: nNovas },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-3 py-2.5 text-[10px] font-bold border-b-2 transition-all ${
              tab === t.key
                ? 'border-teal-500 text-teal-700 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`rounded-full px-1.5 text-[9px] ${
                tab === t.key ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-500'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {tab === 'clausulas' && (
          <div className="space-y-2.5">
            {nMelhoradas === 0 ? (
              <div className="text-center py-6">
                <FileSearch size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhuma clausula melhorada</p>
              </div>
            ) : melhorias.clausulas_melhoradas.map((c, i) => {
              if (deletedClausulas.has(i)) return null
              return (
                <div key={i} className="rounded-xl bg-teal-50 border border-teal-100 p-3.5 transition-all animate-in fade-in">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded-md bg-teal-100 flex items-center justify-center shrink-0">
                      <Wand2 size={11} className="text-teal-600" />
                    </div>
                    <p className="text-[11px] font-bold text-teal-800 flex-1">{c.nome}</p>
                    <span className="text-[9px] font-semibold bg-teal-100 text-teal-600 rounded-full px-1.5 py-0.5">
                      {c.acao}
                    </span>
                    {editing && (
                      <button
                        onClick={() => handleDeleteClausula(i)}
                        className="w-6 h-6 rounded-md bg-red-50 border border-red-200 flex items-center justify-center
                          text-red-400 hover:text-red-600 hover:bg-red-100 transition-all shrink-0"
                        title="Remover esta clausula"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 italic mb-2.5 leading-relaxed">{c.justificativa}</p>
                  <div className="bg-white/80 rounded-lg px-3 py-2.5 border border-teal-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] text-teal-600 font-bold uppercase">Texto Melhorado</p>
                      {editing && (
                        <span className="text-[8px] font-semibold text-teal-400 bg-teal-50 rounded px-1.5 py-0.5">Editavel</span>
                      )}
                    </div>
                    {editing ? (
                      <textarea
                        value={getClausulaText(i, c.texto_melhorado)}
                        onChange={e => handleEditClausula(i, e.target.value)}
                        rows={4}
                        className="w-full text-[10px] text-slate-700 leading-relaxed bg-white rounded-lg px-2.5 py-2
                          border border-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-300/50 resize-y
                          placeholder:text-slate-400"
                      />
                    ) : (
                      <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {getClausulaText(i, c.texto_melhorado)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'riscos' && (
          <div className="space-y-2.5">
            {nMitigados === 0 ? (
              <div className="text-center py-6">
                <Shield size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhum risco mitigado</p>
              </div>
            ) : melhorias.riscos_mitigados.map((r, i) => (
              <div key={i} className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5">
                <p className="text-[11px] font-bold text-emerald-800 mb-1.5">{r.risco_original}</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5 border border-red-100">
                    {r.severidade_original}
                  </span>
                  <ArrowRight size={11} className="text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5 border border-emerald-200">
                    {r.severidade_apos}
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">{r.acao_tomada}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'novas' && (
          <div className="space-y-2.5">
            {nNovas === 0 ? (
              <div className="text-center py-6">
                <Plus size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhuma clausula nova sugerida</p>
              </div>
            ) : melhorias.clausulas_novas.map((c, i) => {
              if (deletedNovas.has(i)) return null
              return (
                <div key={i} className="rounded-xl bg-blue-50 border border-blue-100 p-3.5 transition-all animate-in fade-in">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                      <Plus size={11} className="text-blue-600" />
                    </div>
                    <p className="text-[11px] font-bold text-blue-800 flex-1">{c.nome}</p>
                    {editing && (
                      <button
                        onClick={() => handleDeleteNova(i)}
                        className="w-6 h-6 rounded-md bg-red-50 border border-red-200 flex items-center justify-center
                          text-red-400 hover:text-red-600 hover:bg-red-100 transition-all shrink-0"
                        title="Remover esta clausula"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 italic mb-1.5 leading-relaxed">{c.motivo}</p>
                  {c.base_legal && (
                    <p className="text-[9px] text-blue-500 font-mono mb-2.5 bg-blue-100/50 rounded-md px-2 py-1 inline-block">
                      Base: {c.base_legal}
                    </p>
                  )}
                  <div className="bg-white/80 rounded-lg px-3 py-2.5 border border-blue-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] text-blue-600 font-bold uppercase">Texto da Clausula</p>
                      {editing && (
                        <span className="text-[8px] font-semibold text-blue-400 bg-blue-50 rounded px-1.5 py-0.5">Editavel</span>
                      )}
                    </div>
                    {editing ? (
                      <textarea
                        value={getNovaText(i, c.texto)}
                        onChange={e => handleEditNova(i, e.target.value)}
                        rows={4}
                        className="w-full text-[10px] text-slate-700 leading-relaxed bg-white rounded-lg px-2.5 py-2
                          border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300/50 resize-y
                          placeholder:text-slate-400"
                      />
                    ) : (
                      <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {getNovaText(i, c.texto)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Observacoes */}
      {melhorias.observacoes_gerais && (
        <div className="px-5 py-3.5 border-t border-teal-100 bg-gradient-to-r from-slate-50 to-teal-50/30">
          <div className="flex items-start gap-2">
            <Brain size={12} className="text-teal-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] text-teal-500 font-bold uppercase mb-0.5">Observacoes do Revisor IA</p>
              <p className="text-[10px] text-slate-600 leading-relaxed">{melhorias.observacoes_gerais}</p>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview */}
      {pdfUrl && (
        <div className="px-5 py-4 border-t border-emerald-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800">Minuta Gerada com Sucesso</p>
              <p className="text-[10px] text-emerald-600">PDF disponivel para download e envio para aprovacao</p>
            </div>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold
                bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm"
            >
              <ExternalLink size={11} />
              Abrir PDF
            </a>
          </div>
        </div>
      )}

      {/* Save success feedback */}
      {saveSuccess && (
        <div className="px-5 py-2.5 border-t border-emerald-100 bg-emerald-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <p className="text-[10px] font-bold text-emerald-700">Edicoes salvas com sucesso!</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-5 py-4 border-t border-teal-100 bg-gradient-to-r from-white to-teal-50/30">
        <div className="flex items-center gap-2.5 flex-wrap">
          {!pdfUrl && editing && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all
                bg-teal-600 text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 size={12} className="animate-spin" /> Salvando...</>
              ) : (
                <><Check size={12} /> Salvar Edicoes</>
              )}
            </button>
          )}

          {!pdfUrl && editing && (
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all
                bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 shadow-sm"
            >
              <X size={12} />
              Cancelar
            </button>
          )}

          {!pdfUrl && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all
                bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 hover:border-teal-300 shadow-sm"
            >
              <Edit3 size={12} />
              Editar Melhorias
            </button>
          )}

          {onGerarMinuta && !pdfUrl && (
            <button
              onClick={onGerarMinuta}
              disabled={gerandoMinuta}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold
                bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm
                hover:from-teal-700 hover:to-emerald-700 hover:shadow-md transition-all
                disabled:opacity-50"
            >
              {gerandoMinuta ? (
                <><Loader2 size={12} className="animate-spin" /> Gerando minuta...</>
              ) : (
                <><FileDown size={12} /> Gerar Minuta</>
              )}
            </button>
          )}

          {pdfUrl && onEnviarAprovacao && (
            <button
              onClick={onEnviarAprovacao}
              disabled={enviandoAprovacao}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold
                bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md
                hover:from-emerald-700 hover:to-green-700 hover:shadow-lg transition-all
                disabled:opacity-50"
            >
              {enviandoAprovacao ? (
                <><Loader2 size={14} className="animate-spin" /> Enviando...</>
              ) : (
                <><ChevronRight size={14} /> Enviar para Aprovacao</>
              )}
            </button>
          )}
        </div>
        {editing && !pdfUrl && (
          <p className="text-[9px] text-teal-500 mt-2.5 flex items-center gap-1">
            <Edit3 size={8} />
            Modo edicao ativo — edite textos ou remova sugestoes com o X vermelho, depois clique em &quot;Salvar Edicoes&quot;
          </p>
        )}
        {deletedClausulas.size > 0 || deletedNovas.size > 0 ? (
          <p className="text-[9px] text-amber-600 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={8} />
            {deletedClausulas.size + deletedNovas.size} sugestao(oes) removida(s) da minuta final
          </p>
        ) : null}
      </div>
    </div>
  )
}

// ── MinutaCard ───────────────────────────────────────────────────────────────

function MinutaCard({ minuta, onAnalisar, onMelhorar, onGerarMinuta, analisando, melhorando, gerandoMinuta, melhorias, analiseLocal, autoExpand, onMelhoriasChange, pdfUrl, onEnviarAprovacao, enviandoAprovacao }: {
  minuta: Minuta
  onAnalisar: (m: Minuta) => void
  onMelhorar: (m: Minuta) => void
  onGerarMinuta?: (m: Minuta) => void
  analisando: boolean
  melhorando: boolean
  gerandoMinuta?: boolean
  melhorias?: MelhoriaMinuta | null
  analiseLocal?: MinutaAiAnalise | null
  autoExpand?: boolean
  onMelhoriasChange?: (minutaId: string, edited: MelhoriaMinuta) => void
  pdfUrl?: string | null
  onEnviarAprovacao?: () => void
  enviandoAprovacao?: boolean
}) {
  const [showAnalise, setShowAnalise] = useState(false)
  const [showMelhorias, setShowMelhorias] = useState(false)

  // Use local analysis if available (instant), otherwise from Supabase
  const analise = analiseLocal ?? minuta.ai_analise
  const hasAnalise = analise && typeof analise.score === 'number'

  // Auto-expand when analysis or melhorias arrive
  useEffect(() => {
    if (autoExpand && hasAnalise) setShowAnalise(true)
  }, [autoExpand, hasAnalise])

  useEffect(() => {
    if (melhorias) setShowMelhorias(true)
  }, [melhorias])

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
      hasAnalise ? 'border-indigo-200' : 'border-slate-200'
    }`}>
      {/* Card header */}
      <div className="p-4 pb-0">
        <div className="flex items-start gap-3">
          {/* Icon / Score ring toggle */}
          {hasAnalise ? (
            <div className="shrink-0">
              <ScoreRing score={analise!.score} size={44} strokeWidth={4} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <FileText size={16} className="text-indigo-600" />
            </div>
          )}
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
              {hasAnalise && melhorias && (
                <ScoreComparison before={analise!.score} after={melhorias.score_estimado} />
              )}
            </div>

            {minuta.descricao && (
              <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-snug">{minuta.descricao}</p>
            )}

            <div className="flex items-center justify-between mt-2.5">
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
          </div>
        </div>
      </div>

      {/* AI status bar — shows inline summary when analyzed */}
      {hasAnalise && !showAnalise && (
        <div className="mx-4 mt-3 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Brain size={11} className="text-indigo-500" />
              <span className="text-[10px] font-bold text-indigo-700">IA: Score {analise!.score}/100</span>
            </div>
            <span className="text-[10px] text-slate-500">•</span>
            <span className="text-[10px] text-red-600 font-semibold">{analise!.riscos?.length ?? 0} riscos</span>
            <span className="text-[10px] text-slate-500">•</span>
            <span className="text-[10px] text-amber-600 font-semibold">{analise!.sugestoes?.length ?? 0} sugestoes</span>
            {minuta.ai_analisado_em && (
              <span className="text-[9px] text-slate-400 ml-auto">{fmtDataHora(minuta.ai_analisado_em)}</span>
            )}
          </div>
        </div>
      )}

      {/* Analyzing animation */}
      {analisando && (
        <div className="mx-4 mt-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <Sparkles size={16} className="text-violet-600" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-violet-500 animate-ping" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-violet-800">Analisando minuta com IA...</p>
              <p className="text-[10px] text-violet-500 mt-0.5">Verificando clausulas, riscos, conformidade e sugestoes de melhoria</p>
            </div>
            <Loader2 size={18} className="text-violet-500 animate-spin" />
          </div>
          <div className="mt-2 h-1 rounded-full bg-violet-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {/* Melhorias status bar — shows inline summary when melhorias exist but collapsed */}
      {melhorias && !showMelhorias && !melhorando && (
        <div
          className="mx-4 mt-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 px-3.5 py-2.5 cursor-pointer
            hover:border-teal-200 hover:shadow-sm transition-all"
          onClick={() => setShowMelhorias(true)}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Wand2 size={11} className="text-teal-500" />
              <span className="text-[10px] font-bold text-teal-700">
                Melhorias IA: Score {melhorias.score_estimado}/100
              </span>
            </div>
            <span className="text-[10px] text-slate-500">•</span>
            <span className="text-[10px] text-teal-600 font-semibold">
              {melhorias.clausulas_melhoradas?.length ?? 0} melhorada{(melhorias.clausulas_melhoradas?.length ?? 0) !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-slate-500">•</span>
            <span className="text-[10px] text-blue-600 font-semibold">
              {melhorias.clausulas_novas?.length ?? 0} nova{(melhorias.clausulas_novas?.length ?? 0) !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-slate-500">•</span>
            <span className="text-[10px] text-emerald-600 font-semibold">
              {melhorias.riscos_mitigados?.length ?? 0} risco{(melhorias.riscos_mitigados?.length ?? 0) !== 1 ? 's' : ''} mitigado{(melhorias.riscos_mitigados?.length ?? 0) !== 1 ? 's' : ''}
            </span>
            {minuta.ai_melhorado_em && (
              <span className="text-[9px] text-slate-400 ml-auto">{fmtDataHora(minuta.ai_melhorado_em)}</span>
            )}
          </div>
          {pdfUrl && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <CheckCircle2 size={10} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600">PDF gerado — pronto para aprovacao</span>
            </div>
          )}
          <p className="text-[9px] text-teal-400 mt-1">Clique para expandir</p>
        </div>
      )}

      {/* Melhorando animation */}
      {melhorando && (
        <div className="mx-4 mt-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                <Wand2 size={16} className="text-teal-600" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-teal-500 animate-ping" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-teal-800">Melhorando minuta com IA...</p>
              <p className="text-[10px] text-teal-500 mt-0.5">Reescrevendo clausulas, mitigando riscos e adicionando protecoes</p>
            </div>
            <Loader2 size={18} className="text-teal-500 animate-spin" />
          </div>
          <div className="mt-2 h-1 rounded-full bg-teal-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
        {!analisando && (
          <button
            onClick={() => onAnalisar(minuta)}
            disabled={analisando || melhorando}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-bold
              bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm
              hover:from-violet-700 hover:to-indigo-700 hover:shadow-md transition-all disabled:opacity-50"
          >
            <Sparkles size={11} />
            {hasAnalise ? 'Re-analisar' : 'Analisar com IA'}
          </button>
        )}

        {hasAnalise && !melhorando && (
          <button
            onClick={() => onMelhorar(minuta)}
            disabled={melhorando || analisando}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-bold
              bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm
              hover:from-teal-700 hover:to-emerald-700 hover:shadow-md transition-all disabled:opacity-50"
          >
            <Wand2 size={11} />
            {melhorias ? 'Re-melhorar' : 'Melhorar com IA'}
          </button>
        )}

        {hasAnalise && (
          <button
            onClick={() => setShowAnalise(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition-all ${
              showAnalise
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}
          >
            {showAnalise ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {showAnalise ? 'Ocultar Analise' : 'Ver Analise'}
          </button>
        )}

        {melhorias && (
          <button
            onClick={() => setShowMelhorias(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition-all ${
              showMelhorias
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
            }`}
          >
            {showMelhorias ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {showMelhorias ? 'Ocultar Melhorias' : 'Ver Melhorias'}
          </button>
        )}
      </div>

      {/* Expanded panels */}
      {showAnalise && hasAnalise && (
        <div className="px-4 pb-4">
          <AnalisePanel
            analise={analise!}
            onMelhorar={!melhorias ? () => onMelhorar(minuta) : undefined}
            melhorando={melhorando}
          />
        </div>
      )}

      {showMelhorias && melhorias && (
        <div className="px-4 pb-4">
          <MelhoriasPanel
            melhorias={melhorias}
            scoreOriginal={analise?.score}
            onGerarMinuta={onGerarMinuta ? () => onGerarMinuta(minuta) : undefined}
            gerandoMinuta={gerandoMinuta}
            onMelhoriasChange={onMelhoriasChange ? (edited) => onMelhoriasChange(minuta.id, edited) : undefined}
            pdfUrl={pdfUrl}
            onEnviarAprovacao={onEnviarAprovacao}
            enviandoAprovacao={enviandoAprovacao}
          />
        </div>
      )}
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
  const uploadFile = useUploadMinutaFile()
  const melhorarMinuta = useMelhorarMinuta()
  const gerarMinutaPDF = useGerarMinutaPDF()

  // Form state
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoMinuta>('rascunho')
  const [descricao, setDescricao] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [formError, setFormError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [analisandoId, setAnalisandoId] = useState<string | null>(null)
  const [melhorandoId, setMelhorandoId] = useState<string | null>(null)
  const [melhoriasMap, setMelhoriasMap] = useState<Record<string, MelhoriaMinuta>>({})
  const [analiseMap, setAnaliseMap] = useState<Record<string, MinutaAiAnalise>>({})
  const [autoExpandId, setAutoExpandId] = useState<string | null>(null)
  const [gerandoMinutaId, setGerandoMinutaId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [editedMelhoriasMap, setEditedMelhoriasMap] = useState<Record<string, MelhoriaMinuta>>({})
  const [pdfUrlMap, setPdfUrlMap] = useState<Record<string, string>>({})

  const isLoading = loadingSol || loadingMinutas

  // ── Persist melhorias: load from DB when minutas arrive ────────────
  useEffect(() => {
    if (!minutas.length) return
    const newMelhorias: Record<string, MelhoriaMinuta> = {}
    const newAnalise: Record<string, MinutaAiAnalise> = {}
    const newPdfUrls: Record<string, string> = {}
    let changed = false

    for (const m of minutas) {
      // Restore melhorias from ai_melhorias (saved by useMelhorarMinuta)
      if (m.ai_melhorias && typeof m.ai_melhorias === 'object' && !melhoriasMap[m.id]) {
        newMelhorias[m.id] = m.ai_melhorias as unknown as MelhoriaMinuta
        changed = true
      }
      // Restore analise from ai_analise
      if (m.ai_analise && typeof m.ai_analise === 'object' && typeof m.ai_analise.score === 'number' && !analiseMap[m.id]) {
        newAnalise[m.id] = m.ai_analise
        changed = true
      }
      // Restore pdfUrl if minuta was already generated (status em_revisao and has pdf)
      if (m.status === 'em_revisao' && m.arquivo_url && m.arquivo_nome?.includes('minuta_melhorada') && !pdfUrlMap[m.id]) {
        newPdfUrls[m.id] = m.arquivo_url
        changed = true
      }
    }

    if (changed) {
      if (Object.keys(newMelhorias).length) setMelhoriasMap(prev => ({ ...prev, ...newMelhorias }))
      if (Object.keys(newAnalise).length) setAnaliseMap(prev => ({ ...prev, ...newAnalise }))
      if (Object.keys(newPdfUrls).length) setPdfUrlMap(prev => ({ ...prev, ...newPdfUrls }))
    }
  }, [minutas]) // eslint-disable-line react-hooks/exhaustive-deps

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400'
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1 block'

  const hasFinalMinuta = minutas.some(m => m.tipo === 'final')
  const nextVersion = minutas.length > 0 ? Math.max(...minutas.map(m => m.versao)) + 1 : 1

  const ACCEPTED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain',
  ]
  const ACCEPT_EXT = '.pdf,.doc,.docx,.odt,.txt'
  const MAX_SIZE_MB = 50

  const handleFileDrop = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const f = files[0]
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFormError(`Arquivo muito grande (max ${MAX_SIZE_MB}MB)`)
      return
    }
    setSelectedFile(f)
    setFormError('')
    // Auto-fill titulo if empty
    if (!titulo.trim()) {
      const nameNoExt = f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
      setTitulo(nameNoExt)
    }
  }

  const handleCriarMinuta = async () => {
    setFormError('')
    if (!titulo.trim()) return setFormError('Informe o titulo da minuta')
    if (!selectedFile) return setFormError('Selecione o arquivo da minuta')

    try {
      setUploadProgress('uploading')

      // 1. Upload file to Supabase Storage
      const uploaded = await uploadFile.mutateAsync({
        file: selectedFile,
        solicitacaoId: id!,
      })

      setUploadProgress('done')

      // 2. Create minuta record with uploaded URL
      await criarMinuta.mutateAsync({
        solicitacao_id: id!,
        titulo: titulo.trim(),
        tipo,
        descricao: descricao.trim() || undefined,
        arquivo_url: uploaded.arquivo_url,
        arquivo_nome: uploaded.arquivo_nome,
        versao: nextVersion,
      })

      // Reset form
      setTitulo('')
      setTipo('rascunho')
      setDescricao('')
      setSelectedFile(null)
      setUploadProgress('idle')
      setShowForm(false)
    } catch (e: unknown) {
      setUploadProgress('idle')
      setFormError(e instanceof Error ? e.message : 'Erro ao criar minuta')
    }
  }

  const handleAnalisarMinuta = async (minuta: Minuta) => {
    if (!solicitacao || analisandoId) return
    setAnalisandoId(minuta.id)
    try {
      const result = await analisarMinuta.mutateAsync({
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
      // Store analysis immediately in local state for instant display
      if (result.success && result.analise) {
        setAnaliseMap(prev => ({ ...prev, [minuta.id]: result.analise }))
        setAutoExpandId(minuta.id)
      }
    } catch {
      // Mutation error is handled by TanStack Query
    } finally {
      setAnalisandoId(null)
    }
  }

  const handleMelhorarMinuta = async (minuta: Minuta) => {
    if (!solicitacao || melhorandoId) return
    setMelhorandoId(minuta.id)
    try {
      // Use local analise first (may not be saved to Supabase yet), fallback to minuta.ai_analise
      const analise = analiseMap[minuta.id] ?? minuta.ai_analise ?? undefined
      const result = await melhorarMinuta.mutateAsync({
        solicitacao_id: solicitacao.id,
        minuta_id: minuta.id,
        arquivo_url: minuta.arquivo_url ?? undefined,
        titulo: minuta.titulo,
        analise,
        contexto: {
          objeto: solicitacao.objeto,
          contraparte: solicitacao.contraparte_nome,
          valor: solicitacao.valor_estimado ?? undefined,
          tipo_contrato: solicitacao.tipo_contrato,
          data_inicio: solicitacao.data_inicio_prevista ?? undefined,
          data_fim: solicitacao.data_fim_prevista ?? undefined,
          obra: solicitacao.obra?.nome ?? undefined,
        },
      })
      if (result.success && result.melhorias) {
        setMelhoriasMap(prev => ({ ...prev, [minuta.id]: result.melhorias }))
      }
    } catch {
      // Mutation error handled by TanStack Query
    } finally {
      setMelhorandoId(null)
    }
  }

  const handleMelhoriasChange = async (minutaId: string, edited: MelhoriaMinuta) => {
    setEditedMelhoriasMap(prev => ({ ...prev, [minutaId]: edited }))
    // Also persist to melhoriasMap so it's available for PDF generation
    setMelhoriasMap(prev => ({ ...prev, [minutaId]: edited }))
    // Persist edited melhorias to Supabase
    const { error } = await supabase
      .from('con_minutas')
      .update({ ai_melhorias: edited as unknown as Record<string, unknown>, ai_melhorado_em: new Date().toISOString() })
      .eq('id', minutaId)
    if (error) {
      console.error('Erro ao salvar melhorias:', error)
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

  const handleGerarNovaMinuta = async (minuta: Minuta) => {
    if (gerandoMinutaId || !solicitacao) return
    const mel = editedMelhoriasMap[minuta.id] ?? melhoriasMap[minuta.id]
    if (!mel) return
    setGerandoMinutaId(minuta.id)
    try {
      // ── Helper: build PDF from AI-generated structured text ──────────
      const buildPdfFromAi = (mtRaw: MinutaTextoGerado) => {
        // Normalize field names: n8n returns secoes/clausulas_finais/local_assinatura
        // but older code used clausulas/disposicoes_finais/local_data — accept both
        const clausulas = (mtRaw.secoes ?? mtRaw.clausulas ?? []).map((s, i) => ({
          numero: ('numero' in s && s.numero) ? s.numero : `CLAUSULA ${String(i + 1).padStart(2, '0')}`,
          titulo: s.titulo,
          conteudo: s.conteudo,
        }))
        const disposicoes = mtRaw.clausulas_finais ?? mtRaw.disposicoes_finais ?? ''
        const localAssinatura = mtRaw.local_assinatura ?? mtRaw.local_data ?? ''

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const pw = pdf.internal.pageSize.getWidth()
        const ph = pdf.internal.pageSize.getHeight()
        const mx = 20; const usable = pw - 2 * mx
        let y = 25; const lineH = 5; const gapSm = 3; const gapMd = 8; const gapLg = 14
        const ensureSpace = (need: number) => { if (y + need > ph - 20) { pdf.addPage(); y = 20 } }
        const printText = (text: string, fontSize: number, opts?: { bold?: boolean; color?: [number,number,number]; indent?: number }) => {
          pdf.setFont('helvetica', opts?.bold ? 'bold' : 'normal'); pdf.setFontSize(fontSize)
          const col = opts?.color ?? [30, 30, 30]; pdf.setTextColor(col[0], col[1], col[2])
          const ind = opts?.indent ?? 0
          for (const line of pdf.splitTextToSize(text, usable - ind)) { ensureSpace(lineH + 1); pdf.text(line, mx + ind, y); y += lineH }
        }
        const hr = (color?: [number,number,number]) => {
          ensureSpace(4); const c = color ?? [200, 200, 200]
          pdf.setDrawColor(c[0], c[1], c[2]); pdf.setLineWidth(0.3); pdf.line(mx, y, pw - mx, y); y += 3
        }

        // HEADER
        pdf.setFillColor(15, 118, 110); pdf.rect(0, 0, pw, 40, 'F')
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(200, 240, 230); pdf.text('TEG+', mx, 12)
        pdf.setFontSize(18); pdf.setTextColor(255, 255, 255); pdf.text('MINUTA CONTRATUAL', pw / 2, 18, { align: 'center' })
        pdf.setFontSize(10); pdf.setTextColor(200, 240, 230)
        pdf.text(pdf.splitTextToSize(`${minuta.titulo} — Versao Melhorada via IA`, usable), pw / 2, 28, { align: 'center' })
        y = 50

        // INFO BOX
        pdf.setFillColor(245, 248, 250); pdf.roundedRect(mx, y, usable, 32, 2, 2, 'F')
        const bxY = y + 6
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text('OBJETO', mx + 4, bxY)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(30, 41, 59)
        pdf.text(pdf.splitTextToSize(solicitacao.objeto, usable / 2 - 8).slice(0, 2), mx + 4, bxY + 5)
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text('CONTRAPARTE', usable / 2 + mx + 4, bxY)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(30, 41, 59); pdf.text(solicitacao.contraparte_nome, usable / 2 + mx + 4, bxY + 5)
        if (solicitacao.valor_estimado) {
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text('VALOR', usable / 2 + mx + 4, bxY + 14)
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(15, 118, 110); pdf.text(fmt(solicitacao.valor_estimado), usable / 2 + mx + 4, bxY + 19)
        }
        const dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text('DATA', mx + 4, bxY + 14)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(30, 41, 59); pdf.text(dataStr, mx + 4, bxY + 19)
        y += 38

        // Score badge
        if (mel.score_estimado) {
          ensureSpace(12)
          const sc: [number,number,number] = mel.score_estimado >= 80 ? [16, 185, 129] : mel.score_estimado >= 60 ? [245, 158, 11] : [239, 68, 68]
          pdf.setFillColor(sc[0], sc[1], sc[2]); pdf.roundedRect(mx, y, 50, 8, 2, 2, 'F')
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(255, 255, 255)
          pdf.text(`SCORE: ${mel.score_estimado}/100`, mx + 25, y + 5.5, { align: 'center' }); y += 12
        }

        // PREAMBULO
        if (mtRaw.preambulo) { printText(mtRaw.preambulo, 9, { color: [30, 41, 59] }); y += gapLg }

        // CLAUSULAS (AI-generated — normalized from secoes/clausulas)
        if (clausulas.length) {
          hr([15, 118, 110]); y += gapSm
          for (const cl of clausulas) {
            ensureSpace(20)
            printText(`${cl.numero} — ${cl.titulo}`, 11, { bold: true, color: [15, 118, 110] }); y += gapSm
            printText(cl.conteudo, 9, { color: [30, 41, 59], indent: 2 }); y += gapLg
          }
        }

        // DISPOSICOES FINAIS / CLAUSULAS FINAIS
        if (disposicoes) {
          hr([100, 116, 139]); y += gapSm
          printText('DISPOSICOES FINAIS', 11, { bold: true, color: [71, 85, 105] }); y += gapSm
          printText(disposicoes, 9, { color: [30, 41, 59] }); y += gapLg
        }

        // SIGNATURE BLOCK
        ensureSpace(50); hr(); y += gapMd
        const localData = localAssinatura || `${solicitacao.obra?.nome ?? 'Local'}, ${dataStr}`
        printText(localData, 9, { color: [100, 116, 139] }); y += 20
        const sigW = usable / 2 - 10
        pdf.setDrawColor(100, 116, 139); pdf.setLineWidth(0.2)
        pdf.line(mx, y, mx + sigW, y); pdf.line(pw - mx - sigW, y, pw - mx, y); y += 5
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(71, 85, 105)
        pdf.text('CONTRATANTE', mx + sigW / 2, y, { align: 'center' }); pdf.text('CONTRATADA', pw - mx - sigW / 2, y, { align: 'center' }); y += 4
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184)
        pdf.text('TEG Uniao Engenharia', mx + sigW / 2, y, { align: 'center' }); pdf.text(solicitacao.contraparte_nome, pw - mx - sigW / 2, y, { align: 'center' })
        // Testemunhas
        y += 20; ensureSpace(20); pdf.setDrawColor(148, 163, 184); pdf.setLineWidth(0.15)
        pdf.line(mx, y, mx + sigW, y); pdf.line(pw - mx - sigW, y, pw - mx, y); y += 4
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184)
        pdf.text('Testemunha 1', mx + sigW / 2, y, { align: 'center' }); pdf.text('Testemunha 2', pw - mx - sigW / 2, y, { align: 'center' })

        // FOOTER
        const totalPages = pdf.getNumberOfPages()
        for (let p = 1; p <= totalPages; p++) {
          pdf.setPage(p); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(148, 163, 184)
          pdf.text('TEG+ ERP — Minuta gerada por IA', mx, ph - 8); pdf.text(`Pagina ${p} de ${totalPages}`, pw - mx, ph - 8, { align: 'right' })
        }
        return pdf
      }

      // ── Helper: fallback PDF — formal contract from melhorias (when AI unavailable) ──
      const buildPdfFallback = () => {
        // Build a MinutaTextoGerado-like structure from the melhorias data
        const dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
        const valorStr = solicitacao.valor_estimado ? fmt(solicitacao.valor_estimado) : 'conforme proposta'
        const cnpjContraparte = solicitacao.contraparte_cnpj || 'conforme cadastro'

        const preambulo = `Pelo presente instrumento particular, de um lado, TEG UNIAO ENGENHARIA LTDA, pessoa juridica de direito privado, inscrita no CNPJ sob o no 10.482.352/0001-18, com sede na Rua Bernardo Guimaraes, 245, Sala 301, Funcionarios, Belo Horizonte/MG, CEP 30140-080, neste ato representada por seu Diretor, Leandro Mallet, doravante denominada CONTRATANTE; e, de outro lado, ${solicitacao.contraparte_nome}, inscrita no CNPJ sob o no ${cnpjContraparte}, doravante denominada CONTRATADA; tem entre si justo e contratado o presente instrumento, que se regera pelas clausulas e condicoes seguintes.`

        // Build clausulas from melhorias
        const secoes: Array<{ titulo: string; conteudo: string }> = []
        let num = 1

        // Objeto
        secoes.push({ titulo: `CLAUSULA ${num++} - DO OBJETO`, conteudo: `O presente Contrato tem por objeto ${solicitacao.objeto}.${solicitacao.descricao_escopo ? ' ' + solicitacao.descricao_escopo : ''}` })

        // Preco
        secoes.push({ titulo: `CLAUSULA ${num++} - DO PRECO E CONDICOES DE PAGAMENTO`, conteudo: `Pela execucao dos servicos, a CONTRATANTE pagara a CONTRATADA o valor global de ${valorStr}.${solicitacao.forma_pagamento ? ' Forma de pagamento: ' + solicitacao.forma_pagamento + '.' : ' O pagamento sera efetuado mediante medicoes mensais, no prazo de 30 dias.'}` })

        // Prazo
        const prazoTxt = solicitacao.prazo_meses ? `${solicitacao.prazo_meses} meses` : 'conforme cronograma aprovado'
        secoes.push({ titulo: `CLAUSULA ${num++} - DO PRAZO`, conteudo: `O prazo para execucao dos servicos e de ${prazoTxt}, contados a partir da assinatura deste instrumento ou emissao da Ordem de Servico.` })

        // Add all melhorias clausulas_melhoradas as formal contract clauses
        if (mel.clausulas_melhoradas?.length) {
          for (const c of mel.clausulas_melhoradas) {
            secoes.push({ titulo: `CLAUSULA ${num++} - ${c.nome.toUpperCase()}`, conteudo: c.texto_melhorado })
          }
        }

        // Add clausulas_novas
        if (mel.clausulas_novas?.length) {
          for (const c of mel.clausulas_novas) {
            secoes.push({ titulo: `CLAUSULA ${num++} - ${c.nome.toUpperCase()}`, conteudo: c.texto })
          }
        }

        // Foro
        const disposicoes = `As Partes elegem o foro da Comarca de Belo Horizonte, Estado de Minas Gerais, para dirimir quaisquer duvidas ou litigios decorrentes deste Contrato.`
        const localAssinatura = `Belo Horizonte, ${dataStr}.\n\n_______________\nTEG UNIAO ENGENHARIA LTDA\nLeandro Mallet - Diretor\nCNPJ: 10.482.352/0001-18\n\n_______________\n${solicitacao.contraparte_nome}\nCNPJ: ${cnpjContraparte}\n\nTESTEMUNHAS:\n1. _______________\nNome:\nCPF:\n\n2. _______________\nNome:\nCPF:`

        // Reuse buildPdfFromAi with the constructed data
        return buildPdfFromAi({ preambulo, secoes, clausulas_finais: disposicoes, local_assinatura: localAssinatura })
      }

      // ── Step 1: Try n8n AI, fallback to local ───────────────────────
      let pdf: jsPDF | null = null
      try {
        const aiResult = await gerarMinutaPDF.mutateAsync({
          titulo: minuta.titulo,
          objeto: solicitacao.objeto,
          descricao_escopo: solicitacao.descricao_escopo ?? undefined,
          contraparte: solicitacao.contraparte_nome,
          contraparte_cnpj: solicitacao.contraparte_cnpj ?? undefined,
          contraparte_email: solicitacao.contraparte_email ?? undefined,
          contraparte_telefone: solicitacao.contraparte_telefone ?? undefined,
          valor: solicitacao.valor_estimado ?? undefined,
          forma_pagamento: solicitacao.forma_pagamento ?? undefined,
          prazo_meses: solicitacao.prazo_meses ?? undefined,
          data_inicio_prevista: solicitacao.data_inicio_prevista ?? undefined,
          data_fim_prevista: solicitacao.data_fim_prevista ?? undefined,
          indice_reajuste: solicitacao.indice_reajuste ?? undefined,
          tipo_contrato: solicitacao.tipo_contrato ?? undefined,
          categoria_contrato: solicitacao.categoria_contrato ?? undefined,
          obra_nome: solicitacao.obra?.nome ?? undefined,
          centro_custo: solicitacao.centro_custo ?? undefined,
          justificativa: solicitacao.justificativa ?? undefined,
          melhorias: mel,
        })
        if (aiResult.success && aiResult.minuta_texto) {
          pdf = buildPdfFromAi(aiResult.minuta_texto)
        }
      } catch (n8nErr) {
        console.warn('n8n AI generation failed, falling back to local PDF:', n8nErr)
      }
      if (!pdf) {
        pdf = buildPdfFallback()
      }

      // ── Step 2: Upload to Supabase Storage ──────────────────────────
      const pdfBlob = pdf.output('blob')
      const safeName = minuta.titulo.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 40)
      const pdfFile = new File([pdfBlob], `minuta_melhorada_${safeName}.pdf`, { type: 'application/pdf' })

      const uploaded = await uploadFile.mutateAsync({
        file: pdfFile,
        solicitacaoId: solicitacao.id,
      })

      await supabase
        .from('con_minutas')
        .update({
          arquivo_url: uploaded.arquivo_url,
          arquivo_nome: pdfFile.name,
          tamanho_bytes: pdfFile.size,
          status: 'em_revisao',
        })
        .eq('id', minuta.id)

      setPdfUrlMap(prev => ({ ...prev, [minuta.id]: uploaded.arquivo_url }))

    } catch (e) {
      console.error('Erro ao gerar minuta PDF:', e)
      alert(e instanceof Error ? e.message : 'Erro ao gerar minuta PDF')
    } finally {
      setGerandoMinutaId(null)
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

              {/* Drag & Drop file zone */}
              <div>
                <label className={labelClass}>Arquivo da Minuta *</label>
                {!selectedFile ? (
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFileDrop(e.dataTransfer.files) }}
                    onClick={() => {
                      const inp = document.createElement('input')
                      inp.type = 'file'
                      inp.accept = ACCEPT_EXT
                      inp.onchange = () => handleFileDrop(inp.files)
                      inp.click()
                    }}
                    className={`flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed
                      cursor-pointer transition-all ${
                        isDragOver
                          ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]'
                          : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-all ${
                      isDragOver ? 'bg-indigo-100' : 'bg-white border border-slate-200'
                    }`}>
                      <FileUp size={20} className={isDragOver ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">
                      {isDragOver ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para selecionar'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      PDF, DOC, DOCX, ODT, TXT — max {MAX_SIZE_MB}MB
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-800 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-emerald-600">
                        {fmtBytes(selectedFile.size)} — {selectedFile.type || 'documento'}
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedFile(null); setUploadProgress('idle') }}
                      className="w-7 h-7 rounded-lg bg-white border border-emerald-200 flex items-center
                        justify-center text-emerald-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200
                        transition-all shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
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
                  <label className={labelClass}>Arquivo selecionado</label>
                  <input
                    value={selectedFile?.name ?? 'Nenhum arquivo'}
                    disabled
                    className={`${inputClass} bg-slate-50 text-slate-500`}
                  />
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
                disabled={criarMinuta.isPending || uploadProgress === 'uploading'}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600
                  text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm
                  disabled:opacity-50"
              >
                {uploadProgress === 'uploading' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Enviando arquivo...
                  </>
                ) : criarMinuta.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Enviar Minuta
                  </>
                )}
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
                  onMelhorar={handleMelhorarMinuta}
                  onGerarMinuta={handleGerarNovaMinuta}
                  analisando={analisandoId === m.id}
                  melhorando={melhorandoId === m.id}
                  gerandoMinuta={gerandoMinutaId === m.id}
                  melhorias={melhoriasMap[m.id]}
                  analiseLocal={analiseMap[m.id]}
                  autoExpand={autoExpandId === m.id}
                  onMelhoriasChange={handleMelhoriasChange}
                  pdfUrl={pdfUrlMap[m.id]}
                  onEnviarAprovacao={pdfUrlMap[m.id] ? handleAvancarResumo : undefined}
                  enviandoAprovacao={avancarEtapa.isPending}
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
