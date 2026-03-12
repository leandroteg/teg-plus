import { useState, useRef } from 'react'
import {
  DollarSign, Search, Calendar, AlertTriangle, TrendingUp,
  RefreshCw, Zap, XCircle, CheckCircle2, Clock,
  ChevronDown, ChevronUp, Upload, FileText, ExternalLink,
  ShieldCheck, Receipt, Mail, ArrowRight, X,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useContasReceber, useAutorizarCR, useFaturarCR,
  useAvancarStatusCR, useRegistrarRecebimentoCR,
  useCompartilharNFEmail, useConciliarCRBatch,
} from '../../hooks/useFinanceiro'
import { useLastSync, useTriggerSync, useOmieConfig } from '../../hooks/useOmie'
import type { ContaReceber } from '../../types/financeiro'

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
          {isPending ? 'Aguarde a conclusão' : lastSyncText}
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

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; icon: typeof Clock }> = {
  previsto:     { label: 'Previsto',     dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600',    icon: Calendar },
  autorizado:   { label: 'Autorizado',   dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700',     icon: ShieldCheck },
  faturamento:  { label: 'Faturamento',  dot: 'bg-violet-500',  bg: 'bg-violet-50',   text: 'text-violet-700',   icon: FileText },
  nf_emitida:   { label: 'NF Emitida',   dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',    icon: Receipt },
  aguardando:   { label: 'Aguardando',   dot: 'bg-orange-500',  bg: 'bg-orange-50',   text: 'text-orange-700',   icon: Clock },
  recebido:     { label: 'Recebido',     dot: 'bg-teal-500',    bg: 'bg-teal-50',     text: 'text-teal-700',     icon: CheckCircle2 },
  conciliado:   { label: 'Conciliado',   dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700',    icon: CheckCircle2 },
  cancelado:    { label: 'Cancelado',    dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500',     icon: Clock },
}

const FILTROS: { label: string; value: string }[] = [
  { label: 'Todos',        value: '' },
  { label: 'Previstos',    value: 'previsto' },
  { label: 'Autorizados',  value: 'autorizado' },
  { label: 'Faturamento',  value: 'faturamento' },
  { label: 'NF Emitida',   value: 'nf_emitida' },
  { label: 'Aguardando',   value: 'aguardando' },
  { label: 'Recebidos',    value: 'recebido' },
  { label: 'Conciliados',  value: 'conciliado' },
]

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto
          ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Faturamento</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} className="text-slate-400" /></button>
        </div>

        <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {cr.cliente_nome} — {fmt(cr.valor_original)}
        </p>

        {erro && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{erro}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Numero NF *</label>
            <input value={nf} onChange={e => setNf(e.target.value)} className={inputCls} placeholder="000123" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Serie</label>
              <input value={serie} onChange={e => setSerie(e.target.value)} className={inputCls} placeholder="1" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Data Emissao</label>
              <input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase">Chave NFe (44 digitos)</label>
            <input value={chave} onChange={e => setChave(e.target.value)} className={inputCls} placeholder="Opcional" maxLength={44} />
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl p-6
          ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Registrar Recebimento</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={16} className="text-slate-400" /></button>
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

// ── CRCard ────────────────────────────────────────────────────────────────────

function CRCard({ cr, isDark, onFaturar, onReceber, onEmail, onAutorizar, onAvancar, onConciliar }: {
  cr: ContaReceber
  isDark: boolean
  onAutorizar: (cr: ContaReceber) => void
  onFaturar: (cr: ContaReceber) => void
  onEmail: (cr: ContaReceber) => void
  onAvancar: (cr: ContaReceber, status: string) => void
  onReceber: (cr: ContaReceber) => void
  onConciliar: (cr: ContaReceber) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[cr.status]
  const Icon = cfg?.icon ?? Clock

  const isVencido = !['recebido', 'conciliado', 'cancelado'].includes(cr.status) &&
    new Date(cr.data_vencimento) < new Date()

  const borderColor = isVencido
    ? 'border-red-300'
    : cr.status === 'recebido' || cr.status === 'conciliado'
      ? 'border-emerald-200'
      : isDark ? 'border-white/[0.06]' : 'border-slate-200'

  return (
    <div className={`rounded-2xl border shadow-sm transition-all hover:shadow-md
      ${isDark ? 'bg-[#1e293b]' : 'bg-white'} ${borderColor}`}>

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
            ${isVencido
              ? (isDark ? 'bg-red-500/10' : 'bg-red-50')
              : cr.status === 'autorizado'
                ? (isDark ? 'bg-blue-500/10' : 'bg-blue-50')
                : (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50')}`}>
            {isVencido
              ? <AlertTriangle size={16} className="text-red-500" />
              : <Icon size={16} className={cfg?.text ?? 'text-slate-600'} />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {cr.cliente_nome}
              </p>
              <p className={`text-sm font-extrabold shrink-0 ${isVencido ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt(cr.valor_original)}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${cfg?.bg} ${cfg?.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                {cfg?.label ?? cr.status}
              </span>
              {isVencido && cr.status !== 'cancelado' && (
                <span className="inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 bg-red-50 text-red-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Vencido
                </span>
              )}
              {cr.numero_nf && (
                <span className="text-slate-400 font-mono">NF {cr.numero_nf}</span>
              )}
              {cr.natureza && <span className="text-slate-400">{cr.natureza}</span>}
            </div>

            {cr.descricao && (
              <p className={`text-[11px] mt-1 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {cr.descricao}
              </p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                Venc. {fmtData(cr.data_vencimento)}
              </span>
              {cr.centro_custo && <span>CC: {cr.centro_custo}</span>}
              {cr.classe_financeira && <span>Classe: {cr.classe_financeira}</span>}
              {cr.data_recebimento && (
                <span className="text-teal-600 font-medium">
                  Recebido em {fmtData(cr.data_recebimento)}
                </span>
              )}
              {cr.email_compartilhado_para && (
                <span className="text-amber-600 font-medium flex items-center gap-1">
                  <Mail size={9} /> Enviado para {cr.email_compartilhado_para}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions + Expand */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
          <div className="flex gap-2">
            {cr.status === 'previsto' && (
              <button onClick={() => onAutorizar(cr)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-all">
                <ShieldCheck size={12} /> Autorizar
              </button>
            )}
            {cr.status === 'autorizado' && (
              <button onClick={() => onFaturar(cr)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 transition-all">
                <FileText size={12} /> Faturar
              </button>
            )}
            {cr.status === 'nf_emitida' && (
              <>
                <button onClick={() => onEmail(cr)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 transition-all">
                  <Mail size={12} /> Compartilhar
                </button>
                <button onClick={() => onAvancar(cr, 'aguardando')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[10px] font-bold hover:bg-orange-600 transition-all">
                  <ArrowRight size={12} /> Aguardar Pgto
                </button>
              </>
            )}
            {cr.status === 'aguardando' && (
              <button onClick={() => onReceber(cr)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-[10px] font-bold hover:bg-teal-700 transition-all">
                <CheckCircle2 size={12} /> Registrar Recebimento
              </button>
            )}
            {cr.status === 'recebido' && (
              <button onClick={() => onConciliar(cr)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-[10px] font-bold hover:bg-green-700 transition-all">
                <CheckCircle2 size={12} /> Conciliar
              </button>
            )}
          </div>

          <button onClick={() => setExpanded(!expanded)}
            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all
              ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50'}`}>
            {expanded ? <><ChevronUp size={12} /> Recolher</> : <><ChevronDown size={12} /> Detalhes</>}
          </button>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className={`px-4 pb-4 pt-2 border-t space-y-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Detalhes</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <div><span className="text-slate-400">Cliente:</span> <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>{cr.cliente_nome}</span></div>
              {cr.cliente_cnpj && <div><span className="text-slate-400">CNPJ:</span> <span className="font-mono text-slate-600">{cr.cliente_cnpj}</span></div>}
              {cr.numero_nf && <div><span className="text-slate-400">NF:</span> <span className="font-mono text-slate-600">{cr.numero_nf}</span></div>}
              {cr.serie_nf && <div><span className="text-slate-400">Serie:</span> <span className="font-mono text-slate-600">{cr.serie_nf}</span></div>}
              {cr.chave_nfe && <div className="col-span-2"><span className="text-slate-400">Chave NFe:</span> <span className="font-mono text-slate-600 text-[9px] break-all">{cr.chave_nfe}</span></div>}
              <div><span className="text-slate-400">Emissao:</span> <span className="text-slate-600">{fmtData(cr.data_emissao)}</span></div>
              <div><span className="text-slate-400">Vencimento:</span> <span className={`font-semibold ${isVencido ? 'text-red-600' : 'text-slate-600'}`}>{fmtData(cr.data_vencimento)}</span></div>
              {cr.centro_custo && <div><span className="text-slate-400">Centro Custo:</span> <span className="text-slate-600">{cr.centro_custo}</span></div>}
              {cr.classe_financeira && <div><span className="text-slate-400">Classe:</span> <span className="text-slate-600">{cr.classe_financeira}</span></div>}
              {cr.autorizado_por && <div><span className="text-slate-400">Autorizado por:</span> <span className="text-blue-600 font-semibold">{cr.autorizado_por}</span></div>}
              {cr.autorizado_em && <div><span className="text-slate-400">Em:</span> <span className="text-slate-600">{new Date(cr.autorizado_em).toLocaleDateString('pt-BR')}</span></div>}
            </div>
          </div>

          {/* DANFE / XML links */}
          {(cr.danfe_url || cr.xml_url) && (
            <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-violet-50/60'}`}>
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText size={10} /> Documentos Fiscais
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

          {cr.observacoes && (
            <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observacoes</p>
              <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{cr.observacoes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContasReceber() {
  const { isDark } = useTheme()
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [faturarModal, setFaturarModal] = useState<ContaReceber | null>(null)
  const [recebimentoModal, setRecebimentoModal] = useState<ContaReceber | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const { data: contas = [], isLoading, error: crError } = useContasReceber()
  const autorizar = useAutorizarCR()
  const avancar = useAvancarStatusCR()
  const conciliar = useConciliarCRBatch()
  const compartilhar = useCompartilharNFEmail()

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAutorizar(cr: ContaReceber) {
    try {
      await autorizar.mutateAsync({ crId: cr.id })
      showToast(`${cr.cliente_nome} autorizado com sucesso`)
    } catch { showToast('Erro ao autorizar', false) }
  }

  async function handleAvancar(cr: ContaReceber, status: string) {
    try {
      await avancar.mutateAsync({ crId: cr.id, novoStatus: status })
      showToast('Status atualizado')
    } catch { showToast('Erro ao atualizar status', false) }
  }

  async function handleConciliar(cr: ContaReceber) {
    try {
      await conciliar.mutateAsync({ ids: [cr.id] })
      showToast(`${cr.cliente_nome} conciliado`)
    } catch { showToast('Erro ao conciliar', false) }
  }

  async function handleEmail(cr: ContaReceber) {
    const email = prompt('Email do cliente:')
    if (!email) return
    try {
      await compartilhar.mutateAsync({ crId: cr.id, email })
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
      showToast(`Email registrado para ${email}`)
    } catch { showToast('Erro ao compartilhar', false) }
  }

  const filtered = contas
    .filter(cr => !statusFilter || cr.status === statusFilter)
    .filter(cr =>
      !busca || cr.cliente_nome.toLowerCase().includes(busca.toLowerCase())
        || cr.numero_nf?.toLowerCase().includes(busca.toLowerCase())
        || cr.descricao?.toLowerCase().includes(busca.toLowerCase())
    )

  const totalAberto = filtered
    .filter(cr => !['recebido', 'conciliado', 'cancelado'].includes(cr.status))
    .reduce((s, cr) => s + cr.valor_original, 0)
  const totalRecebido = filtered
    .filter(cr => ['recebido', 'conciliado'].includes(cr.status))
    .reduce((s, cr) => s + cr.valor_recebido, 0)
  const totalVencido = filtered
    .filter(cr =>
      !['recebido', 'conciliado', 'cancelado'].includes(cr.status) &&
      new Date(cr.data_vencimento) < new Date()
    )
    .reduce((s, cr) => s + cr.valor_original, 0)

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold
          ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Error */}
      {crError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          Erro ao carregar contas a receber: {(crError as Error).message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <TrendingUp size={20} className="text-emerald-600" />
          Contas a Receber
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Pipeline de faturamento e recebimentos
        </p>
      </div>

      {/* Omie Sync */}
      <SyncBar isDark={isDark} />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</p>
          <p className={`text-lg font-extrabold mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{filtered.length}</p>
          <p className="text-[10px] text-slate-400">titulos</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-widest">Em Aberto</p>
          <p className="text-lg font-extrabold text-blue-600 mt-1">{fmt(totalAberto)}</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Recebido</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-1">{fmt(totalRecebido)}</p>
        </div>
      </div>

      {/* Vencido alert */}
      {totalVencido > 0 && (
        <div className={`border rounded-2xl p-4 flex items-center gap-3 ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-700">Titulos vencidos</p>
            <p className="text-xs text-red-500">{fmt(totalVencido)} em atraso</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente, NF, descricao..."
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
              ${isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {FILTROS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
                ${statusFilter === f.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark ? 'bg-[#1e293b] text-slate-400 border border-white/[0.06]' : 'bg-white text-slate-500 border border-slate-200'
                }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <DollarSign size={28} className="text-emerald-300" />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum titulo encontrado</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>As contas a receber aparecerao aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cr => (
            <CRCard
              key={cr.id}
              cr={cr}
              isDark={isDark}
              onAutorizar={handleAutorizar}
              onFaturar={setFaturarModal}
              onEmail={handleEmail}
              onAvancar={handleAvancar}
              onReceber={setRecebimentoModal}
              onConciliar={handleConciliar}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {faturarModal && (
        <FaturamentoModal
          cr={faturarModal}
          isDark={isDark}
          onClose={() => { setFaturarModal(null); showToast('NF emitida com sucesso') }}
        />
      )}
      {recebimentoModal && (
        <RegistrarRecebimentoModal
          cr={recebimentoModal}
          isDark={isDark}
          onClose={() => { setRecebimentoModal(null); showToast('Recebimento registrado') }}
        />
      )}
    </div>
  )
}
