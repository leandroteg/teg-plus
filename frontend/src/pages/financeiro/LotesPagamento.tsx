import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Search, CheckSquare, Square, Minus,
  Plus, Send, Package, CheckCircle2,
  ChevronLeft, ChevronRight, RefreshCw, Zap, AlertCircle,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useContasPagar } from '../../hooks/useFinanceiro'
import {
  useLotesPagamento,
  useCriarLote,
  useEnviarLoteAprovacao,
} from '../../hooks/useLotesPagamento'
import {
  useOmieCredentials,
  useOmieEnviarRemessa,
  useOmieAtualizarRemessas,
} from '../../hooks/useOmieApi'
import type { LotePagamento, StatusLote } from '../../types/financeiro'

const CP_PAGE_SIZES = [100, 200, 500]
const LOTE_PAGE_SIZES = [24, 48, 96]

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
  montando:              { label: 'Montando',      bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
  enviado_aprovacao:     { label: 'Em Aprovacao',  bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  parcialmente_aprovado: { label: 'Parcial',       bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  aprovado:              { label: 'Aprovado',      bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  em_pagamento:          { label: 'Em Pagamento',  bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  pago:                  { label: 'Pago',          bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  cancelado:             { label: 'Cancelado',     bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
}

function LoteStatusBadge({ status }: { status: StatusLote }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.montando
  return (
    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function PaginationBar({
  page,
  totalPages,
  pageSize,
  pageSizes,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  totalPages: number
  pageSize: number
  pageSizes: number[]
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  if (totalItems === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="text-xs text-slate-400">
        {totalItems.toLocaleString('pt-BR')} registro(s)
      </div>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {pageSizes.map(size => (
            <option key={size} value={size}>
              {size}/pagina
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 p-1 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[72px] text-center text-xs text-slate-500 dark:text-slate-400">
            Pag. {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-200 p-1 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LotesPagamento() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { data: cpsDisponiveis = [], isLoading: loadingCPs } = useContasPagar({ status: 'confirmado' })
  const { data: lotes = [], isLoading: loadingLotes } = useLotesPagamento()
  const criarLote = useCriarLote()
  const enviarAprovacao = useEnviarLoteAprovacao()

  // Omie integration
  const { data: omieCredentials } = useOmieCredentials()
  const enviarRemessaOmie = useOmieEnviarRemessa()
  const atualizarRemessas = useOmieAtualizarRemessas()
  const [omieStatus, setOmieStatus] = useState<Record<string, { ok?: boolean; msg?: string; loading?: boolean }>>({})

  async function handleEnviarOmie(lote: LotePagamento, e: React.MouseEvent) {
    e.stopPropagation()
    if (!omieCredentials) return
    // Busca os CPs do lote para enviar
    const cpsLote = cpsDisponiveis.filter(cp => cp.lote_id === lote.id)
    if (cpsLote.length === 0) {
      showToast('error', 'Nenhuma CP encontrada neste lote para enviar ao Omie')
      return
    }
    setOmieStatus(prev => ({ ...prev, [lote.id]: { loading: true } }))
    try {
      const res = await enviarRemessaOmie.mutateAsync({ credentials: omieCredentials, cps: cpsLote })
      const erros = res.filter(r => r.status === 'erro').length
      const ok = res.filter(r => r.status === 'incluido').length
      setOmieStatus(prev => ({ ...prev, [lote.id]: { ok: erros === 0, msg: `${ok} enviada(s)${erros ? `, ${erros} erro(s)` : ''}` } }))
      showToast(erros === 0 ? 'success' : 'error', `Omie: ${ok} CP(s) incluída(s)${erros ? `, ${erros} com erro` : ''}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar ao Omie'
      setOmieStatus(prev => ({ ...prev, [lote.id]: { ok: false, msg } }))
      showToast('error', msg)
    }
  }

  async function handleAtualizarOmie(e: React.MouseEvent) {
    e.stopPropagation()
    if (!omieCredentials) return
    try {
      const res = await atualizarRemessas.mutateAsync({ credentials: omieCredentials })
      const confirmadas = res.filter(r => r.novoStatus === 'pago').length
      showToast('success', `Atualizado: ${res.length} CP(s), ${confirmadas} pago(s)`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao atualizar remessas')
    }
  }

  const [tab, setTab] = useState<Tab>('montar')
  const [busca, setBusca] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [obsLote, setObsLote] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [filtroLotes, setFiltroLotes] = useState<string>('todos')
  const [cpPage, setCpPage] = useState(1)
  const [cpPageSize, setCpPageSize] = useState(200)
  const [lotePage, setLotePage] = useState(1)
  const [lotePageSize, setLotePageSize] = useState(24)

  const cpsFiltered = useMemo(() => {
    if (!busca) return cpsDisponiveis
    const q = busca.toLowerCase()
    return cpsDisponiveis.filter(c =>
      c.fornecedor_nome.toLowerCase().includes(q)
      || c.descricao?.toLowerCase().includes(q)
      || c.numero_documento?.toLowerCase().includes(q)
      || c.requisicao?.obra_nome?.toLowerCase().includes(q)
    )
  }, [cpsDisponiveis, busca])

  const lotesFiltrados = useMemo(() => {
    if (filtroLotes === 'todos') return lotes
    if (filtroLotes === 'ativos') return lotes.filter(l => ['montando', 'enviado_aprovacao'].includes(l.status))
    if (filtroLotes === 'em_aprovacao') return lotes.filter(l => l.status === 'enviado_aprovacao')
    return lotes.filter(l => ['aprovado', 'parcialmente_aprovado', 'em_pagamento', 'pago', 'cancelado'].includes(l.status))
  }, [lotes, filtroLotes])

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allFilteredSelected = cpsFiltered.length > 0 && cpsFiltered.every(cp => selected.has(cp.id))
  const someFilteredSelected = !allFilteredSelected && cpsFiltered.some(cp => selected.has(cp.id))

  const toggleAll = useCallback(() => {
    const ids = cpsFiltered.map(c => c.id)
    const shouldClear = ids.length > 0 && ids.every(id => selected.has(id))

    setSelected(prev => {
      if (shouldClear) {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      }

      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })
  }, [cpsFiltered, selected])

  const selectedCount = selected.size
  const selectedTotal = cpsDisponiveis
    .filter(c => selected.has(c.id))
    .reduce((s, c) => s + c.valor_original, 0)

  const cpTotalPages = Math.max(1, Math.ceil(cpsFiltered.length / cpPageSize))
  const cpPageSafe = Math.min(cpPage, cpTotalPages)
  const cpStart = (cpPageSafe - 1) * cpPageSize
  const cpsPage = cpsFiltered.slice(cpStart, cpStart + cpPageSize)

  const loteTotalPages = Math.max(1, Math.ceil(lotesFiltrados.length / lotePageSize))
  const lotePageSafe = Math.min(lotePage, loteTotalPages)
  const loteStart = (lotePageSafe - 1) * lotePageSize
  const lotesPage = lotesFiltrados.slice(loteStart, loteStart + lotePageSize)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const handleCriarLote = async () => {
    if (selectedCount === 0) return

    try {
      const lote = await criarLote.mutateAsync({
        cpIds: [...selected],
        cps: cpsDisponiveis,
        criadoPor: 'Financeiro',
        observacao: obsLote || undefined,
      })

      setSelected(new Set())
      setShowModal(false)
      setObsLote('')
      showToast('success', `Lote ${lote.numero_lote} criado com sucesso`)
      navigate(`/financeiro/lotes/${lote.id}`)
    } catch {
      showToast('error', 'Erro ao criar lote')
    }
  }

  const handleEnviarLote = async (lote: LotePagamento) => {
    try {
      await enviarAprovacao.mutateAsync({ loteId: lote.id, lote })
      showToast('success', `Lote ${lote.numero_lote} enviado para aprovacao`)
    } catch {
      showToast('error', 'Erro ao enviar lote para aprovacao')
    }
  }

  const cardBg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const inputBg = isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers size={20} className="text-indigo-500" />
          <div>
            <h1 className="text-lg font-bold">Lotes de Pagamento</h1>
            <p className="text-xs text-slate-400">
              Monte lotes, envie para aprovacao e acompanhe a fila antes do painel de pagamentos.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'montar' as Tab, label: 'Montar Lote', icon: Plus, count: cpsDisponiveis.length, color: 'indigo' },
          { key: 'lotes' as Tab, label: 'Lotes', icon: Package, count: lotes.length, color: 'emerald' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              setBusca('')
              setSelected(new Set())
              setCpPage(1)
              setLotePage(1)
            }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
              tab === t.key
                ? `bg-${t.color}-600 text-white border-${t.color}-600`
                : `${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`
            }`}
          >
            <t.icon size={14} />
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              tab === t.key ? 'bg-white/20' : isDark ? 'bg-slate-700' : 'bg-slate-100'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'montar' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar fornecedor, documento, obra..."
                value={busca}
                onChange={e => {
                  setBusca(e.target.value)
                  setCpPage(1)
                }}
                className={`w-full rounded-lg border py-2 pl-9 pr-4 text-sm ${inputBg}`}
              />
            </div>

            <div className="text-xs text-slate-400">
              {cpsFiltered.length.toLocaleString('pt-BR')} CP(s) pronta(s) para montar lote
            </div>
          </div>

          {loadingCPs && <div className="py-8 text-center text-sm text-slate-400">Carregando...</div>}
          {!loadingCPs && cpsFiltered.length === 0 && (
            <div className="py-12 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
              <div className="text-sm text-slate-400">Nenhuma CP confirmada aguardando lote</div>
            </div>
          )}

          <div className={`overflow-hidden rounded-xl border ${cardBg}`}>
            <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-slate-700/50 bg-slate-800/60' : 'border-slate-100 bg-slate-50'}`}>
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-500 dark:text-slate-300"
              >
                {allFilteredSelected ? (
                  <CheckSquare size={16} className="text-indigo-500" />
                ) : someFilteredSelected ? (
                  <Minus size={16} className="text-indigo-500" />
                ) : (
                  <Square size={16} />
                )}
                Selecionar todos os resultados
              </button>

              <div className="text-xs text-slate-400">
                {selectedCount.toLocaleString('pt-BR')} selecionado(s)
              </div>
            </div>

            {cpsPage.map((cp, i) => (
              <div
                key={cp.id}
                onClick={() => toggle(cp.id)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                  i > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''
                } ${
                  selected.has(cp.id)
                    ? isDark ? 'bg-indigo-900/10' : 'bg-indigo-50/50'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                }`}
              >
                <span className="text-slate-400">
                  {selected.has(cp.id) ? (
                    <CheckSquare size={15} className="text-indigo-500" />
                  ) : (
                    <Square size={15} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{cp.fornecedor_nome}</div>
                  <div className="truncate text-[11px] text-slate-400">
                    {cp.numero_documento && <span className="mr-2">{cp.numero_documento}</span>}
                    {cp.requisicao?.obra_nome && <span>· {cp.requisicao.obra_nome}</span>}
                    {cp.descricao && <span> · {cp.descricao}</span>}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold">{fmtFull(cp.valor_original)}</div>
                  <div className="text-[10px] text-slate-400">Venc. {fmtData(cp.data_vencimento)}</div>
                </div>
              </div>
            ))}
          </div>

          <PaginationBar
            page={cpPageSafe}
            totalPages={cpTotalPages}
            pageSize={cpPageSize}
            pageSizes={CP_PAGE_SIZES}
            totalItems={cpsFiltered.length}
            onPageChange={setCpPage}
            onPageSizeChange={size => {
              setCpPageSize(size)
              setCpPage(1)
            }}
          />

          {selectedCount > 0 && (
            <div className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-sm ${
              isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'
            }`}>
              <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckSquare size={16} className="text-indigo-500" />
                  <span className="text-sm font-medium">{selectedCount} selecionado(s)</span>
                  <span className="text-sm font-bold text-indigo-500">{fmtFull(selectedTotal)}</span>
                </div>

                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  <Layers size={15} />
                  Criar Lote
                </button>
              </div>
            </div>
          )}

          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className={`mx-4 w-full max-w-md rounded-2xl border p-6 shadow-xl ${cardBg}`}>
                <h3 className="mb-4 text-lg font-bold">Criar Lote de Pagamento</h3>

                <div className={`mb-4 rounded-lg p-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-400">Itens</span>
                    <span className="font-semibold">{selectedCount} CP(s)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Valor total</span>
                    <span className="font-bold text-indigo-500">{fmtFull(selectedTotal)}</span>
                  </div>
                </div>

                <label className="mb-1.5 block text-xs text-slate-400">Observacao (opcional)</label>
                <textarea
                  value={obsLote}
                  onChange={e => setObsLote(e.target.value)}
                  rows={2}
                  placeholder="Ex: Pagamento fornecedores obra X..."
                  className={`mb-5 w-full resize-none rounded-lg border px-3 py-2 text-sm ${inputBg}`}
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false)
                      setObsLote('')
                    }}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-medium ${
                      isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCriarLote}
                    disabled={criarLote.isPending}
                    className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {criarLote.isPending ? 'Criando...' : 'Criar Lote'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'lotes' && (
        <>
          {/* Omie integration bar */}
          {omieCredentials && (
            <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${isDark ? 'bg-emerald-900/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-emerald-600 shrink-0" />
                <p className={`text-xs font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  Integração Omie ativa — lotes aprovados podem ser enviados ao Omie para pagamento
                </p>
              </div>
              <button
                onClick={handleAtualizarOmie}
                disabled={atualizarRemessas.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 shrink-0"
              >
                <RefreshCw size={12} className={atualizarRemessas.isPending ? 'animate-spin' : ''} />
                {atualizarRemessas.isPending ? 'Atualizando...' : 'Atualizar Status Omie'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'ativos', label: 'Ativos' },
                { key: 'em_aprovacao', label: 'Em Aprovacao' },
                { key: 'finalizados', label: 'Finalizados' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => {
                    setFiltroLotes(f.key)
                    setLotePage(1)
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    filtroLotes === f.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : `${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400">
              {lotesFiltrados.length.toLocaleString('pt-BR')} lote(s)
            </div>
          </div>

          {loadingLotes && <div className="py-8 text-center text-sm text-slate-400">Carregando...</div>}
          {!loadingLotes && lotesFiltrados.length === 0 && (
            <div className="py-12 text-center">
              <Package size={32} className="mx-auto mb-3 text-slate-300" />
              <div className="text-sm text-slate-400">Nenhum lote encontrado</div>
            </div>
          )}

          <div className="space-y-3">
            {lotesPage.map(lote => (
              <div
                key={lote.id}
                onClick={() => navigate(`/financeiro/lotes/${lote.id}`)}
                className={`rounded-xl border p-4 transition-all hover:shadow-md ${cardBg} cursor-pointer`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    isDark ? 'bg-indigo-900/30' : 'bg-indigo-50'
                  }`}>
                    <Package size={18} className="text-indigo-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{lote.numero_lote}</span>
                      <LoteStatusBadge status={lote.status} />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {lote.qtd_itens} item(ns) · Criado por {lote.criado_por} · {fmtDataFull(lote.created_at)}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold text-indigo-500">{fmt(lote.valor_total)}</div>
                  </div>

                  {lote.status === 'montando' && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        handleEnviarLote(lote)
                      }}
                      disabled={enviarAprovacao.isPending}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                    >
                      <Send size={14} />
                      {enviarAprovacao.isPending ? 'Enviando...' : 'Enviar para Aprovacao'}
                    </button>
                  )}

                  {/* Omie remessa — disponível em lotes aprovados */}
                  {omieCredentials && (lote.status === 'aprovado' || lote.status === 'parcialmente_aprovado') && (
                    <button
                      type="button"
                      onClick={e => handleEnviarOmie(lote, e)}
                      disabled={omieStatus[lote.id]?.loading || enviarRemessaOmie.isPending}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {omieStatus[lote.id]?.loading
                        ? <RefreshCw size={13} className="animate-spin" />
                        : <Zap size={13} />
                      }
                      {omieStatus[lote.id]?.loading ? 'Enviando Omie...' : 'Enviar para Omie'}
                    </button>
                  )}
                </div>

                {lote.observacao && (
                  <div className="mt-2 truncate text-[11px] text-slate-400">
                    {lote.observacao}
                  </div>
                )}
                {omieStatus[lote.id]?.msg && (
                  <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium ${
                    omieStatus[lote.id]?.ok
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {omieStatus[lote.id]?.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                    Omie: {omieStatus[lote.id]?.msg}
                  </div>
                )}
              </div>
            ))}
          </div>

          <PaginationBar
            page={lotePageSafe}
            totalPages={loteTotalPages}
            pageSize={lotePageSize}
            pageSizes={LOTE_PAGE_SIZES}
            totalItems={lotesFiltrados.length}
            onPageChange={setLotePage}
            onPageSizeChange={size => {
              setLotePageSize(size)
              setLotePage(1)
            }}
          />
        </>
      )}

      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
