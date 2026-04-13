import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp,
  FileText, Ban, AlertTriangle, Calendar, ArrowUp, ArrowDown,
  LayoutList, LayoutGrid, Download, ClipboardList, ShieldCheck, Building2,
  Loader2,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useRequisicoes } from '../hooks/useRequisicoes'
import { useLookupObras } from '../hooks/useLookups'
import { useAprovacoesPendentes, useDecisaoRequisicao } from '../hooks/useAprovacoes'
import { useEmitirPedido, useCancelarRequisicao } from '../hooks/usePedidos'
import { useEditorLock } from '../hooks/useEditorLock'
import { useAuth } from '../contexts/AuthContext'
import StatusBadge from '../components/StatusBadge'
import FluxoTimeline from '../components/FluxoTimeline'
import EmitirPedidoModal from '../components/EmitirPedidoModal'
import type { StatusRequisicao, Aprovacao, Requisicao } from '../types'

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// ── Types ───────────────────────────────────────────────────────────────────

type PipelineTab = 'pendente' | 'em_validacao'
type SortField = 'data' | 'valor' | 'obra'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

// ── Pipeline stages ─────────────────────────────────────────────────────────

const PIPELINE_STAGES: { status: PipelineTab; label: string; icon: typeof ClipboardList; statuses: string[] }[] = [
  { status: 'pendente',     label: 'Requisições Pendentes',   icon: ClipboardList, statuses: ['rascunho'] },
  { status: 'em_validacao', label: 'Em Validação Técnica',   icon: ShieldCheck,   statuses: ['pendente', 'em_aprovacao', 'em_esclarecimento'] },
]

const STATUS_ACCENT: Record<PipelineTab, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string }> = {
  pendente:     { bg: 'hover:bg-amber-50',  bgActive: 'bg-amber-50',   text: 'text-amber-600',  textActive: 'text-amber-800',  dot: 'bg-amber-400',  border: 'border-amber-400' },
  em_validacao: { bg: 'hover:bg-violet-50', bgActive: 'bg-violet-50',  text: 'text-violet-600', textActive: 'text-violet-800', dot: 'bg-violet-500', border: 'border-violet-500' },
}

