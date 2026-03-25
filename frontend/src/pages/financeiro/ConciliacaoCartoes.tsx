import { useState, useMemo, useRef, useCallback } from 'react'
import {
  CreditCard, Link2, Unlink, Search, Upload,
  CheckCircle2, AlertCircle, ChevronDown, X,
  RefreshCw, FileText, Clock, Filter, Loader2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useCartoesCredito,
  useApontamentosCartao,
  useFaturasCartao,
  useItensFatura,
  useConciliarItem,
  useDesconciliarItem,
  useUploadFatura,
} from '../../hooks/useCartoes'
import type {
  CartaoCredito, ApontamentoCartao, FaturaCartao, ItemFaturaCartao,
} from '../../types/financeiro'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const ACCEPTED_FATURA_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

function isAcceptedFaturaFile(file?: File | null) {
  return !!file && ACCEPTED_FATURA_MIME_TYPES.includes(file.type)
}

// ── Fatura Upload ─────────────────────────────────────────────────────────────

function FaturaUploadCard({ cartaoId, isDark }: { cartaoId: string; isDark: boolean }) {
  const [file, setFile]             = useState<File | null>(null)
  const [drag, setDrag]             = useState(false)
  const [dismissed, setDismissed]   = useState(false)
  const fileRef                     = useRef<HTMLInputElement>(null)
  const upload                      = useUploadFatura()

  const defaultMonth = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const [mesReferencia, setMesReferencia] = useState(defaultMonth)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (isAcceptedFaturaFile(f)) setFile(f)
  }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (isAcceptedFaturaFile(f)) setFile(f)
    e.target.value = ''
  }

  async function handleUpload() {
    if (!file) return
    try {
      await upload.mutateAsync({ cartaoId, mesReferencia, file })
      setFile(null)
    } catch {
      // error displayed via upload.isError
    }
  }

  if (dismissed) return null

  const isPending = upload.isPending
  const isSuccess = upload.isSuccess
  const isError   = upload.isError

  return (
    <div className={`rounded-2xl border p-4 space-y-3
      ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/60'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload size={14} className="text-emerald-500" />
          <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Upload de Fatura
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Mês de referência */}
      <div>
        <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 block
          ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Mês de Referência
        </label>
        <input
          type="month"
          value={mesReferencia}
          onChange={e => setMesReferencia(e.target.value)}
          className={`w-full px-3 py-2 rounded-xl border text-xs
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
            ${isDark
              ? 'bg-white/[0.03] border-white/[0.06] text-slate-200'
              : 'bg-white border-slate-200 text-slate-700'}`}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => !file && fileRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-4 flex flex-col items-center gap-2
          text-center cursor-pointer transition-all select-none
          ${drag
            ? isDark ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-emerald-400 bg-emerald-50'
            : file
              ? isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-300 bg-emerald-50'
              : isDark ? 'border-white/[0.08] hover:border-white/20' : 'border-slate-200 hover:border-emerald-300'
          }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={handleFile}
        />

        {file ? (
          <>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center
              ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-100'}`}>
              <FileText size={18} className="text-emerald-500" />
            </div>
            <p className={`text-xs font-semibold truncate max-w-full px-2
              ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400">
              {(file.size / 1024).toFixed(0)} KB · Clique para trocar
            </p>
          </>
        ) : (
          <>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center
              ${isDark ? 'bg-white/[0.04]' : 'bg-white'}`}>
              <Upload size={18} className="text-slate-400" />
            </div>
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Arraste o arquivo aqui ou clique para selecionar
            </p>
            <p className="text-[10px] text-slate-400">PDF, JPG, PNG, WebP, HEIC</p>
          </>
        )}
      </div>

      {/* Feedback */}
      {isSuccess && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-emerald-500/10 text-emerald-600 text-xs font-semibold">
          <CheckCircle2 size={13} />
          Fatura enviada! Processando lançamentos em segundo plano…
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-red-500/10 text-red-500 text-xs font-semibold">
          <AlertCircle size={13} />
          Erro ao enviar fatura. Verifique a conexão e tente novamente.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleUpload}
          disabled={!file || isPending}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl
            bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
            text-white text-xs font-bold transition-all shadow-sm shadow-emerald-500/20"
        >
          {isPending ? (
            <><Loader2 size={12} className="animate-spin" /> Processando…</>
          ) : (
            <><Upload size={12} /> Enviar e Processar</>
          )}
        </button>
        {file && !isPending && (
          <button
            onClick={() => setFile(null)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors
              ${isDark
                ? 'border-white/[0.06] text-slate-400 hover:text-slate-200'
                : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
          >
            Limpar
          </button>
        )}
      </div>

      <p className={`text-[10px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        Integração automática via n8n · Os itens aparecerão na coluna de faturas após o processamento
      </p>
    </div>
  )
}

// ── Checkbox circle ───────────────────────────────────────────────────────────

function SelectCircle({ selected, isDark }: { selected: boolean; isDark: boolean }) {
  if (selected) {
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/40">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    )
  }
  return (
    <div className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors
      ${isDark ? 'border-white/20 hover:border-emerald-500/60' : 'border-slate-300 hover:border-emerald-400'}`}
    />
  )
}

