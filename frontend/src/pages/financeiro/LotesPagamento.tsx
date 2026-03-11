import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Search, CheckSquare, Square, Minus,
  Plus, Send, Package, Clock, CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useContasPagar } from '../../hooks/useFinanceiro'
import { useLotesPagamento, useCriarLote } from '../../hooks/useLotesPagamento'
import type { StatusLote } from '../../types/financeiro'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const fmtDataFull = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

type Tab = 'montar' | 'lotes'

const STATUS_CONFIG: Record<StatusLote, { label: string; bg: string; text: string }> = {
  montando:                { label: 'Montando',     bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
  enviado_aprovacao:       { label: 'Em Aprovação', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  parcialmente_aprovado:   { label: 'Parcial',      bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  aprovado:                { label: 'Aprovado',     bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  em_pagamento:            { label: 'Em Pagamento', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  pago:                    { label: 'Pago',         bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  cancelado:               { label: 'Cancelado',    bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function LoteStatusBadge({ status }: { status: StatusLote }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.montando
  return (
    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function LotesPagamento() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { data: allCPs = [], isLoading: loadingCPs } = useContasPagar()
  const { data: lotes = [], isLoading: loadingLotes } = useLotesPagamento()
  const criarLote = useCriarLote()

  const [tab, setTab] = useState<Tab>('montar')
  const [busca, setBusca] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [obsLote, setObsLote] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [filtroLotes, setFiltroLotes] = useState<string>('todos')

  // ── CPs disponíveis para montar lote ──
  const cpsDisponiveis = useMemo(() =>
    allCPs.filter(c =>
      c.status === 'aguardando_aprovacao' && !c.lote_id
    ),
    [allCPs],
  )

  const cpsFiltered = useMemo(() => {
    if (!busca) return cpsDisponiveis
    const q = busca.toLowerCase()
    return cpsDisponiveis.filter(c =>
      c.fornecedor_nome.toLowerCase().includes(q)
      || c.descricao?.toLowerCase().includes(q)
      || c.numero_documento?.toLowerCase().includes(q)
    )
  }, [cpsDisponiveis, busca])

  // ── Lotes filtrados ──
  const lotesFiltrados = useMemo(() => {
    if (filtroLotes === 'todos') return lotes
    if (filtroLotes === 'ativos') return lotes.filter(l => ['montando', 'enviado_aprovacao'].includes(l.status))
    return lotes.filter(l => ['aprovado', 'parcialmente_aprovado', 'pago', 'cancelado'].includes(l.status))
  }, [lotes, filtroLotes])

  // ── Selection helpers ──
  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const toggleAll = useCallback(() => {
    const ids = cpsFiltered.map(c => c.id)
    const allSel = ids.length > 0 && ids.every(id => selected.has(id))
    setSelected(allSel ? new Set() : new Set(ids))
  }, [cpsFiltered, selected])

  const selectedCount = selected.size
  const selectedTotal = cpsDisponiveis
    .filter(c => selected.has(c.id))
    .reduce((s, c) => s + c.valor_original, 0)

  // ── Create lote ──
  const handleCriarLote = async () => {
    if (selectedCount === 0) return
    try {
      const lote = await criarLote.mutateAsync({
        cpIds: [...selected],
        cps: cpsDisponiveis,
        criadoPor: 'Financeiro',  // TODO: user name from auth context
        observacao: obsLote || undefined,
      })
      setSelected(new Set())
      setShowModal(false)
      setObsLote('')
      navigate(`/financeiro/lotes/${lote.id}`)
    } catch {
      setToast({ type: 'error', msg: 'Erro ao criar lote' })
      setTimeout(() => setToast(null), 3000)
    }
  }

  const cardBg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const inputBg = isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'

  return (
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers size={20} className="text-indigo-500" />
          <h1 className="text-lg font-bold">Lotes de Pagamento</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'montar' as Tab, label: 'Montar Lote', icon: Plus, count: cpsDisponiveis.length, color: 'indigo' },
          { key: 'lotes' as Tab, label: 'Lotes', icon: Package, count: lotes.length, color: 'emerald' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setBusca(''); setSelected(new Set()) }}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors ${
              tab === t.key
                ? `bg-${t.color}-600 text-white border-${t.color}-600`
                : `${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`
            }`}
          >
            <t.icon size={14} />
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              tab === t.key ? 'bg-white/20' : isDark ? 'bg-slate-700' : 'bg-slate-100'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══════ TAB: MONTAR LOTE ══════ */}
      {tab === 'montar' && (
        <>
          {/* Search + Select all */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar fornecedor, documento..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 text-sm rounded-lg border ${inputBg}`}
              />
            </div>
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 transition-colors"
            >
              {cpsFiltered.length > 0 && cpsFiltered.every(c => selected.has(c.id)) ? (
                <CheckSquare size={14} />
              ) : selected.size > 0 ? (
                <Minus size={14} />
              ) : (
                <Square size={14} />
              )}
              Selecionar todos
            </button>
          </div>

          {/* Loading / Empty */}
          {loadingCPs && <div className="text-center text-sm text-slate-400 py-8">Carregando...</div>}
          {!loadingCPs && cpsFiltered.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
              <div className="text-sm text-slate-400">Nenhuma CP aguardando aprovação</div>
            </div>
          )}

          {/* CP List */}
          <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
            {cpsFiltered.map((cp, i) => (
              <div
                key={cp.id}
                onClick={() => toggle(cp.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  i > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''
                } ${
                  selected.has(cp.id)
                    ? isDark ? 'bg-indigo-900/10' : 'bg-indigo-50/50'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                }`}
              >
                <span className="text-slate-400">
                  {selected.has(cp.id)
                    ? <CheckSquare size={15} className="text-indigo-500" />
                    : <Square size={15} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cp.fornecedor_nome}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {cp.numero_documento && <span className="mr-2">{cp.numero_documento}</span>}
                    {cp.requisicao?.obra_nome && <span>· {cp.requisicao.obra_nome}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">{fmtFull(cp.valor_original)}</div>
                  <div className="text-[10px] text-slate-400">Venc. {fmtData(cp.data_vencimento)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky bottom bar */}
          {selectedCount > 0 && (
            <div className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-sm ${
              isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'
            }`}>
              <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckSquare size={16} className="text-indigo-500" />
                  <span className="text-sm font-medium">{selectedCount} selecionado(s)</span>
                  <span className="text-sm font-bold text-indigo-500">{fmtFull(selectedTotal)}</span>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <Layers size={15} />
                  Criar Lote
                </button>
              </div>
            </div>
          )}

          {/* Create Lote Modal */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className={`rounded-2xl border shadow-xl max-w-md w-full mx-4 p-6 ${cardBg}`}>
                <h3 className="text-lg font-bold mb-4">Criar Lote de Pagamento</h3>

                <div className={`rounded-lg p-4 mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Itens</span>
                    <span className="font-semibold">{selectedCount} CP(s)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Valor total</span>
                    <span className="font-bold text-indigo-500">{fmtFull(selectedTotal)}</span>
                  </div>
                </div>

                <label className="block text-xs text-slate-400 mb-1.5">Observação (opcional)</label>
                <textarea
                  value={obsLote}
                  onChange={e => setObsLote(e.target.value)}
                  rows={2}
                  placeholder="Ex: Pagamento fornecedores obra X..."
                  className={`w-full px-3 py-2 text-sm rounded-lg border mb-5 resize-none ${inputBg}`}
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowModal(false); setObsLote('') }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border ${
                      isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCriarLote}
                    disabled={criarLote.isPending}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {criarLote.isPending ? 'Criando...' : 'Criar Lote'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════ TAB: LOTES ══════ */}
      {tab === 'lotes' && (
        <>
          {/* Filter pills */}
          <div className="flex gap-1.5">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'ativos', label: 'Ativos' },
              { key: 'finalizados', label: 'Finalizados' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFiltroLotes(f.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filtroLotes === f.key
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : `${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Loading / Empty */}
          {loadingLotes && <div className="text-center text-sm text-slate-400 py-8">Carregando...</div>}
          {!loadingLotes && lotesFiltrados.length === 0 && (
            <div className="text-center py-12">
              <Package size={32} className="mx-auto text-slate-300 mb-3" />
              <div className="text-sm text-slate-400">Nenhum lote encontrado</div>
            </div>
          )}

          {/* Lote cards */}
          <div className="space-y-3">
            {lotesFiltrados.map(lote => (
              <div
                key={lote.id}
                onClick={() => navigate(`/financeiro/lotes/${lote.id}`)}
                className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${cardBg}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-indigo-900/30' : 'bg-indigo-50'
                  }`}>
                    <Package size={18} className="text-indigo-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{lote.numero_lote}</span>
                      <LoteStatusBadge status={lote.status} />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {lote.qtd_itens} item(ns) · Criado por {lote.criado_por} · {fmtDataFull(lote.created_at)}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-indigo-500">{fmt(lote.valor_total)}</div>
                  </div>
                </div>

                {lote.observacao && (
                  <div className="text-[11px] text-slate-400 mt-2 truncate">
                    💬 {lote.observacao}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
