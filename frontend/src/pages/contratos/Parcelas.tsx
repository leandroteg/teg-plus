import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays, Search, Clock, CheckCircle2, AlertTriangle,
  Upload, X, Banknote, FileText, TrendingUp, TrendingDown,
  Paperclip, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  useParcelas, useLiberarParcela, useConfirmarPagamento,
  useUploadAnexoParcela, useAnexosParcela,
} from '../../hooks/useContratos'
import { useAuth } from '../../contexts/AuthContext'
import type { Parcela, ParcelaAnexo } from '../../types/contratos'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  previsto:  { label: 'Previsto',   dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600'   },
  pendente:  { label: 'Pendente',   dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  liberado:  { label: 'Liberado',   dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  pago:      { label: 'Pago',       dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  cancelado: { label: 'Cancelado',  dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500'    },
}

const FILTROS_STATUS = [
  { label: 'Todos',     value: '' },
  { label: 'Previstas', value: 'previsto' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Liberadas', value: 'liberado' },
  { label: 'Pagas',     value: 'pago' },
]

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ── Anexos List ──────────────────────────────────────────────────────────────
function AnexosList({ parcelaId }: { parcelaId: string }) {
  const { data: anexos, isLoading } = useAnexosParcela(parcelaId)

  if (isLoading) return (
    <div className="flex justify-center py-2">
      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!anexos?.length) return (
    <p className="text-[11px] text-slate-400 italic py-1">Nenhum anexo enviado.</p>
  )

  const TIPO_LABEL: Record<string, string> = {
    nota_fiscal: 'NF', medicao: 'Medição', recibo: 'Recibo',
    comprovante: 'Comprovante', outro: 'Outro',
  }

  return (
    <div className="space-y-1">
      {anexos.map((a: ParcelaAnexo) => (
        <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200
            bg-white hover:border-slate-300 hover:shadow-sm transition-all group">
          <Paperclip size={11} className="text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-slate-700 truncate">{a.nome_arquivo}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-semibold bg-indigo-50 text-indigo-600 rounded-full px-1.5 py-0.5">
                {TIPO_LABEL[a.tipo] ?? a.tipo}
              </span>
              <span className="text-[9px] text-slate-400">
                {new Date(a.uploaded_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
          <ExternalLink size={10} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
        </a>
      ))}
    </div>
  )
}

// ── Liberar Modal ────────────────────────────────────────────────────────────
interface LiberarModalProps {
  parcela: Parcela
  isDespesa: boolean
  onClose: () => void
}

function LiberarModal({ parcela, isDespesa, onClose }: LiberarModalProps) {
  const { perfil } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [tipoAnexo, setTipoAnexo] = useState(isDespesa ? 'nota_fiscal' : 'medicao')
  const [nfNumero, setNfNumero] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const liberarMutation = useLiberarParcela()
  const uploadAnexo = useUploadAnexoParcela()

  const handleConfirm = async () => {
    setErro('')
    setLoading(true)
    try {
      // 1. Upload anexo if provided
      if (arquivo) {
        await uploadAnexo.mutateAsync({
          parcelaId: parcela.id,
          file: arquivo,
          tipo: tipoAnexo,
          observacao: observacao || undefined,
        })
      }

      // 2. Liberar parcela
      await liberarMutation.mutateAsync({
        parcelaId: parcela.id,
        liberadoPor: perfil?.nome ?? 'Sistema',
        nfNumero: nfNumero || undefined,
      })

      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao liberar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-indigo-600" />
            <h3 className="text-base font-bold text-slate-800">
              Liberar {isDespesa ? 'Pagamento' : 'Recebimento'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumo */}
          <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
            <p className="font-bold text-slate-800">
              Parcela {parcela.numero} — {parcela.contrato?.numero}
            </p>
            <p className="text-slate-500 text-xs">{parcela.contrato?.objeto}</p>
            <p className={`font-extrabold ${isDespesa ? 'text-amber-600' : 'text-emerald-700'}`}>
              {fmt(parcela.valor)}
            </p>
            <p className="text-[10px] text-slate-400">
              Vencimento: {fmtData(parcela.data_vencimento)}
            </p>
          </div>

          {/* NF Number */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Número da NF / Recibo</p>
            <input value={nfNumero} onChange={e => setNfNumero(e.target.value)}
              placeholder="Ex: NF-12345"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700
                placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
          </div>

          {/* Tipo do anexo */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Tipo do Documento</p>
            <select value={tipoAnexo} onChange={e => setTipoAnexo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700
                focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
              <option value="nota_fiscal">Nota Fiscal</option>
              <option value="medicao">Medição</option>
              <option value="recibo">Recibo</option>
              <option value="comprovante">Comprovante</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          {/* File upload */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Anexar Documento <span className="text-slate-400 font-normal">(opcional)</span>
            </p>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            <button onClick={() => fileRef.current?.click()}
              className={`w-full flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed transition-all ${
                arquivo
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
              }`}>
              <Upload size={20} className={arquivo ? 'text-indigo-500' : 'text-slate-400'} />
              <span className={`text-xs font-semibold ${arquivo ? 'text-indigo-700' : 'text-slate-500'}`}>
                {arquivo
                  ? `${arquivo.name} (${(arquivo.size / 1024).toFixed(0)} KB)`
                  : 'Clique para anexar NF, medição ou recibo'}
              </span>
            </button>

            <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
              placeholder="Observação (opcional)" rows={2}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 text-xs
                text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2
                focus:ring-indigo-500/30 focus:border-indigo-400 resize-none" />
          </div>

          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{erro}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold
                text-slate-600 hover:bg-slate-50 transition-all">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={loading}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold
                hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <CheckCircle2 size={15} />}
              Liberar {isDespesa ? 'Pagamento' : 'Recebimento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Parcela Card ─────────────────────────────────────────────────────────────
function ParcelaCard({ parcela, onLiberar, onConfirmarPgto }: {
  parcela: Parcela
  onLiberar: (p: Parcela) => void
  onConfirmarPgto: (p: Parcela) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isDespesa = parcela.contrato?.tipo_contrato === 'despesa'
  const vencido = !['pago', 'cancelado'].includes(parcela.status) &&
    new Date(parcela.data_vencimento + 'T00:00:00') < new Date()
  const isPago = parcela.status === 'pago'
  const canLiberar = parcela.status === 'pendente'
  const canPay = parcela.status === 'liberado'
  const cfg = STATUS_CONFIG[parcela.status]

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${
      vencido ? 'border-red-200' : isPago ? 'border-emerald-200' : canLiberar ? 'border-amber-200' : canPay ? 'border-blue-200' : 'border-slate-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            vencido ? 'bg-red-50' : isPago ? 'bg-emerald-50'
              : isDespesa ? 'bg-amber-50' : 'bg-emerald-50'
          }`}>
            {vencido
              ? <AlertTriangle size={16} className="text-red-500" />
              : isPago
                ? <CheckCircle2 size={16} className="text-emerald-600" />
                : isDespesa
                  ? <TrendingDown size={16} className="text-amber-600" />
                  : <TrendingUp size={16} className="text-emerald-600" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-bold text-slate-800">
                Parcela {parcela.numero}
              </p>
              <p className={`text-sm font-extrabold shrink-0 ${
                vencido ? 'text-red-600' : isDespesa ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {fmt(parcela.valor)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <StatusBadge status={parcela.status} />
              {parcela.contrato?.numero && (
                <span className="bg-slate-100 text-slate-600 font-mono font-semibold rounded-full px-2 py-0.5">
                  {parcela.contrato.numero}
                </span>
              )}
              <span className={`font-semibold rounded-full px-2 py-0.5 ${
                isDespesa ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {isDespesa ? 'Pagar' : 'Receber'}
              </span>
            </div>

            {parcela.contrato?.objeto && (
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1">{parcela.contrato.objeto}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <CalendarDays size={10} />
                Venc. {fmtData(parcela.data_vencimento)}
              </span>
              {parcela.nf_numero && (
                <span className="flex items-center gap-1 text-slate-500">
                  <FileText size={9} /> NF: {parcela.nf_numero}
                </span>
              )}
              {parcela.liberado_por && (
                <span className="text-blue-500 font-medium">
                  Liberado por {parcela.liberado_por}
                </span>
              )}
              {parcela.data_pagamento && (
                <span className="text-emerald-600 font-medium">
                  {isDespesa ? 'Pago' : 'Recebido'} em {fmtData(parcela.data_pagamento)}
                </span>
              )}
            </div>
          </div>

          <button onClick={() => setExpanded(v => !v)}
            className="text-slate-400 hover:text-slate-600 shrink-0">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          {canLiberar && (
            <button onClick={() => onLiberar(parcela)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 transition-all
                shadow-sm shadow-amber-500/20">
              <CheckCircle2 size={12} />
              Liberar {isDespesa ? 'Pagamento' : 'Recebimento'}
            </button>
          )}
          {canPay && (
            <button onClick={() => onConfirmarPgto(parcela)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-all">
              <Banknote size={11} />
              Confirmar {isDespesa ? 'Pagamento' : 'Recebimento'}
            </button>
          )}
          {!canLiberar && !canPay && !expanded && (
            <button onClick={() => setExpanded(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-500
                hover:bg-slate-100 transition-all">
              <Paperclip size={11} />
              Detalhes
            </button>
          )}
        </div>
      </div>

      {/* Expanded: Anexos */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Paperclip size={11} /> Anexos
          </p>
          <AnexosList parcelaId={parcela.id} />

          {parcela.observacoes && (
            <div className="bg-slate-50 rounded-xl p-3 mt-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observações</p>
              <p className="text-[11px] text-slate-600 mt-1">{parcela.observacoes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ParcelasPage() {
  const [searchParams] = useSearchParams()
  const contratoId = searchParams.get('contrato') ?? undefined

  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [liberarModal, setLiberarModal] = useState<Parcela | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data: parcelas = [], isLoading } = useParcelas(contratoId, statusFilter ? { status: statusFilter } : undefined)
  const confirmarMutation = useConfirmarPagamento()

  const handleConfirmarPgto = (p: Parcela) => {
    const isDespesa = p.contrato?.tipo_contrato === 'despesa'
    const label = isDespesa ? 'pagamento' : 'recebimento'
    if (!confirm(`Confirmar ${label} de ${fmt(p.valor)} — Parcela ${p.numero}?`)) return
    confirmarMutation.mutate({ parcelaId: p.id }, {
      onSuccess: () => {
        setToast({ type: 'success', msg: `${isDespesa ? 'Pagamento' : 'Recebimento'} confirmado` })
        setTimeout(() => setToast(null), 4000)
      },
      onError: () => {
        setToast({ type: 'error', msg: `Erro ao confirmar ${label}` })
        setTimeout(() => setToast(null), 5000)
      },
    })
  }

  const filtered = parcelas.filter(p =>
    !busca || p.contrato?.numero?.toLowerCase().includes(busca.toLowerCase())
      || p.contrato?.objeto?.toLowerCase().includes(busca.toLowerCase())
      || p.nf_numero?.toLowerCase().includes(busca.toLowerCase())
  )

  const totalAberto = filtered
    .filter(p => !['pago', 'cancelado'].includes(p.status))
    .reduce((s, p) => s + p.valor, 0)
  const totalPago = filtered
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + p.valor, 0)

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <CalendarDays size={20} className="text-indigo-600" />
          Parcelas
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {contratoId ? 'Parcelas deste contrato' : 'Todas as parcelas de contratos'}
        </p>
      </div>

      {/* ── Resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</p>
          <p className="text-lg font-extrabold text-slate-800 mt-1">{filtered.length}</p>
          <p className="text-[10px] text-slate-400">parcelas</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-widest">Em Aberto</p>
          <p className="text-lg font-extrabold text-amber-600 mt-1">{fmt(totalAberto)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Pago</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-1">{fmt(totalPago)}</p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar contrato, NF..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white
              text-sm text-slate-700 placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {FILTROS_STATUS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
                ${statusFilter === f.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200'
                }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={28} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhuma parcela encontrada</p>
          <p className="text-xs text-slate-400 mt-1">As parcelas aparecerão aqui quando contratos forem criados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <ParcelaCard
              key={p.id}
              parcela={p}
              onLiberar={setLiberarModal}
              onConfirmarPgto={handleConfirmarPgto}
            />
          ))}
        </div>
      )}

      {/* ── Modal: Liberar ────────────────────────────────────── */}
      {liberarModal && (
        <LiberarModal
          parcela={liberarModal}
          isDespesa={liberarModal.contrato?.tipo_contrato === 'despesa'}
          onClose={() => setLiberarModal(null)}
        />
      )}
    </div>
  )
}
