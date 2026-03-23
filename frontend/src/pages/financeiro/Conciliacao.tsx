import { useState, useMemo, useCallback, useRef } from 'react'
import {
  Landmark, CheckCircle2, Search, Calendar, Filter,
  Tag, Briefcase, FolderOpen, ChevronDown, X,
  CheckSquare, Square, Minus, ArrowUpDown, AlertTriangle,
  Layers, XCircle, Upload,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useContasPagar, useContasReceber,
  useClassificarCPBatch, useConciliarCPBatch,
  useClassificarCRBatch, useConciliarCRBatch,
  useDistinctCentroCusto, useDistinctClasseFinanceira,
  useObras,
} from '../../hooks/useFinanceiro'
import { useUploadAnexo } from '../../hooks/useAnexos'
import { supabase } from '../../services/supabase'
import type { ContaPagar, ContaReceber } from '../../types/financeiro'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

type Tab = 'cp' | 'cr'
type ClassModalMode = 'classificar' | 'conciliar'

interface UnifiedRow {
  id: string
  tipo: 'cp' | 'cr'
  nome: string             // fornecedor_nome or cliente_nome
  descricao?: string
  valor: number
  valorPago: number
  vencimento: string
  status: string
  centroCusto?: string
  classeFinanceira?: string
  projetoId?: string
  documento?: string       // numero_documento or numero_nf
  natureza?: string
  raw: ContaPagar | ContaReceber
}

const STATUS_CP: Record<string, { label: string; dot: string }> = {
  previsto:             { label: 'Previsto',       dot: 'bg-slate-400'   },
  confirmado:           { label: 'Confirmado',     dot: 'bg-blue-400'   },
  em_lote:              { label: 'Em Lote',        dot: 'bg-violet-400' },
  aprovado_pgto:        { label: 'Pgto Aprov.',    dot: 'bg-indigo-400' },
  em_pagamento:         { label: 'Em Pagamento',   dot: 'bg-amber-400'  },
  pago:                 { label: 'Pago',           dot: 'bg-emerald-500'},
  conciliado:           { label: 'Conciliado',     dot: 'bg-green-500'  },
  cancelado:            { label: 'Cancelado',      dot: 'bg-gray-400'   },
}

const STATUS_CR: Record<string, { label: string; dot: string }> = {
  previsto:   { label: 'Previsto',   dot: 'bg-slate-400'   },
  faturado:   { label: 'Faturado',   dot: 'bg-blue-400'    },
  parcial:    { label: 'Parcial',    dot: 'bg-amber-400'   },
  recebido:   { label: 'Recebido',   dot: 'bg-emerald-500' },
  conciliado: { label: 'Conciliado', dot: 'bg-green-500'   },
  vencido:    { label: 'Vencido',    dot: 'bg-red-500'     },
  cancelado:  { label: 'Cancelado',  dot: 'bg-gray-400'    },
}

// ── Autocomplete Dropdown ────────────────────────────────────────────────────