const STATUS_ACCENT_DARK: Record<PipelineTab, { bg: string; bgActive: string; text: string; textActive: string }> = {
  pendente:     { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',  text: 'text-amber-400',  textActive: 'text-amber-300' },
  em_validacao: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10', text: 'text-violet-400', textActive: 'text-violet-300' },
}

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',  label: 'Data' },
  { field: 'valor', label: 'Valor' },
  { field: 'obra',  label: 'Obra' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, string> = {
  Lauany: 'bg-violet-500', Fernando: 'bg-amber-500', Aline: 'bg-emerald-500',
}

const NIVEL_LABEL: Record<number, string> = {
  1: 'Coordenador', 2: 'Gerente', 3: 'Diretor', 4: 'CEO',
}

function getApprovalStatusLabel(status: string): string | undefined {
  if (status === 'pendente')          return 'Aguard. Valid. Técnica'
  if (status === 'em_aprovacao')      return 'Em Validação Técnica'
  if (status === 'em_esclarecimento') return 'Em Esclarecimento'
  return undefined
}

function CompradorBadge({ nome, isDark }: { nome: string; isDark: boolean }) {
  const bg = AVATAR_COLORS[nome.split(' ')[0]] ?? 'bg-slate-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-[9px] font-extrabold">{nome.slice(0, 2).toUpperCase()}</span>
      </div>
      <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{nome.split(' ')[0]}</span>
    </div>
  )
}

// ── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(items: Requisicao[], stageName: string) {
  const headers = ['Número', 'Descrição', 'Obra', 'Solicitante', 'Valor', 'Urgência', 'Status', 'Data']
  const rows = items.map(r => [
    r.numero, r.descricao, r.obra_nome, r.solicitante_nome,
    r.valor_estimado, r.urgencia, r.status, fmtData(r.created_at),
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `requisicoes-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Card ────────────────────────────────────────────────────────────────────

function ReqCard({ r, apr, isDark, onClick }: {
  r: Requisicao; apr?: Aprovacao; isDark: boolean; onClick: () => void
}) {
  const approvalLabel = getApprovalStatusLabel(r.status)
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 cursor-pointer transition-all active:scale-[0.99] space-y-3 flex flex-col justify-between ${
        isDark
          ? 'bg-white/[0.02] border-white/[0.06] hover:border-teal-500/40 hover:bg-white/[0.04]'
          : 'bg-white border-slate-200 hover:border-teal-300 hover:shadow-md shadow-sm'
      }`}
    >
      {/* Row 1: número + urgência + status */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-mono flex-shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{r.numero}</span>
          {r.urgencia !== 'normal' && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
              r.urgencia === 'critica'
                ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                : isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
            }`}>
              ⚡ {r.urgencia}
            </span>
          )}
          {r.categoria && (
            <span className={`text-[10px] rounded px-1.5 py-0.5 truncate max-w-[80px] ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
              {r.categoria.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <StatusBadge status={r.status as StatusRequisicao} size="sm" customLabel={approvalLabel} />
      </div>

      {/* Descrição */}
      <p className={`text-sm font-semibold line-clamp-2 leading-snug ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.justificativa || r.descricao}</p>

      {/* Obra + Necessidade + Valor */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 max-w-[65%]">
          <span className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Building2 size={10} className="inline mr-1" />{r.obra_nome}
          </span>
          {r.data_necessidade && (
            <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Calendar size={9} className="inline mr-0.5" />{new Date(r.data_necessidade).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(r as any).compra_recorrente && (
            <span className="text-[8px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">MENSAL</span>
          )}
          <span className={`text-sm font-extrabold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{fmt(r.valor_estimado)}</span>
        </div>
      </div>

      {/* Esclarecimento alert */}
      {r.status === 'em_esclarecimento' && r.esclarecimento_msg && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
          <MessageSquare size={13} className={`flex-shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              Esclarecimento solicitado{r.esclarecimento_por ? ` por ${r.esclarecimento_por.split(' ')[0]}` : ''}
            </p>
            <p className={`text-xs line-clamp-2 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{r.esclarecimento_msg}</p>
          </div>
        </div>
      )}

      {/* Comprador + data + chip */}
      <div className={`flex items-center justify-between pt-2 ${isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50'}`}>
        <div className="flex items-center gap-2">
          {r.comprador_nome
            ? <CompradorBadge nome={r.comprador_nome} isDark={isDark} />
            : <span className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>Sem comprador</span>
          }
          {apr && (
            <span className={`text-[10px] font-semibold truncate max-w-[200px] rounded-full px-2 py-0.5 ${
              isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              Aguard. {apr.aprovador_nome?.split(' ')[0]}{apr.nivel && NIVEL_LABEL[apr.nivel] ? ` (${NIVEL_LABEL[apr.nivel]})` : ''}
            </span>
          )}
        </div>
        <span className={`text-xs flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {r.solicitante_nome.split(' ')[0]} · {fmtData(r.created_at)}
        </span>
      </div>
    </div>
  )
}

// ── Detail Modal ────────────────────────────────────────────────────────────

function DetailModal({ r, apr, onClose, isDark, canDecide, onDecisao, isProcessing, onEmitir, onCancelar, isEmitting, isCancelling }: {
  r: Requisicao; apr?: Aprovacao; onClose: () => void; isDark: boolean
  canDecide: boolean
  onDecisao: (decisao: 'aprovada' | 'rejeitada' | 'esclarecimento', obs: string) => void
  isProcessing: boolean
  onEmitir: () => void; onCancelar: () => void; isEmitting: boolean; isCancelling: boolean
}) {
  const [observacao, setObservacao] = useState('')
  const approvalLabel = getApprovalStatusLabel(r.status)
  const atLeastComprador = true // will be checked externally

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-teal-600 shrink-0" />
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>#{r.numero}</h3>
            <StatusBadge status={r.status as StatusRequisicao} size="sm" customLabel={approvalLabel} />
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumo */}
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.justificativa || r.descricao}</p>

          {/* Detalhes adicionais */}
          {r.descricao && r.descricao !== r.justificativa && (
            <div className={`rounded-xl px-3.5 py-2.5 ${isDark ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-teal-50 border border-teal-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Detalhes adicionais</p>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-teal-200' : 'text-teal-800'}`}>{r.descricao}</p>
            </div>
          )}

          {/* Timeline */}
          <FluxoTimeline status={r.status} compact />

          {/* Grid de dados */}
          <div className={`grid grid-cols-2 gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <div>
              <p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Obra</p>
              <p>{r.obra_nome}</p>
            </div>
            <div>
              <p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{(r as any).compra_recorrente ? 'Valor Mensal' : 'Valor Estimado'}</p>
              <div className="flex items-center gap-1.5">
                <p className={`font-extrabold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{fmt(r.valor_estimado)}</p>
                {(r as any).compra_recorrente && (
                  <span className="text-[8px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">RECORRENTE</span>
                )}
              </div>
            </div>
            <div>
              <p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Solicitante</p>
              <p>{r.solicitante_nome}</p>
            </div>
            <div>
              <p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Data</p>
              <p>{fmtData(r.created_at)}</p>
            </div>
            {r.comprador_nome && (
              <div>
                <p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Comprador</p>
                <CompradorBadge nome={r.comprador_nome} isDark={isDark} />
              </div>
            )}
            {r.urgencia !== 'normal' && (
              <div>
                <p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Urgência</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  r.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>⚡ {r.urgencia}</span>
              </div>
            )}
            {r.categoria && (
              <div>
                <p className={`font-bold mb-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Categoria</p>
                <p>{r.categoria.replace(/_/g, ' ')}</p>
              </div>
            )}
          </div>

          {/* Justificativa de urgência */}
          {r.urgencia !== 'normal' && r.justificativa_urgencia && (
            <div className={`rounded-xl px-3.5 py-2.5 ${
              r.urgencia === 'critica'
                ? isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'
                : isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100'
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                r.urgencia === 'critica'
                  ? isDark ? 'text-red-400' : 'text-red-600'
                  : isDark ? 'text-amber-400' : 'text-amber-600'
              }`}>Justificativa de Urgência</p>
              <p className={`text-xs leading-relaxed ${
                r.urgencia === 'critica'
                  ? isDark ? 'text-red-200' : 'text-red-800'
                  : isDark ? 'text-amber-200' : 'text-amber-800'
              }`}>{r.justificativa_urgencia}</p>
            </div>
          )}

          {r.esclarecimento_msg && (
            <div className={`rounded-xl px-3.5 py-2.5 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare size={13} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Esclarecimento Solicitado</p>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{r.esclarecimento_msg}</p>
              {(r.esclarecimento_por || r.esclarecimento_em) && (
                <p className={`text-[10px] mt-1.5 ${isDark ? 'text-amber-500' : 'text-amber-500'}`}>
                  {r.esclarecimento_por && <>Por: <span className="font-semibold">{r.esclarecimento_por}</span></>}
                  {r.esclarecimento_por && r.esclarecimento_em && ' · '}
                  {r.esclarecimento_em && fmtData(r.esclarecimento_em)}
                </p>
              )}
            </div>
          )}

          {/* Ações de decisão */}
          {canDecide && (
            <div className={`pt-3 space-y-3 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <textarea
                rows={2}
                className={`w-full border rounded-xl px-3 py-2 text-sm outline-none ${
                  isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500/30'
                    : 'border-slate-200 focus:ring-2 focus:ring-teal-400/30'
                }`}
                placeholder="Observação / motivo..."
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
              />
              <div className="flex gap-2">
                <button disabled={isProcessing} onClick={() => onDecisao('rejeitada', observacao)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-[0.98] transition-all disabled:opacity-50">
                  <XCircle size={14} /> Rejeitar
                </button>
                <button disabled={isProcessing} onClick={() => { if (!observacao.trim()) return; onDecisao('esclarecimento', observacao) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 active:scale-[0.98] transition-all disabled:opacity-50">
                  <MessageSquare size={14} /> Esclarecer
                </button>
                <button disabled={isProcessing} onClick={() => onDecisao('aprovada', observacao)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98] transition-all disabled:opacity-50">
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Aprovar
                </button>
              </div>
            </div>
          )}

          {/* Emitir Pedido / Cancelar */}
          {r.status === 'cotacao_aprovada' && (
            <div className={`pt-3 space-y-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-teal-100'}`}>
              <p className={`text-[10px] font-bold text-center uppercase tracking-wide ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Emissão de Pedido</p>
              <div className="flex gap-2">
                <button disabled={isCancelling || isEmitting} onClick={onCancelar}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-[0.98] transition-all disabled:opacity-50">
                  {isCancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Cancelar
                </button>
                <button disabled={isEmitting || isCancelling} onClick={onEmitir}
                  className="flex-[2] flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-500 border border-teal-500 hover:bg-teal-600 shadow-sm shadow-teal-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
                  {isEmitting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Emitir Pedido
                </button>
              </div>
            </div>
          )}

          {/* Botão ver detalhes completo */}
          <button onClick={() => { onClose() }}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}>
            Ver detalhes completos →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function ListaRequisicoes() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { isAdmin, atLeast, perfil, canTechnicalApprove } = useAuth()

  const [activeTab, setActiveTab] = useState<PipelineTab>('pendente')
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [detail, setDetail] = useState<Requisicao | null>(null)
  const [emitirRequisicao, setEmitirRequisicao] = useState<Requisicao | null>(null)
  const detailReqId = detail?.id
  const { isLocked: isDetailLocked, blockedByName: detailBlockedByName } = useEditorLock({
    resourceType: 'cmp_requisicao',
    resourceId: detailReqId,
    enabled: Boolean(detailReqId),
  })

  const obras = useLookupObras()
  const { data: requisicoes = [], isLoading } = useRequisicoes()
  const { data: aprovacoes } = useAprovacoesPendentes()
  const decisaoMutation = useDecisaoRequisicao()
  const emitirPedidoMutation = useEmitirPedido()
  const cancelarMutation = useCancelarRequisicao()

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const aprovacaoMap = useMemo(() => {
    const map = new Map<string, Aprovacao>()
    for (const a of aprovacoes ?? []) map.set(a.requisicao_id, a)
    return map
  }, [aprovacoes])

  // Group by pipeline tab
  const grouped = useMemo(() => {
    const map = new Map<PipelineTab, Requisicao[]>()
    for (const stage of PIPELINE_STAGES) map.set(stage.status, [])
    for (const r of requisicoes) {
      for (const stage of PIPELINE_STAGES) {
        if (stage.statuses.includes(r.status)) {
          map.get(stage.status)!.push(r)
          break
        }
      }
    }
    return map
  }, [requisicoes])

  const activeItems = useMemo(() => {
    let items = grouped.get(activeTab) ?? []

    // Search
    if (busca) {
      const t = busca.toLowerCase()
      items = items.filter(r =>
        r.numero.toLowerCase().includes(t) ||
        r.descricao.toLowerCase().includes(t) ||
        r.solicitante_nome.toLowerCase().includes(t) ||
        r.obra_nome.toLowerCase().includes(t) ||
        (r.comprador_nome ?? '').toLowerCase().includes(t) ||
        (r.categoria ?? '').toLowerCase().includes(t)
      )
    }

    // Sort
    items = [...items].sort((a, b) => {
      let cmp = 0
      if (sortField === 'data') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (sortField === 'valor') cmp = a.valor_estimado - b.valor_estimado
      else if (sortField === 'obra') cmp = (a.obra_nome ?? '').localeCompare(b.obra_nome ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  const totalCount = Array.from(grouped.values()).reduce((s, a) => s + a.length, 0)
  const urgentCount = activeItems.filter(r => r.urgencia !== 'normal').length

  const handleDecisao = (reqId: string, numero: string, alcada: number, decisao: 'aprovada' | 'rejeitada' | 'esclarecimento', obs: string, categoria?: string, currentStatus?: string) => {
    if (!perfil) return
    decisaoMutation.mutate({
      requisicaoId: reqId, decisao, observacao: obs || undefined,
      requisicaoNumero: numero, alcadaNivel: alcada,
      aprovadorNome: perfil.nome, aprovadorEmail: perfil.email,
      categoria, currentStatus,
    }, {
      onSuccess: () => {
        setDetail(null)
        const label = decisao === 'aprovada' ? 'Aprovada ✓' : decisao === 'rejeitada' ? 'Rejeitada' : 'Esclarecimento solicitado'
        setToast({ type: 'success', msg: `${numero}: ${label}` })
        setTimeout(() => setToast(null), 4000)
      },
      onError: () => {
        setToast({ type: 'error', msg: `Erro ao processar ${numero}` })
        setTimeout(() => setToast(null), 5000)
      },
    })
  }

  return (
    <div className="space-y-3">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <ClipboardList size={20} className="text-teal-600" /> {'Requisi\u00e7\u00f5es'}
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {'Pipeline de requisi\u00e7\u00f5es em valida\u00e7\u00e3o t\u00e9cnica'}
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
                    : `${STATUS_ACCENT[stage.status].bgActive} ${STATUS_ACCENT[stage.status].textActive} ${STATUS_ACCENT[stage.status].border} shadow-sm ring-1 ring-${STATUS_ACCENT[stage.status].border}`
                  : isDark
                    ? `bg-transparent ${accent.text} border-white/[0.06] ${accent.bg}`
                    : `bg-white ${STATUS_ACCENT[stage.status].text} border-slate-200 ${STATUS_ACCENT[stage.status].bg}`
              }`}>
              <Icon size={13} />
              {stage.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                isActive
                  ? isDark ? 'bg-white/10 text-white' : 'bg-white/80 text-slate-800'
                  : isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            className={`w-full rounded-lg pl-9 pr-4 py-2 text-xs border transition-all outline-none ${
              isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500/30'
                : 'bg-white border-slate-200 focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400'
            }`}
            placeholder="Buscar número, descrição, obra..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button onClick={() => setBusca('')} className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Sort */}
        {SORT_OPTIONS.map(o => (
          <button key={o.field} onClick={() => { if (sortField === o.field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(o.field); setSortDir('desc') } }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              sortField === o.field
                ? isDark ? 'bg-white/10 text-white border-white/10' : 'bg-slate-100 text-slate-800 border-slate-200'
                : isDark ? 'bg-transparent text-slate-500 border-white/[0.06] hover:bg-white/5' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}>
            {o.label}
            {sortField === o.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </button>
        ))}

        {/* View toggle */}
        <div className={`flex border rounded-lg ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('list')}
            className={`p-1.5 transition-all ${viewMode === 'list' ? isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50'}`}>
            <LayoutList size={14} />
          </button>
          <button onClick={() => setViewMode('cards')}
            className={`p-1.5 transition-all ${viewMode === 'cards' ? isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50'}`}>
            <LayoutGrid size={14} />
          </button>
        </div>

        {/* Export */}
        <button onClick={() => exportCSV(activeItems, PIPELINE_STAGES.find(s => s.status === activeTab)?.label ?? '')}
          disabled={activeItems.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-40 ${
            isDark ? 'bg-transparent text-slate-400 border-white/[0.06] hover:bg-white/5' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}>
          <Download size={13} /> CSV
        </button>

        {/* Count */}
        <div className={`ml-auto text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {activeItems.length} de {totalCount}
          {urgentCount > 0 && (
            <span className="ml-2 text-red-500">
              <AlertTriangle size={10} className="inline" /> {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeItems.length === 0 ? (
        <div className={`text-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">Nenhuma requisição nesta etapa</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-2 p-4 stagger-children">
          {activeItems.map(r => (
            <ReqCard key={r.id} r={r} apr={aprovacaoMap.get(r.id)} isDark={isDark}
              onClick={() => setDetail(r)} />
          ))}
        </div>
      ) : (
        /* Table view */
        <div className={`rounded-xl border overflow-x-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'}>
                <th className="text-left px-3 py-2 font-semibold">{`N\u00famero`}</th>
                <th className="text-left px-3 py-2 font-semibold">{`Descri\u00e7\u00e3o`}</th>
                <th className="text-left px-3 py-2 font-semibold">Obra</th>
                <th className="text-left px-3 py-2 font-semibold">Necessidade</th>
                <th className="text-center px-3 py-2 font-semibold">{`Urg\u00eancia`}</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
                <th className="text-left px-3 py-2 font-semibold">Solicitante</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map(r => (
                <tr key={r.id} onClick={() => setDetail(r)}
                  className={`cursor-pointer transition-all ${isDark ? 'hover:bg-white/[0.03] border-t border-white/[0.04]' : 'hover:bg-slate-50 border-t border-slate-100'}`}>
                  <td className={`px-3 py-2 font-mono ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{r.numero}</td>
                  <td className={`px-3 py-2 max-w-[200px] truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.justificativa || r.descricao}</td>
                  <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.obra_nome}</td>
                  <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.data_necessidade ? new Date(r.data_necessidade).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-3 py-2 text-center">{r.urgencia && r.urgencia !== 'normal' ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.urgencia === 'critica' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') : (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')}`}>{r.urgencia}</span>
                  ) : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}</td>
                  <td className={`px-3 py-2 text-right font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                    {fmt(r.valor_estimado)}
                    {(r as any).compra_recorrente && <span className="text-[8px] font-bold text-indigo-500 ml-1">/mês</span>}
                  </td>
                  <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.solicitante_nome.split(' ')[0]}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status as StatusRequisicao} size="sm" customLabel={getApprovalStatusLabel(r.status)} /></td>
                  <td className={`px-3 py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtData(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <DetailModal
          r={detail}
          apr={aprovacaoMap.get(detail.id)}
          isDark={isDark}
          onClose={() => setDetail(null)}
          canDecide={
            (
              ['pendente', 'em_aprovacao', 'em_esclarecimento'].includes(detail.status)
              && canTechnicalApprove('compras')
            )
            || (detail.status === 'cotacao_enviada' && isAdmin)
          }
          isProcessing={decisaoMutation.isPending}
          onDecisao={(decisao, obs) => {
            if (isDetailLocked) {
              setToast({ type: 'error', msg: `${detailBlockedByName ?? 'Outro usuário'} está editando ${detail.numero}` })
              setTimeout(() => setToast(null), 5000)
              return
            }
            handleDecisao(detail.id, detail.numero, detail.alcada_nivel, decisao, obs, detail.categoria, detail.status)
          }}
          onEmitir={() => {
            if (isDetailLocked) {
              setToast({ type: 'error', msg: `${detailBlockedByName ?? 'Outro usuário'} está editando ${detail.numero}` })
              setTimeout(() => setToast(null), 5000)
              return
            }
            setEmitirRequisicao(detail)
          }}
          onCancelar={() => {
            if (!confirm('Cancelar esta requisição?')) return
            cancelarMutation.mutate(detail.id, {
              onSuccess: () => { setDetail(null); setToast({ type: 'success', msg: `${detail.numero}: Cancelada` }); setTimeout(() => setToast(null), 4000) },
              onError: () => { setToast({ type: 'error', msg: `Erro ao cancelar` }); setTimeout(() => setToast(null), 5000) },
            })
          }}
          isEmitting={emitirPedidoMutation.isPending}
          isCancelling={cancelarMutation.isPending}
        />
      )}

      {emitirRequisicao && (
        <EmitirPedidoModal
          open
          onClose={() => setEmitirRequisicao(null)}
          requisicaoId={emitirRequisicao.id}
          onConfirm={(payload) => {
            emitirPedidoMutation.mutate({
              requisicaoId: emitirRequisicao.id,
              ...payload,
            }, {
              onSuccess: (pedido) => {
                setEmitirRequisicao(null)
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
      )}
    </div>
  )
}
