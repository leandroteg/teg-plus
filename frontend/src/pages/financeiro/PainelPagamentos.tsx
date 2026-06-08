import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Banknote, Search, CheckSquare, Square, Minus,
  ChevronDown, ChevronUp, AlertTriangle, Calendar,
  DollarSign, Clock, CheckCircle2, FileDown, Loader2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useCPsParaPagamento, useRegistrarPagamentoBatch } from '../../hooks/useLotesPagamento'
import type { ContaPagar } from '../../types/financeiro'
import { downloadPagamentosPrevistosPdf } from '../../utils/pagamentos-previstos-pdf'
import { supabase } from '../../services/supabase'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const today = () => new Date().toISOString().slice(0, 10)

const isOverdue = (d: string) => d < today()
const isDueToday = (d: string) => d === today()
const isDueThisWeek = (d: string) => {
  const t = new Date()
  const end = new Date(t)
  end.setDate(end.getDate() + 7)
  return d >= today() && d <= end.toISOString().slice(0, 10)
}

type GroupBy = 'vencimento' | 'fornecedor' | 'forma'

interface GroupedSection {
  key: string
  label: string
  cps: ContaPagar[]
  total: number
  overdue: boolean
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PainelPagamentos() {
  const { isDark } = useTheme()
  const { data: cps = [], isLoading } = useCPsParaPagamento()
  const registrarBatch = useRegistrarPagamentoBatch()

  const [busca, setBusca] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('vencimento')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dataPagamento, setDataPagamento] = useState(today())
  const [showConfirm, setShowConfirm] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [pendentesComprovante, setPendentesComprovante] = useState<ContaPagar[]>([])
  const [checandoComprovantes, setChecandoComprovantes] = useState(false)

  // ── Filter ──
  const filtered = useMemo(() => {
    if (!busca) return cps
    const q = busca.toLowerCase()
    return cps.filter(c =>
      c.fornecedor_nome.toLowerCase().includes(q)
      || c.descricao?.toLowerCase().includes(q)
      || c.numero_documento?.toLowerCase().includes(q)
      || c.centro_custo?.toLowerCase().includes(q)
    )
  }, [cps, busca])

  // ── KPIs ──
  const kpis = useMemo(() => {
    const t = today()
    const totalAberto = filtered.reduce((s, c) => s + c.valor_original, 0)
    const vencidos = filtered.filter(c => isOverdue(c.data_vencimento))
    const venceHoje = filtered.filter(c => isDueToday(c.data_vencimento))
    const venceSemana = filtered.filter(c => isDueThisWeek(c.data_vencimento))
    return {
      totalAberto,
      vencidosCount: vencidos.length,
      vencidosValor: vencidos.reduce((s, c) => s + c.valor_original, 0),
      hojeCount: venceHoje.length,
      hojeValor: venceHoje.reduce((s, c) => s + c.valor_original, 0),
      semanaCount: venceSemana.length,
      semanaValor: venceSemana.reduce((s, c) => s + c.valor_original, 0),
    }
  }, [filtered])

  // ── Group ──
  const sections = useMemo<GroupedSection[]>(() => {
    const map = new Map<string, ContaPagar[]>()

    for (const cp of filtered) {
      let key: string
      if (groupBy === 'vencimento') {
        key = cp.data_vencimento
      } else if (groupBy === 'fornecedor') {
        key = cp.fornecedor_nome
      } else {
        key = cp.forma_pagamento ?? 'Não definido'
      }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(cp)
    }

    const arr = Array.from(map.entries()).map(([key, items]) => {
      let label: string
      if (groupBy === 'vencimento') {
        const over = isOverdue(key)
        label = over ? `⚠️ ${fmtData(key)} — VENCIDO` : fmtData(key)
      } else {
        label = key.charAt(0).toUpperCase() + key.slice(1)
      }
      return {
        key,
        label,
        cps: items,
        total: items.reduce((s, c) => s + c.valor_original, 0),
        overdue: groupBy === 'vencimento' && isOverdue(key),
      }
    })

    // Overdue first, then by key
    arr.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return a.key.localeCompare(b.key)
    })