function AutocompleteField({
  label,
  icon: Icon,
  value,
  onChange,
  suggestions,
  placeholder,
  isDark,
}: {
  label: string
  icon: typeof Tag
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder: string
  isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const filtered = suggestions.filter(s =>
    !value || s.toLowerCase().includes(value.toLowerCase())
  )

  return (
    <div className="relative">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
        <Icon size={10} /> {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-lg border text-sm placeholder-slate-400
          focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
          ${isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-200' : 'border-slate-200 text-slate-700'}`}
      />
      {open && filtered.length > 0 && (
        <div className={`absolute z-50 mt-1 w-full rounded-lg shadow-lg max-h-36 overflow-y-auto
          ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          {filtered.map(s => (
            <button
              key={s}
              onMouseDown={() => { onChange(s); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors
                ${isDark ? 'text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Conciliacao() {
  const { isDark } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('cp')
  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [filtroSemCC, setFiltroSemCC] = useState(false)
  const [filtroSemClasse, setFiltroSemClasse] = useState(false)
  const [filtroCC, setFiltroCC] = useState('')
  const [filtroClasse, setFiltroClasse] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showClassModal, setShowClassModal] = useState(false)
  const [classModalMode, setClassModalMode] = useState<ClassModalMode>('classificar')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [conciliarIds, setConciliarIds] = useState<string[]>([])
  const [missingComprovantePedidoIds, setMissingComprovantePedidoIds] = useState<string[]>([])
  const [arquivoComprovante, setArquivoComprovante] = useState<File | null>(null)
  const [observacaoComprovante, setObservacaoComprovante] = useState('')

  // Batch classification form state
  const [batchCC, setBatchCC] = useState('')
  const [batchClasse, setBatchClasse] = useState('')
  const [batchProjeto, setBatchProjeto] = useState('')

  // Data
  const { data: contasCP = [], isLoading: loadingCP } = useContasPagar()
  const { data: contasCR = [], isLoading: loadingCR } = useContasReceber()
  const { data: ccSuggestions = [] } = useDistinctCentroCusto()
  const { data: classeSuggestions = [] } = useDistinctClasseFinanceira()
  const { data: obras = [] } = useObras()

  // Mutations
  const classificarCP = useClassificarCPBatch()
  const conciliarCP = useConciliarCPBatch()
  const classificarCR = useClassificarCRBatch()
  const conciliarCR = useConciliarCRBatch()
  const uploadAnexo = useUploadAnexo()

  const isLoading = tab === 'cp' ? loadingCP : loadingCR

  // Unify rows
  const rows: UnifiedRow[] = useMemo(() => {
    if (tab === 'cp') {
      return contasCP.map(cp => ({
        id: cp.id,
        tipo: 'cp' as const,
        nome: cp.fornecedor_nome,
        descricao: cp.descricao,
        valor: cp.valor_original,
        valorPago: cp.valor_pago,
        vencimento: cp.data_vencimento,
        status: cp.status,
        centroCusto: cp.centro_custo ?? cp.requisicao?.centro_custo,
        classeFinanceira: cp.classe_financeira ?? cp.requisicao?.classe_financeira,
        projetoId: cp.projeto_id ?? cp.requisicao?.projeto_id,
        documento: cp.numero_documento,
        natureza: cp.natureza,
        raw: cp,
      }))
    }
    return contasCR.map(cr => ({
      id: cr.id,
      tipo: 'cr' as const,
      nome: cr.cliente_nome,
      descricao: cr.descricao,
      valor: cr.valor_original,
      valorPago: cr.valor_recebido,
      vencimento: cr.data_vencimento,
      status: cr.status,
      centroCusto: cr.centro_custo,
      classeFinanceira: cr.classe_financeira,
      projetoId: cr.projeto_id,
      documento: cr.numero_nf ? `NF ${cr.numero_nf}` : undefined,
      natureza: cr.natureza,
      raw: cr,
    }))
  }, [tab, contasCP, contasCR])

  // Apply filters
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (busca) {
        const q = busca.toLowerCase()
        const match = r.nome.toLowerCase().includes(q)
          || r.descricao?.toLowerCase().includes(q)
          || r.documento?.toLowerCase().includes(q)
          || r.centroCusto?.toLowerCase().includes(q)
          || r.classeFinanceira?.toLowerCase().includes(q)
        if (!match) return false
      }
      if (dataInicio && r.vencimento < dataInicio) return false
      if (dataFim && r.vencimento > dataFim) return false
      if (filtroSemCC && r.centroCusto) return false
      if (filtroSemClasse && r.classeFinanceira) return false
      if (filtroCC && r.centroCusto !== filtroCC) return false
      if (filtroClasse && r.classeFinanceira !== filtroClasse) return false
      return true
    })
  }, [rows, busca, dataInicio, dataFim, filtroSemCC, filtroSemClasse, filtroCC, filtroClasse])

  // Selection helpers
  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))
  const someSelected = filtered.some(r => selected.has(r.id))
  const selectedCount = [...selected].filter(id => filtered.some(r => r.id === id)).length

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(r => r.id)))
    }
  }, [allSelected, filtered])

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Clear selection on tab change
  const handleTabChange = (t: Tab) => {
    setTab(t)
    setSelected(new Set())
    setBusca('')
    setDataInicio('')
    setDataFim('')
    setFiltroSemCC(false)
    setFiltroSemClasse(false)
    setFiltroCC('')
    setFiltroClasse('')
  }

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const resetModalState = useCallback(() => {
    setBatchCC('')
    setBatchClasse('')
    setBatchProjeto('')
    setConciliarIds([])
    setMissingComprovantePedidoIds([])
    setArquivoComprovante(null)
    setObservacaoComprovante('')
  }, [])

  const closeClassModal = useCallback(() => {
    setShowClassModal(false)
    resetModalState()
  }, [resetModalState])

  const modalIds = useMemo(
    () => classModalMode === 'conciliar'
      ? conciliarIds
      : [...selected].filter(id => filtered.some(r => r.id === id)),
    [classModalMode, conciliarIds, selected, filtered],
  )

  const modalRows = useMemo(
    () => modalIds
      .map(id => rows.find(row => row.id === id))
      .filter((row): row is UnifiedRow => Boolean(row)),
    [modalIds, rows],
  )

  // Batch classify
  const handleClassificar = async () => {
    const ids = modalIds
    if (ids.length === 0) return

    const payload = {
      ids,
      centro_custo: batchCC || undefined,
      classe_financeira: batchClasse || undefined,
      projeto_id: batchProjeto || undefined,
    }

    try {
      if (tab === 'cp') {
        await classificarCP.mutateAsync(payload)
      } else {
        await classificarCR.mutateAsync(payload)
      }
      showToast('success', `${ids.length} ${ids.length === 1 ? 'título classificado' : 'títulos classificados'}`)
      closeClassModal()
      setSelected(new Set())
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao classificar títulos')
    }
  }

  // Batch conciliar
  const handleConciliar = async () => {
    const ids = [...selected].filter(id => filtered.some(r => r.id === id))
    const validStatuses = tab === 'cp' ? ['pago'] : ['recebido']
    const validIds = ids.filter(id => {
      const row = filtered.find(r => r.id === id)
      return row && validStatuses.includes(row.status)
    })

    if (validIds.length === 0) {
      showToast('error', `Somente títulos ${tab === 'cp' ? 'pagos' : 'recebidos'} podem ser conciliados`)
      return
    }

    if (tab === 'cp') {
      try {
        const cpRows = validIds
          .map(id => filtered.find(r => r.id === id))
          .filter((row): row is UnifiedRow => Boolean(row))

        const pedidoIds = Array.from(new Set(
          cpRows
            .map(row => (row.raw as ContaPagar).pedido_id)
            .filter(Boolean),
        )) as string[]

        let pedidosSemComprovante: string[] = []
        if (pedidoIds.length > 0) {
          const { data: anexos, error } = await supabase
            .from('cmp_pedidos_anexos')
            .select('pedido_id')
            .eq('tipo', 'comprovante_pagamento')
            .in('pedido_id', pedidoIds)

          if (error) throw error

          const pedidosComComprovante = new Set((anexos ?? []).map(anexo => anexo.pedido_id).filter(Boolean))
          pedidosSemComprovante = pedidoIds.filter(pedidoId => !pedidosComComprovante.has(pedidoId))
        }

        setClassModalMode('conciliar')
        setConciliarIds(validIds)
        setMissingComprovantePedidoIds(pedidosSemComprovante)
        setArquivoComprovante(null)
        setObservacaoComprovante('')
        setShowClassModal(true)
      } catch (error) {
        showToast('error', error instanceof Error ? error.message : 'Erro ao validar comprovantes')
      }
      return
    }

    try {
      await conciliarCR.mutateAsync({ ids: validIds })
      showToast('success', `${validIds.length} ${validIds.length === 1 ? 'título conciliado' : 'títulos conciliados'}`)
      setSelected(new Set())
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao conciliar títulos')
    }
  }

  const handleConfirmarConciliacao = async () => {
    if (modalIds.length === 0) return
    if (missingComprovantePedidoIds.length > 0 && !arquivoComprovante) {
      showToast('error', 'Anexe o comprovante de pagamento para continuar.')
      return
    }

    try {
      if (arquivoComprovante) {
        for (const pedidoId of missingComprovantePedidoIds) {
          await uploadAnexo.mutateAsync({
            pedidoId,
            file: arquivoComprovante,
            tipo: 'comprovante_pagamento',
            observacao: observacaoComprovante || undefined,
            origem: 'financeiro',
          })
        }
      }

      if (batchCC || batchClasse || batchProjeto) {
        await classificarCP.mutateAsync({
          ids: modalIds,
          centro_custo: batchCC || undefined,
          classe_financeira: batchClasse || undefined,
          projeto_id: batchProjeto || undefined,
        })
      }

      await conciliarCP.mutateAsync({ ids: modalIds })
      showToast('success', `${modalIds.length} ${modalIds.length === 1 ? 'título conciliado' : 'títulos conciliados'}`)
      closeClassModal()
      setSelected(new Set())
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Erro ao conciliar títulos')
    }
  }

  // KPIs
  const totalSemCC = rows.filter(r => !r.centroCusto).length
  const totalSemClasse = rows.filter(r => !r.classeFinanceira).length
  const totalConciliados = rows.filter(r => r.status === 'conciliado').length
  const valorSelected = filtered
    .filter(r => selected.has(r.id))
    .reduce((s, r) => s + r.valor, 0)
  const modalSelectedValue = modalRows.reduce((sum, row) => sum + row.valor, 0)
  const modalSelectedCount = modalRows.length
  const modalMissingCCCount = modalRows.filter(row => !row.centroCusto).length
  const modalMissingClasseCount = modalRows.filter(row => !row.classeFinanceira).length
  const requiresComprovanteUpload = classModalMode === 'conciliar' && missingComprovantePedidoIds.length > 0

  const statusMap = tab === 'cp' ? STATUS_CP : STATUS_CR

  const isBusy = classificarCP.isPending || classificarCR.isPending
    || conciliarCP.isPending || conciliarCR.isPending

  return (
    <div className="space-y-4 pb-32">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm
          font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <Landmark size={20} className="text-emerald-600" />
          Conciliação Manual
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Classificação em lote — centro de custo, classe financeira e projeto
        </p>
      </div>

      {/* ── KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-2xl p-3.5 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Layers size={12} className="text-slate-400" />
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</p>
          </div>
          <p className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{rows.length}</p>
        </div>
        <button
          onClick={() => { setFiltroSemCC(v => !v); setFiltroSemClasse(false) }}
          className={`rounded-2xl p-3.5 border shadow-sm text-left transition-all ${
            filtroSemCC
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30'
              : isDark ? 'bg-[#1e293b] border-white/[0.06] hover:border-amber-500/30' : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Briefcase size={12} className="text-amber-500" />
            <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-widest">Sem CC</p>
          </div>
          <p className="text-lg font-extrabold text-amber-600">{totalSemCC}</p>
        </button>
        <button
          onClick={() => { setFiltroSemClasse(v => !v); setFiltroSemCC(false) }}
          className={`rounded-2xl p-3.5 border shadow-sm text-left transition-all ${
            filtroSemClasse
              ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-400/30'
              : isDark ? 'bg-[#1e293b] border-white/[0.06] hover:border-violet-500/30' : 'bg-white border-slate-200 hover:border-violet-300'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Tag size={12} className="text-violet-500" />
            <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-widest">Sem Classe</p>
          </div>
          <p className="text-lg font-extrabold text-violet-600">{totalSemClasse}</p>
        </button>
        <div className={`rounded-2xl p-3.5 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Conciliados</p>
          </div>
          <p className="text-lg font-extrabold text-emerald-600">{totalConciliados}</p>
        </div>
      </div>

      {/* ── Tab Switch ──────────────────────────────────────── */}
      <div className="flex gap-1.5">
        <button
          onClick={() => handleTabChange('cp')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${
            tab === 'cp'
              ? 'bg-emerald-600 text-white shadow-sm'
              : isDark ? 'bg-[#1e293b] text-slate-400 border border-white/[0.06]' : 'bg-white text-slate-500 border border-slate-200'
          }`}
        >
          Contas a Pagar
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            tab === 'cp' ? 'bg-emerald-500' : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-400'
          }`}>
            {contasCP.length}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('cr')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${
            tab === 'cr'
              ? 'bg-emerald-600 text-white shadow-sm'
              : isDark ? 'bg-[#1e293b] text-slate-400 border border-white/[0.06]' : 'bg-white text-slate-500 border border-slate-200'
          }`}
        >
          Contas a Receber
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            tab === 'cr' ? 'bg-emerald-500' : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-400'
          }`}>
            {contasCR.length}
          </span>
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border shadow-sm p-3 space-y-3 ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          <Filter size={11} /> Filtros
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={tab === 'cp' ? 'Fornecedor, documento, CC, classe...' : 'Cliente, NF, CC, classe...'}
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className={`pl-8 pr-2 py-2.5 rounded-xl border text-xs
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                  ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
              />
            </div>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className={`pl-8 pr-2 py-2.5 rounded-xl border text-xs
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                  ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
              />
            </div>
          </div>
          {/* Issue #37: CC and Classe dropdowns */}
          <div className="flex gap-2">
            <select
              value={filtroCC}
              onChange={e => { setFiltroCC(e.target.value); if (e.target.value) setFiltroSemCC(false) }}
              className={`px-3 py-2.5 rounded-xl border text-xs
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
            >
              <option value="">Centro de Custo</option>
              {ccSuggestions.map(cc => (
                <option key={cc} value={cc}>{cc}</option>
              ))}
            </select>
            <select
              value={filtroClasse}
              onChange={e => { setFiltroClasse(e.target.value); if (e.target.value) setFiltroSemClasse(false) }}
              className={`px-3 py-2.5 rounded-xl border text-xs
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
            >
              <option value="">Classe Financeira</option>
              {classeSuggestions.map(cl => (
                <option key={cl} value={cl}>{cl}</option>
              ))}
            </select>
          </div>
        </div>
        {(busca || dataInicio || dataFim || filtroSemCC || filtroSemClasse || filtroCC || filtroClasse) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-400">Filtros ativos:</span>
            {busca && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5
                ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                "{busca}"
                <button onClick={() => setBusca('')}><X size={9} /></button>
              </span>
            )}
            {dataInicio && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5
                ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                De {fmtData(dataInicio)}
                <button onClick={() => setDataInicio('')}><X size={9} /></button>
              </span>
            )}
            {dataFim && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5
                ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                Até {fmtData(dataFim)}
                <button onClick={() => setDataFim('')}><X size={9} /></button>
              </span>
            )}
            {filtroSemCC && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-semibold
                rounded-full px-2 py-0.5">
                Sem Centro Custo
                <button onClick={() => setFiltroSemCC(false)}><X size={9} /></button>
              </span>
            )}
            {filtroSemClasse && (
              <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-[10px] font-semibold
                rounded-full px-2 py-0.5">
                Sem Classe Financeira
                <button onClick={() => setFiltroSemClasse(false)}><X size={9} /></button>
              </span>
            )}
            {filtroCC && (
              <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 text-[10px] font-semibold
                rounded-full px-2 py-0.5">
                CC: {filtroCC}
                <button onClick={() => setFiltroCC('')}><X size={9} /></button>
              </span>
            )}
            {filtroClasse && (
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-[10px] font-semibold
                rounded-full px-2 py-0.5">
                Classe: {filtroClasse}
                <button onClick={() => setFiltroClasse('')}><X size={9} /></button>
              </span>
            )}
            <button
              onClick={() => { setBusca(''); setDataInicio(''); setDataFim(''); setFiltroSemCC(false); setFiltroSemClasse(false); setFiltroCC(''); setFiltroClasse('') }}
              className="text-[10px] text-red-500 font-semibold hover:underline"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* ── Table Header ────────────────────────────────────── */}
      <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        <button onClick={toggleAll} className="shrink-0 text-slate-400 hover:text-emerald-600 transition-colors">
          {allSelected ? (
            <CheckSquare size={16} className="text-emerald-600" />
          ) : someSelected ? (
            <Minus size={16} className="text-emerald-500" />
          ) : (
            <Square size={16} />
          )}
        </button>
        <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center text-[10px] font-bold
          text-slate-400 uppercase tracking-wider">
          <span className="col-span-4 sm:col-span-3 flex items-center gap-1">
            <ArrowUpDown size={9} /> {tab === 'cp' ? 'Fornecedor' : 'Cliente'}
          </span>
          <span className="col-span-2 hidden sm:block">Vencimento</span>
          <span className="col-span-2 hidden sm:block">Status</span>
          <span className="col-span-2 hidden md:block">Centro Custo</span>
          <span className="col-span-2 hidden lg:block">Classe Fin.</span>
          <span className="col-span-2 text-right">Valor</span>
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-slate-50'}`}>
            <Landmark size={28} className={isDark ? 'text-emerald-300' : 'text-slate-200'} />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum título encontrado</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ajuste os filtros para ver resultados</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(row => {
            const isSelected = selected.has(row.id)
            const cfg = statusMap[row.status]
            const semCC = !row.centroCusto
            const semClasse = !row.classeFinanceira

            return (
              <button
                key={row.id}
                onClick={() => toggle(row.id)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 flex items-center gap-2
                  transition-all ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400/30'
                    : isDark ? 'bg-[#1e293b] border-white/[0.06] hover:border-white/[0.12] hover:shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="shrink-0">
                  {isSelected ? (
                    <CheckSquare size={16} className="text-emerald-600" />
                  ) : (
                    <Square size={16} className="text-slate-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
                  {/* Name + doc */}
                  <div className="col-span-10 sm:col-span-3 min-w-0">
                    <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{row.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {row.documento && (
                        <span className="text-[10px] text-slate-400 font-mono truncate">{row.documento}</span>
                      )}
                      {row.descricao && (
                        <span className="text-[10px] text-slate-400 truncate hidden sm:block">{row.descricao}</span>
                      )}
                    </div>
                  </div>

                  {/* Vencimento */}
                  <div className="col-span-2 hidden sm:block">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{fmtData(row.vencimento)}</span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 hidden sm:block">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold">
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? 'bg-slate-400'}`} />
                      {cfg?.label ?? row.status}
                    </span>
                  </div>

                  {/* Centro Custo */}
                  <div className="col-span-2 hidden md:block">
                    {row.centroCusto ? (
                      <span className={`text-[10px] font-medium truncate block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{row.centroCusto}</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-medium">
                        <AlertTriangle size={9} /> Vazio
                      </span>
                    )}
                  </div>

                  {/* Classe Financeira */}
                  <div className="col-span-2 hidden lg:block">
                    {row.classeFinanceira ? (
                      <span className="text-[10px] text-violet-600 font-medium truncate block">{row.classeFinanceira}</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-400 font-medium">
                        <AlertTriangle size={9} /> Vazio
                      </span>
                    )}
                  </div>

                  {/* Valor */}
                  <div className="col-span-2 text-right">
                    <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(row.valor)}</p>
                    {/* Mobile: show missing fields */}
                    <div className="flex items-center justify-end gap-1 mt-0.5 sm:hidden">
                      {semCC && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Sem CC" />
                      )}
                      {semClasse && (
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="Sem Classe" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Batch Action Bar (sticky bottom) ────────────────── */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40">
          <div className={`backdrop-blur-lg border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3
            ${isDark ? 'bg-[#1e293b]/95 border-white/[0.06]' : 'bg-white/95 border-slate-200'}`}>
            <div className="max-w-4xl mx-auto flex items-center gap-3 flex-wrap">
              {/* Selection info */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                  <CheckSquare size={14} className="text-emerald-600" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {selectedCount} {selectedCount === 1 ? 'selecionado' : 'selecionados'}
                  </p>
                  <p className="text-[10px] text-slate-400">{fmtFull(valorSelected)}</p>
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={() => setSelected(new Set())}
                className={`px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all
                  ${isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.03]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                Limpar
              </button>
              <button
                onClick={() => {
                  resetModalState()
                  setClassModalMode('classificar')
                  setShowClassModal(true)
                }}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white
                  text-[11px] font-bold hover:bg-violet-700 transition-all shadow-sm shadow-violet-500/20
                  disabled:opacity-50"
              >
                <Tag size={12} />
                Classificar
              </button>
              <button
                onClick={handleConciliar}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white
                  text-[11px] font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-500/20
                  disabled:opacity-50"
              >
                {isBusy ? (
                  <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 size={12} />
                )}
                Conciliar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Classification Modal ────────────────────────────── */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-violet-600" />
                <div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {classModalMode === 'conciliar' ? 'Preparar Conciliação' : 'Classificar em Lote'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {modalSelectedCount} {modalSelectedCount === 1 ? 'título' : 'títulos'} — {fmtFull(modalSelectedValue)}
                  </p>
                </div>
              </div>
              <button onClick={closeClassModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {classModalMode === 'conciliar'
                  ? 'Revise os classificadores antes da conciliação. Campos vazios mantêm o valor atual dos títulos selecionados.'
                  : 'Preencha os campos que deseja aplicar. Campos vazios não serão alterados.'}
              </p>

              {classModalMode === 'conciliar' && (
                <div className={`rounded-xl border px-3 py-2.5 text-xs space-y-1.5 ${
                  isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-300' : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  <p className="font-semibold">
                    Pendências: {modalMissingCCCount} sem centro de custo, {modalMissingClasseCount} sem classe financeira.
                  </p>
                  {requiresComprovanteUpload ? (
                    <p>
                      {missingComprovantePedidoIds.length === 1
                        ? 'Falta comprovante em 1 pedido vinculado. Anexe o arquivo para concluir a conciliação.'
                        : `Faltam comprovantes em ${missingComprovantePedidoIds.length} pedidos vinculados. O mesmo arquivo será anexado a todos eles.`}
                    </p>
                  ) : (
                    <p>Os pedidos vinculados aos títulos selecionados já possuem comprovante de pagamento.</p>
                  )}
                </div>
              )}

              <AutocompleteField
                isDark={isDark}
                label="Centro de Custo"
                icon={Briefcase}
                value={batchCC}
                onChange={setBatchCC}
                suggestions={ccSuggestions}
                placeholder="Ex: Obra Frutal, Administrativo..."
              />

              <AutocompleteField
                isDark={isDark}
                label="Classe Financeira"
                icon={Tag}
                value={batchClasse}
                onChange={setBatchClasse}
                suggestions={classeSuggestions}
                placeholder="Ex: Material, Serviço, Locação..."
              />

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <FolderOpen size={10} /> Projeto / Obra
                </label>
                <div className="relative">
                  <select
                    value={batchProjeto}
                    onChange={e => setBatchProjeto(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm appearance-none
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                      ${isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-200' : 'border-slate-200 text-slate-700 bg-white'}`}
                  >
                    <option value="">— Não alterar —</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>{o.nome} ({o.codigo})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {classModalMode === 'conciliar' && requiresComprovanteUpload && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Comprovante de Pagamento
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={event => setArquivoComprovante(event.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={`w-full flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed transition-all ${
                      arquivoComprovante
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50'
                    }`}
                  >
                    <Upload size={20} className={arquivoComprovante ? 'text-emerald-500' : 'text-slate-400'} />
                    <span className={`text-xs font-semibold ${arquivoComprovante ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {arquivoComprovante
                        ? `${arquivoComprovante.name} (${(arquivoComprovante.size / 1024).toFixed(0)} KB)`
                        : 'Clique para anexar o comprovante'}
                    </span>
                  </button>
                  <textarea
                    value={observacaoComprovante}
                    onChange={event => setObservacaoComprovante(event.target.value)}
                    placeholder="Observação sobre o pagamento (opcional)"
                    rows={2}
                    className={`w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${
                      isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-200 placeholder-slate-500' : 'border-slate-200 text-slate-700 placeholder-slate-400'
                    }`}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={closeClassModal}
                  className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all
                    ${isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.03]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={classModalMode === 'conciliar' ? handleConfirmarConciliacao : handleClassificar}
                  disabled={
                    isBusy
                    || uploadAnexo.isPending
                    || (
                      classModalMode === 'classificar'
                        ? (!batchCC && !batchClasse && !batchProjeto)
                        : (requiresComprovanteUpload && !arquivoComprovante)
                    )
                  }
                  className={`flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    classModalMode === 'conciliar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'
                  }`}
                >
                  {isBusy || uploadAnexo.isPending ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  {classModalMode === 'conciliar'
                    ? `Conciliar ${modalSelectedCount} ${modalSelectedCount === 1 ? 'título' : 'títulos'}`
                    : `Aplicar a ${modalSelectedCount} ${modalSelectedCount === 1 ? 'título' : 'títulos'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
