import { useState, useMemo, useRef } from 'react'
import {
  TrendingUp, Search, Calendar, AlertTriangle, CheckCircle2, Clock,
  FileText, ChevronDown, ChevronUp, X, ShieldCheck,
  Building2, Tag, Briefcase, Hash, Layers,
  ExternalLink, Download, ArrowUpDown, LayoutList,
  LayoutGrid, ArrowDown, ArrowUp, Receipt, Mail,
  ArrowRight, Upload, RefreshCw, XCircle, Zap,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useContasReceber, useAutorizarCR, useFaturarCR,
  useAvancarStatusCR, useRegistrarRecebimentoCR,
  useCompartilharNFEmail, useConciliarCRBatch,
} from '../../hooks/useFinanceiro'
import { UpperInput } from '../../components/UpperInput'
import { useLastSync, useTriggerSync, useOmieConfig } from '../../hooks/useOmie'
import { supabase } from '../../services/supabase'
import type { ContaReceber, StatusCR } from '../../types/financeiro'
import { CR_PIPELINE_STAGES } from '../../types/financeiro'

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const fmtDataFull = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ── Sort types ──────────────────────────────────────────────────────────────

type SortField = 'vencimento' | 'valor' | 'cliente' | 'emissao'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'
const CR_TABLE_GRID = 'grid grid-cols-[20px_2px_minmax(0,1.8fr)_minmax(0,1.45fr)_90px_72px_minmax(0,1fr)_72px_96px] items-center gap-x-3'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'vencimento', label: 'Vencimento' },
  { field: 'valor',      label: 'Valor' },
  { field: 'cliente',    label: 'Cliente' },
  { field: 'emissao',    label: 'Emissao' },
]

// ── Urgency helper ──────────────────────────────────────────────────────────

