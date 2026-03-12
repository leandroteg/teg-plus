import { useState, useMemo, useCallback } from 'react'
import {
  Receipt, Search, Calendar, AlertTriangle, CheckCircle2, Clock,
  FileText, ChevronDown, ChevronUp, Banknote, X, ShieldCheck,
  Building2, Tag, Briefcase, Hash, Layers,
  Paperclip, ExternalLink, Download, ArrowUpDown, LayoutList,
  LayoutGrid, Filter, SortAsc, SortDesc, ArrowDown, ArrowUp,
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
  useRegistrarPagamentoBatch,
} from '../../hooks/useLotesPagamento'
import { supabase } from '../../services/supabase'
import { useAnexosPedido, TIPO_LABEL } from '../../hooks/useAnexos'
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

const fmtDataFull = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ── Sort types ──────────────────────────────────────────────────────────────

type SortField = 'vencimento' | 'valor' | 'fornecedor' | 'emissao'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'vencimento', label: 'Vencimento' },
  { field: 'valor',      label: 'Valor' },
  { field: 'fornecedor', label: 'Fornecedor' },
  { field: 'emissao',    label: 'Emissão' },
]

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

// ── Status icon map ─────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, typeof Receipt> = {
  previsto:      Calendar,
  confirmado:    CheckCircle2,
  em_lote:       Layers,
  aprovado_pgto: ShieldCheck,
  em_pagamento:  Clock,
  pago:          Banknote,
  conciliado:    CheckCircle2,
}