    return arr
  }, [filtered, groupBy])

  // ── Selection helpers ──
  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const toggleAll = useCallback(() => {
    const allIds = filtered.map(c => c.id)
    const allSel = allIds.every(id => selected.has(id))
    setSelected(allSel ? new Set() : new Set(allIds))
  }, [filtered, selected])

  const toggleSection = useCallback((sectionCps: ContaPagar[]) => {
    const ids = sectionCps.map(c => c.id)
    const allSel = ids.every(id => selected.has(id))
    setSelected(prev => {
      const n = new Set(prev)
      ids.forEach(id => allSel ? n.delete(id) : n.add(id))
      return n
    })
  }, [selected])

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }, [])

  const selectedCount = selected.size
  const selectedTotal = filtered
    .filter(c => selected.has(c.id))
    .reduce((s, c) => s + c.valor_original, 0)

  // ── Checagem de comprovantes ao abrir a confirmação ──
  // Bloqueia o batch se algum CP do lote tem pedido_id sem comprovante de pagamento anexado.
  // Roda APENAS na transição showConfirm false→true (sem depender de filtered/selected
  // que mudam de referência a cada render e disparariam loop infinito).
  useEffect(() => {
    if (!showConfirm) {
      setPendentesComprovante(prev => prev.length === 0 ? prev : [])
      return
    }
    const selecionadas = filtered.filter(c => selected.has(c.id))
    const comPedido = selecionadas.filter(c => !!c.pedido_id)
    if (comPedido.length === 0) {
      setPendentesComprovante([])
      return
    }
    let cancelado = false
    setChecandoComprovantes(true)
    ;(async () => {
      const pedidoIds = Array.from(new Set(comPedido.map(c => c.pedido_id as string)))
      const { data, error } = await supabase
        .from('cmp_pedidos_anexos')
        .select('pedido_id')
        .eq('tipo', 'comprovante_pagamento')
        .in('pedido_id', pedidoIds)
      if (cancelado) return
      setChecandoComprovantes(false)
      if (error) {
        setToast({ type: 'error', msg: 'Erro ao verificar comprovantes' })
        setTimeout(() => setToast(null), 3000)
        return
      }
      const comComprovante = new Set((data ?? []).map(r => r.pedido_id))
      setPendentesComprovante(comPedido.filter(c => !comComprovante.has(c.pedido_id as string)))
    })()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfirm])

  // ── Actions ──
  const handleRegistrar = async () => {
    if (selectedCount === 0) return
    if (pendentesComprovante.length > 0) return
    try {
      const count = await registrarBatch.mutateAsync({
        cpIds: [...selected],
        dataPagamento,
      })
      setSelected(new Set())
      setShowConfirm(false)
      setToast({ type: 'success', msg: `${count} pagamento(s) registrado(s) com sucesso!` })
      setTimeout(() => setToast(null), 3000)
    } catch {
      setToast({ type: 'error', msg: 'Erro ao registrar pagamentos' })
      setTimeout(() => setToast(null), 3000)
    }
  }

  const handleExportPdf = async () => {
    if (exporting) return
    setExporting(true)
    try {
      // Forecast gerencial = todos os títulos em aberto (não só os aprovados p/
      // pagamento que a tela lista), ordenados por vencimento.
      const { data, error } = await supabase
        .from('fin_contas_pagar')
        .select('*')
        .in('status', ['previsto', 'confirmado', 'aguardando_aprovacao', 'aprovado_pgto', 'em_pagamento'])
        .order('data_vencimento', { ascending: true })
      if (error) throw error
      const previstos = (data ?? []) as ContaPagar[]
      if (previstos.length === 0) {
        setToast({ type: 'error', msg: 'Nenhum pagamento previsto para exportar' })
        setTimeout(() => setToast(null), 3000)
        return
      }
      await downloadPagamentosPrevistosPdf(previstos)
    } catch {
      setToast({ type: 'error', msg: 'Erro ao gerar o PDF' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setExporting(false)
    }
  }

  const cardBg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const inputBg = isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'

  return (
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Banknote size={20} className="text-emerald-500" />
          <h1 className="text-lg font-bold">Painel de Pagamentos</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {filtered.length} pagamento(s) pendente(s)
          </span>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-600/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Exportar previstos (PDF)
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total a Pagar', val: fmt(kpis.totalAberto), sub: `${filtered.length} itens`, color: 'emerald', icon: DollarSign },
          { label: 'Vencidos', val: kpis.vencidosCount.toString(), sub: fmt(kpis.vencidosValor), color: 'red', icon: AlertTriangle },
          { label: 'Vence Hoje', val: kpis.hojeCount.toString(), sub: fmt(kpis.hojeValor), color: 'amber', icon: Clock },
          { label: 'Vence 7 dias', val: kpis.semanaCount.toString(), sub: fmt(kpis.semanaValor), color: 'blue', icon: Calendar },
        ].map((k, i) => (
          <div key={i} className={`rounded-xl border p-4 ${cardBg}`}>
            <div className="flex items-center gap-2 mb-2">
              <k.icon size={14} className={`text-${k.color}-500`} />
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{k.label}</span>
            </div>
            <div className={`text-xl font-bold text-${k.color}-500`}>{k.val}</div>
            <div className="text-[11px] text-slate-400 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + Group tabs */}
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

        <div className="flex gap-1.5">
          {([
            { key: 'vencimento', label: 'Por Vencimento' },
            { key: 'fornecedor', label: 'Por Fornecedor' },
            { key: 'forma', label: 'Por Forma' },
          ] as { key: GroupBy; label: string }[]).map(g => (
            <button
              key={g.key}
              onClick={() => setGroupBy(g.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                groupBy === g.key
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : `${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Select all */}
        <button
          onClick={toggleAll}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-500 transition-colors"
        >
          {filtered.length > 0 && filtered.every(c => selected.has(c.id)) ? (
            <CheckSquare size={14} />
          ) : selected.size > 0 ? (
            <Minus size={14} />
          ) : (
            <Square size={14} />
          )}
          Selecionar todos
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center text-sm text-slate-400 py-8">Carregando...</div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
          <div className="text-sm text-slate-400">Nenhum pagamento pendente</div>
        </div>
      )}

      {/* Sections */}
      {sections.map(section => {
        const isCollapsed = collapsed.has(section.key)
        const sectionAllSelected = section.cps.every(c => selected.has(c.id))
        const sectionSome = section.cps.some(c => selected.has(c.id))

        return (
          <div
            key={section.key}
            className={`rounded-xl border overflow-hidden ${cardBg} ${
              section.overdue ? 'border-red-500/40' : ''
            }`}
          >
            {/* Section header */}
            <div
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${
                section.overdue
                  ? isDark ? 'bg-red-900/20' : 'bg-red-50'
                  : isDark ? 'bg-slate-800/50' : 'bg-slate-50'
              }`}
              onClick={() => toggleCollapse(section.key)}
            >
              <button
                onClick={e => { e.stopPropagation(); toggleSection(section.cps) }}
                className="text-slate-400 hover:text-emerald-500 transition-colors"
              >
                {sectionAllSelected ? <CheckSquare size={16} /> : sectionSome ? <Minus size={16} /> : <Square size={16} />}
              </button>

              <div className="flex-1 min-w-0">
                <span className={`text-sm font-semibold ${section.overdue ? 'text-red-500' : ''}`}>
                  {section.label}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  {section.cps.length} item(ns)
                </span>
              </div>

              <span className="text-sm font-bold text-emerald-500">{fmtFull(section.total)}</span>

              {isCollapsed ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
            </div>

            {/* Section items */}
            {!isCollapsed && (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {section.cps.map(cp => (
                  <div
                    key={cp.id}
                    onClick={() => toggle(cp.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      selected.has(cp.id)
                        ? isDark ? 'bg-emerald-900/10' : 'bg-emerald-50/50'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <span className="text-slate-400">
                      {selected.has(cp.id) ? <CheckSquare size={15} className="text-emerald-500" /> : <Square size={15} />}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{cp.fornecedor_nome}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {cp.numero_documento && <span className="mr-2">{cp.numero_documento}</span>}
                        {cp.descricao && <span>{cp.descricao}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">{fmtFull(cp.valor_original)}</div>
                      <div className={`text-[10px] ${isOverdue(cp.data_vencimento) ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                        Venc. {fmtData(cp.data_vencimento)}
                      </div>
                    </div>

                    {cp.forma_pagamento && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {cp.forma_pagamento}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Sticky bottom bar */}
      {selectedCount > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-sm ${
          isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'
        }`}>
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckSquare size={16} className="text-emerald-500" />
              <span className="text-sm font-medium">
                {selectedCount} selecionado(s)
              </span>
              <span className="text-sm font-bold text-emerald-500">
                {fmtFull(selectedTotal)}
              </span>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <Banknote size={15} />
              Registrar Pagamento
            </button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl border shadow-xl max-w-md w-full mx-4 p-6 ${cardBg}`}>
            <h3 className="text-lg font-bold mb-4">Confirmar Pagamento</h3>

            <div className={`rounded-lg p-4 mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Quantidade</span>
                <span className="font-semibold">{selectedCount} pagamento(s)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Valor total</span>
                <span className="font-bold text-emerald-500">{fmtFull(selectedTotal)}</span>
              </div>
            </div>

            <label className="block text-xs text-slate-400 mb-1.5">Data do Pagamento</label>
            <input
              type="date"
              value={dataPagamento}
              onChange={e => setDataPagamento(e.target.value)}
              className={`w-full px-3 py-2 text-sm rounded-lg border mb-5 ${inputBg}`}
            />

            {checandoComprovantes && (
              <div className="flex items-center gap-2 mb-4 text-xs text-slate-400">
                <div className="w-3 h-3 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                Verificando comprovantes de pagamento...
              </div>
            )}

            {pendentesComprovante.length > 0 && (
              <div className="mb-5 rounded-xl border border-red-300 bg-red-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-xs font-bold text-red-700">
                    {pendentesComprovante.length} pagamento(s) sem comprovante anexado
                  </span>
                </div>
                <p className="text-[11px] text-red-600 mb-2">
                  Anexe o comprovante no pedido antes de registrar a baixa.
                </p>
                <ul className="text-[11px] text-red-700 space-y-0.5 max-h-32 overflow-auto">
                  {pendentesComprovante.map(cp => (
                    <li key={cp.id} className="truncate">
                      • {cp.fornecedor_nome}
                      {cp.numero_documento ? ` — ${cp.numero_documento}` : ''}
                      {' — '}{fmtFull(cp.valor_original)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border ${
                  isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrar}
                disabled={registrarBatch.isPending || checandoComprovantes || pendentesComprovante.length > 0}
                title={pendentesComprovante.length > 0 ? 'Anexe os comprovantes pendentes antes de confirmar' : undefined}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {registrarBatch.isPending ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