function getUrgency(cr: ContaReceber): 'overdue' | 'today' | 'week' | 'normal' {
  if (['recebido', 'conciliado', 'cancelado'].includes(cr.status)) return 'normal'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const venc = new Date(cr.data_vencimento + 'T00:00:00')
  const diffDays = Math.floor((venc.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'normal'
}

// ── Status icon map ─────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, typeof Receipt> = {
  previsto:     Calendar,
  autorizado:   ShieldCheck,
  faturamento:  FileText,
  nf_emitida:   Receipt,
  aguardando:   Clock,
  recebido:     CheckCircle2,
  conciliado:   CheckCircle2,
}

const STATUS_ACCENT: Record<string, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string; badge: string }> = {
  previsto:     { bg: 'hover:bg-slate-50',   bgActive: 'bg-slate-100',   text: 'text-slate-600',   textActive: 'text-slate-800',   dot: 'bg-slate-400',   border: 'border-slate-400',   badge: 'bg-slate-200 text-slate-700' },
  autorizado:   { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',     text: 'text-blue-600',    textActive: 'text-blue-800',    dot: 'bg-blue-500',    border: 'border-blue-500',    badge: 'bg-blue-100 text-blue-700' },
  faturamento:  { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',   text: 'text-violet-600',  textActive: 'text-violet-800',  dot: 'bg-violet-500',  border: 'border-violet-500',  badge: 'bg-violet-100 text-violet-700' },
  nf_emitida:   { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',    text: 'text-amber-600',   textActive: 'text-amber-800',   dot: 'bg-amber-500',   border: 'border-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  aguardando:   { bg: 'hover:bg-orange-50',  bgActive: 'bg-orange-50',   text: 'text-orange-600',  textActive: 'text-orange-800',  dot: 'bg-orange-500',  border: 'border-orange-500',  badge: 'bg-orange-100 text-orange-700' },
  recebido:     { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',     text: 'text-teal-600',    textActive: 'text-teal-800',    dot: 'bg-teal-500',    border: 'border-teal-500',    badge: 'bg-teal-100 text-teal-700' },
  conciliado:   { bg: 'hover:bg-green-50',   bgActive: 'bg-green-50',    text: 'text-green-600',   textActive: 'text-green-800',   dot: 'bg-green-500',   border: 'border-green-500',   badge: 'bg-green-100 text-green-700' },
}

const STATUS_ACCENT_DARK: Record<string, { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }> = {
  previsto:     { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/10',   text: 'text-slate-400',   textActive: 'text-slate-200',   badge: 'bg-slate-500/20 text-slate-300',   border: 'border-slate-500/40' },
  autorizado:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300',    badge: 'bg-blue-500/20 text-blue-300',    border: 'border-blue-500/40' },
  faturamento:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10',  text: 'text-violet-400',  textActive: 'text-violet-300',  badge: 'bg-violet-500/20 text-violet-300', border: 'border-violet-500/40' },
  nf_emitida:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',   text: 'text-amber-400',   textActive: 'text-amber-300',   badge: 'bg-amber-500/20 text-amber-300',   border: 'border-amber-500/40' },
  aguardando:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-orange-500/10',  text: 'text-orange-400',  textActive: 'text-orange-300',  badge: 'bg-orange-500/20 text-orange-300', border: 'border-orange-500/40' },
  recebido:     { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-teal-500/10',    text: 'text-teal-400',    textActive: 'text-teal-300',    badge: 'bg-teal-500/20 text-teal-300',    border: 'border-teal-500/40' },
  conciliado:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-green-500/10',   text: 'text-green-400',   textActive: 'text-green-300',   badge: 'bg-green-500/20 text-green-300',   border: 'border-green-500/40' },
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(crs: ContaReceber[], stageName: string) {
  const headers = ['Cliente', 'CNPJ', 'Valor', 'Vencimento', 'Emissao', 'NF', 'Centro Custo', 'Classe Financeira', 'Natureza', 'Descricao', 'Status']
  const rows = crs.map(cr => [
    cr.cliente_nome,
    cr.cliente_cnpj || '',
    cr.valor_original.toFixed(2).replace('.', ','),
    fmtDataFull(cr.data_vencimento),
    fmtDataFull(cr.data_emissao),
    cr.numero_nf || '',
    cr.centro_custo || '',
    cr.classe_financeira || '',
    cr.natureza || '',
    cr.descricao || '',
    cr.status,
  ])

  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contas-a-receber-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── SyncBar ───────────────────────────────────────────────────────────────────

function SyncBar({ isDark }: { isDark: boolean }) {
  const { data: config } = useOmieConfig()
  const { data: log, isLoading } = useLastSync('contas_receber')
  const trigger = useTriggerSync('contas_receber')

  const webhookUrl = config?.n8n_webhook_url ?? ''
  const omieEnabled = config?.omie_enabled === 'true'
  if (!omieEnabled) return null

  const status = log?.status
  const isPending = trigger.isPending || status === 'running'

  const lastSyncText = log?.executado_em
    ? new Date(log.executado_em).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : 'Nunca sincronizado'

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
      {isLoading || isPending ? (
        <RefreshCw size={13} className="text-emerald-500 animate-spin shrink-0" />
      ) : status === 'success' ? (
        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
      ) : status === 'error' ? (
        <XCircle size={13} className="text-red-500 shrink-0" />
      ) : (
        <Zap size={13} className="text-emerald-400 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-emerald-700 leading-none">
          {isPending ? 'Sincronizando com Omie...' : 'Omie'}
        </p>
        <p className="text-[10px] text-emerald-600/70 mt-0.5">
          {isPending ? 'Aguarde a conclusao' : lastSyncText}
        </p>
      </div>
      <button
        onClick={() => webhookUrl && trigger.mutate({ webhookUrl })}
        disabled={isPending || !webhookUrl}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white
          text-[10px] font-bold hover:bg-emerald-700 transition-all shrink-0
          disabled:opacity-50 disabled:cursor-not-allowed">
        <RefreshCw size={10} className={isPending ? 'animate-spin' : ''} />
        {isPending ? 'Aguarde' : 'Sincronizar Omie'}
      </button>
    </div>
  )
}

// ── FaturamentoModal ──────────────────────────────────────────────────────────

function FaturamentoModal({ cr, onClose, isDark }: { cr: ContaReceber; onClose: () => void; isDark: boolean }) {
  const danfeRef = useRef<HTMLInputElement>(null)
  const xmlRef = useRef<HTMLInputElement>(null)
  const [nf, setNf] = useState(cr.numero_nf ?? '')
  const [serie, setSerie] = useState(cr.serie_nf ?? '')
  const [chave, setChave] = useState(cr.chave_nfe ?? '')
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0])
  const [danfeFile, setDanfeFile] = useState<File | null>(null)
  const [xmlFile, setXmlFile] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const faturar = useFaturarCR()

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${isDark
    ? 'bg-[#0f172a] border-white/10 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`

  async function handleConfirmar() {
    if (!nf.trim()) { setErro('Numero da NF e obrigatorio'); return }
    setLoading(true); setErro('')
    try {
      await faturar.mutateAsync({
        crId: cr.id, numero_nf: nf.trim(), serie_nf: serie || undefined,
        chave_nfe: chave || undefined, data_emissao: dataEmissao, danfeFile: danfeFile ?? undefined, xmlFile: xmlFile ?? undefined,
      })
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao faturar')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full sm:max-w-lg rounded-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto
          ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Faturamento</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {cr.cliente_nome} — {fmt(cr.valor_original)}
        </p>

        {erro && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{erro}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Numero NF *</label>
            <UpperInput value={nf} onChange={e => setNf(e.target.value)} className={inputCls} placeholder="000123" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Serie</label>
              <UpperInput value={serie} onChange={e => setSerie(e.target.value)} className={inputCls} placeholder="1" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Data Emissao</label>
              <input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Chave NFe (44 digitos)</label>
            <UpperInput value={chave} onChange={e => setChave(e.target.value)} className={inputCls} placeholder="Opcional" maxLength={44} />
          </div>

          {/* DANFE Upload */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">DANFE (PDF)</label>
            <input ref={danfeRef} type="file" accept=".pdf" className="hidden"
              onChange={e => e.target.files?.[0] && setDanfeFile(e.target.files[0])} />
            <button onClick={() => danfeRef.current?.click()}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all
                ${danfeFile
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : isDark ? 'border-white/10 text-slate-400 hover:border-violet-500/40' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
              <Upload size={13} />
              {danfeFile ? danfeFile.name : 'Selecionar DANFE...'}
            </button>
          </div>

          {/* XML Upload */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">XML</label>
            <input ref={xmlRef} type="file" accept=".xml" className="hidden"
              onChange={e => e.target.files?.[0] && setXmlFile(e.target.files[0])} />
            <button onClick={() => xmlRef.current?.click()}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all
                ${xmlFile
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : isDark ? 'border-white/10 text-slate-400 hover:border-violet-500/40' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
              <Upload size={13} />
              {xmlFile ? xmlFile.name : 'Selecionar XML...'}
            </button>
          </div>
        </div>

        <button onClick={handleConfirmar} disabled={loading}
          className="w-full mt-5 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold
            hover:bg-violet-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Receipt size={14} />}
          {loading ? 'Processando...' : 'Confirmar Faturamento'}
        </button>
      </div>
    </div>
  )
}

// ── RegistrarRecebimentoModal ─────────────────────────────────────────────────

function RegistrarRecebimentoModal({ cr, onClose, isDark }: { cr: ContaReceber; onClose: () => void; isDark: boolean }) {
  const [valor, setValor] = useState(cr.valor_original.toString())
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const registrar = useRegistrarRecebimentoCR()

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${isDark
    ? 'bg-[#0f172a] border-white/10 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`

  async function handleConfirmar() {
    const v = parseFloat(valor)
    if (isNaN(v) || v <= 0) { setErro('Valor invalido'); return }
    setLoading(true); setErro('')
    try {
      await registrar.mutateAsync({ crId: cr.id, valorRecebido: v, dataRecebimento: data })
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full sm:max-w-md rounded-2xl shadow-2xl p-6
          ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Registrar Recebimento</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {cr.cliente_nome} — Previsto: {fmt(cr.valor_original)}
        </p>

        {erro && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{erro}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Valor Recebido</label>
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Data Recebimento</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
          </div>
        </div>

        <button onClick={handleConfirmar} disabled={loading}
          className="w-full mt-5 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold
            hover:bg-teal-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {loading ? 'Processando...' : 'Confirmar Recebimento'}
        </button>
      </div>
    </div>
  )
}

// ── CRDetailModal ──────────────────────────────────────────────────────────

function CRDetailModal({ cr, onClose, onAction, isDark }: {
  cr: ContaReceber
  onClose: () => void
  onAction: (action: string, cr: ContaReceber) => void
  isDark: boolean
}) {
  const urgency = getUrgency(cr)
  const stage = CR_PIPELINE_STAGES.find(s => s.status === cr.status)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp size={18} className="text-emerald-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cr.cliente_nome}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className={`text-2xl font-extrabold ${urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
              {fmtFull(cr.valor_original)}
            </p>
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${STATUS_ACCENT[cr.status]?.bgActive || 'bg-slate-100'} ${STATUS_ACCENT[cr.status]?.textActive || 'text-slate-700'}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_ACCENT[cr.status]?.dot}`} />
              {stage?.label ?? cr.status}
            </span>
          </div>

          {urgency === 'overdue' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-semibold">Vencido em {fmtData(cr.data_vencimento)}</p>
            </div>
          )}

          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Vencimento:</span> <span className="font-semibold">{fmtData(cr.data_vencimento)}</span></div>
              <div><span className="text-slate-400">Emissao:</span> <span className="font-semibold">{fmtData(cr.data_emissao)}</span></div>
              {cr.cliente_cnpj && <div><span className="text-slate-400">CNPJ:</span> <span className="font-mono">{cr.cliente_cnpj}</span></div>}
              {cr.numero_nf && <div><span className="text-slate-400">NF:</span> <span className="font-mono">{cr.numero_nf}</span></div>}
              {cr.serie_nf && <div><span className="text-slate-400">Serie:</span> <span className="font-mono">{cr.serie_nf}</span></div>}
              {cr.natureza && <div><span className="text-slate-400">Natureza:</span> <span>{cr.natureza}</span></div>}
              {cr.centro_custo && <div><span className="text-slate-400">Centro Custo:</span> <span className="font-semibold">{cr.centro_custo}</span></div>}
              {cr.classe_financeira && <div><span className="text-slate-400">Classe Fin:</span> <span className="text-violet-600 font-semibold">{cr.classe_financeira}</span></div>}
              {cr.autorizado_por && <div><span className="text-slate-400">Autorizado por:</span> <span className="text-blue-600 font-semibold">{cr.autorizado_por}</span></div>}
              {cr.autorizado_em && <div><span className="text-slate-400">Em:</span> <span>{new Date(cr.autorizado_em).toLocaleDateString('pt-BR')}</span></div>}
              {cr.data_recebimento && <div><span className="text-slate-400">Recebido em:</span> <span className="text-emerald-600 font-semibold">{fmtData(cr.data_recebimento)}</span></div>}
              {cr.valor_recebido > 0 && <div><span className="text-slate-400">Valor Recebido:</span> <span className="text-emerald-600 font-semibold">{fmtFull(cr.valor_recebido)}</span></div>}
              {cr.email_compartilhado_para && <div className="col-span-2"><span className="text-slate-400">Email enviado:</span> <span className="text-amber-600 font-semibold">{cr.email_compartilhado_para}</span></div>}
            </div>
            {cr.descricao && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">{cr.descricao}</p>}
          </div>

          {cr.chave_nfe && (
            <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chave NFe</p>
              <p className="font-mono text-[10px] text-slate-600 break-all">{cr.chave_nfe}</p>
            </div>
          )}

          {/* DANFE / XML links */}
          {(cr.danfe_url || cr.xml_url) && (
            <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-violet-50/60'}`}>
              <p className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText size={9} /> Documentos Fiscais
              </p>
              <div className="flex gap-2">
                {cr.danfe_url && (
                  <a href={cr.danfe_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-semibold hover:shadow-sm transition-all">
                    <FileText size={11} /> DANFE (PDF) <ExternalLink size={9} />
                  </a>
                )}
                {cr.xml_url && (
                  <a href={cr.xml_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold hover:shadow-sm transition-all">
                    <FileText size={11} /> XML <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Pipeline progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {CR_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = CR_PIPELINE_STAGES.findIndex(st => st.status === cr.status)
                const isPast = i <= currentIdx
                const accent = STATUS_ACCENT[s.status]
                return (
                  <div key={s.status} className="flex-1">
                    <div className={`h-1.5 rounded-full transition-all ${isPast ? accent?.dot || 'bg-slate-400' : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Fechar
            </button>
            {cr.status === 'previsto' && (
              <button onClick={() => onAction('autorizar', cr)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <ShieldCheck size={15} /> Autorizar
              </button>
            )}
            {cr.status === 'autorizado' && (
              <button onClick={() => onAction('faturar', cr)} className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                <FileText size={15} /> Faturar
              </button>
            )}
            {cr.status === 'nf_emitida' && (
              <button onClick={() => onAction('avancar', cr)} className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-all flex items-center justify-center gap-2">
                <ArrowRight size={15} /> Aguardar Pgto
              </button>
            )}
            {cr.status === 'aguardando' && (
              <button onClick={() => onAction('receber', cr)} className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Reg. Recebimento
              </button>
            )}
            {cr.status === 'recebido' && (
              <button onClick={() => onAction('conciliar', cr)} className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Conciliar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CRRow (compact table row) ────────────────────────────────────────────────

function CRRow({ cr, onClick, isDark, isSelected, onSelect }: {
  cr: ContaReceber
  onClick: () => void
  isDark: boolean
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const urgency = getUrgency(cr)

  return (
    <div
      onClick={onClick}
      className={`${CR_TABLE_GRID} px-3 py-2 border-b cursor-pointer transition-all ${
        isDark
          ? `border-white/[0.04] hover:bg-white/[0.03] ${isSelected ? 'bg-emerald-500/10' : ''}`
          : `border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-emerald-50' : ''}`
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => { e.stopPropagation(); onSelect(cr.id) }}
        onClick={e => e.stopPropagation()}
        className="w-3 h-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
      />

      <div className={`w-0.5 h-4 rounded-full shrink-0 ${
        urgency === 'overdue' ? 'bg-red-500' : urgency === 'today' ? 'bg-amber-500' : urgency === 'week' ? 'bg-yellow-400' : 'bg-transparent'
      }`} />

      <span className={`text-xs font-semibold truncate min-w-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {cr.cliente_nome}
      </span>

      <span className={`text-[11px] truncate min-w-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {cr.descricao || '—'}
      </span>

      <span className={`text-[11px] truncate font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {cr.numero_nf ? `NF ${cr.numero_nf}` : '—'}
      </span>

      <span className={`text-[11px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {cr.centro_custo || '—'}
      </span>

      <span className={`text-[11px] truncate min-w-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {cr.classe_financeira || '—'}
      </span>

      <span className={`text-[11px] text-right ${
        urgency === 'overdue' ? 'text-red-500 font-bold' : urgency === 'today' ? 'text-amber-600 font-semibold' : isDark ? 'text-slate-500' : 'text-slate-400'
      }`}>
        {fmtData(cr.data_vencimento)}
      </span>

      <span className={`text-xs font-bold text-right ${
        urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'
      }`}>
        {fmt(cr.valor_original)}
      </span>
    </div>
  )
}

// ── CRCard (block/card view) ─────────────────────────────────────────────────

function CRCard({ cr, onClick, isDark, isSelected, onSelect }: {
  cr: ContaReceber
  onClick: () => void
  isDark: boolean
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const urgency = getUrgency(cr)

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
        isDark
          ? `border-white/[0.06] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02]'}`
          : `border-slate-200 hover:border-teal-300 hover:shadow-md ${isSelected ? 'bg-emerald-50 border-emerald-300' : 'bg-white'}`
      }`}
    >
      {/* Linha 1: checkbox + cliente + urgency + valor */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onSelect(cr.id) }}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
        />
        <div className={`w-1 h-6 rounded-full shrink-0 ${
          urgency === 'overdue' ? 'bg-red-500' : urgency === 'today' ? 'bg-amber-500' : urgency === 'week' ? 'bg-yellow-400' : 'bg-transparent'
        }`} />
        <p className={`text-sm font-bold truncate flex-1 min-w-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {cr.cliente_nome}
        </p>
        {urgency === 'overdue' && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">VENCIDO</span>
        )}
        <p className={`text-sm font-extrabold shrink-0 ${urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
          {fmt(cr.valor_original)}
        </p>
      </div>

      {/* Linha 2: descricao */}
      {cr.descricao && (
        <p className={`text-xs truncate mt-1.5 ml-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cr.descricao}</p>
      )}

      {/* Linha 3: tags + data */}
      <div className="flex items-center justify-between mt-2 ml-10">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {cr.numero_nf && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-semibold shrink-0 ${isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-700'}`}>
              <FileText size={9} /> NF {cr.numero_nf}
            </span>
          )}
          {cr.centro_custo && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Briefcase size={9} /> {cr.centro_custo}
            </span>
          )}
          {cr.classe_financeira && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Tag size={9} /> {cr.classe_financeira}
            </span>
          )}
          {cr.natureza && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              {cr.natureza}
            </span>
          )}
        </div>
        <span className={`text-[11px] flex items-center gap-1 shrink-0 ml-3 ${
          urgency === 'overdue' ? 'text-red-500 font-bold' : urgency === 'today' ? 'text-amber-600 font-semibold' : isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          <Calendar size={10} /> {fmtData(cr.data_vencimento)}
        </span>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ContasReceber() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<StatusCR>('previsto')
  const [busca, setBusca] = useState('')
  const [detailCR, setDetailCR] = useState<ContaReceber | null>(null)
  const [faturarModal, setFaturarModal] = useState<ContaReceber | null>(null)
  const [recebimentoModal, setRecebimentoModal] = useState<ContaReceber | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [sortField, setSortField] = useState<SortField>('vencimento')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Data
  const { data: contas = [], isLoading } = useContasReceber()

  // Mutations
  const autorizarMut = useAutorizarCR()
  const avancarMut = useAvancarStatusCR()
  const conciliarMut = useConciliarCRBatch()
  const compartilharMut = useCompartilharNFEmail()

  // Group all CRs by status
  const grouped = useMemo(() => {
    const map = new Map<StatusCR, ContaReceber[]>()
    for (const s of CR_PIPELINE_STAGES) map.set(s.status, [])
    for (const cr of contas) {
      const arr = map.get(cr.status as StatusCR)
      if (arr) arr.push(cr)
    }
    return map
  }, [contas])

  // Filter active tab by search, then sort
  const activeCRs = useMemo(() => {
    let crs = [...(grouped.get(activeTab) || [])]

    // Search filter
    if (busca) {
      const q = busca.toLowerCase()
      crs = crs.filter(cr =>
        cr.cliente_nome.toLowerCase().includes(q)
        || cr.descricao?.toLowerCase().includes(q)
        || cr.numero_nf?.toLowerCase().includes(q)
        || cr.centro_custo?.toLowerCase().includes(q)
        || cr.classe_financeira?.toLowerCase().includes(q)
        || cr.natureza?.toLowerCase().includes(q)
        || cr.cliente_cnpj?.toLowerCase().includes(q)
      )
    }

    // Sort
    crs.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'vencimento': cmp = a.data_vencimento.localeCompare(b.data_vencimento); break
        case 'emissao':    cmp = a.data_emissao.localeCompare(b.data_emissao); break
        case 'valor':      cmp = a.valor_original - b.valor_original; break
        case 'cliente':    cmp = a.cliente_nome.localeCompare(b.cliente_nome); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return crs
  }, [grouped, activeTab, busca, sortField, sortDir])

  // Tab totals
  const tabTotal = useMemo(() => activeCRs.reduce((s, cr) => s + cr.valor_original, 0), [activeCRs])

  // Toast helper
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const allIds = activeCRs.map(cr => cr.id)
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleAutorizar = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await autorizarMut.mutateAsync({ crId: id })
      }
      showToast('success', `${ids.length} titulo(s) autorizado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao autorizar') }
  }

  const handleAvancar = async (ids: string[], novoStatus: string) => {
    try {
      for (const id of ids) {
        await avancarMut.mutateAsync({ crId: id, novoStatus })
      }
      showToast('success', `${ids.length} titulo(s) atualizado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao atualizar status') }
  }

  const handleConciliar = async (ids: string[]) => {
    try {
      await conciliarMut.mutateAsync({ ids })
      showToast('success', `${ids.length} titulo(s) conciliado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao conciliar') }
  }

  const handleEmail = async (cr: ContaReceber) => {
    const email = prompt('Email do cliente:')
    if (!email) return
    try {
      await compartilharMut.mutateAsync({ crId: cr.id, email })
      const subject = encodeURIComponent(`NF ${cr.numero_nf ?? ''} — ${cr.cliente_nome}`)
      const body = encodeURIComponent(
        `Segue a Nota Fiscal referente ao servico prestado.\n\n` +
        `Cliente: ${cr.cliente_nome}\n` +
        `Valor: ${fmt(cr.valor_original)}\n` +
        `NF: ${cr.numero_nf ?? 'N/A'}\n` +
        (cr.danfe_url ? `\nDANFE: ${cr.danfe_url}\n` : '') +
        `\nAtenciosamente,\nTEG+ Financeiro`
      )
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank')
      showToast('success', `Email registrado para ${email}`)
    } catch { showToast('error', 'Erro ao compartilhar') }
  }

  const handleBulkAction = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    switch (activeTab) {
      case 'previsto': handleAutorizar(ids); break
      case 'nf_emitida': handleAvancar(ids, 'aguardando'); break
      case 'recebido': handleConciliar(ids); break
    }
  }

  const handleDetailAction = (action: string, cr: ContaReceber) => {
    setDetailCR(null)
    switch (action) {
      case 'autorizar': handleAutorizar([cr.id]); break
      case 'faturar': setFaturarModal(cr); break
      case 'avancar': handleAvancar([cr.id], 'aguardando'); break
      case 'receber': setRecebimentoModal(cr); break
      case 'conciliar': handleConciliar([cr.id]); break
    }
  }

  // Export
  const handleExport = () => {
    const stage = CR_PIPELINE_STAGES.find(s => s.status === activeTab)
    const toExport = selectedIds.size > 0 ? activeCRs.filter(cr => selectedIds.has(cr.id)) : activeCRs
    exportCSV(toExport, stage?.label || activeTab)
    showToast('success', `${toExport.length} registro(s) exportado(s)`)
  }

  // Bulk action config per tab
  const BULK_ACTIONS: Partial<Record<StatusCR, { label: string; icon: typeof CheckCircle2; className: string }>> = {
    previsto:     { label: 'Autorizar',     icon: ShieldCheck,  className: 'bg-blue-600 hover:bg-blue-700 text-white' },
    nf_emitida:   { label: 'Aguardar Pgto', icon: ArrowRight,   className: 'bg-orange-500 hover:bg-orange-600 text-white' },
    recebido:     { label: 'Conciliar',     icon: CheckCircle2, className: 'bg-green-600 hover:bg-green-700 text-white' },
  }
  const bulk = BULK_ACTIONS[activeTab]
  const selectedInTab = activeCRs.filter(cr => selectedIds.has(cr.id))

  // Switch tab clears selection
  const switchTab = (status: StatusCR) => {
    setActiveTab(status)
    setSelectedIds(new Set())
    setBusca('')
  }

  // Summary stats
  const overdueCt = activeCRs.filter(cr => getUrgency(cr) === 'overdue').length
  const overdueTotal = activeCRs.filter(cr => getUrgency(cr) === 'overdue').reduce((s, c) => s + c.valor_original, 0)

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={20} className="text-emerald-600" />
            Contas a Receber
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {contas.length} titulos &middot; {fmt(contas.reduce((s, c) => s + c.valor_original, 0))}
          </p>
        </div>
      </div>

      {/* Omie Sync */}
      <SyncBar isDark={isDark} />

      {/* ── Horizontal Tabs ───────────────────────────────────────── */}
      <div className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {CR_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status
          const Icon = STATUS_ICONS[stage.status] || Receipt
          const accent = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]

          return (
            <button
              key={stage.status}
              onClick={() => switchTab(stage.status)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? isDark
                    ? `${accent?.bgActive} ${accent?.textActive} ${STATUS_ACCENT_DARK[stage.status]?.border} font-bold shadow-sm`
                    : `${accent?.bgActive} ${accent?.textActive} ${STATUS_ACCENT[stage.status]?.border} font-bold shadow-sm`
                  : isDark
                    ? `${accent?.bg} ${accent?.text} font-medium border-transparent`
                    : `${accent?.bg} ${accent?.text} font-medium border-transparent hover:bg-white hover:shadow-sm`
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 flex items-center justify-center ${
                  isActive
                    ? isDark ? `${STATUS_ACCENT_DARK[stage.status]?.badge}` : `${STATUS_ACCENT[stage.status]?.badge}`
                    : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Content panel ───────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>

        {/* Toolbar: Search + Sort + View Toggle + Export */}
        <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <UpperInput
              type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar cliente, NF, CNPJ, CC..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
              }`}
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort buttons */}
          <div className="flex items-center gap-0.5">
            {SORT_OPTIONS.map(opt => {
              const isActive = sortField === opt.field
              return (
                <button
                  key={opt.field}
                  onClick={() => toggleSort(opt.field)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isActive
                      ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                      : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                  {isActive && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </button>
              )
            })}
          </div>

          {/* View toggle */}
          <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-all ${
                viewMode === 'list'
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700'
                  : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Lista"
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 transition-all ${
                viewMode === 'cards'
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700'
                  : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Cards"
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExport}
            disabled={activeCRs.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30'
            }`}
            title="Exportar CSV"
          >
            <Download size={13} />
            CSV
          </button>

          {/* Stats */}
          <div className={`ml-auto flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{activeCRs.length} {activeCRs.length === 1 ? 'titulo' : 'titulos'}</span>
            <span className="font-bold text-emerald-600">{fmt(tabTotal)}</span>
            {overdueCt > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-bold">
                <AlertTriangle size={11} /> {overdueCt} vencido{overdueCt > 1 ? 's' : ''} ({fmt(overdueTotal)})
              </span>
            )}
          </div>
        </div>

        {/* Select all + bulk action bar */}
        {activeCRs.length > 0 && bulk && (
          <div className={`px-4 py-2 border-b flex items-center gap-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={activeCRs.length > 0 && activeCRs.every(cr => selectedIds.has(cr.id))}
                onChange={selectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Todos
              </span>
            </label>
            {selectedInTab.length > 0 && (
              <>
                <button
                  onClick={handleBulkAction}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${bulk.className}`}
                >
                  <bulk.icon size={12} />
                  {bulk.label} ({selectedInTab.length})
                </button>
                <span className={`text-[10px] ml-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {fmt(selectedInTab.reduce((s, cr) => s + cr.valor_original, 0))} selecionado
                </span>
              </>
            )}
          </div>
        )}

        {/* CR list / cards */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeCRs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <TrendingUp size={24} className="text-slate-300" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Nenhum titulo nesta etapa
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {busca ? 'Tente outra busca' : 'Os titulos aparecerão aqui quando avancarem'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <>
              {/* Table header */}
              <div className={`${CR_TABLE_GRID} px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider ${
                isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'
              }`}>
                <span />
                <span />
                <span>Cliente</span>
                <span>Descricao</span>
                <span>NF</span>
                <span>CC</span>
                <span>Classe</span>
                <span className="text-right">Venc.</span>
                <span className="text-right">Valor</span>
              </div>
              {activeCRs.map(cr => (
                <CRRow
                  key={cr.id}
                  cr={cr}
                  onClick={() => setDetailCR(cr)}
                  isDark={isDark}
                  isSelected={selectedIds.has(cr.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </>
          ) : (
            <div className="space-y-2 p-4">
              {activeCRs.map(cr => (
                <CRCard
                  key={cr.id}
                  cr={cr}
                  onClick={() => setDetailCR(cr)}
                  isDark={isDark}
                  isSelected={selectedIds.has(cr.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailCR && (
        <CRDetailModal
          cr={detailCR}
          onClose={() => setDetailCR(null)}
          onAction={handleDetailAction}
          isDark={isDark}
        />
      )}

      {/* Faturamento Modal */}
      {faturarModal && (
        <FaturamentoModal
          cr={faturarModal}
          isDark={isDark}
          onClose={() => { setFaturarModal(null); showToast('success', 'NF emitida com sucesso') }}
        />
      )}

      {/* Recebimento Modal */}
      {recebimentoModal && (
        <RegistrarRecebimentoModal
          cr={recebimentoModal}
          isDark={isDark}
          onClose={() => { setRecebimentoModal(null); showToast('success', 'Recebimento registrado') }}
        />
      )}
    </div>
  )
}
