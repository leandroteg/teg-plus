import { useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, AlertTriangle, Zap,
  TrendingUp, Clock, MapPin, Activity, DollarSign,
  CalendarClock, BarChart3, ChevronRight,
  Upload, FileText, Loader2, CheckCircle, X, Sparkles,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { usePortfolios, useParseOSC, useConfirmarOSC } from '../../hooks/usePMO'
import type { OSCParsed } from '../../hooks/usePMO'
import { useLookupObras } from '../../hooks/useLookups'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'
import type { PMOPortfolio, StatusPortfolio } from '../../types/pmo'

// ── Formatadores ─────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtPct = (v: number) => `${v.toFixed(1)}%`

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

const fmtDataHora = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Array<{ key: StatusPortfolio; label: string; barClass: string }> = [
  { key: 'em_analise_ate', label: 'Em Análise ATE', barClass: 'bg-amber-400' },
  { key: 'revisao_cliente', label: 'Revisão Cliente', barClass: 'bg-violet-500' },
  { key: 'liberado_iniciar', label: 'Liberado Iniciar', barClass: 'bg-blue-500' },
  { key: 'obra_andamento', label: 'Em Andamento', barClass: 'bg-emerald-500' },
  { key: 'obra_paralisada', label: 'Paralisada', barClass: 'bg-red-500' },
  { key: 'obra_concluida', label: 'Concluída', barClass: 'bg-slate-400' },
]

const STATUS_LABEL: Record<string, string> = {
  em_analise_ate: 'Em Análise ATE',
  revisao_cliente: 'Revisão Cliente',
  liberado_iniciar: 'Liberado Iniciar',
  obra_andamento: 'Em Andamento',
  obra_paralisada: 'Paralisada',
  obra_concluida: 'Concluída',
  cancelada: 'Cancelada',
}

// ── toneClasses helper ────────────────────────────────────────────────────────
function toneClasses(
  tone: 'sky' | 'emerald' | 'cyan' | 'amber' | 'teal' | 'orange' | 'blue' | 'violet' | 'red' | 'slate' | 'indigo'
) {
  const map = {
    sky:     { text: 'text-sky-600',     soft: 'bg-sky-50 text-sky-700 border-sky-100',             icon: 'bg-sky-50 text-sky-500'     },
    emerald: { text: 'text-emerald-600', soft: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'bg-emerald-50 text-emerald-500' },
    cyan:    { text: 'text-cyan-600',    soft: 'bg-cyan-50 text-cyan-700 border-cyan-100',           icon: 'bg-cyan-50 text-cyan-500'   },
    amber:   { text: 'text-amber-600',   soft: 'bg-amber-50 text-amber-700 border-amber-100',       icon: 'bg-amber-50 text-amber-500' },
    teal:    { text: 'text-teal-600',    soft: 'bg-teal-50 text-teal-700 border-teal-100',           icon: 'bg-teal-50 text-teal-500'   },
    orange:  { text: 'text-orange-600',  soft: 'bg-orange-50 text-orange-700 border-orange-100',    icon: 'bg-orange-50 text-orange-500' },
    blue:    { text: 'text-blue-600',    soft: 'bg-blue-50 text-blue-700 border-blue-100',           icon: 'bg-blue-50 text-blue-500'   },
    violet:  { text: 'text-violet-600',  soft: 'bg-violet-50 text-violet-700 border-violet-100',    icon: 'bg-violet-50 text-violet-500' },
    red:     { text: 'text-red-600',     soft: 'bg-red-50 text-red-700 border-red-100',             icon: 'bg-red-50 text-red-500'     },
    slate:   { text: 'text-slate-500',   soft: 'bg-slate-50 text-slate-600 border-slate-100',       icon: 'bg-slate-50 text-slate-400' },
    indigo:  { text: 'text-indigo-600',  soft: 'bg-indigo-50 text-indigo-700 border-indigo-100',    icon: 'bg-indigo-50 text-indigo-500' },
  } as const
  return map[tone]
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function SpotlightMetric({
  label, value, note, tone,
}: {
  label: string
  value: number | string
  note: string
  tone: 'sky' | 'emerald' | 'cyan' | 'amber' | 'teal' | 'slate' | 'indigo' | 'orange' | 'blue' | 'violet' | 'red'
}) {
  const { isDark } = useTheme()
  const palette = toneClasses(tone)
  return (
    <div className={`rounded-2xl border px-3.5 py-2.5 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : `${palette.soft} border`}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1.5 text-[1.85rem] leading-none font-black ${palette.text}`}>{value}</p>
      <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{note}</p>
    </div>
  )
}

function HorizontalStatusBar({
  title, segments, emptyLabel, isDark, totalLabel,
}: {
  title: string
  segments: Array<{ key: string; label: string; value: number; barClass: string }>
  emptyLabel: string
  isDark: boolean
  totalLabel?: string
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} {totalLabel ?? 'OSC(s)'}</p>
      </div>
      {segments.length === 0 ? (
        <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
          {emptyLabel}
        </div>
      ) : (
        <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          {segments.map(seg => {
            const pct = (seg.value / total) * 100
            const showLabel = pct >= 14
            const showValue = pct >= 22
            return (
              <div
                key={seg.key}
                className={`${seg.barClass} relative flex items-center justify-center transition-all`}
                style={{ width: `${Math.max(pct, 4)}%` }}
                title={`${seg.label}: ${seg.value}`}
              >
                {showLabel && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-2">
                    {seg.label} {showValue ? seg.value : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiniInfoCard({
  label, value, note, icon: Icon, iconTone, isDark,
}: {
  label: string; value: number; note: string
  icon: typeof AlertTriangle; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-slate-50/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
          <p className={`mt-1.5 text-[1.85rem] leading-none font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
          <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{note}</p>
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-white'}`}>
          <Icon size={14} className={iconTone} />
        </div>
      </div>
    </div>
  )
}

function EmptyPanel({ isDark, title, description }: { isDark: boolean; title: string; description: string }) {
  return (
    <div className={`px-4 py-6 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
      <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{title}</p>
      <p className="text-[10px] mt-1">{description}</p>
    </div>
  )
}

function Loader() {
  const { isDark } = useTheme()
  return (
    <div className="flex items-center justify-center py-20">
      <div className={`w-8 h-8 border-[3px] border-t-transparent rounded-full animate-spin ${isDark ? 'border-teal-400' : 'border-teal-500'}`} />
    </div>
  )
}

// ── Hooks auxiliares (queries inline) ────────────────────────────────────────

function useEGPKpis(obraFilter: string) {
  return useQuery({
    queryKey: ['egp-kpis', obraFilter],
    queryFn: async () => {
      // Riscos criticos
      let riscosQ = supabase
        .from('pmo_riscos')
        .select('id', { count: 'exact', head: true })
        .in('probabilidade', ['alta', 'muito_alta'])
        .in('impacto', ['alto', 'muito_alto'])
        .eq('status', 'aberto')

      // Acoes criticas (prazo vencido + pendente)
      let acoesQ = supabase
        .from('pmo_plano_acao')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .lt('prazo', new Date().toISOString())

      // Indicadores snapshot (latest per portfolio for IDP)
      let indicadoresQ = supabase
        .from('pmo_indicadores_snapshot')
        .select('portfolio_id, idp, pct_valor_executado')
        .order('data_snapshot', { ascending: false })

      if (obraFilter) {
        // Need to filter by obra_id through portfolio
        const { data: portIds } = await supabase
          .from('pmo_portfolio')
          .select('id')
          .eq('obra_id', obraFilter)
        const ids = (portIds ?? []).map(p => p.id)
        if (ids.length > 0) {
          riscosQ = riscosQ.in('portfolio_id', ids)
          acoesQ = acoesQ.in('portfolio_id', ids)
          indicadoresQ = indicadoresQ.in('portfolio_id', ids)
        } else {
          return { riscosCriticos: 0, acoesCriticas: 0, indicadores: [] as Array<{ portfolio_id: string | null; idp: number | null; pct_valor_executado: number | null }> }
        }
      }

      const [riscosRes, acoesRes, indicadoresRes] = await Promise.all([
        riscosQ,
        acoesQ,
        indicadoresQ,
      ])

      // Deduplicate indicadores: keep latest per portfolio_id
      const indRaw = (indicadoresRes.data ?? []) as Array<{ portfolio_id: string | null; idp: number | null; pct_valor_executado: number | null }>
      const seenPortfolios = new Set<string>()
      const indicadores: typeof indRaw = []
      for (const ind of indRaw) {
        const pid = ind.portfolio_id ?? ''
        if (!seenPortfolios.has(pid)) {
          seenPortfolios.add(pid)
          indicadores.push(ind)
        }
      }

      return {
        riscosCriticos: riscosRes.count ?? 0,
        acoesCriticas: acoesRes.count ?? 0,
        indicadores,
      }
    },
    staleTime: 2 * 60 * 1000,
  })
}

function useRecentes() {
  return useQuery({
    queryKey: ['egp-recentes'],
    queryFn: async () => {
      // Fetch recent entries across multiple PMO tables
      const [multasRes, reunioesRes, mudancasRes, acoesRes] = await Promise.all([
        supabase.from('pmo_multas').select('id, descricao, created_at, status, portfolio_id').order('created_at', { ascending: false }).limit(3),
        supabase.from('pmo_reunioes').select('id, tipo, data, created_at, status, portfolio_id').order('created_at', { ascending: false }).limit(3),
        supabase.from('pmo_mudancas').select('id, descricao, tipo, created_at, parecer, portfolio_id').order('created_at', { ascending: false }).limit(3),
        supabase.from('pmo_plano_acao').select('id, descricao, created_at, status, portfolio_id').order('created_at', { ascending: false }).limit(3),
      ])

      type RecenteItem = { id: string; tipo: string; descricao: string; created_at: string; status: string }
      const items: RecenteItem[] = []

      for (const m of (multasRes.data ?? []) as any[]) {
        items.push({ id: m.id, tipo: 'Multa', descricao: m.descricao, created_at: m.created_at, status: m.status })
      }
      for (const r of (reunioesRes.data ?? []) as any[]) {
        items.push({ id: r.id, tipo: 'Reunião', descricao: `${r.tipo} - ${r.data}`, created_at: r.created_at, status: r.status })
      }
      for (const m of (mudancasRes.data ?? []) as any[]) {
        items.push({ id: m.id, tipo: 'Mudança', descricao: m.descricao, created_at: m.created_at, status: m.parecer })
      }
      for (const a of (acoesRes.data ?? []) as any[]) {
        items.push({ id: a.id, tipo: 'Ação', descricao: a.descricao, created_at: a.created_at, status: a.status })
      }

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return items.slice(0, 8)
    },
    staleTime: 2 * 60 * 1000,
  })
}

// ── Upload OSC Modal ─────────────────────────────────────────────────────────

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
  const { error } = await supabase.storage.from('temp-uploads').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(`Upload falhou: ${error.message}`)
  const { data } = supabase.storage.from('temp-uploads').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

type UploadStep = 'idle' | 'uploading' | 'parsing' | 'review' | 'saving' | 'done' | 'error'

function UploadOSCModal({ open, onClose, isDark }: { open: boolean; onClose: () => void; isDark: boolean }) {
  const nav = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<UploadStep>('idle')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<OSCParsed | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const parseOSC = useParseOSC()
  const confirmar = useConfirmarOSC()

  const reset = useCallback(() => {
    setStep('idle')
    setFileName('')
    setError('')
    setParsed(null)
    setDragOver(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_OSC.includes(file.type)) {
      setError('Formato não suportado. Use PDF, JPG, PNG ou WebP.')
      setStep('error')
      return
    }
    if (file.size > MAX_SIZE_OSC) {
      setError('Arquivo muito grande. Máximo 50 MB.')
      setStep('error')
      return
    }

    setFileName(file.name)
    setStep('uploading')
    setError('')

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
      setParsed(result)
      setStep('review')
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar OSC')
      setStep('error')
    }
  }, [parseOSC])

  const handleConfirm = useCallback(async () => {
    if (!parsed) return
    setStep('saving')
    try {
      const portfolio = await confirmar.mutateAsync(parsed)
      setStep('done')
      setTimeout(() => {
        handleClose()
        nav(`/egp/iniciacao/${portfolio.id}`)
      }, 1200)
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar contrato')
      setStep('error')
    }
  }, [parsed, confirmar, handleClose, nav])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  if (!open) return null

  const cardCls = isDark
    ? 'bg-slate-800 border-slate-700 text-white'
    : 'bg-white border-slate-200 text-slate-800'

  const fmtV = (v: number | undefined) =>
    v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '-'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${cardCls}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-teal-500" />
            <h2 className="text-sm font-bold">Upload de OSC</h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
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
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                  dragOver
                    ? 'border-teal-400 bg-teal-50/50 dark:bg-teal-500/10'
                    : isDark
                      ? 'border-slate-600 hover:border-teal-500/50 hover:bg-white/[0.02]'
                      : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
                }`}
              >
                <Upload size={28} className={dragOver ? 'text-teal-500' : isDark ? 'text-slate-500' : 'text-slate-300'} />
                <div className="text-center">
                  <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    Arraste o PDF da OSC aqui
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    ou clique para selecionar — PDF, JPG, PNG (até 50 MB)
                  </p>
                </div>
                <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileInput} />
              </div>
              {step === 'error' && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
              <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                A IA vai extrair os dados da OSC e gerar uma TAP automaticamente. Você revisa antes de confirmar.
              </p>
            </div>
          )}

          {(step === 'uploading' || step === 'parsing') && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={32} className="text-teal-500 animate-spin" />
              <div className="text-center">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                  {step === 'uploading' ? 'Enviando arquivo...' : 'Analisando OSC com IA...'}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {fileName}
                </p>
              </div>
            </div>
          )}

          {step === 'review' && parsed && (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 space-y-2 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Contrato / OSC</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nome da obra</p>
                    <p className="font-medium">{parsed.portfolio.nome_obra || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nº OSC</p>
                    <p className="font-medium">{parsed.portfolio.numero_osc || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tipo</p>
                    <p className="font-medium capitalize">{parsed.portfolio.tipo_osc || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Valor Total</p>
                    <p className="font-medium">{fmtV(parsed.portfolio.valor_total_osc)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Cidade/Estado</p>
                    <p className="font-medium">{parsed.portfolio.cidade_estado || '-'}</p>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl border p-4 space-y-2 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>TAP Gerada</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Projeto</p>
                    <p className="font-medium">{parsed.tap.nome_projeto || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Cliente</p>
                    <p className="font-medium">{parsed.tap.cliente || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Objetivo</p>
                    <p className="font-medium line-clamp-2">{parsed.tap.objetivo || '-'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Orçamento</p>
                    <p className="font-medium">{fmtV(parsed.tap.orcamento_total)}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Riscos</p>
                    <p className="font-medium">{(parsed.tap.riscos_principais as any[])?.length ?? 0} identificados</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={32} className="text-teal-500 animate-spin" />
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                Registrando contrato e TAP...
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle size={32} className="text-emerald-500" />
              <div className="text-center">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                  Contrato registrado com sucesso!
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Redirecionando para Iniciação...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'review' && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-inherit">
            <button onClick={reset}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
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

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function EGPPainel() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const [obraFilter, setObraFilter] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const obras = useLookupObras()

  const { data: portfolios = [], isLoading, isError, refetch: refetchPortfolios } = usePortfolios(
    obraFilter ? { obra_id: obraFilter } : undefined
  )
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useEGPKpis(obraFilter)
  const { data: recentes = [], refetch: refetchRecentes } = useRecentes()

  const refetch = () => {
    refetchPortfolios()
    refetchKpis()
    refetchRecentes()
  }

  // ── Computed KPIs ──────────────────────────────────────────────────────────
  const hoje = Date.now()

  const avancoFisico = useMemo(() => {
    const ativos = portfolios.filter(p => p.valor_total_osc > 0)
    if (ativos.length === 0) return 0
    const total = ativos.reduce((sum, p) => {
      const pct = (p.custo_real / p.valor_total_osc) * 100
      return sum + Math.min(pct, 100)
    }, 0)
    return total / ativos.length
  }, [portfolios])

  const desvioPrazo = useMemo(() => {
    const ativos = portfolios.filter(p =>
      p.status === 'obra_andamento' && p.data_termino_contratual
    )
    if (ativos.length === 0) return 0
    const totalDias = ativos.reduce((sum, p) => {
      const termino = new Date(p.data_termino_contratual!).getTime()
      const diff = (termino - hoje) / (1000 * 60 * 60 * 24)
      return sum + diff
    }, 0)
    return Math.round(totalDias / ativos.length)
  }, [portfolios, hoje])

  const custoReal = useMemo(() =>
    portfolios.reduce((sum, p) => sum + (p.custo_real ?? 0), 0),
    [portfolios]
  )

  // Status segments
  const statusSegments = useMemo(() => {
    return STATUS_CONFIG
      .map(s => ({
        key: s.key,
        label: s.label,
        value: portfolios.filter(p => p.status === s.key).length,
        barClass: s.barClass,
      }))
      .filter(s => s.value > 0)
  }, [portfolios])

  // OSCs atrasadas
  const atrasadas = useMemo(() =>
    portfolios.filter(p =>
      p.data_termino_contratual &&
      new Date(p.data_termino_contratual).getTime() < hoje &&
      p.status === 'obra_andamento'
    ),
    [portfolios, hoje]
  )

  // OSCs com SPI < 0.85
  const spiCriticos = useMemo(() => {
    if (!kpis?.indicadores) return []
    const lowIdp = new Set(
      kpis.indicadores
        .filter(i => i.idp != null && i.idp < 0.85)
        .map(i => i.portfolio_id)
    )
    return portfolios.filter(p => lowIdp.has(p.id))
  }, [portfolios, kpis])

  // Por obra agrupado
  const porObra = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; valor: number }>()
    for (const p of portfolios) {
      const obraNome = p.obra?.nome ?? 'Sem obra'
      const entry = map.get(obraNome) ?? { nome: obraNome, total: 0, valor: 0 }
      entry.total += 1
      entry.valor += p.valor_total_osc ?? 0
      map.set(obraNome, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor)
  }, [portfolios])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) return <Loader />

  const cardClass = isDark
    ? 'bg-[#1e293b] border border-white/[0.06]'
    : 'bg-white border border-slate-200'

  return (
    <div className="space-y-5">

      {/* Banner de erro */}
      {isError && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <span className="text-amber-700 font-medium">Falha ao carregar dados — exibindo última versão disponível</span>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 whitespace-nowrap"
          >
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </div>
      )}

      {/* Header + Filtros */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Painel — EGP
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Portfólio de obras, indicadores e alertas críticos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center">
            <MapPin size={11} className={`absolute left-2.5 pointer-events-none z-10 ${obraFilter ? 'text-teal-600' : isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <select
              value={obraFilter}
              onChange={e => setObraFilter(e.target.value)}
              className={`text-[11px] font-semibold rounded-2xl pl-7 pr-3 py-2 border transition-all appearance-none cursor-pointer max-w-[140px] truncate ${
                obraFilter
                  ? 'bg-teal-50 border-teal-300 text-teal-700'
                  : isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
            >
              <option value="">Todas obras</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} - ` : ''}{o.nome}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all ${
              isDark ? 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
            }`}
          >
            <Upload size={12} /> Upload OSC
          </button>
          <button
            onClick={() => refetch()}
            className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-slate-500 hover:text-teal-400' : 'text-slate-400 hover:text-teal-600'}`}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* Upload OSC Modal */}
      <UploadOSCModal open={uploadOpen} onClose={() => setUploadOpen(false)} isDark={isDark} />

      {/* Hero 2 colunas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">

        {/* Nucleo EGP */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Núcleo EGP
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Indicadores consolidados do portfólio
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                <Activity size={18} className="text-teal-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric
                label="Avanço Físico"
                value={fmtPct(avancoFisico)}
                tone="teal"
                note="média do portfólio"
              />
              <SpotlightMetric
                label="Prazo"
                value={`${desvioPrazo > 0 ? '+' : ''}${desvioPrazo}d`}
                tone={desvioPrazo < 0 ? 'amber' : 'emerald'}
                note={desvioPrazo < 0 ? 'atrasado em média' : 'dentro do prazo'}
              />
              <SpotlightMetric
                label="Custo Real"
                value={fmt(custoReal)}
                tone="sky"
                note="soma acumulada"
              />
            </div>
          </div>
        </section>

        {/* Janela Critica */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Janela Crítica
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  O que exige ação agora
                </h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(kpis?.riscosCriticos ?? 0) > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={14} className={(kpis?.riscosCriticos ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard
                label="Riscos Críticos"
                value={kpis?.riscosCriticos ?? 0}
                note={(kpis?.riscosCriticos ?? 0) > 0 ? 'alta prob. + alto impacto' : 'nenhum risco crítico'}
                icon={AlertTriangle}
                iconTone={(kpis?.riscosCriticos ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'}
                isDark={isDark}
              />
              <MiniInfoCard
                label="Ações Críticas"
                value={kpis?.acoesCriticas ?? 0}
                note={(kpis?.acoesCriticas ?? 0) > 0 ? 'pendentes c/ prazo vencido' : 'nenhuma atrasada'}
                icon={Zap}
                iconTone={(kpis?.acoesCriticas ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'}
                isDark={isDark}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso por Status */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-teal-500" /> Pulso por Status
          </h2>
        </div>
        <div className="px-4 py-3">
          <HorizontalStatusBar
            isDark={isDark}
            title="Distribuição atual do portfólio"
            emptyLabel="Nenhuma OSC cadastrada"
            segments={statusSegments}
            totalLabel="OSC(s)"
          />
        </div>
      </section>

      {/* OSCs Criticas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Atrasadas */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-red-500/30' : 'bg-white border border-red-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-red-500/20' : 'border-b border-red-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-red-400' : 'text-red-800'}`}>
              <CalendarClock size={14} className="text-red-500" /> Atrasadas
            </h2>
            <span className={`text-[10px] font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{atrasadas.length} OSC(s)</span>
          </div>
          {atrasadas.length === 0 ? (
            <EmptyPanel
              isDark={isDark}
              title="Nenhuma OSC atrasada"
              description="OSCs em andamento com data de termino contratual vencida aparecem aqui."
            />
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-red-50'}`}>
              {atrasadas.slice(0, 5).map(p => {
                const diasAtraso = Math.round((hoje - new Date(p.data_termino_contratual!).getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => nav(`/egp/portfolio/${p.id}`)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-red-50/50'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                      <AlertTriangle size={14} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{p.numero_osc}</p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                          -{diasAtraso}d
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.nome_obra}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-red-600">{fmt(p.valor_total_osc)}</p>
                      <p className={`text-[9px] mt-0.5 font-semibold text-red-500`}>
                        Prazo: {fmtData(p.data_termino_contratual)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* SPI < 0.85 */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-amber-500/30' : 'bg-white border border-amber-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-amber-500/20' : 'border-b border-amber-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
              <BarChart3 size={14} className="text-amber-500" /> SPI &lt; 0.85
            </h2>
            <span className={`text-[10px] font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{spiCriticos.length} OSC(s)</span>
          </div>
          {spiCriticos.length === 0 ? (
            <EmptyPanel
              isDark={isDark}
              title="Nenhuma OSC com SPI crítico"
              description="OSCs com índice de performance de prazo abaixo de 0.85 aparecem aqui."
            />
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-amber-50'}`}>
              {spiCriticos.slice(0, 5).map(p => {
                const ind = kpis?.indicadores.find(i => i.portfolio_id === p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => nav(`/egp/portfolio/${p.id}`)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-amber-50/50'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                      <BarChart3 size={14} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{p.numero_osc}</p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          IDP {ind?.idp?.toFixed(2) ?? '—'}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.nome_obra}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-amber-600">{fmt(p.valor_total_osc)}</p>
                      <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.obra?.nome ?? '—'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Por Obra */}
      {porObra.length > 0 && (
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <MapPin size={14} className="text-slate-500" /> Por Obra
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {porObra.map(o => {
              const maxValor = Math.max(...porObra.map(x => x.valor), 1)
              const pct = Math.round((o.valor / maxValor) * 100)
              return (
                <div key={o.nome} className={`rounded-2xl p-3.5 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50/80 border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{o.nome}</p>
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{o.total} OSC{o.total !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-teal-600">{fmt(o.valor)}</p>
                    </div>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Recentes */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Clock size={14} className="text-slate-500" /> Recentes
          </h2>
          <button onClick={() => nav('/egp/portfolio')}
            className="flex items-center gap-0.5 text-[10px] text-teal-600 font-semibold">
            Ver portfólio <ChevronRight size={11} />
          </button>
        </div>
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
          {recentes.length === 0 ? (
            <EmptyPanel isDark={isDark} title="Nenhuma atividade recente" description="Atualizações de multas, reuniões, mudanças e ações aparecem aqui." />
          ) : (
            recentes.map(r => {
              const tipoColors: Record<string, string> = {
                Multa: 'bg-red-100 text-red-700',
                Reunião: 'bg-blue-100 text-blue-700',
                Mudança: 'bg-violet-100 text-violet-700',
                Ação: 'bg-amber-100 text-amber-700',
              }
              const tipoIcons: Record<string, string> = {
                Multa: 'text-red-500',
                Reunião: 'text-blue-500',
                Mudança: 'text-violet-500',
                Ação: 'text-amber-500',
              }
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'} transition-colors`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <DollarSign size={14} className={tipoIcons[r.tipo] ?? 'text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tipoColors[r.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                        {r.tipo.toUpperCase()}
                      </span>
                      <span className={`text-[9px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{r.descricao}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDataHora(r.created_at)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

    </div>
  )
}