// ── Item Fatura Card ──────────────────────────────────────────────────────────

function ItemFaturaRow({
  item,
  isDark,
  isSelected,
  onToggle,
}: {
  item: ItemFaturaCartao
  isDark: boolean
  isSelected: boolean
  onToggle: (id: string) => void
}) {
  const isConc = item.conciliado

  return (
    <div
      onClick={() => !isConc && onToggle(item.id)}
      className={`rounded-xl border px-3 py-2.5 transition-all
        ${isConc
          ? isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
          : isSelected
            ? isDark ? 'bg-emerald-500/10 border-emerald-500/40 cursor-pointer' : 'bg-emerald-50 border-emerald-400 cursor-pointer'
            : isDark ? 'bg-[#1e293b] border-white/[0.06] cursor-pointer hover:border-white/20' : 'bg-white border-slate-200 cursor-pointer hover:border-slate-300'
        }`}>
      <div className="flex items-center gap-2">

        {/* Checkbox or status dot */}
        {isConc ? (
          <div className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" />
        ) : (
          <SelectCircle selected={isSelected} isDark={isDark} />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {item.descricao}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-400">{fmtDate(item.data_lancamento)}</span>
            {item.categoria_banco && (
              <span className="text-[10px] text-slate-400">· {item.categoria_banco}</span>
            )}
            {isConc && item.apontamento && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                <Link2 size={9} /> {item.apontamento.descricao}
              </span>
            )}
          </div>
        </div>

        {/* Valor */}
        <p className={`text-sm font-extrabold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {fmt(item.valor)}
        </p>
      </div>
    </div>
  )
}

// ── Apontamento Card ──────────────────────────────────────────────────────────

function ApontamentoRow({
  a,
  isDark,
  onDesconciliar,
  isBusy,
  isSelected,
  onToggle,
}: {
  a: ApontamentoCartao
  isDark: boolean
  onDesconciliar: (itemId: string, apontamentoId: string) => void
  isBusy: boolean
  isSelected: boolean
  onToggle: (id: string) => void
}) {
  const isConc = a.status === 'conciliado'
  const isEnv  = a.status === 'enviado'

  return (
    <div
      onClick={() => !isConc && onToggle(a.id)}
      className={`rounded-xl border px-3 py-2.5 transition-all
        ${isConc
          ? isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
          : isSelected
            ? isDark ? 'bg-blue-500/10 border-blue-500/40 cursor-pointer' : 'bg-blue-50 border-blue-400 cursor-pointer'
            : isDark ? 'bg-[#1e293b] border-white/[0.06] cursor-pointer hover:border-white/20' : 'bg-white border-slate-200 cursor-pointer hover:border-slate-300'
        }`}>
      <div className="flex items-center gap-2">

        {/* Checkbox or status dot */}
        {isConc ? (
          <div className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" />
        ) : (
          <SelectCircle selected={isSelected} isDark={isDark} />
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {a.descricao}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-400">{fmtDate(a.data_lancamento)}</span>
            {a.estabelecimento && (
              <span className="text-[10px] text-slate-400">· {a.estabelecimento}</span>
            )}
            {isConc && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                <Link2 size={9} /> Conciliado
              </span>
            )}
            {!isConc && !isEnv && (
              <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                <Clock size={9} /> Rascunho
              </span>
            )}
            {a.comprovante_url && (
              <a href={a.comprovante_url} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:underline">
                <FileText size={9} /> Comprovante
              </a>
            )}
          </div>
        </div>

        <p className={`text-sm font-extrabold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {fmt(a.valor)}
        </p>

        {isConc && a.item_fatura_id && (
          <button
            onClick={e => { e.stopPropagation(); onDesconciliar(a.item_fatura_id!, a.id) }}
            disabled={isBusy}
            title="Desvincular"
            className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors
              ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-400 hover:bg-red-50'}`}
          >
            <Unlink size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Confirmation Bar ──────────────────────────────────────────────────────────

function ConfirmBar({
  item,
  apontamento,
  isBusy,
  isDark,
  onConfirm,
  onCancel,
}: {
  item: ItemFaturaCartao
  apontamento: ApontamentoCartao
  isBusy: boolean
  isDark: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const diff = Math.abs(item.valor - apontamento.valor)
  const pct  = item.valor > 0 ? (diff / item.valor) * 100 : 0

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 border-t px-4 py-3 flex items-center gap-3
      shadow-2xl animate-[slideUp_0.25s_ease]
      ${isDark
        ? 'bg-[#0f172a] border-white/[0.08]'
        : 'bg-white border-slate-200'}`}>

      {/* Pair summary */}
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
        {/* Fatura item */}
        <div className={`flex-1 min-w-0 rounded-xl px-3 py-2
          ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
          <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-0.5">Fatura</p>
          <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.descricao}</p>
          <p className="text-[10px] text-slate-400">{fmtDate(item.data_lancamento)} · {fmt(item.valor)}</p>
        </div>

        {/* Arrow */}
        <Link2 size={16} className="shrink-0 text-emerald-500" />

        {/* Apontamento */}
        <div className={`flex-1 min-w-0 rounded-xl px-3 py-2
          ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">Apontamento</p>
          <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{apontamento.descricao}</p>
          <p className="text-[10px] text-slate-400">{fmtDate(apontamento.data_lancamento)} · {fmt(apontamento.valor)}</p>
        </div>
      </div>

      {/* Diff warning */}
      {pct > 1 && (
        <div className="shrink-0 text-center">
          <p className="text-[10px] text-amber-500 font-bold">{pct.toFixed(1)}% diff</p>
          <p className="text-[10px] text-slate-400">{fmt(diff)}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onCancel}
          className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors
            ${isDark
              ? 'border-white/[0.08] text-slate-400 hover:text-slate-200'
              : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={isBusy}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
            text-white text-xs font-bold transition-all flex items-center gap-2 shadow-sm shadow-emerald-500/20"
        >
          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
          Confirmar Conciliação
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ConciliacaoCartoes() {
  const { isDark } = useTheme()

  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>('')
  const [faturaSelecionada, setFaturaSelecionada] = useState<string>('')
  const [buscaApontamento, setBuscaApontamento] = useState('')
  const [buscaFatura, setBuscaFatura]   = useState('')
  const [showSoConc, setShowSoConc]    = useState(false)

  // Checkbox selections
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedApId, setSelectedApId]     = useState<string | null>(null)

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data: cartoes = [] } = useCartoesCredito()
  const { data: faturas = [] } = useFaturasCartao(cartaoSelecionado || undefined)
  const hasProcessing = faturas.some(f => f.status === 'processando')

  const { data: itens = [], isLoading: loadingItens }  = useItensFatura(
    faturaSelecionada || undefined,
    faturaSelecionada ? undefined : (cartaoSelecionado || undefined),
    hasProcessing
  )
  const { data: apontamentos = [], isLoading: loadingAp } = useApontamentosCartao({
    cartao_id: cartaoSelecionado || undefined,
  })

  const conciliar    = useConciliarItem()
  const desconciliar = useDesconciliarItem()
  const isBusy = conciliar.isPending || desconciliar.isPending

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function toggleItem(id: string) {
    setSelectedItemId(prev => prev === id ? null : id)
  }

  function toggleAp(id: string) {
    setSelectedApId(prev => prev === id ? null : id)
  }

  async function handleConfirmConciliar() {
    if (!selectedItemId || !selectedApId) return
    try {
      await conciliar.mutateAsync({ itemId: selectedItemId, apontamentoId: selectedApId })
      setSelectedItemId(null)
      setSelectedApId(null)
      showToast('success', 'Lançamento conciliado com sucesso')
    } catch {
      showToast('error', 'Erro ao conciliar lançamento')
    }
  }

  async function handleDesconciliar(itemId: string, apontamentoId: string) {
    try {
      await desconciliar.mutateAsync({ itemId, apontamentoId })
      showToast('success', 'Vínculo removido')
    } catch {
      showToast('error', 'Erro ao desvincular')
    }
  }

  // Filtragem local
  const filteredItens = useMemo(() => {
    let r = itens
    if (showSoConc) r = r.filter(i => i.conciliado)
    if (buscaFatura) {
      const q = buscaFatura.toLowerCase()
      r = r.filter(i => i.descricao.toLowerCase().includes(q) || i.categoria_banco?.toLowerCase().includes(q))
    }
    return r
  }, [itens, showSoConc, buscaFatura])

  const filteredAp = useMemo(() => {
    let r = apontamentos
    if (showSoConc) r = r.filter(a => a.status === 'conciliado')
    if (buscaApontamento) {
      const q = buscaApontamento.toLowerCase()
      r = r.filter(a =>
        a.descricao.toLowerCase().includes(q)
        || a.estabelecimento?.toLowerCase().includes(q)
        || a.centro_custo?.toLowerCase().includes(q)
      )
    }
    return r
  }, [apontamentos, showSoConc, buscaApontamento])

  // Lookup for confirmation bar
  const selectedItem = selectedItemId ? itens.find(i => i.id === selectedItemId) : null
  const selectedAp   = selectedApId   ? apontamentos.find(a => a.id === selectedApId) : null
  const showBar      = !!(selectedItem && selectedAp)

  // Métricas
  const totalItens = itens.length
  const concItens  = itens.filter(i => i.conciliado).length
  const totalAp    = apontamentos.length
  const concAp     = apontamentos.filter(a => a.status === 'conciliado').length
  const valorFatura = itens.reduce((s, i) => s + i.valor, 0)
  const valorAp     = apontamentos.filter(a => a.status !== 'rascunho').reduce((s, a) => s + a.valor, 0)
  const diff        = valorFatura - valorAp

  const card = (extra = '') =>
    `rounded-2xl border shadow-sm ${extra} ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`

  return (
    <div className={`space-y-4 ${showBar ? 'pb-28' : 'pb-6'}`}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm
          font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <CreditCard size={20} className="text-emerald-600" />
          Conciliação de Cartões de Crédito
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Selecione um item da fatura e um apontamento para confirmá-los como o mesmo lançamento
        </p>
      </div>

      {/* ── Seletores: cartão + fatura ───────────────────────────── */}
      <div className={card('p-3 flex flex-col sm:flex-row gap-3 items-end')}>
        {/* Cartão */}
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Cartão
          </label>
          <div className="relative">
            <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={cartaoSelecionado}
              onChange={e => { setCartaoSelecionado(e.target.value); setFaturaSelecionada('') }}
              className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm appearance-none
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 text-slate-700'}`}
            >
              <option value="">Todos os cartões</option>
              {cartoes.map((c: CartaoCredito) => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.ultimos4 ? ` ····${c.ultimos4}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Fatura / Mês */}
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Fatura / Mês de Referência
          </label>
          <div className="relative">
            <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={faturaSelecionada}
              onChange={e => setFaturaSelecionada(e.target.value)}
              disabled={faturas.length === 0}
              className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm appearance-none
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                disabled:opacity-50
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 text-slate-700'}`}
            >
              <option value="">Todas as faturas</option>
              {faturas.map((f: FaturaCartao) => (
                <option key={f.id} value={f.id}>
                  {f.mes_referencia} — {f.cartao?.nome ?? ''}
                  {f.valor_total ? ` · ${fmt(f.valor_total)}` : ''}
                  {f.status === 'processando' ? ' · ⏳ Processando' : ''}
                  {f.status === 'erro' ? ' · ❌ Erro' : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Filtro rápido */}
        <button
          onClick={() => setShowSoConc(v => !v)}
          className={`shrink-0 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2
            ${showSoConc
              ? 'bg-emerald-600 text-white border-emerald-600'
              : isDark ? 'border-white/[0.06] text-slate-400 hover:border-emerald-500/30' : 'border-slate-200 text-slate-500 hover:border-emerald-300'
            }`}
        >
          <Filter size={12} />
          {showSoConc ? 'Só conciliados' : 'Todos'}
        </button>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Fatura Total</p>
          <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(valorFatura)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{concItens}/{totalItens} conciliados</p>
        </div>
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Apontamentos</p>
          <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(valorAp)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{concAp}/{totalAp} conciliados</p>
        </div>
        <div className={`${card('p-3.5')} ${Math.abs(diff) > 10 ? isDark ? 'border-amber-500/20' : 'border-amber-200' : ''}`}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Diferença</p>
          <p className={`text-sm font-extrabold ${Math.abs(diff) > 10 ? 'text-amber-500' : 'text-emerald-600'}`}>
            {diff > 0 ? '+' : ''}{fmt(diff)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {Math.abs(diff) <= 10 ? 'Balanceado' : 'Verificar diferença'}
          </p>
        </div>
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest mb-1 flex items-center gap-1">
            <CheckCircle2 size={9} /> Progresso
          </p>
          <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {totalItens > 0 ? Math.round((concItens / totalItens) * 100) : 0}%
          </p>
          <div className={`mt-1.5 h-1.5 rounded-full ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${totalItens > 0 ? (concItens / totalItens) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Hint ────────────────────────────────────────────────── */}
      {!showBar && (selectedItemId || selectedApId) && (
        <div className={`rounded-xl border px-4 py-2.5 flex items-center gap-2 text-xs font-semibold
          ${isDark ? 'border-blue-500/20 bg-blue-500/5 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
          <Link2 size={13} />
          {selectedItemId && !selectedApId
            ? 'Agora selecione um apontamento na coluna da esquerda para conciliar'
            : 'Agora selecione um item da fatura na coluna da direita para conciliar'
          }
        </div>
      )}

      {/* ── Split View ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── LEFT: Apontamentos dos portadores ─────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Apontamentos dos Portadores
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                {filteredAp.length}
              </span>
            </h2>
          </div>

          {/* Busca apontamentos */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={buscaApontamento}
              onChange={e => setBuscaApontamento(e.target.value)}
              placeholder="Buscar apontamento..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            />
          </div>

          {loadingAp ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredAp.length === 0 ? (
            <div className={`rounded-xl border p-6 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
              <p className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Nenhum apontamento
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Os portadores ainda não lançaram gastos para este cartão
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredAp.map(a => (
                <ApontamentoRow
                  key={a.id}
                  a={a}
                  isDark={isDark}
                  onDesconciliar={handleDesconciliar}
                  isBusy={isBusy}
                  isSelected={selectedApId === a.id}
                  onToggle={toggleAp}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Faturas dos cartões (extraído via n8n) ──────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              Faturas dos Cartões
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                ${isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                {filteredItens.length}
              </span>
            </h2>
            {hasProcessing ? (
              <span className="text-[10px] text-amber-500 flex items-center gap-1 font-semibold">
                <Loader2 size={9} className="animate-spin" />
                Processando fatura…
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <RefreshCw size={9} />
                Extraído via n8n
              </span>
            )}
          </div>

          {/* Busca itens fatura */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={buscaFatura}
              onChange={e => setBuscaFatura(e.target.value)}
              placeholder="Buscar lançamento da fatura..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            />
          </div>

          {loadingItens ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredItens.length === 0 ? (
            <div className="space-y-3">
              <div className={`rounded-xl border p-4 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nenhum lançamento de fatura
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {cartaoSelecionado
                    ? 'Faça upload da fatura PDF abaixo'
                    : 'Selecione um cartão e envie a fatura'
                  }
                </p>
              </div>
              {cartaoSelecionado && (
                <FaturaUploadCard cartaoId={cartaoSelecionado} isDark={isDark} />
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredItens.map(item => (
                  <ItemFaturaRow
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    isSelected={selectedItemId === item.id}
                    onToggle={toggleItem}
                  />
                ))}
              </div>
              {/* Upload nova fatura */}
              {cartaoSelecionado && (
                <FaturaUploadCard cartaoId={cartaoSelecionado} isDark={isDark} />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Confirmation Bar ────────────────────────────────────── */}
      {showBar && selectedItem && selectedAp && (
        <ConfirmBar
          item={selectedItem}
          apontamento={selectedAp}
          isBusy={isBusy}
          isDark={isDark}
          onConfirm={handleConfirmConciliar}
          onCancel={() => { setSelectedItemId(null); setSelectedApId(null) }}
        />
      )}
    </div>
  )
}
