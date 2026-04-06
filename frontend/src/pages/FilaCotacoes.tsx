import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Clock, CheckCircle, AlertTriangle, ChevronRight, Info,
  XCircle, MessageSquare, FileText, ScrollText, Ban, Search, X, ArrowUp, ArrowDown,
  LayoutList, LayoutGrid, Download, Loader2, Building2, Calendar,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'
import { useCotacoes } from '../hooks/useCotacoes'
import { useCategorias } from '../hooks/useCategorias'
import { useDecisaoRequisicao } from '../hooks/useAprovacoes'
import { useEmitirPedido, useCancelarRequisicao } from '../hooks/usePedidos'
import { useAuth } from '../contexts/AuthContext'
import EmitirPedidoModal from '../components/EmitirPedidoModal'
import type { StatusCotacao, Cotacao } from '../types'
import { minCotacoesPorValor } from '../utils/cotacoesPolicy'

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// ── Types ───────────────────────────────────────────────────────────────────

type PipelineTab = 'pendente' | 'em_cotacao' | 'em_aprovacao'
type SortField = 'data' | 'valor' | 'dias'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

// ── Pipeline stages ─────────────────────────────────────────────────────────

const PIPELINE_STAGES: { status: PipelineTab; label: string; icon: typeof Clock; cotStatuses: StatusCotacao[] }[] = [
  { status: 'pendente',     label: 'Pendentes',    icon: Clock,         cotStatuses: ['pendente'] },
  { status: 'em_cotacao',   label: 'Em Cotação',   icon: ShoppingCart,  cotStatuses: ['em_andamento'] },
  { status: 'em_aprovacao', label: 'Em Aprovação', icon: AlertTriangle, cotStatuses: ['concluida'] },
]