const STATUS_ACCENT: Record<string, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string }> = {
  previsto:      { bg: 'hover:bg-slate-50',   bgActive: 'bg-slate-100',   text: 'text-slate-600',   textActive: 'text-slate-800',   dot: 'bg-slate-400',   border: 'border-slate-400' },
  confirmado:    { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',     text: 'text-blue-600',    textActive: 'text-blue-800',    dot: 'bg-blue-500',    border: 'border-blue-500' },
  em_lote:       { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',   text: 'text-violet-600',  textActive: 'text-violet-800',  dot: 'bg-violet-500',  border: 'border-violet-500' },
  aprovado_pgto: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50',  text: 'text-emerald-600', textActive: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-500' },
  em_pagamento:  { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',    text: 'text-amber-600',   textActive: 'text-amber-800',   dot: 'bg-amber-500',   border: 'border-amber-500' },
  pago:          { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',     text: 'text-teal-600',    textActive: 'text-teal-800',    dot: 'bg-teal-500',    border: 'border-teal-500' },
  conciliado:    { bg: 'hover:bg-green-50',   bgActive: 'bg-green-50',    text: 'text-green-600',   textActive: 'text-green-800',   dot: 'bg-green-500',   border: 'border-green-500' },
}

const STATUS_ACCENT_DARK: Record<string, { bg: string; bgActive: string; text: string; textActive: string }> = {
  previsto:      { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/10',   text: 'text-slate-400',   textActive: 'text-slate-200' },
  confirmado:    { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300' },
  em_lote:       { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10',  text: 'text-violet-400',  textActive: 'text-violet-300' },
  aprovado_pgto: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300' },
  em_pagamento:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',   text: 'text-amber-400',   textActive: 'text-amber-300' },
  pago:          { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-teal-500/10',    text: 'text-teal-400',    textActive: 'text-teal-300' },
  conciliado:    { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-green-500/10',   text: 'text-green-400',   textActive: 'text-green-300' },
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(cps: ContaPagar[], stageName: string) {
  const headers = ['Fornecedor', 'Valor', 'Vencimento', 'Emissao', 'Documento', 'Centro Custo', 'Classe Financeira', 'Obra', 'Pedido', 'Descricao', 'Status']
  const rows = cps.map(cp => [
    cp.fornecedor_nome,
    cp.valor_original.toFixed(2).replace('.', ','),
    fmtDataFull(cp.data_vencimento),
    fmtDataFull(cp.data_emissao),
    cp.numero_documento || '',
    cp.centro_custo || '',
    cp.classe_financeira || '',
    cp.requisicao?.obra_nome || '',
    cp.pedido?.numero_pedido || '',
    cp.descricao || '',
    cp.status,
  ])

  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contas-a-pagar-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── FornecedorBankInfo ──────────────────────────────────────────────────────

function FornecedorBankInfo({ fornecedorId, isDark }: { fornecedorId: string; isDark: boolean }) {
  const { data: forn } = useFornecedorById(fornecedorId)
  if (!forn) return null
  const hasBankData = forn.banco_nome || forn.agencia || forn.conta || forn.pix_chave
  if (!hasBankData) return null

  return (
    <div className={`rounded-xl p-2.5 space-y-1 ${isDark ? 'bg-white/[0.04]' : 'bg-blue-50/60'}`}>
      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
        <Banknote size={9} /> Dados Bancarios
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
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Receipt size={18} className="text-emerald-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cp.fornecedor_nome}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className={`text-2xl font-extrabold ${urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
              {fmtFull(cp.valor_original)}
            </p>
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${STATUS_ACCENT[cp.status]?.bgActive || 'bg-slate-100'} ${STATUS_ACCENT[cp.status]?.textActive || 'text-slate-700'}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_ACCENT[cp.status]?.dot}`} />
              {stage?.label ?? cp.status}
            </span>
          </div>

          {urgency === 'overdue' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-semibold">Vencido em {fmtData(cp.data_vencimento)}</p>
            </div>
          )}

          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Vencimento:</span> <span className="font-semibold">{fmtData(cp.data_vencimento)}</span></div>
              <div><span className="text-slate-400">Emissao:</span> <span className="font-semibold">{fmtData(cp.data_emissao)}</span></div>
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

          {cp.fornecedor_id && <FornecedorBankInfo fornecedorId={cp.fornecedor_id} isDark={isDark} />}

          {cp.pedido_id && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Paperclip size={10} /> Anexos</p>
              <AnexosList pedidoId={cp.pedido_id} />
            </div>
          )}

          {/* Pipeline progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {CP_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = CP_PIPELINE_STAGES.findIndex(st => st.status === cp.status)
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

// ── CPRow (compact table row) ────────────────────────────────────────────────

function CPRow({ cp, onClick, isDark, isSelected, onSelect }: {
  cp: ContaPagar
  onClick: () => void
  isDark: boolean
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const urgency = getUrgency(cp)
  const obraNome = cp.requisicao?.obra_nome
  const pedidoNum = cp.pedido?.numero_pedido

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer transition-all group ${
        isDark
          ? `border-white/[0.04] hover:bg-white/[0.03] ${isSelected ? 'bg-emerald-500/10' : ''}`
          : `border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-emerald-50' : ''}`
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => { e.stopPropagation(); onSelect(cp.id) }}
        onClick={e => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
      />

      <div className={`w-1 h-7 rounded-full shrink-0 ${
        urgency === 'overdue' ? 'bg-red-500' : urgency === 'today' ? 'bg-amber-500' : urgency === 'week' ? 'bg-yellow-400' : 'bg-transparent'
      }`} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {cp.fornecedor_nome}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          {cp.descricao && (
            <span className={`text-[11px] truncate max-w-[200px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cp.descricao}</span>
          )}
          {obraNome && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Building2 size={9} /> {obraNome}
            </span>
          )}
          {pedidoNum && (
            <span className="text-[10px] font-semibold text-teal-600 flex items-center gap-0.5">
              <FileText size={9} /> {pedidoNum}
            </span>
          )}
          {cp.centro_custo && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Briefcase size={9} /> {cp.centro_custo}
            </span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0 w-20">
        <p className={`text-[11px] font-medium flex items-center justify-end gap-0.5 ${
          urgency === 'overdue' ? 'text-red-500 font-bold' : urgency === 'today' ? 'text-amber-600 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>
          <Calendar size={10} />
          {fmtData(cp.data_vencimento)}
        </p>
        {urgency === 'overdue' && (
          <span className="text-[9px] font-bold text-red-500">VENCIDO</span>
        )}
      </div>

      <p className={`text-sm font-extrabold text-right shrink-0 w-28 ${
        urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'
      }`}>
        {fmt(cp.valor_original)}
      </p>
    </div>
  )
}

// ── CPCard (block/card view) ─────────────────────────────────────────────────

function CPCard({ cp, onClick, isDark, isSelected, onSelect }: {
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
      className={`rounded-xl border p-4 cursor-pointer transition-all group ${
        isDark
          ? `border-white/[0.06] hover:border-white/[0.12] ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02]'}`
          : `border-slate-200 hover:border-slate-300 hover:shadow-sm ${isSelected ? 'bg-emerald-50 border-emerald-300' : 'bg-white'}`
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onSelect(cp.id) }}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {cp.fornecedor_nome}
            </p>
            {urgency !== 'normal' && (
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                urgency === 'overdue' ? 'bg-red-500' : urgency === 'today' ? 'bg-amber-500' : 'bg-yellow-400'
              }`} />
            )}
          </div>

          {cp.descricao && (
            <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cp.descricao}</p>
          )}

          <div className="flex items-center justify-between mt-2.5">
            <p className={`text-lg font-extrabold ${urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
              {fmt(cp.valor_original)}
            </p>
            <div className="text-right">
              <p className={`text-[11px] flex items-center gap-0.5 ${
                urgency === 'overdue' ? 'text-red-500 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Calendar size={10} /> {fmtData(cp.data_vencimento)}
              </p>
              {urgency === 'overdue' && <span className="text-[9px] font-bold text-red-500">VENCIDO</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
            {obraNome && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                <Building2 size={9} /> {obraNome}
              </span>
            )}
            {cp.centro_custo && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                <Briefcase size={9} /> {cp.centro_custo}
              </span>
            )}
            {cp.pedido?.numero_pedido && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 flex items-center gap-0.5 font-semibold">
                <FileText size={9} /> {cp.pedido.numero_pedido}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function CPPipeline() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<StatusCP>('previsto')
  const [busca, setBusca] = useState('')
  const [detailCP, setDetailCP] = useState<ContaPagar | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [sortField, setSortField] = useState<SortField>('vencimento')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Data
  const { data: contas = [], isLoading } = useContasPagar()
  const { data: lotes = [] } = useLotesPagamento()

  // Mutations
  const conciliarMut = useConciliarCPBatch()
  const criarLoteMut = useCriarLote()
  const registrarBatchMut = useRegistrarPagamentoBatch()

  // Group all CPs by status
  const grouped = useMemo(() => {
    const map = new Map<StatusCP, ContaPagar[]>()
    for (const s of CP_PIPELINE_STAGES) map.set(s.status, [])
    for (const cp of contas) {
      const arr = map.get(cp.status as StatusCP)
      if (arr) arr.push(cp)
    }
    return map
  }, [contas])

  // Filter active tab by search, then sort
  const activeCPs = useMemo(() => {
    let cps = [...(grouped.get(activeTab) || [])]

    // Search filter
    if (busca) {
      const q = busca.toLowerCase()
      cps = cps.filter(cp =>
        cp.fornecedor_nome.toLowerCase().includes(q)
        || cp.descricao?.toLowerCase().includes(q)
        || cp.numero_documento?.toLowerCase().includes(q)
        || cp.centro_custo?.toLowerCase().includes(q)
        || cp.classe_financeira?.toLowerCase().includes(q)
        || cp.requisicao?.obra_nome?.toLowerCase().includes(q)
        || cp.pedido?.numero_pedido?.toLowerCase().includes(q)
        || cp.natureza?.toLowerCase().includes(q)
      )
    }

    // Sort
    cps.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'vencimento': cmp = a.data_vencimento.localeCompare(b.data_vencimento); break
        case 'emissao':    cmp = a.data_emissao.localeCompare(b.data_emissao); break
        case 'valor':      cmp = a.valor_original - b.valor_original; break
        case 'fornecedor': cmp = a.fornecedor_nome.localeCompare(b.fornecedor_nome); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return cps
  }, [grouped, activeTab, busca, sortField, sortDir])

  // Tab totals
  const tabTotal = useMemo(() => activeCPs.reduce((s, cp) => s + cp.valor_original, 0), [activeCPs])

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
    const allIds = activeCPs.map(cp => cp.id)
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

  const handleConfirmar = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'confirmado' })
        .in('id', ids)
      if (error) throw error
      showToast('success', `${ids.length} titulo(s) confirmado(s)`)
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
    try {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })
        .in('id', ids)
      if (error) throw error
      showToast('success', `${ids.length} pagamento(s) confirmado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao confirmar pagamento') }
  }

  const handleConciliar = async (ids: string[]) => {
    try {
      await conciliarMut.mutateAsync({ ids })
      showToast('success', `${ids.length} titulo(s) conciliado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao conciliar') }
  }

  const handleBulkAction = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    switch (activeTab) {
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

  // Export
  const handleExport = () => {
    const stage = CP_PIPELINE_STAGES.find(s => s.status === activeTab)
    const toExport = selectedIds.size > 0 ? activeCPs.filter(cp => selectedIds.has(cp.id)) : activeCPs
    exportCSV(toExport, stage?.label || activeTab)
    showToast('success', `${toExport.length} registro(s) exportado(s)`)
  }

  // Bulk action config per tab
  const BULK_ACTIONS: Partial<Record<StatusCP, { label: string; icon: typeof CheckCircle2; className: string }>> = {
    previsto:      { label: 'Confirmar',     icon: CheckCircle2, className: 'bg-blue-600 hover:bg-blue-700 text-white' },
    confirmado:    { label: 'Criar Lote',    icon: Layers,       className: 'bg-violet-600 hover:bg-violet-700 text-white' },
    aprovado_pgto: { label: 'Reg. Pagamento', icon: Banknote,    className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    em_pagamento:  { label: 'Confirmar Pgto', icon: CheckCircle2, className: 'bg-teal-600 hover:bg-teal-700 text-white' },
    pago:          { label: 'Conciliar',     icon: CheckCircle2, className: 'bg-green-600 hover:bg-green-700 text-white' },
  }
  const bulk = BULK_ACTIONS[activeTab]
  const selectedInTab = activeCPs.filter(cp => selectedIds.has(cp.id))

  // Switch tab clears selection
  const switchTab = (status: StatusCP) => {
    setActiveTab(status)
    setSelectedIds(new Set())
    setBusca('')
  }

  // Summary stats
  const overdueCt = activeCPs.filter(cp => getUrgency(cp) === 'overdue').length
  const overdueTotal = activeCPs.filter(cp => getUrgency(cp) === 'overdue').reduce((s, c) => s + c.valor_original, 0)

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
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {contas.length} titulos &middot; {fmt(contas.reduce((s, c) => s + c.valor_original, 0))}
          </p>
        </div>
      </div>

      {/* ── Horizontal Tabs ───────────────────────────────────────── */}
      <div className={`flex items-center gap-1 overflow-x-auto hide-scrollbar pb-0.5`}>
        {CP_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status
          const Icon = STATUS_ICONS[stage.status] || Receipt
          const accent = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]

          return (
            <button
              key={stage.status}
              onClick={() => switchTab(stage.status)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? `${accent?.bgActive} ${accent?.textActive} font-bold shadow-sm ${!isDark ? `ring-1 ${STATUS_ACCENT[stage.status]?.border?.replace('border-', 'ring-')}` : ''}`
                  : `${accent?.bg} ${accent?.text} font-medium`
              }`}
            >
              <Icon size={13} className="shrink-0" />
              {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                  isActive
                    ? isDark ? 'bg-white/10 text-white' : `${STATUS_ACCENT[stage.status]?.dot} text-white`
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
            <input
              type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar fornecedor, documento, obra, CC..."
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
            disabled={activeCPs.length === 0}
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
            <span>{activeCPs.length} {activeCPs.length === 1 ? 'titulo' : 'titulos'}</span>
            <span className="font-bold text-emerald-600">{fmt(tabTotal)}</span>
            {overdueCt > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-bold">
                <AlertTriangle size={11} /> {overdueCt} vencido{overdueCt > 1 ? 's' : ''} ({fmt(overdueTotal)})
              </span>
            )}
          </div>
        </div>

        {/* Select all + bulk action bar */}
        {activeCPs.length > 0 && bulk && (
          <div className={`px-4 py-2 border-b flex items-center gap-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={activeCPs.length > 0 && activeCPs.every(cp => selectedIds.has(cp.id))}
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
                  {fmt(selectedInTab.reduce((s, cp) => s + cp.valor_original, 0))} selecionado
                </span>
              </>
            )}
          </div>
        )}

        {/* CP list / cards */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeCPs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <Receipt size={24} className="text-slate-300" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Nenhum titulo nesta etapa
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {busca ? 'Tente outra busca' : 'Os titulos aparecerao aqui quando avancarem'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            // ── List view ──
            activeCPs.map(cp => (
              <CPRow
                key={cp.id}
                cp={cp}
                onClick={() => setDetailCP(cp)}
                isDark={isDark}
                isSelected={selectedIds.has(cp.id)}
                onSelect={toggleSelect}
              />
            ))
          ) : (
            // ── Cards view ──
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {activeCPs.map(cp => (
                <CPCard
                  key={cp.id}
                  cp={cp}
                  onClick={() => setDetailCP(cp)}
                  isDark={isDark}
                  isSelected={selectedIds.has(cp.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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
