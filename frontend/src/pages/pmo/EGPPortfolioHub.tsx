import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, GitBranch, CalendarDays, BarChart3, Users, DollarSign, Upload, Sparkles, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { useState, useRef, useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolios, useParseOSC, useConfirmarOSC } from '../../hooks/usePMO'
import type { OSCParsed } from '../../hooks/usePMO'
import { supabase } from '../../services/supabase'

/**
 * Reusable hub page that shows portfolio cards and links to a specific EGP sub-screen.
 * Used for screens that require a portfolioId (EAP, Cronograma, Medições, Histograma, Custos).
 */

interface EGPPortfolioHubProps {
  /** Screen identifier - appended to /egp/{screen}/{portfolioId} */
  screen: string
  /** Page title */
  title: string
  /** Lucide icon component */
  icon: React.ElementType
  /** Accent color class */
  accent?: string
  /** Description shown under the title */
  description?: string
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

const STATUS_MAP: Record<string, { label: string; light: string; dark: string }> = {
  em_analise_ate:   { label: 'Em Análise ATE',  light: 'bg-amber-100 text-amber-700',    dark: 'bg-amber-500/15 text-amber-400' },
  revisao_cliente:  { label: 'Revisão Cliente',  light: 'bg-purple-100 text-purple-700',  dark: 'bg-purple-500/15 text-purple-400' },
  liberado_iniciar: { label: 'Liberado Iniciar', light: 'bg-blue-100 text-blue-700',      dark: 'bg-blue-500/15 text-blue-400' },
  obra_andamento:   { label: 'Em Andamento',     light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  obra_paralisada:  { label: 'Paralisada',       light: 'bg-red-100 text-red-700',        dark: 'bg-red-500/15 text-red-400' },
  obra_concluida:   { label: 'Concluída',        light: 'bg-slate-100 text-slate-600',    dark: 'bg-slate-500/15 text-slate-400' },
  cancelada:        { label: 'Cancelada',         light: 'bg-gray-100 text-gray-500',     dark: 'bg-gray-500/15 text-gray-400' },
}

// ── Upload helpers ──────────────────────────────────────────────────────────
const ACCEPTED_OSC = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_OSC = 50 * 1024 * 1024
const STORAGE_THRESHOLD_OSC = 8 * 1024 * 1024

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadToTempStorage(file: File): Promise<{ path: string; url: string }> {
  const ext = file.name.split('.').pop() || 'pdf'
  const path = `osc-parse/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('temp-uploads').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Upload falhou: ${error.message}`)
  const { data } = supabase.storage.from('temp-uploads').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

type UploadStep = 'idle' | 'uploading' | 'parsing' | 'review' | 'saving' | 'done' | 'error'

export default function EGPPortfolioHub({
  screen, title, icon: Icon, accent = 'text-blue-500', description,
}: EGPPortfolioHubProps) {
  const { isLightSidebar: isLight } = useTheme()
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data: portfolios, isLoading } = usePortfolios()

  const filtered = (portfolios ?? []).filter(p =>
    p.nome_obra.toLowerCase().includes(search.toLowerCase()) ||
    p.numero_osc.toLowerCase().includes(search.toLowerCase())
  )

  const activePortfolios = filtered.filter(p => !['cancelada', 'obra_concluida'].includes(p.status))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Icon size={22} className={accent} />
            {title}
          </h1>
          {description && (
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {description}
            </p>
          )}
        </div>

        {/* Search + Upload */}
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-60">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar contrato..."
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm transition-all ${
                isLight
                  ? 'bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
                  : 'bg-slate-800/60 border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-white'
              } focus:outline-none`}
            />
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md ${
              isLight
                ? 'bg-teal-500 text-white hover:bg-teal-600 shadow-teal-500/20'
                : 'bg-teal-500 text-white hover:bg-teal-600 shadow-teal-500/20'
            }`}
          >
            <Upload size={14} /> Upload OSC
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 text-sm ${
        isLight ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      }`}>
        <Icon size={16} />
        Selecione um contrato para acessar {title.toLowerCase()}
      </div>

      {/* Portfolio Grid */}
      {activePortfolios.length === 0 ? (
        <div className={`text-center py-12 rounded-2xl border ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-800/40 border-slate-700 text-slate-400'
        }`}>
          <Icon size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum contrato encontrado</p>
          <p className="text-sm mt-1 opacity-70">Cadastre um contrato no Painel EGP para começar</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activePortfolios.map(p => {
            const st = STATUS_MAP[p.status] ?? STATUS_MAP.obra_andamento
            const progresso = p.valor_total_osc > 0
              ? p.valor_faturado / p.valor_total_osc
              : 0

            return (
              <button
                key={p.id}
                onClick={() => nav(`/egp/${screen}/${p.id}`)}
                className={`group text-left rounded-2xl border p-4 transition-all duration-200 ${
                  isLight
                    ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10'
                    : 'bg-slate-800/50 border-slate-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
                }`}
              >
                {/* Top row: name + status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-sm truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {p.nome_obra}
                    </h3>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {p.numero_osc}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? st.light : st.dark}`}>
                    {st.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className={`h-1.5 rounded-full overflow-hidden mb-3 ${isLight ? 'bg-slate-100' : 'bg-slate-700'}`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                    style={{ width: `${Math.min(progresso * 100, 100)}%` }}
                  />
                </div>

                {/* Metrics */}
                <div className="flex items-center justify-between text-xs">
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    {fmtPct(progresso)} faturado
                  </span>
                  <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                    {fmt(p.valor_total_osc)}
                  </span>
                </div>

                {/* Arrow */}
                <div className={`flex items-center gap-1 mt-3 text-xs font-medium transition-colors ${
                  isLight
                    ? 'text-blue-500 group-hover:text-blue-600'
                    : 'text-blue-400 group-hover:text-blue-300'
                }`}>
                  Acessar {title} <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Upload OSC Modal */}
      {uploadOpen && (
        <UploadOSCModal isLight={isLight} onClose={() => setUploadOpen(false)} onCreated={(id) => {
          setUploadOpen(false)
          nav(`/egp/iniciacao/${id}`)
        }} />
      )}
    </div>
  )
}