const STATUS_ACCENT: Record<PipelineTab, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string }> = {
  pendente:     { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',    text: 'text-amber-600',  textActive: 'text-amber-800',  dot: 'bg-amber-400',  border: 'border-amber-400' },
  em_cotacao:   { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',     text: 'text-blue-600',   textActive: 'text-blue-800',   dot: 'bg-blue-500',   border: 'border-blue-500' },
  em_aprovacao: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50',  text: 'text-emerald-600',textActive: 'text-emerald-800',dot: 'bg-emerald-500',border: 'border-emerald-500' },
}

const STATUS_ACCENT_DARK: Record<PipelineTab, { bg: string; bgActive: string; text: string; textActive: string }> = {
  pendente:     { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',   text: 'text-amber-400',   textActive: 'text-amber-300' },
  em_cotacao:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300' },
  em_aprovacao: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300' },
}

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',  label: 'Data' },
  { field: 'valor', label: 'Valor' },
  { field: 'dias',  label: 'Dias' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function diasEmAberto(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
}

function getDescricaoPrincipal(cot: Cotacao) {
  const req = cot.requisicao
  const justificativa = (req?.justificativa ?? '').trim()
  if (justificativa) return justificativa

  const descricao = (req?.descricao ?? '').trim()
  if (descricao) return descricao

  return 'Sem descrição'
}

function AlertaCotacoes({
  valor,
  regras,
  isDark,
}: {
  valor: number
  regras?: { ate_500: number; '501_a_2k': number; acima_2k: number }
  isDark: boolean
}) {
  const minCot = minCotacoesPorValor(valor, regras)
  if (minCot === 1) return null
  return (
    <div className={`flex items-start gap-1.5 rounded-xl px-3 py-2 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
      <Info size={12} className={`mt-0.5 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
      <p className={`text-[11px] ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
        Mín. <strong>{minCot} cotações</strong> ({valor <= 2000 ? '>R$500' : '>R$2.000'})
      </p>
    </div>
  )
}

function exportCSV(items: Cotacao[], stageName: string) {
  const headers = ['RC', 'Descrição', 'Obra', 'Valor', 'Fornecedor', 'Status', 'Dias']
  const rows = items.map(c => [
    c.requisicao?.numero ?? '', getDescricaoPrincipal(c), c.requisicao?.obra_nome ?? '',
    c.valor_selecionado ?? c.requisicao?.valor_estimado ?? 0,
    c.fornecedor_selecionado_nome ?? '', c.status, diasEmAberto(c.created_at),
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cotacoes-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Card ────────────────────────────────────────────────────────────────────

function CotCard({ cot, isDark, onClick }: { cot: Cotacao; isDark: boolean; onClick: () => void }) {
  const valor = cot.valor_selecionado ?? (cot.requisicao as any)?.valor_estimado ?? 0
  const dias = diasEmAberto(cot.created_at)
  const concluida = cot.status === 'concluida'
  const descricaoPrincipal = getDescricaoPrincipal(cot)

  return (
    <div onClick={onClick}
      className={`rounded-2xl border p-4 cursor-pointer transition-all active:scale-[0.99] space-y-3 flex flex-col justify-between ${
        isDark
          ? 'bg-white/[0.02] border-white/[0.06] hover:border-teal-500/40 hover:bg-white/[0.04]'
          : concluida
            ? 'bg-white border-emerald-200 hover:border-emerald-300 hover:shadow-md shadow-sm'
            : 'bg-white border-slate-200 hover:border-teal-300 hover:shadow-md shadow-sm'
      }`}>
      {/* Row 1: RC + status + dias */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-mono flex-shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{cot.requisicao?.numero ?? '—'}</span>
          {cot.requisicao?.urgencia && cot.requisicao.urgencia !== 'normal' && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
              cot.requisicao.urgencia === 'critica'
                ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                : isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
            }`}>⚡ {cot.requisicao.urgencia}</span>
          )}
          {concluida && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
              Concluída
            </span>
          )}
        </div>
        {dias > 0 && !concluida && (
          <span className={`text-[10px] font-semibold flex-shrink-0 ${dias > 5 ? 'text-red-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {dias}d
          </span>
        )}
      </div>

      {/* Descrição */}
      <p className={`text-sm font-semibold line-clamp-2 leading-snug ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {descricaoPrincipal}
      </p>

      {/* Obra + Necessidade + Valor */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 max-w-[65%]">
          <span className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Building2 size={10} className="inline mr-1" />{cot.requisicao?.obra_nome}
          </span>
          {cot.requisicao?.data_necessidade && (
            <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Calendar size={9} className="inline mr-0.5" />{new Date(cot.requisicao.data_necessidade).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(cot.requisicao as any)?.compra_recorrente && (
            <span className="text-[8px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">MENSAL</span>
          )}
          <span className={`text-sm font-extrabold ${concluida ? isDark ? 'text-emerald-400' : 'text-emerald-600' : isDark ? 'text-teal-400' : 'text-teal-600'}`}>
            {fmt(valor)}
          </span>
        </div>
      </div>

      {/* Fornecedor selecionado */}
      {cot.fornecedor_selecionado_nome && (
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
          <CheckCircle size={13} /> {cot.fornecedor_selecionado_nome}
        </div>
      )}

      {/* Footer */}
      <div className={`flex items-center justify-between pt-2 ${isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50'}`}>
        {cot.requisicao?.categoria && (
          <span className={`text-[10px] rounded-full px-2 py-0.5 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
            {cot.requisicao.categoria.replace(/_/g, ' ')}
          </span>
        )}
        <span className={`text-xs flex-shrink-0 ml-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtData(cot.created_at)}</span>
      </div>
    </div>
  )
}

// ── Detail Modal ────────────────────────────────────────────────────────────

function CotDetailModal({ cot, onClose, isDark, isAdmin, atLeastComprador, onDecisao, isProcessing, onEmitir, onCancelar, isEmitting, isCancelling, onOpenCotacao }: {
  cot: Cotacao; onClose: () => void; isDark: boolean; isAdmin: boolean; atLeastComprador: boolean
  onDecisao: (decisao: 'aprovada' | 'rejeitada' | 'esclarecimento', obs: string) => void; isProcessing: boolean
  onEmitir: () => void; onCancelar: () => void; isEmitting: boolean; isCancelling: boolean
  onOpenCotacao: () => void
}) {
  const { data: categorias = [] } = useCategorias()
  const [observacao, setObservacao] = useState('')
  const valor = cot.valor_selecionado ?? (cot.requisicao as any)?.valor_estimado ?? 0
  const categoriaCodigo = ((cot.requisicao as any)?.categoria ?? '') as string
  const categoriaRegra = categorias.find(c => c.codigo === categoriaCodigo)?.cotacoes_regras
  const catTipo = categorias.find(c => c.codigo === categoriaCodigo)?.tipo
  const isRecorrente = (cot.requisicao as any)?.compra_recorrente === true
  const deveContrato = isRecorrente || (catTipo === 'servico' && valor > 2000)
  const dias = diasEmAberto(cot.created_at)
  const concluida = cot.status === 'concluida'
  const reqStatus = cot.requisicao?.status
  const descricaoPrincipal = getDescricaoPrincipal(cot)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-teal-600 shrink-0" />
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{cot.requisicao?.numero ?? '—'}</h3>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{descricaoPrincipal}</p>

          {/* Descrição da compra */}
          {cot.requisicao?.justificativa && (
            <div className={`rounded-xl px-3.5 py-2.5 ${isDark ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-teal-50 border border-teal-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Descrição</p>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-teal-200' : 'text-teal-800'}`}>{cot.requisicao.justificativa}</p>
            </div>
          )}

          {/* Grid de dados */}
          <div className={`grid grid-cols-2 gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <div><p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Obra</p><p>{cot.requisicao?.obra_nome}</p></div>
            <div><p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{(cot.requisicao as any)?.compra_recorrente ? 'Valor Mensal' : 'Valor'}</p><div className="flex items-center gap-1.5"><p className={`font-extrabold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{fmt(valor)}</p>{(cot.requisicao as any)?.compra_recorrente && <span className="text-[8px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">RECORRENTE</span>}</div></div>
            <div><p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Dias em aberto</p><p className={dias > 5 ? 'text-red-500 font-bold' : ''}>{dias}d</p></div>
            {cot.fornecedor_selecionado_nome && (
              <div><p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Fornecedor</p><p className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>{cot.fornecedor_selecionado_nome}</p></div>
            )}
          </div>

          {!concluida && <AlertaCotacoes valor={valor} regras={categoriaRegra} isDark={isDark} />}

          {/* Status chips */}
          {concluida && reqStatus === 'cotacao_enviada' && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${isDark ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-teal-50 text-teal-600 border border-teal-200'}`}>
              <Clock size={10} /> Aguard. Aprovação Financeira
            </span>
          )}
          {concluida && reqStatus === 'cotacao_aprovada' && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
              <CheckCircle size={10} /> Aprovada — Pronta para Pedido
            </span>
          )}

          {/* Aprovação financeira */}
          {isAdmin && concluida && reqStatus === 'cotacao_enviada' && (
            <div className={`pt-3 space-y-3 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-teal-100'}`}>
              <p className={`text-[10px] font-bold text-center uppercase tracking-wide ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Aprovação Financeira</p>
              <textarea rows={2} className={`w-full border rounded-xl px-3 py-2 text-sm outline-none ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500/30' : 'border-slate-200 focus:ring-2 focus:ring-teal-400/30'}`}
                placeholder="Observação..." value={observacao} onChange={e => setObservacao(e.target.value)} />
              <div className="flex gap-2">
                <button disabled={isProcessing} onClick={() => onDecisao('rejeitada', observacao)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50">
                  <XCircle size={14} /> Rejeitar
                </button>
                <button disabled={isProcessing} onClick={() => { if (!observacao.trim()) return; onDecisao('esclarecimento', observacao) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-50">
                  <MessageSquare size={14} /> Esclarecer
                </button>
                <button disabled={isProcessing} onClick={() => onDecisao('aprovada', observacao)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50">
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Aprovar
                </button>
              </div>
            </div>
          )}

          {/* Emitir pedido / Solicitar contrato */}
          {atLeastComprador && concluida && reqStatus === 'cotacao_aprovada' && (
            <div className={`pt-3 space-y-2 ${isDark ? 'border-t border-white/[0.06]' : deveContrato ? 'border-t border-indigo-100' : 'border-t border-teal-100'}`}>
              <p className={`text-[10px] font-bold text-center uppercase tracking-wide ${isDark ? (deveContrato ? 'text-indigo-400' : 'text-teal-400') : deveContrato ? 'text-indigo-600' : 'text-teal-600'}`}>
                {deveContrato ? 'Solicitação de Contrato' : 'Emissão de Pedido'}
              </p>
              <div className="flex gap-2">
                <button disabled={isCancelling || isEmitting} onClick={onCancelar}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50">
                  {isCancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Cancelar
                </button>
                <button disabled={isEmitting || isCancelling} onClick={onEmitir}
                  className={`flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 ${deveContrato ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-teal-500 hover:bg-teal-600'}`}>
                  {isEmitting ? <Loader2 size={14} className="animate-spin" /> : deveContrato ? <ScrollText size={14} /> : <FileText size={14} />}
                  {deveContrato ? 'Solicitar Contrato' : 'Emitir Pedido'}
                </button>
              </div>
            </div>
          )}

          {/* Abrir cotação */}
          <button onClick={onOpenCotacao}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isDark ? 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20' : 'bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-200'
            }`}>
            {concluida || !atLeastComprador ? 'Ver detalhes' : 'Abrir e Cotar'} <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function FilaCotacoes() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const { isAdmin, atLeast, perfil } = useAuth()

  const [activeTab, setActiveTab] = useState<PipelineTab>('pendente')
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [detail, setDetail] = useState<Cotacao | null>(null)
  const [emitirCotacao, setEmitirCotacao] = useState<Cotacao | null>(null)

  const { data: cotacoes = [], isLoading } = useCotacoes()
  const { data: categorias = [] } = useCategorias()
  const decisaoMutation = useDecisaoRequisicao()
  const emitirPedidoMutation = useEmitirPedido()
  const cancelarMutation = useCancelarRequisicao()
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Group by pipeline tab
  const grouped = useMemo(() => {
    const map = new Map<PipelineTab, Cotacao[]>()
    for (const stage of PIPELINE_STAGES) map.set(stage.status, [])

    // Filter out finalized items
    const statusesFinalizados = ['pedido_emitido', 'em_entrega', 'entregue', 'comprada', 'cancelada', 'aguardando_pgto', 'pago']

    for (const cot of cotacoes) {
      const reqStatus = cot.requisicao?.status

      // "Em Aprovação" mostra itens aguardando decisão financeira OU prontos para emitir pedido.
      if (cot.status === 'concluida' && reqStatus && reqStatus !== 'cotacao_enviada' && reqStatus !== 'cotacao_aprovada') continue

      // Skip finalized
      if (cot.status === 'concluida' && reqStatus && statusesFinalizados.includes(reqStatus)) continue

      for (const stage of PIPELINE_STAGES) {
        if (stage.cotStatuses.includes(cot.status)) {
          map.get(stage.status)!.push(cot)
          break
        }
      }
    }
    return map
  }, [cotacoes])

  const activeItems = useMemo(() => {
    let items = grouped.get(activeTab) ?? []

    if (busca) {
      const t = busca.toLowerCase()
      items = items.filter(c =>
        (c.requisicao?.numero ?? '').toLowerCase().includes(t) ||
        getDescricaoPrincipal(c).toLowerCase().includes(t) ||
        (c.requisicao?.descricao ?? '').toLowerCase().includes(t) ||
        (c.requisicao?.obra_nome ?? '').toLowerCase().includes(t) ||
        (c.fornecedor_selecionado_nome ?? '').toLowerCase().includes(t)
      )
    }

    items = [...items].sort((a, b) => {
      let cmp = 0
      if (sortField === 'data') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (sortField === 'valor') cmp = (a.valor_selecionado ?? 0) - (b.valor_selecionado ?? 0)
      else if (sortField === 'dias') cmp = diasEmAberto(a.created_at) - diasEmAberto(b.created_at)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  const totalCount = Array.from(grouped.values()).reduce((s, a) => s + a.length, 0)

  const handleDecisao = (reqId: string, numero: string, alcada: number, decisao: 'aprovada' | 'rejeitada' | 'esclarecimento', obs: string, categoria?: string, currentStatus?: string) => {
    if (!perfil) return
    decisaoMutation.mutate({
      requisicaoId: reqId, decisao, observacao: obs || undefined,
      requisicaoNumero: numero, alcadaNivel: alcada,
      aprovadorNome: perfil.nome, aprovadorEmail: perfil.email,
      categoria, currentStatus,
    }, {
      onSuccess: () => { setDetail(null); setToast({ type: 'success', msg: `${numero}: ${decisao === 'aprovada' ? 'Aprovada ✓' : decisao === 'rejeitada' ? 'Rejeitada' : 'Esclarecimento'}` }); setTimeout(() => setToast(null), 4000) },
      onError: () => { setToast({ type: 'error', msg: `Erro ao processar ${numero}` }); setTimeout(() => setToast(null), 5000) },
    })
  }

  return (
    <div className="space-y-3">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <ShoppingCart size={20} className="text-teal-600" /> {'Cota\u00e7\u00f5es'}
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {'Pipeline de cota\u00e7\u00f5es e aprova\u00e7\u00e3o financeira'}
          </p>
        </div>
      </div>

      {/* Pipeline tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status
          const Icon = stage.icon
          const accent = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]

          return (
            <button key={stage.status} onClick={() => setActiveTab(stage.status)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 border ${
                isActive
                  ? isDark
                    ? `${accent.bgActive} ${accent.textActive} border-white/10 shadow-lg`
                    : `${STATUS_ACCENT[stage.status].bgActive} ${STATUS_ACCENT[stage.status].textActive} ${STATUS_ACCENT[stage.status].border} shadow-sm`
                  : isDark
                    ? `bg-transparent ${accent.text} border-white/[0.06] ${accent.bg}`
                    : `bg-white ${STATUS_ACCENT[stage.status].text} border-slate-200 ${STATUS_ACCENT[stage.status].bg}`
              }`}>
              <Icon size={13} />
              {stage.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                isActive ? isDark ? 'bg-white/10 text-white' : 'bg-white/80 text-slate-800' : isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input className={`w-full rounded-lg pl-9 pr-4 py-2 text-xs border transition-all outline-none ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500/30' : 'bg-white border-slate-200 focus:ring-2 focus:ring-teal-400/30'}`}
            placeholder="Buscar RC, descrição..." value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button onClick={() => setBusca('')} className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}><X size={12} /></button>}
        </div>

        {SORT_OPTIONS.map(o => (
          <button key={o.field} onClick={() => { if (sortField === o.field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(o.field); setSortDir('desc') } }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              sortField === o.field ? isDark ? 'bg-white/10 text-white border-white/10' : 'bg-slate-100 text-slate-800 border-slate-200'
                : isDark ? 'bg-transparent text-slate-500 border-white/[0.06] hover:bg-white/5' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}>
            {o.label} {sortField === o.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </button>
        ))}

        <div className={`flex border rounded-lg ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('list')} className={`p-1.5 transition-all ${viewMode === 'list' ? isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} className={`p-1.5 transition-all ${viewMode === 'cards' ? isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
        </div>

        <button onClick={() => exportCSV(activeItems, PIPELINE_STAGES.find(s => s.status === activeTab)?.label ?? '')} disabled={activeItems.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-40 ${isDark ? 'text-slate-400 border-white/[0.06] hover:bg-white/5' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
          <Download size={13} /> CSV
        </button>

        <div className={`ml-auto text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {activeItems.length} de {totalCount}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : activeItems.length === 0 ? (
        <div className={`text-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">Nenhuma cotação nesta etapa</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-2 p-4 stagger-children">
          {activeItems.map(cot => <CotCard key={cot.id} cot={cot} isDark={isDark} onClick={() => setDetail(cot)} />)}
        </div>
      ) : (
        <div className={`rounded-xl border overflow-x-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'}>
                <th className="text-left px-3 py-2 font-semibold">RC</th>
                <th className="text-left px-3 py-2 font-semibold">{`Descri\u00e7\u00e3o`}</th>
                <th className="text-left px-3 py-2 font-semibold">Obra</th>
                <th className="text-left px-3 py-2 font-semibold">Necessidade</th>
                <th className="text-center px-3 py-2 font-semibold">{`Urg\u00eancia`}</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
                <th className="text-left px-3 py-2 font-semibold">Fornecedor</th>
                <th className="text-left px-3 py-2 font-semibold">Dias</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map(cot => (
                <tr key={cot.id} onClick={() => setDetail(cot)}
                  className={`cursor-pointer transition-all ${isDark ? 'hover:bg-white/[0.03] border-t border-white/[0.04]' : 'hover:bg-slate-50 border-t border-slate-100'}`}>
                  <td className={`px-3 py-2 font-mono ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{cot.requisicao?.numero ?? '—'}</td>
                  <td className={`px-3 py-2 max-w-[200px] truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{getDescricaoPrincipal(cot)}</td>
                  <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cot.requisicao?.obra_nome}</td>
                  <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cot.requisicao?.data_necessidade ? new Date(cot.requisicao.data_necessidade).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-3 py-2 text-center">{cot.requisicao?.urgencia && cot.requisicao.urgencia !== 'normal' ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cot.requisicao.urgencia === 'critica' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') : (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')}`}>{cot.requisicao.urgencia}</span>
                  ) : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}</td>
                  <td className={`px-3 py-2 text-right font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{fmt(cot.valor_selecionado ?? 0)}</td>
                  <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cot.fornecedor_selecionado_nome ?? '—'}</td>
                  <td className={`px-3 py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{diasEmAberto(cot.created_at)}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <CotDetailModal cot={detail} isDark={isDark} onClose={() => setDetail(null)}
          isAdmin={isAdmin} atLeastComprador={atLeast('comprador')}
          isProcessing={decisaoMutation.isPending}
          onDecisao={(decisao, obs) => {
            const req = detail.requisicao
            if (!req) return
            handleDecisao(req.id, req.numero, req.alcada_nivel, decisao, obs, req.categoria, req.status)
          }}
          onEmitir={() => setEmitirCotacao(detail)}
          onCancelar={() => {
            const req = detail.requisicao
            if (!req) return
            if (!confirm('Cancelar esta requisição?')) return
            cancelarMutation.mutate(req.id, {
              onSuccess: () => { setDetail(null); setToast({ type: 'success', msg: `${req.numero}: Cancelada` }); setTimeout(() => setToast(null), 4000) },
              onError: () => { setToast({ type: 'error', msg: `Erro ao cancelar` }); setTimeout(() => setToast(null), 5000) },
            })
          }}
          isEmitting={emitirPedidoMutation.isPending}
          isCancelling={cancelarMutation.isPending}
          onOpenCotacao={() => { setDetail(null); nav(`/cotacoes/${detail.id}`) }}
        />
      )}

      {emitirCotacao?.requisicao && (() => {
        const req = emitirCotacao.requisicao
        const valorEmitir = emitirCotacao.valor_selecionado ?? (req as any).valor_estimado ?? 0
        const catTipo = categorias.find(c => c.codigo === (req as any).categoria)?.tipo
        const deveContrato = (req as any).compra_recorrente === true || (catTipo === 'servico' && valorEmitir > 2000)
        return (
          <EmitirPedidoModal
            open
            onClose={() => setEmitirCotacao(null)}
            requisicaoId={req.id}
            compraRecorrente={deveContrato}
            cotacao={{
              id: emitirCotacao.id,
              fornecedorNome: emitirCotacao.fornecedor_selecionado_nome ?? "N/A",
              valorTotal: valorEmitir,
              compradorId: emitirCotacao.comprador_id,
            }}
            onSolicitarContrato={async () => {
              try {
                const year = new Date().getFullYear()
                const prefix = `SOL-CON-${year}-`
                const { count } = await supabase.from('con_solicitacoes').select('id', { count: 'exact', head: true }).like('numero', `${prefix}%`)
                const seq = String((count ?? 0) + 1).padStart(3, '0')
                const numero = `${prefix}${seq}`
                const { error: solErr } = await supabase.from('con_solicitacoes').insert({
                  numero,
                  objeto: req.descricao,
                  categoria_contrato: 'prestacao_servico',
                  grupo_contrato: 'prestacao_servicos',
                  tipo_contrato: 'despesa',
                  tipo_contraparte: 'fornecedor',
                  contraparte_nome: emitirCotacao.fornecedor_selecionado_nome ?? 'A definir',
                  obra_id: (req as any).obra_id ?? null,
                  valor_estimado: valorEmitir,
                  solicitante_id: perfil?.id ?? null,
                  solicitante_nome: perfil?.nome || perfil?.email || 'Sistema',
                  etapa_atual: 'solicitacao',
                  status: 'em_andamento',
                  requisicao_origem_id: req.id,
                  urgencia: 'normal',
                  documentos_ref: [],
                })
                if (solErr) throw solErr
                await supabase.from('cmp_requisicoes').update({ status: 'aguardando_contrato' }).eq('id', req.id)
                setEmitirCotacao(null)
                setDetail(null)
                setToast({ type: 'success', msg: `Solicitação de contrato ${numero} criada` })
                setTimeout(() => setToast(null), 4000)
                nav('/contratos/solicitacoes')
              } catch (err: any) {
                setToast({ type: 'error', msg: `Erro: ${err?.message || 'falha ao criar solicitação'}` })
                setTimeout(() => setToast(null), 5000)
              }
            }}
            onConfirm={(payload) => {
              emitirPedidoMutation.mutate({
                requisicaoId: req.id,
                ...payload,
              }, {
                onSuccess: (pedido) => {
                  setEmitirCotacao(null)
                  setDetail(null)
                  setToast({ type: "success", msg: `${pedido.numero_pedido} emitido` })
                  setTimeout(() => setToast(null), 4000)
                },
                onError: (err: any) => {
                  setToast({ type: "error", msg: `Erro: ${err?.message || "erro"}` })
                  setTimeout(() => setToast(null), 5000)
                },
              })
            }}
            isSubmitting={emitirPedidoMutation.isPending}
          />
        )
      })()}
    </div>
  )
}
