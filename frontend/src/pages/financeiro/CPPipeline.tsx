import { useState, useMemo, useRef } from 'react'
import {
  Receipt, Search, Calendar, AlertTriangle, CheckCircle2, Clock,
  FileText, ChevronDown, ChevronUp, Banknote, X, ShieldCheck,
  Building2, Tag, Briefcase, Hash, Layers, ArrowRight,
  LayoutGrid, List, Filter, ChevronRight, ChevronLeft, Plus,
  Paperclip, ExternalLink,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useContasPagar,
  useAprovarPagamento,
  useMarcarCPPago,
  useConciliarCPBatch,
  useFornecedorById,
} from '../../hooks/useFinanceiro'
import {
  useLotesPagamento,
  useCriarLote,
  useEnviarLoteAprovacao,
  useRegistrarPagamentoBatch,
} from '../../hooks/useLotesPagamento'
import { supabase } from '../../services/supabase'
import { useAnexosPedido, useUploadAnexo, TIPO_LABEL } from '../../hooks/useAnexos'
import type { PedidoAnexo } from '../../hooks/useAnexos'
import type { ContaPagar, LotePagamento, StatusCP } from '../../types/financeiro'
import { CP_PIPELINE_STAGES } from '../../types/financeiro'

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

// ── Status configs ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  previsto:       { dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300' },
  confirmado:     { dot: 'bg-blue-500',    bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300' },
  em_lote:        { dot: 'bg-violet-500',  bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-300' },
  aprovado_pgto:  { dot: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  em_pagamento:   { dot: 'bg-amber-500',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300' },
  pago:           { dot: 'bg-teal-500',    bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-300' },
  conciliado:     { dot: 'bg-green-500',   bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-300' },
  cancelado:      { dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500',    border: 'border-gray-300' },
}

// ── Urgency helper ──────────────────────────────────────────────────────────

function getUrgency(cp: ContaPagar): 'overdue' | 'today' | 'week' | 'normal' {
  if (['pago', 'conciliado', 'cancelado'].includes(cp.status)) return 'normal'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const venc = new Date(cp.data_vencimento + 'T00:00:00')
  const diffDays = Math.floor((venc.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'normal'
}

const URGENCY_STYLES = {
  overdue: 'ring-2 ring-red-400/50 border-red-300',
  today:   'ring-2 ring-amber-400/50 border-amber-300',
  week:    'border-yellow-200',
  normal:  '',
}

// ── FornecedorPagamentoInfo ─────────────────────────────────────────────────

function FornecedorBankInfo({ fornecedorId, isDark }: { fornecedorId: string; isDark: boolean }) {
  const { data: forn } = useFornecedorById(fornecedorId)
  if (!forn) return null
  const hasBankData = forn.banco_nome || forn.agencia || forn.conta || forn.pix_chave
  if (!hasBankData) return null

  return (
    <div className={`rounded-xl p-2.5 space-y-1 ${isDark ? 'bg-white/[0.04]' : 'bg-blue-50/60'}`}>
      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
        <Banknote size={9} /> Dados Bancários
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        {forn.banco_nome && <div><span className="text-slate-400">Banco:</span> <span className="font-semibold text-slate-700">{forn.banco_nome}</span></div>}
        {forn.agencia && <div><span className="text-slate-400">Ag:</span> <span className="font-mono text-slate-700">{forn.agencia}</span></div>}
        {forn.conta && <div><span className="text-slate-400">CC:</span> <span className="font-mono text-slate-700">{forn.conta}</span></div>}
        {forn.pix_chave && <div className="col-span-2"><span className="text-slate-400">PIX:</span> <span className="font-mono text-blue-700 font-semibold">{forn.pix_chave}</span></div>}
      </div>
    </div>
  )
}

// ── AnexosList ──────────────────────────────────────────────────────────────

function AnexosList({ pedidoId }: { pedidoId: string }) {
  const { data: anexos, isLoading } = useAnexosPedido(pedidoId)
  if (isLoading) return <div className="flex justify-center py-2"><div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!anexos?.length) return <p className="text-[10px] text-slate-400 italic py-1">Sem anexos</p>
  return (
    <div className="space-y-1">
      {anexos.slice(0, 3).map((a: PedidoAnexo) => (
        <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 hover:border-slate-300 text-[10px] group">
          <Paperclip size={9} className="text-slate-400 shrink-0" />
          <span className="truncate text-slate-600 font-medium">{a.nome_arquivo}</span>
          <ExternalLink size={8} className="text-slate-300 group-hover:text-slate-500 shrink-0 ml-auto" />
        </a>
      ))}
      {anexos.length > 3 && <p className="text-[9px] text-slate-400">+{anexos.length - 3} mais</p>}
    </div>
  )
}

// ── CPDetailModal ───────────────────────────────────────────────────────────

function CPDetailModal({ cp, onClose, onAction, isDark }: {
  cp: ContaPagar
  onClose: () => void
  onAction: (action: string, cp: ContaPagar) => void
  isDark: boolean
}) {
  const nav = useNavigate()
  const urgency = getUrgency(cp)
  const stage = CP_PIPELINE_STAGES.find(s => s.status === cp.status)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Receipt size={18} className="text-emerald-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cp.fornecedor_nome}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Value + Status */}
          <div className="flex items-center justify-between">
            <p className={`text-2xl font-extrabold ${urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
              {fmtFull(cp.valor_original)}
            </p>
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${STATUS_COLORS[cp.status]?.bg} ${STATUS_COLORS[cp.status]?.text}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[cp.status]?.dot}`} />
              {stage?.label ?? cp.status}
            </span>
          </div>

          {/* Urgency alert */}
          {urgency === 'overdue' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-semibold">Vencido em {fmtData(cp.data_vencimento)}</p>
            </div>
          )}

          {/* Details grid */}
          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Vencimento:</span> <span className="font-semibold">{fmtData(cp.data_vencimento)}</span></div>
              <div><span className="text-slate-400">Emissão:</span> <span className="font-semibold">{fmtData(cp.data_emissao)}</span></div>
              {cp.numero_documento && <div><span className="text-slate-400">Documento:</span> <span className="font-mono">{cp.numero_documento}</span></div>}
              {cp.natureza && <div><span className="text-slate-400">Natureza:</span> <span>{cp.natureza}</span></div>}
              {cp.forma_pagamento && <div><span className="text-slate-400">Forma Pgto:</span> <span>{cp.forma_pagamento}</span></div>}
              {cp.centro_custo && <div><span className="text-slate-400">Centro Custo:</span> <span className="font-semibold">{cp.centro_custo}</span></div>}
              {cp.classe_financeira && <div><span className="text-slate-400">Classe Fin:</span> <span className="text-violet-600 font-semibold">{cp.classe_financeira}</span></div>}
              {cp.requisicao?.obra_nome && <div><span className="text-slate-400">Obra:</span> <span className="font-semibold">{cp.requisicao.obra_nome}</span></div>}
              {cp.pedido?.numero_pedido && (
                <div>
                  <span className="text-slate-400">Pedido:</span>{' '}
                  <button onClick={() => nav(`/pedidos?pedido=${cp.pedido_id}`)} className="font-semibold text-teal-700 underline hover:text-teal-800">{cp.pedido.numero_pedido}</button>
                </div>
              )}
              {cp.requisicao?.numero && <div><span className="text-slate-400">RC:</span> <span className="font-semibold text-indigo-600">{cp.requisicao.numero}</span></div>}
              {cp.data_pagamento && <div><span className="text-slate-400">Pago em:</span> <span className="text-emerald-600 font-semibold">{fmtData(cp.data_pagamento)}</span></div>}
              {cp.aprovado_por && <div><span className="text-slate-400">Aprovado por:</span> <span className="font-semibold">{cp.aprovado_por}</span></div>}
            </div>
            {cp.descricao && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">{cp.descricao}</p>}
          </div>

          {/* Bank info */}
          {cp.fornecedor_id && <FornecedorBankInfo fornecedorId={cp.fornecedor_id} isDark={isDark} />}

          {/* Attachments */}
          {cp.pedido_id && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Paperclip size={10} /> Anexos</p>
              <AnexosList pedidoId={cp.pedido_id} />
            </div>
          )}

          {/* Pipeline progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso no Pipeline</p>
            <div className="flex items-center gap-0.5">
              {CP_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = CP_PIPELINE_STAGES.findIndex(st => st.status === cp.status)
                const isPast = i <= currentIdx
                return (
                  <div key={s.status} className="flex items-center flex-1">
                    <div className={`h-1.5 flex-1 rounded-full transition-all ${isPast ? `bg-${s.color}-500` : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              {CP_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = CP_PIPELINE_STAGES.findIndex(st => st.status === cp.status)
                return (
                  <span key={s.status} className={`text-[7px] font-medium ${i <= currentIdx ? `text-${s.color}-600` : 'text-slate-300'}`}>
                    {s.label.split(' ')[0]}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Fechar
            </button>
            {cp.status === 'previsto' && (
              <button onClick={() => onAction('confirmar', cp)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Confirmar
              </button>
            )}
            {cp.status === 'confirmado' && (
              <button onClick={() => onAction('addLote', cp)} className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                <Layers size={15} /> Adicionar ao Lote
              </button>
            )}
            {cp.status === 'aprovado_pgto' && (
              <button onClick={() => onAction('pagar', cp)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <Banknote size={15} /> Registrar Pgto
              </button>
            )}
            {cp.status === 'pago' && (
              <button onClick={() => onAction('conciliar', cp)} className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Conciliar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PipelineCPCard (compact card for Kanban) ────────────────────────────────

function PipelineCPCard({ cp, onClick, isDark, isSelected, onSelect }: {
  cp: ContaPagar
  onClick: () => void
  isDark: boolean
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const urgency = getUrgency(cp)
  const obraNome = cp.requisicao?.obra_nome

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md group ${
        isDark ? 'bg-[#1e293b] hover:bg-[#1e293b]/80' : 'bg-white hover:bg-slate-50'
      } ${isSelected ? 'ring-2 ring-emerald-500' : ''} ${
        isDark ? 'border-white/[0.06]' : URGENCY_STYLES[urgency] || 'border-slate-200'
      }`}
    >
      {/* Selection checkbox */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onSelect(cp.id) }}
          onClick={e => e.stopPropagation()}
          className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
        />
        <div className="flex-1 min-w-0">
          {/* Supplier name */}
          <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {cp.fornecedor_nome}
          </p>

          {/* Value + date */}
          <div className="flex items-center justify-between mt-1">
            <p className={`text-sm font-extrabold ${urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
              {fmt(cp.valor_original)}
            </p>
            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
              urgency === 'overdue' ? 'text-red-500' : urgency === 'today' ? 'text-amber-600' : 'text-slate-400'
            }`}>
              <Calendar size={9} />
              {fmtData(cp.data_vencimento)}
            </span>
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {urgency === 'overdue' && (
              <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">
                <AlertTriangle size={7} /> VENCIDO
              </span>
            )}
            {obraNome && (
              <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{obraNome}</span>
            )}
            {cp.numero_documento && (
              <span className="text-[9px] font-mono text-slate-400">#{cp.numero_documento}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PipelineColumn ──────────────────────────────────────────────────────────

function PipelineColumn({ stage, cps, lotes, isDark, onCardClick, selectedIds, onSelect, onBulkAction }: {
  stage: typeof CP_PIPELINE_STAGES[0]
  cps: ContaPagar[]
  lotes: LotePagamento[]
  isDark: boolean
  onCardClick: (cp: ContaPagar) => void
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onBulkAction: (action: string, ids: string[]) => void
}) {
  const total = cps.reduce((s, cp) => s + cp.valor_original, 0)
  const selectedInCol = cps.filter(cp => selectedIds.has(cp.id))

  // For em_lote stage, group CPs by lote
  const loteGroups = useMemo(() => {
    if (stage.status !== 'em_lote') return null
    const groups = new Map<string, { lote: LotePagamento | null; cps: ContaPagar[] }>()
    for (const cp of cps) {
      const key = cp.lote_id || 'sem-lote'
      if (!groups.has(key)) {
        const lote = lotes.find(l => l.id === cp.lote_id) || null
        groups.set(key, { lote, cps: [] })
      }
      groups.get(key)!.cps.push(cp)
    }
    return groups
  }, [cps, lotes, stage.status])

  // Bulk action labels
  const bulkActions: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    previsto:      { label: 'Confirmar', icon: CheckCircle2, className: 'bg-blue-600 hover:bg-blue-700 text-white' },
    confirmado:    { label: 'Criar Lote', icon: Layers, className: 'bg-violet-600 hover:bg-violet-700 text-white' },
    aprovado_pgto: { label: 'Pagar', icon: Banknote, className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    em_pagamento:  { label: 'Confirmar Pgto', icon: CheckCircle2, className: 'bg-teal-600 hover:bg-teal-700 text-white' },
    pago:          { label: 'Conciliar', icon: CheckCircle2, className: 'bg-green-600 hover:bg-green-700 text-white' },
  }
  const bulk = bulkActions[stage.status]

  return (
    <div className={`flex flex-col min-w-[260px] w-[260px] rounded-2xl border-t-[3px] ${stage.borderColor} ${
      isDark ? 'bg-[#0f172a]/50 border border-white/[0.04]' : 'bg-slate-50/80 border border-slate-200/60'
    }`}>
      {/* Column header */}
      <div className="px-3 py-3 flex items-center justify-between">
        <div>
          <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>{stage.label}</h3>
          <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {cps.length} {cps.length === 1 ? 'título' : 'títulos'} &middot; {fmt(total)}
          </p>
        </div>
        <span className={`text-lg font-extrabold ${isDark ? 'text-white/20' : 'text-slate-300'}`}>{cps.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 max-h-[calc(100vh-320px)] scrollbar-thin">
        {stage.status === 'em_lote' && loteGroups ? (
          // Render grouped by lote
          Array.from(loteGroups.entries()).map(([key, group]) => (
            <div key={key} className={`rounded-xl border p-2 space-y-1.5 ${isDark ? 'bg-violet-500/5 border-violet-500/20' : 'bg-violet-50/50 border-violet-200'}`}>
              {group.lote && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-violet-600 flex items-center gap-1">
                    <Layers size={10} /> {group.lote.numero_lote}
                  </span>
                  <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 ${
                    group.lote.status === 'enviado_aprovacao' ? 'bg-orange-100 text-orange-700'
                    : group.lote.status === 'montando' ? 'bg-violet-100 text-violet-700'
                    : 'bg-slate-100 text-slate-600'
                  }`}>
                    {group.lote.status === 'enviado_aprovacao' ? 'Em Aprovação' : group.lote.status === 'montando' ? 'Montando' : group.lote.status}
                  </span>
                </div>
              )}
              {group.cps.map(cp => (
                <PipelineCPCard key={cp.id} cp={cp} onClick={() => onCardClick(cp)} isDark={isDark}
                  isSelected={selectedIds.has(cp.id)} onSelect={onSelect} />
              ))}
            </div>
          ))
        ) : (
          cps.map(cp => (
            <PipelineCPCard key={cp.id} cp={cp} onClick={() => onCardClick(cp)} isDark={isDark}
              isSelected={selectedIds.has(cp.id)} onSelect={onSelect} />
          ))
        )}

        {cps.length === 0 && (
          <div className="py-8 text-center">
            <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
              <Receipt size={16} className="text-slate-300" />
            </div>
            <p className="text-[10px] text-slate-400">Nenhum título</p>
          </div>
        )}
      </div>

      {/* Bulk action footer */}
      {bulk && selectedInCol.length > 0 && (
        <div className="px-2 pb-2">
          <button
            onClick={() => onBulkAction(stage.status, selectedInCol.map(cp => cp.id))}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${bulk.className}`}
          >
            <bulk.icon size={12} />
            {bulk.label} ({selectedInCol.length})
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function CPPipeline() {
  const { isDark } = useTheme()
  const [busca, setBusca] = useState('')
  const [detailCP, setDetailCP] = useState<ContaPagar | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Data
  const { data: contas = [], isLoading } = useContasPagar()
  const { data: lotes = [] } = useLotesPagamento()

  // Mutations
  const aprovarMut = useAprovarPagamento()
  const pagarMut = useMarcarCPPago()
  const conciliarMut = useConciliarCPBatch()
  const criarLoteMut = useCriarLote()
  const registrarBatchMut = useRegistrarPagamentoBatch()

  // Filter by search
  const filtered = useMemo(() => {
    if (!busca) return contas
    const q = busca.toLowerCase()
    return contas.filter(cp =>
      cp.fornecedor_nome.toLowerCase().includes(q)
      || cp.descricao?.toLowerCase().includes(q)
      || cp.numero_documento?.toLowerCase().includes(q)
      || cp.centro_custo?.toLowerCase().includes(q)
      || cp.requisicao?.obra_nome?.toLowerCase().includes(q)
    )
  }, [contas, busca])

  // Group by status
  const grouped = useMemo(() => {
    const map = new Map<StatusCP, ContaPagar[]>()
    for (const s of CP_PIPELINE_STAGES) map.set(s.status, [])
    for (const cp of filtered) {
      const arr = map.get(cp.status as StatusCP)
      if (arr) arr.push(cp)
    }
    return map
  }, [filtered])

  // KPIs
  const kpis = useMemo(() => {
    const aberto = filtered.filter(cp => !['pago', 'conciliado', 'cancelado'].includes(cp.status))
    const vencidas = aberto.filter(cp => getUrgency(cp) === 'overdue')
    const venc7d = aberto.filter(cp => getUrgency(cp) === 'week' || getUrgency(cp) === 'today')
    const pagos = filtered.filter(cp => ['pago', 'conciliado'].includes(cp.status))
    return {
      totalAberto: aberto.reduce((s, cp) => s + cp.valor_original, 0),
      countAberto: aberto.length,
      totalVencidas: vencidas.reduce((s, cp) => s + cp.valor_original, 0),
      countVencidas: vencidas.length,
      totalVenc7d: venc7d.reduce((s, cp) => s + cp.valor_original, 0),
      countVenc7d: venc7d.length,
      totalPago: pagos.reduce((s, cp) => s + (cp.valor_pago || cp.valor_original), 0),
      countPago: pagos.length,
    }
  }, [filtered])

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

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleConfirmar = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'confirmado' })
        .in('id', ids)
      if (error) throw error
      showToast('success', `${ids.length} título(s) confirmado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao confirmar') }
  }

  const handleCriarLote = async (ids: string[]) => {
    try {
      await criarLoteMut.mutateAsync({ cpIds: ids, criadoPor: 'Financeiro' })
      showToast('success', `Lote criado com ${ids.length} itens`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao criar lote') }
  }

  const handlePagar = async (ids: string[]) => {
    try {
      await registrarBatchMut.mutateAsync({
        cpIds: ids,
        dataPagamento: new Date().toISOString().split('T')[0],
      })
      showToast('success', `${ids.length} pagamento(s) registrado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao registrar pagamento') }
  }

  const handleConfirmarPagamento = async (ids: string[]) => {
    // em_pagamento → pago
    try {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString().split('T')[0],
        })
        .in('id', ids)
      if (error) throw error
      showToast('success', `${ids.length} pagamento(s) confirmado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao confirmar pagamento') }
  }

  const handleConciliar = async (ids: string[]) => {
    try {
      await conciliarMut.mutateAsync({ ids })
      showToast('success', `${ids.length} título(s) conciliado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao conciliar') }
  }

  const handleBulkAction = (status: string, ids: string[]) => {
    if (ids.length === 0) return
    switch (status) {
      case 'previsto': handleConfirmar(ids); break
      case 'confirmado': handleCriarLote(ids); break
      case 'aprovado_pgto': handlePagar(ids); break
      case 'em_pagamento': handleConfirmarPagamento(ids); break
      case 'pago': handleConciliar(ids); break
    }
  }

  const handleDetailAction = (action: string, cp: ContaPagar) => {
    setDetailCP(null)
    switch (action) {
      case 'confirmar': handleConfirmar([cp.id]); break
      case 'addLote': handleCriarLote([cp.id]); break
      case 'pagar': handlePagar([cp.id]); break
      case 'conciliar': handleConciliar([cp.id]); break
    }
  }

  // Scroll controls
  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' })
  }

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
            <Receipt size={20} className="text-emerald-600" />
            Contas a Pagar
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline de pagamentos</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Em Aberto', value: fmt(kpis.totalAberto), sub: `${kpis.countAberto} títulos`, accent: 'text-slate-600', icon: Receipt },
          { label: 'Vencidas', value: fmt(kpis.totalVencidas), sub: `${kpis.countVencidas} títulos`, accent: 'text-red-600', icon: AlertTriangle },
          { label: 'Vence 7 dias', value: fmt(kpis.totalVenc7d), sub: `${kpis.countVenc7d} títulos`, accent: 'text-amber-600', icon: Clock },
          { label: 'Realizado', value: fmt(kpis.totalPago), sub: `${kpis.countPago} títulos`, accent: 'text-emerald-600', icon: CheckCircle2 },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{k.label}</p>
              <k.icon size={13} className={k.accent} />
            </div>
            <p className={`text-lg font-extrabold ${k.accent}`}>{k.value}</p>
            <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Search + scroll controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, obra, documento..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
              isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
            }`}
          />
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => scrollBy(-1)} className={`p-2 rounded-xl border transition-all ${isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scrollBy(1)} className={`p-2 rounded-xl border transition-all ${isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Pipeline columns */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin snap-x snap-mandatory">
          {CP_PIPELINE_STAGES.map(stage => (
            <PipelineColumn
              key={stage.status}
              stage={stage}
              cps={grouped.get(stage.status) || []}
              lotes={lotes}
              isDark={isDark}
              onCardClick={setDetailCP}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
              onBulkAction={handleBulkAction}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailCP && (
        <CPDetailModal
          cp={detailCP}
          onClose={() => setDetailCP(null)}
          onAction={handleDetailAction}
          isDark={isDark}
        />
      )}
    </div>
  )
}