// ── Upload OSC Modal ────────────────────────────────────────────────────────

function UploadOSCModal({ isLight, onClose, onCreated }: { isLight: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<UploadStep>('idle')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<OSCParsed | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const parseOSC = useParseOSC()
  const confirmar = useConfirmarOSC()

  const reset = useCallback(() => {
    setStep('idle'); setFileName(''); setError(''); setParsed(null); setDragOver(false)
  }, [])

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_OSC.includes(file.type)) { setError('Use PDF, JPG, PNG ou WebP.'); setStep('error'); return }
    if (file.size > MAX_SIZE_OSC) { setError('Máximo 50 MB.'); setStep('error'); return }
    setFileName(file.name); setStep('uploading'); setError('')
    try {
      let payload: { file_base64?: string; file_url?: string; file_name: string; mime_type: string }
      if (file.size > STORAGE_THRESHOLD_OSC) {
        const { url } = await uploadToTempStorage(file)
        payload = { file_url: url, file_name: file.name, mime_type: file.type }
      } else {
        const b64 = await fileToBase64(file)
        payload = { file_base64: b64, file_name: file.name, mime_type: file.type }
      }
      setStep('parsing')
      const result = await parseOSC.mutateAsync(payload)
      setParsed(result); setStep('review')
    } catch (err: any) { setError(err?.message || 'Erro ao processar OSC'); setStep('error') }
  }, [parseOSC])

  const handleConfirm = useCallback(async () => {
    if (!parsed) return
    setStep('saving')
    try {
      const portfolio = await confirmar.mutateAsync(parsed)
      setStep('done')
      setTimeout(() => onCreated(portfolio.id), 1200)
    } catch (err: any) { setError(err?.message || 'Erro ao salvar'); setStep('error') }
  }, [parsed, confirmar, onCreated])

  const fmtV = (v: number | undefined) =>
    v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '-'

  const cardCls = isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-800 border-slate-700 text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${cardCls}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-teal-500" />
            <h2 className="text-sm font-bold">Upload de OSC</h2>
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-700'}`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {(step === 'idle' || step === 'error') && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                  dragOver
                    ? 'border-teal-400 bg-teal-50/50'
                    : isLight
                      ? 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
                      : 'border-slate-600 hover:border-teal-500/50 hover:bg-white/[0.02]'
                }`}
              >
                <Upload size={28} className={dragOver ? 'text-teal-500' : isLight ? 'text-slate-300' : 'text-slate-500'} />
                <div className="text-center">
                  <p className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                    Arraste o PDF da OSC aqui
                  </p>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    ou clique para selecionar — PDF, JPG, PNG (até 50 MB)
                  </p>
                </div>
                <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }} />
              </div>
              {step === 'error' && (
                <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${isLight ? 'bg-red-50 text-red-600' : 'bg-red-500/10 text-red-400'}`}>
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
              <p className={`text-xs mt-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                A IA (Gemini 2.5 Flash) vai extrair os dados da OSC e gerar uma TAP automaticamente. Você revisa antes de confirmar.
              </p>
            </div>
          )}

          {(step === 'uploading' || step === 'parsing') && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={32} className="text-teal-500 animate-spin" />
              <div className="text-center">
                <p className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>
                  {step === 'uploading' ? 'Enviando arquivo...' : 'Analisando OSC com Gemini 2.5 Flash...'}
                </p>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{fileName}</p>
              </div>
            </div>
          )}

          {step === 'review' && parsed && (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 space-y-2 ${isLight ? 'bg-slate-50 border-slate-100' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Contrato / OSC</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nome da obra</p>
                    <p className="font-medium">{parsed.portfolio.nome_obra || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nº OSC</p>
                    <p className="font-medium">{parsed.portfolio.numero_osc || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Tipo</p>
                    <p className="font-medium capitalize">{parsed.portfolio.tipo_osc || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Valor Total</p>
                    <p className="font-medium">{fmtV(parsed.portfolio.valor_total_osc)}</p>
                  </div>
                </div>
              </div>
              <div className={`rounded-xl border p-4 space-y-2 ${isLight ? 'bg-slate-50 border-slate-100' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>TAP Gerada</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Projeto</p>
                    <p className="font-medium">{parsed.tap.nome_projeto || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Cliente</p>
                    <p className="font-medium">{parsed.tap.cliente || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Objetivo</p>
                    <p className="font-medium line-clamp-2">{parsed.tap.objetivo || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={32} className="text-teal-500 animate-spin" />
              <p className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>Registrando contrato e TAP...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle size={32} className="text-emerald-500" />
              <p className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>Contrato registrado com sucesso!</p>
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Redirecionando para Iniciação...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'review' && (
          <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
            <button onClick={reset}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-700 text-slate-300'}`}>
              Cancelar
            </button>
            <button onClick={handleConfirm}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/20 flex items-center gap-1.5">
              <CheckCircle size={14} /> Confirmar e Cadastrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
