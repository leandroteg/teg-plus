import { useState, useMemo } from 'react'
import {
  Package2, Plus, Search, AlertTriangle, LayoutList, LayoutGrid,
  X, Save, Loader2, Download, Truck, PackageCheck, RefreshCw, ClipboardCheck,
  CheckCircle2, Warehouse, Building2, Ban, History, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  useEstoqueItens, useSalvarItem, useSaldos, useBases,
  useAguardandoEntrada, useEmMovimentacao, useLiberadosRetirada,
  useConfirmarEntrada, useContaCorrenteItem,
} from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
import type {
  EstItem, EstSaldo, EstSolicitacao, EstoqueEntradaItem, EstoqueMovimentacaoItem,
  EstoquePipelineTab,
} from '../../types/estoque'
import { ESTOQUE_PIPELINE_STAGES as STAGES } from '../../types/estoque'

// ── Accent maps ──────────────────────────────────────────────────────────────
const STATUS_ACCENT: Record<EstoquePipelineTab, { bg: string; text: string; border: string; badge: string; ring: string }> = {
  aguardando_entrada: { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-300',   badge: 'bg-slate-100 text-slate-700',     ring: 'ring-slate-400'   },
  em_estoque:         { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-400', badge: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-400' },
  liberado_retirada:  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-400',    badge: 'bg-blue-100 text-blue-700',       ring: 'ring-blue-400'    },
  em_movimentacao:    { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-400',   badge: 'bg-amber-100 text-amber-700',     ring: 'ring-amber-400'   },
}
const STATUS_ACCENT_DARK: Record<EstoquePipelineTab, { bg: string; text: string; border: string; badge: string; ring: string }> = {
  aguardando_entrada: { bg: 'bg-slate-500/10',   text: 'text-slate-300',   border: 'border-slate-500',   badge: 'bg-slate-500/20 text-slate-300',     ring: 'ring-slate-500'   },
  em_estoque:         { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400', ring: 'ring-emerald-500' },
  liberado_retirada:  { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500',    badge: 'bg-blue-500/20 text-blue-400',       ring: 'ring-blue-500'    },
  em_movimentacao:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500',   badge: 'bg-amber-500/20 text-amber-400',     ring: 'ring-amber-500'   },
}

const CURVA_COLOR: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  A: { bg: 'bg-red-100',   text: 'text-red-700',   darkBg: 'bg-red-500/20',   darkText: 'text-red-400'   },
  B: { bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'bg-amber-500/20', darkText: 'text-amber-400' },
  C: { bg: 'bg-slate-100', text: 'text-slate-600', darkBg: 'bg-slate-500/20', darkText: 'text-slate-400' },
}

const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada', saida: 'Saída', transferencia_out: 'Transf. Saída',
  transferencia_in: 'Transf. Entrada', ajuste_positivo: 'Ajuste +', ajuste_negativo: 'Ajuste −',
  devolucao: 'Devolução', baixa: 'Baixa', recebimento: 'Recebimento',
}

const DESTINO_LABEL: Record<string, { label: string; icon: typeof Warehouse; color: string; darkColor: string }> = {
  consumo:      { label: 'Estoque',     icon: Warehouse,  color: 'bg-teal-100 text-teal-700',   darkColor: 'bg-teal-500/20 text-teal-400' },
  patrimonial:  { label: 'Patrimônio',  icon: Building2,  color: 'bg-violet-100 text-violet-700', darkColor: 'bg-violet-500/20 text-violet-400' },
  nenhum:       { label: 'Nenhum',      icon: Ban,        color: 'bg-slate-100 text-slate-500',  darkColor: 'bg-slate-500/20 text-slate-400' },
}

const UNIDADES = ['UN', 'M', 'M2', 'M3', 'KG', 'TON', 'L', 'CX', 'PCT', 'RL', 'PR', 'JG']

const EMPTY_FORM: Partial<EstItem> = {
  codigo: '', descricao: '', categoria: '', unidade: 'UN', curva_abc: 'C',
  estoque_minimo: 0, estoque_maximo: 0, ponto_reposicao: 0, lead_time_dias: 0,
  controla_lote: false, controla_serie: false, tem_validade: false, valor_medio: 0,
}

type ViewMode = 'list' | 'cards'

function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════

export default function Itens() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<EstoquePipelineTab>('em_estoque')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [busca, setBusca] = useState('')
  const [curvaFiltro, setCurvaFiltro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<EstItem> | null>(null)
  const [baseFilter, setBaseFilter] = useState('')
  const [contaCorrenteItemId, setContaCorrenteItemId] = useState<string | undefined>(undefined)

  // Data
  const { data: bases = [] } = useBases()
  const { data: saldos = [], isLoading: loadingSaldos } = useSaldos(baseFilter || undefined)
  const { data: entradas = [], isLoading: loadingEntradas } = useAguardandoEntrada()
  const { data: liberados = [], isLoading: loadingLiberados } = useLiberadosRetirada()
  const { data: movs = [], isLoading: loadingMovs } = useEmMovimentacao()
  const salvar = useSalvarItem()
  const confirmarEntrada = useConfirmarEntrada()

  const accent = isDark ? STATUS_ACCENT_DARK : STATUS_ACCENT

  // Filtered data per tab
  const saldosFiltrados = useMemo(() => {
    let list = saldos.filter(s => s.saldo > 0)
    if (curvaFiltro) list = list.filter(s => s.item?.curva_abc === curvaFiltro)
    if (busca.trim()) {
      const t = busca.toLowerCase()
      list = list.filter(s =>
        (s.item?.descricao ?? '').toLowerCase().includes(t) ||
        (s.item?.codigo ?? '').toLowerCase().includes(t)
      )
    }
    return list
  }, [saldos, curvaFiltro, busca])

  const entradasFiltradas = useMemo(() => {
    if (!busca.trim()) return entradas
    const t = busca.toLowerCase()
    return entradas.filter(e =>
      e.descricao.toLowerCase().includes(t) || e.codigo.toLowerCase().includes(t)
    )
  }, [entradas, busca])

  const movsFiltradas = useMemo(() => {
    if (!busca.trim()) return movs
    const t = busca.toLowerCase()
    return movs.filter(m =>
      m.descricao.toLowerCase().includes(t) || m.codigo.toLowerCase().includes(t)
    )
  }, [movs, busca])

  const liberadosFiltrados = useMemo(() => {
    if (!busca.trim()) return liberados
    const t = busca.toLowerCase()
    return liberados.filter(s =>
      s.numero.toLowerCase().includes(t) ||
      s.solicitante_nome.toLowerCase().includes(t) ||
      s.obra_nome.toLowerCase().includes(t)
    )
  }, [liberados, busca])

  const counts: Record<EstoquePipelineTab, number> = {
    aguardando_entrada: entradasFiltradas.length,
    em_estoque: saldosFiltrados.length,
    liberado_retirada: liberadosFiltrados.length,
    em_movimentacao: movsFiltradas.length,
  }

  const isLoading = activeTab === 'em_estoque' ? loadingSaldos
    : activeTab === 'aguardando_entrada' ? loadingEntradas
    : activeTab === 'liberado_retirada' ? loadingLiberados : loadingMovs

  // Form handlers
  function openNew() { setEditItem({ ...EMPTY_FORM }); setShowForm(true) }
  function openEdit(item: EstItem) { setEditItem({ ...item }); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null) }
  async function handleSave() { if (!editItem) return; await salvar.mutateAsync(editItem); closeForm() }

  // CSV export
  function exportCSV() {
    let csv = ''
    if (activeTab === 'em_estoque') {
      csv = 'Codigo;Descricao;Base;Saldo;Unidade;Curva;Valor Medio\n'
      saldosFiltrados.forEach(s => {
        csv += `${s.item?.codigo};${s.item?.descricao};${s.base?.nome};${s.saldo};${s.item?.unidade};${s.item?.curva_abc};${(s.item as any)?.valor_medio ?? 0}\n`
      })
    } else if (activeTab === 'aguardando_entrada') {
      csv = 'Codigo;Descricao;Quantidade;Tipo;Fornecedor;NF;Data\n'
      entradasFiltradas.forEach(e => {
        csv += `${e.codigo};${e.descricao};${e.quantidade};${TIPO_LABEL[e.tipo] ?? e.tipo};${e.fornecedor_nome ?? ''};${e.nf_numero ?? ''};${fmtDate(e.criado_em)}\n`
      })
    } else if (activeTab === 'liberado_retirada') {
      csv = 'Numero;Solicitante;Obra;Urgencia;Status;Itens;Data\n'
      liberadosFiltrados.forEach(s => {
        csv += `${s.numero};${s.solicitante_nome};${s.obra_nome};${s.urgencia};${s.status};${s.itens?.length ?? 0};${fmtDate(s.criado_em)}\n`
      })
    } else {
      csv = 'Codigo;Descricao;Quantidade;Tipo;Base;Destino;Responsavel;Data\n'
      movsFiltradas.forEach(m => {
        csv += `${m.codigo};${m.descricao};${m.quantidade};${TIPO_LABEL[m.tipo] ?? m.tipo};${m.base_nome ?? ''};${m.base_destino_nome ?? ''};${m.responsavel_nome ?? ''};${fmtDate(m.criado_em)}\n`
      })
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `estoque_${activeTab}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Estoque
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {'Vis\u00e3o geral do estoque por item'}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Item
        </button>
      </div>

      {/* ── Pipeline Tabs ──────────────────────────────────────────── */}
      <div className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {STAGES.map(stage => {
          const active = activeTab === stage.tab
          const a = accent[stage.tab]
          return (
            <button
              key={stage.tab}
              onClick={() => setActiveTab(stage.tab)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${active
                  ? `${a.bg} ${a.text} ${a.border} border shadow-sm`
                  : isDark
                    ? 'text-slate-400 hover:bg-white/[0.04] border border-transparent'
                    : 'text-slate-500 hover:bg-white hover:shadow-sm border border-transparent'
                }`}
            >
              {stage.tab === 'aguardando_entrada' && <PackageCheck size={15} />}
              {stage.tab === 'em_estoque' && <Package2 size={15} />}
              {stage.tab === 'liberado_retirada' && <ClipboardCheck size={15} />}
              {stage.tab === 'em_movimentacao' && <Truck size={15} />}
              {stage.label}
              <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${active ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                {counts[stage.tab]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Content Card ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`}>

        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar..."
              className={`pl-8 pr-3 py-1.5 rounded-lg border text-xs w-[200px]
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                ${isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-800'}`}
            />
          </div>

          {activeTab === 'em_estoque' && (
            <select
              value={baseFilter}
              onChange={e => setBaseFilter(e.target.value)}
              className={`px-2 py-1.5 rounded-lg border text-xs
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                ${isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              <option value="">Estoque Geral</option>
              {bases.map(b => (
                <option key={b.id} value={b.id}>{b.nome}</option>
              ))}
            </select>
          )}

          {activeTab === 'em_estoque' && (
            <div className="flex gap-1">
              {(['', 'A', 'B', 'C'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCurvaFiltro(c)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${
                    curvaFiltro === c
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isDark
                        ? 'bg-white/[0.03] text-slate-400 border-white/[0.08] hover:bg-white/[0.06]'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c === '' ? 'Todos' : c}
                </button>
              ))}
            </div>
          )}

          <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 transition-all ${viewMode === 'list'
                ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700')
                : (isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600')}`}
              title="Lista">
              <LayoutList size={14} />
            </button>
            <button onClick={() => setViewMode('cards')}
              className={`p-1.5 transition-all ${viewMode === 'cards'
                ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700')
                : (isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600')}`}
              title="Cards">
              <LayoutGrid size={14} />
            </button>
          </div>

          <button onClick={exportCSV}
            className={`p-1.5 rounded-lg border transition-colors ${isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}
            title="Exportar CSV">
            <Download size={14} />
          </button>

          <div className={`ml-auto flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{counts[activeTab]} item(ns)</span>
            {activeTab === 'em_estoque' && saldosFiltrados.filter(s => s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)).length > 0 && (
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <AlertTriangle size={11} /> {saldosFiltrados.filter(s => s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)).length} abaixo do mínimo
              </span>
            )}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'em_estoque' && (
              viewMode === 'list'
                ? <SaldosList data={saldosFiltrados} isDark={isDark} onEdit={openEdit} onClickItem={(id) => setContaCorrenteItemId(id)} />
                : <SaldosCards data={saldosFiltrados} isDark={isDark} onClickItem={(id) => setContaCorrenteItemId(id)} />
            )}
            {activeTab === 'aguardando_entrada' && (
              viewMode === 'list'
                ? <EntradasList data={entradasFiltradas} isDark={isDark} onConfirm={(ids) => confirmarEntrada.mutate(ids)} confirming={confirmarEntrada.isPending} />
                : <EntradasCards data={entradasFiltradas} isDark={isDark} onConfirm={(ids) => confirmarEntrada.mutate(ids)} confirming={confirmarEntrada.isPending} />
            )}
            {activeTab === 'liberado_retirada' && (
              viewMode === 'list'
                ? <LiberadosList data={liberadosFiltrados} isDark={isDark} />
                : <LiberadosCards data={liberadosFiltrados} isDark={isDark} />
            )}
            {activeTab === 'em_movimentacao' && (
              viewMode === 'list'
                ? <MovsList data={movsFiltradas} isDark={isDark} />
                : <MovsCards data={movsFiltradas} isDark={isDark} />
            )}
          </>
        )}
      </div>

      {/* ── Item Form Modal ────────────────────────────────────────── */}
      {showForm && editItem && (
        <ItemFormModal
          item={editItem}
          onChange={setEditItem}
          onSave={handleSave}
          onClose={closeForm}
          saving={salvar.isPending}
          isDark={isDark}
        />
      )}

      {contaCorrenteItemId && (
        <ContaCorrenteModal
          itemId={contaCorrenteItemId}
          onClose={() => setContaCorrenteItemId(undefined)}
          isDark={isDark}
        />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Em Estoque — List & Cards
// ═════════════════════════════════════════════════════════════════════════════

function SaldosList({ data, isDark, onEdit, onClickItem }: { data: EstSaldo[]; isDark: boolean; onEdit: (item: EstItem) => void; onClickItem: (itemId: string) => void }) {
  if (data.length === 0) return <EmptyState icon={Package2} msg="Nenhum item em estoque" sub="Os itens aparecerão aqui quando houver saldo" isDark={isDark} />
  return (
    <>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
        <span className="w-[70px] shrink-0">Código</span>
        <span className="flex-1 min-w-0">Descrição</span>
        <span className="w-[100px] shrink-0">Base</span>
        <span className="w-[50px] shrink-0 text-center">Curva</span>
        <span className="w-[80px] shrink-0 text-right">Saldo</span>
        <span className="w-[60px] shrink-0 text-right">Reserv.</span>
        <span className="w-[80px] shrink-0 text-right">Disp.</span>
        <span className="w-[40px] shrink-0" />
      </div>
      {/* Rows */}
      {data.map(s => {
        const abaixo = s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)
        const curva = CURVA_COLOR[s.item?.curva_abc ?? 'C']
        const disponivel = s.saldo - (s.saldo_reservado ?? 0)
        return (
          <div key={s.id} onClick={() => s.item_id && onClickItem(s.item_id)} className={`flex items-center gap-2 px-3 py-1.5 border-b cursor-pointer transition-all ${
            isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'
          }`}>
            <span className={`text-[11px] font-mono font-bold w-[70px] shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
              {s.item?.codigo ?? '—'}
            </span>
            <span className="flex-1 min-w-0 truncate">
              <span className={`text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.item?.descricao ?? '—'}</span>
              {abaixo && <AlertTriangle size={10} className="inline ml-1 text-amber-500" />}
            </span>
            <span className={`text-[11px] truncate w-[100px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {s.base?.nome ?? '—'}
            </span>
            <span className="w-[50px] shrink-0 text-center">
              {s.item?.curva_abc && (
                <span className={`inline-flex rounded-full text-[10px] font-bold px-1.5 py-0.5
                  ${isDark ? `${curva.darkBg} ${curva.darkText}` : `${curva.bg} ${curva.text}`}`}>
                  {s.item.curva_abc}
                </span>
              )}
            </span>
            <span className={`text-[11px] font-semibold text-right w-[80px] shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {s.saldo} {s.item?.unidade}
            </span>
            <span className={`text-[11px] text-right w-[60px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {s.saldo_reservado ?? 0}
            </span>
            <span className={`text-[11px] font-semibold text-right w-[80px] shrink-0 ${
              disponivel <= 0 ? 'text-red-500' : isDark ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              {disponivel} {s.item?.unidade}
            </span>
            <span className="w-[40px] shrink-0 text-right">
              <button
                onClick={(e) => { e.stopPropagation(); s.item && onEdit(s.item as EstItem) }}
                className="text-[10px] text-blue-600 font-semibold hover:underline"
              >
                Editar
              </button>
            </span>
          </div>
        )
      })}
    </>
  )
}

function SaldosCards({ data, isDark, onClickItem }: { data: EstSaldo[]; isDark: boolean; onClickItem: (itemId: string) => void }) {
  if (data.length === 0) return <EmptyState icon={Package2} msg="Nenhum item em estoque" sub="Os itens aparecerão aqui quando houver saldo" isDark={isDark} />
  return (
    <div className="space-y-2 p-4">
      {data.map(s => {
        const abaixo = s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)
        const curva = CURVA_COLOR[s.item?.curva_abc ?? 'C']
        const disponivel = s.saldo - (s.saldo_reservado ?? 0)
        return (
          <div key={s.id} onClick={() => s.item_id && onClickItem(s.item_id)} className={`rounded-2xl border p-4 cursor-pointer transition-all group flex flex-col ${
            isDark
              ? 'border-white/[0.06] hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 bg-white/[0.02]'
              : 'border-slate-200 hover:border-blue-300 hover:shadow-md bg-white'
          }`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className={`font-mono text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.item?.codigo}</p>
                <p className={`font-semibold text-sm truncate mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {s.item?.descricao}
                </p>
              </div>
              {s.item?.curva_abc && (
                <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 shrink-0
                  ${isDark ? `${curva.darkBg} ${curva.darkText}` : `${curva.bg} ${curva.text}`}`}>
                  Curva {s.item.curva_abc}
                </span>
              )}
            </div>
            <div className={`border-t my-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`} />
            <div className="flex items-center justify-between text-xs">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.base?.nome ?? '—'}</span>
              <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {s.saldo} {s.item?.unidade}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                Min: {s.item?.estoque_minimo} · Repos: {s.item?.ponto_reposicao}
              </span>
              <span className={disponivel <= 0 ? 'text-red-500 font-bold' : isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                Disp: {disponivel}
              </span>
            </div>
            {abaixo && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-500 font-semibold">
                <AlertTriangle size={10} /> Abaixo do mínimo
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Aguardando Entrada — List & Cards
// ═════════════════════════════════════════════════════════════════════════════

function DestinoBadge({ tipo, isDark }: { tipo?: string; isDark: boolean }) {
  const d = DESTINO_LABEL[tipo ?? 'nenhum'] ?? DESTINO_LABEL.nenhum
  const Icon = d.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isDark ? d.darkColor : d.color}`}>
      <Icon size={10} />
      {d.label}
    </span>
  )
}

function EntradasList({ data, isDark, onConfirm, confirming }: { data: EstoqueEntradaItem[]; isDark: boolean; onConfirm: (ids: string[]) => void; confirming: boolean }) {
  if (data.length === 0) return <EmptyState icon={PackageCheck} msg="Nenhuma entrada pendente" sub="Os itens aparecerão aqui após confirmar recebimento" isDark={isDark} />
  return (
    <>
      <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
        <span className="w-[70px] shrink-0">Código</span>
        <span className="flex-1 min-w-0">Descrição</span>
        <span className="w-[70px] shrink-0 text-right">Qtd</span>
        <span className="w-[90px] shrink-0 text-center">Destino</span>
        <span className="w-[120px] shrink-0">Pedido</span>
        <span className="w-[120px] shrink-0">Fornecedor</span>
        <span className="w-[62px] shrink-0 text-right">Data</span>
        <span className="w-[80px] shrink-0 text-right">Ação</span>
      </div>
      {data.map(e => (
        <div key={e.id} className={`flex items-center gap-2 px-3 py-1.5 border-b transition-all ${
          isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'
        }`}>
          <span className={`text-[11px] font-mono font-bold w-[70px] shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            {e.codigo || '—'}
          </span>
          <span className={`text-xs truncate flex-1 min-w-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {e.descricao}
          </span>
          <span className={`text-[11px] font-semibold text-right w-[70px] shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {e.quantidade} {e.unidade}
          </span>
          <span className="w-[90px] shrink-0 text-center">
            <DestinoBadge tipo={e.tipo_destino} isDark={isDark} />
          </span>
          <span className={`text-[11px] font-mono w-[120px] shrink-0 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {e.numero_pedido || '—'}
          </span>
          <span className={`text-[11px] truncate w-[120px] shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {e.fornecedor_nome || '—'}
          </span>
          <span className={`text-[11px] text-right w-[62px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {fmtDate(e.criado_em)}
          </span>
          <span className="w-[80px] shrink-0 text-right">
            <button
              onClick={() => onConfirm([e.id])}
              disabled={confirming}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-all"
            >
              <CheckCircle2 size={11} />
              Confirmar
            </button>
          </span>
        </div>
      ))}
      {data.length > 1 && (
        <div className="flex justify-end px-3 py-2">
          <button
            onClick={() => onConfirm(data.map(e => e.id))}
            disabled={confirming}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <CheckCircle2 size={14} />
            Confirmar Todos ({data.length})
          </button>
        </div>
      )}
    </>
  )
}

function EntradasCards({ data, isDark, onConfirm, confirming }: { data: EstoqueEntradaItem[]; isDark: boolean; onConfirm: (ids: string[]) => void; confirming: boolean }) {
  if (data.length === 0) return <EmptyState icon={PackageCheck} msg="Nenhuma entrada pendente" sub="Os itens aparecerão aqui após confirmar recebimento" isDark={isDark} />
  return (
    <div className="space-y-2 p-4">
      {data.map(e => {
        const dest = DESTINO_LABEL[e.tipo_destino ?? 'nenhum'] ?? DESTINO_LABEL.nenhum
        return (
          <div key={e.id} className={`rounded-2xl border p-4 transition-all group flex flex-col ${
            isDark
              ? 'border-white/[0.06] hover:border-teal-500/30 hover:shadow-lg hover:shadow-teal-500/5 bg-white/[0.02]'
              : 'border-slate-200 hover:border-teal-300 hover:shadow-md bg-white'
          }`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className={`font-mono text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {e.codigo || '—'} {e.numero_pedido ? `· ${e.numero_pedido}` : ''}
                </p>
                <p className={`font-semibold text-sm truncate mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {e.descricao}
                </p>
              </div>
              <DestinoBadge tipo={e.tipo_destino} isDark={isDark} />
            </div>
            <div className={`border-t my-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`} />
            <div className="flex items-center justify-between text-xs">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                Qtd: {e.quantidade} {e.unidade}
                {e.valor_unitario ? ` · ${fmtCurrency(e.valor_unitario)}/un` : ''}
              </span>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                {e.fornecedor_nome || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {e.base_nome ? `Base: ${e.base_nome}` : ''} {fmtDate(e.criado_em)}
              </span>
              <button
                onClick={() => onConfirm([e.id])}
                disabled={confirming}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 size={12} />
                Confirmar Entrada
              </button>
            </div>
          </div>
        )
      })}
      {data.length > 1 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => onConfirm(data.map(e => e.id))}
            disabled={confirming}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <CheckCircle2 size={14} />
            Confirmar Todos ({data.length})
          </button>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Liberado para Retirada — List & Cards
// ═════════════════════════════════════════════════════════════════════════════

const URGENCIA_BADGE: Record<string, { light: string; dark: string }> = {
  normal:  { light: 'bg-slate-100 text-slate-600',  dark: 'bg-slate-500/20 text-slate-400'  },
  urgente: { light: 'bg-amber-100 text-amber-700',  dark: 'bg-amber-500/20 text-amber-400'  },
  critica: { light: 'bg-red-100 text-red-700',      dark: 'bg-red-500/20 text-red-400'      },
}

function LiberadosList({ data, isDark }: { data: EstSolicitacao[]; isDark: boolean }) {
  if (data.length === 0) return <EmptyState icon={ClipboardCheck} msg="Nenhuma solicitação liberada" sub="As solicitações aprovadas aparecerão aqui" isDark={isDark} />
  return (
    <>
      <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
        <span className="w-[60px] shrink-0">Nº</span>
        <span className="flex-1 min-w-0">Solicitante</span>
        <span className="w-[120px] shrink-0">Obra</span>
        <span className="w-[70px] shrink-0 text-center">Urgência</span>
        <span className="w-[90px] shrink-0 text-center">Status</span>
        <span className="w-[40px] shrink-0 text-right">Itens</span>
        <span className="w-[62px] shrink-0 text-right">Data</span>
      </div>
      {data.map(s => {
        const urg = URGENCIA_BADGE[s.urgencia] ?? URGENCIA_BADGE.normal
        return (
          <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 border-b cursor-pointer transition-all ${
            isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'
          }`}>
            <span className={`text-[11px] font-mono font-bold w-[60px] shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
              {s.numero}
            </span>
            <span className={`text-xs truncate flex-1 min-w-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {s.solicitante_nome}
            </span>
            <span className={`text-[11px] truncate w-[120px] shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {s.obra_nome}
            </span>
            <span className="w-[70px] shrink-0 text-center">
              <span className={`inline-flex rounded-full text-[10px] font-bold px-1.5 py-0.5 capitalize
                ${isDark ? urg.dark : urg.light}`}>
                {s.urgencia}
              </span>
            </span>
            <span className="w-[90px] shrink-0 text-center">
              <span className={`inline-flex rounded-full text-[10px] font-bold px-1.5 py-0.5
                ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                {s.status === 'aprovada' ? 'Aprovada' : 'Em Separação'}
              </span>
            </span>
            <span className={`text-[11px] font-semibold text-right w-[40px] shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {s.itens?.length ?? 0}
            </span>
            <span className={`text-[11px] text-right w-[62px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {fmtDate(s.criado_em)}
            </span>
          </div>
        )
      })}
    </>
  )
}

function LiberadosCards({ data, isDark }: { data: EstSolicitacao[]; isDark: boolean }) {
  if (data.length === 0) return <EmptyState icon={ClipboardCheck} msg="Nenhuma solicitação liberada" sub="As solicitações aprovadas aparecerão aqui" isDark={isDark} />
  return (
    <div className="space-y-2 p-4">
      {data.map(s => {
        const urg = URGENCIA_BADGE[s.urgencia] ?? URGENCIA_BADGE.normal
        return (
        <div key={s.id} className={`rounded-2xl border p-4 cursor-pointer transition-all group flex flex-col ${
            isDark
              ? 'border-white/[0.06] hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 bg-white/[0.02]'
              : 'border-slate-200 hover:border-blue-300 hover:shadow-md bg-white'
          }`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className={`font-mono text-[10px] font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{s.numero}</p>
                <p className={`font-semibold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {s.solicitante_nome}
                </p>
              </div>
              <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 capitalize shrink-0
                ${isDark ? urg.dark : urg.light}`}>
                {s.urgencia}
              </span>
            </div>
            <div className={`border-t my-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`} />
            <div className="flex items-center justify-between text-xs">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.obra_nome}</span>
              <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {s.itens?.length ?? 0} itens
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className={`rounded-full font-bold px-2 py-0.5
                ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                {s.status === 'aprovada' ? 'Aprovada' : 'Em Separação'}
              </span>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{fmtDate(s.criado_em)}</span>
            </div>
            {s.itens && s.itens.length > 0 && (
              <div className={`mt-3 pt-2 border-t space-y-1 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                {s.itens.slice(0, 3).map(it => (
                  <div key={it.id} className={`flex items-center justify-between text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className="truncate max-w-[180px]">{it.item?.descricao ?? it.descricao_livre ?? '—'}</span>
                    <span className="font-semibold">{it.quantidade} {it.item?.unidade ?? it.unidade ?? 'UN'}</span>
                  </div>
                ))}
                {s.itens.length > 3 && (
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    +{s.itens.length - 3} mais...
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Em Movimentação — List & Cards
// ═════════════════════════════════════════════════════════════════════════════

function MovsList({ data, isDark }: { data: EstoqueMovimentacaoItem[]; isDark: boolean }) {
  if (data.length === 0) return <EmptyState icon={Truck} msg="Nenhuma movimentação ativa" sub="As movimentações aparecerão aqui quando registradas" isDark={isDark} />
  return (
    <>
      <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
        <span className="w-[70px] shrink-0">Código</span>
        <span className="flex-1 min-w-0">Descrição</span>
        <span className="w-[70px] shrink-0 text-right">Qtd</span>
        <span className="w-[90px] shrink-0 text-center">Tipo</span>
        <span className="w-[140px] shrink-0">Origem → Destino</span>
        <span className="w-[100px] shrink-0">Responsável</span>
        <span className="w-[62px] shrink-0 text-right">Data</span>
      </div>
      {data.map(m => (
        <div key={m.id} className={`flex items-center gap-2 px-3 py-1.5 border-b cursor-pointer transition-all ${
          isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'
        }`}>
          <span className={`text-[11px] font-mono font-bold w-[70px] shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            {m.codigo}
          </span>
          <span className="flex-1 min-w-0 truncate">
            <span className={`text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.descricao}</span>
            {m.obra_nome && <span className={`text-[10px] ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.obra_nome}</span>}
          </span>
          <span className={`text-[11px] font-semibold text-right w-[70px] shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {m.quantidade} {m.unidade}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md w-[90px] shrink-0 text-center font-medium ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
            {TIPO_LABEL[m.tipo] ?? m.tipo}
          </span>
          <span className={`text-[11px] truncate w-[140px] shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {m.base_nome ?? '—'}{m.base_destino_nome ? ` → ${m.base_destino_nome}` : ''}
          </span>
          <span className={`text-[11px] truncate w-[100px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {m.responsavel_nome || '—'}
          </span>
          <span className={`text-[11px] text-right w-[62px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {fmtDate(m.criado_em)}
          </span>
        </div>
      ))}
    </>
  )
}

function MovsCards({ data, isDark }: { data: EstoqueMovimentacaoItem[]; isDark: boolean }) {
  if (data.length === 0) return <EmptyState icon={Truck} msg="Nenhuma movimentação ativa" sub="As movimentações aparecerão aqui quando registradas" isDark={isDark} />
  return (
    <div className="space-y-2 p-4">
      {data.map(m => (
        <div key={m.id} className={`rounded-2xl border p-4 cursor-pointer transition-all group flex flex-col ${
          isDark
            ? 'border-white/[0.06] hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 bg-white/[0.02]'
            : 'border-slate-200 hover:border-blue-300 hover:shadow-md bg-white'
        }`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className={`font-mono text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.codigo}</p>
              <p className={`font-semibold text-sm truncate mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {m.descricao}
              </p>
            </div>
            <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 shrink-0
              ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
              {TIPO_LABEL[m.tipo] ?? m.tipo}
            </span>
          </div>
          <div className={`border-t my-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`} />
          <div className="flex items-center justify-between text-xs">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              Qtd: {m.quantidade} {m.unidade}
            </span>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {m.base_nome ?? ''}{m.base_destino_nome ? ` → ${m.base_destino_nome}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
              {m.responsavel_nome || m.obra_nome || '—'}
            </span>
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{fmtDate(m.criado_em)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, msg, sub, isDark }: { icon: any; msg: string; sub?: string; isDark: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
        <Icon size={24} className="text-slate-300" />
      </div>
      <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{msg}</p>
      {sub && <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Conta Corrente Modal
// ═════════════════════════════════════════════════════════════════════════════

function ContaCorrenteModal({ itemId, onClose, isDark }: { itemId: string; onClose: () => void; isDark: boolean }) {
  const { data, isLoading } = useContaCorrenteItem(itemId)
  const saldos = data?.saldos ?? []
  const movs = data?.movimentacoes ?? []

  const modalBg = isDark ? 'bg-[#111827]' : 'bg-white'
  const borderB = isDark ? 'border-white/[0.06]' : 'border-slate-100'

  // Compute running balance chronologically
  const movsComSaldo = useMemo(() => {
    let running = 0
    return movs.map(m => {
      const isEntrada = ['entrada', 'transferencia_in', 'ajuste_positivo', 'devolucao'].includes(m.tipo)
      running += isEntrada ? m.quantidade : -m.quantidade
      return { ...m, saldo_acumulado: running }
    })
  }, [movs])

  const itemInfo = movs[0]?.item

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderB} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <History size={18} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            </div>
            <div>
              <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Conta Corrente
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {itemInfo ? `${itemInfo.codigo} — ${itemInfo.descricao}` : 'Carregando...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {/* Saldo por Base */}
            {saldos.length > 0 && (
              <div className={`px-6 py-4 border-b ${borderB}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Saldo Atual por Base
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {saldos.map(s => (
                    <div key={s.id} className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                      <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {s.base?.nome ?? 'Base'}
                      </p>
                      <p className={`text-lg font-extrabold mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {s.saldo}
                      </p>
                      {(s.saldo_reservado ?? 0) > 0 && (
                        <p className={`text-[10px] ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                          Reservado: {s.saldo_reservado}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Movimentacoes */}
            <div className="px-6 py-4">
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Historico de Movimentacoes ({movsComSaldo.length})
              </h3>
              {movsComSaldo.length === 0 ? (
                <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Nenhuma movimentacao registrada
                </p>
              ) : (
                <div className="space-y-0">
                  {/* Header */}
                  <div className={`flex items-center gap-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    <span className="w-[70px] shrink-0">Data</span>
                    <span className="w-[90px] shrink-0">Tipo</span>
                    <span className="w-[60px] shrink-0 text-right">Qtd</span>
                    <span className="flex-1 min-w-0">Base</span>
                    <span className="w-[100px] shrink-0 hidden md:block">Responsavel</span>
                    <span className="w-[60px] shrink-0 text-right">Saldo</span>
                  </div>
                  {/* Rows (newest first for display) */}
                  {[...movsComSaldo].reverse().map(m => {
                    const isEntrada = ['entrada', 'transferencia_in', 'ajuste_positivo', 'devolucao'].includes(m.tipo)
                    return (
                      <div key={m.id} className={`flex items-center gap-2 px-2 py-1.5 border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`}>
                        <span className={`text-[11px] w-[70px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {fmtDate(m.criado_em)}
                        </span>
                        <span className="w-[90px] shrink-0 flex items-center gap-1">
                          {isEntrada
                            ? <ArrowUpRight size={11} className="text-emerald-500" />
                            : <ArrowDownRight size={11} className="text-red-500" />
                          }
                          <span className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {TIPO_LABEL[m.tipo] ?? m.tipo}
                          </span>
                        </span>
                        <span className={`text-[11px] font-semibold text-right w-[60px] shrink-0 ${isEntrada ? 'text-emerald-600' : 'text-red-500'}`}>
                          {isEntrada ? '+' : '-'}{m.quantidade}
                        </span>
                        <span className={`text-[11px] truncate flex-1 min-w-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {m.base?.nome ?? '—'}
                        </span>
                        <span className={`text-[11px] truncate w-[100px] shrink-0 hidden md:block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {m.responsavel_nome ?? '—'}
                        </span>
                        <span className={`text-[11px] font-bold text-right w-[60px] shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {m.saldo_acumulado}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Item Form Modal (preserved from original)
// ═════════════════════════════════════════════════════════════════════════════

function ItemFormModal({
  item, onChange, onSave, onClose, saving, isDark
}: {
  item: Partial<EstItem>
  onChange: (v: Partial<EstItem>) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  isDark: boolean
}) {
  const set = (k: keyof EstItem, v: any) => onChange({ ...item, [k]: v })

  const modalBg = isDark ? 'bg-[#111827]' : 'bg-white'
  const borderB = isDark ? 'border-white/[0.06]' : 'border-slate-100'
  const labelCls = isDark ? 'text-slate-300' : 'text-slate-600'
  const inputCls = isDark
    ? 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'
    : 'input-base'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderB}`}>
          <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {item.id ? 'Editar Item' : 'Novo Item'}
          </h2>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Código *</label>
              <input value={item.codigo ?? ''} onChange={e => set('codigo', e.target.value)}
                className={inputCls} placeholder="EX-0001" />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Unidade *</label>
              <select value={item.unidade ?? 'UN'} onChange={e => set('unidade', e.target.value)}
                className={inputCls}>
                {UNIDADES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Descrição *</label>
            <input value={item.descricao ?? ''} onChange={e => set('descricao', e.target.value)}
              className={inputCls} placeholder="Nome completo do item" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Categoria</label>
              <input value={item.categoria ?? ''} onChange={e => set('categoria', e.target.value)}
                className={inputCls} placeholder="Ex: Elétrico, Civil..." />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Curva ABC</label>
              <select value={item.curva_abc ?? 'C'} onChange={e => set('curva_abc', e.target.value)}
                className={inputCls}>
                <option value="A">A — Alta rotatividade</option>
                <option value="B">B — Média rotatividade</option>
                <option value="C">C — Baixa rotatividade</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Estoque Mínimo</label>
              <input type="number" min={0} value={item.estoque_minimo ?? 0}
                onChange={e => set('estoque_minimo', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Estoque Máximo</label>
              <input type="number" min={0} value={item.estoque_maximo ?? 0}
                onChange={e => set('estoque_maximo', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Ponto Reposição</label>
              <input type="number" min={0} value={item.ponto_reposicao ?? 0}
                onChange={e => set('ponto_reposicao', Number(e.target.value))}
                className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Lead Time (dias)</label>
              <input type="number" min={0} value={item.lead_time_dias ?? 0}
                onChange={e => set('lead_time_dias', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Valor Médio (R$)</label>
              <input type="number" min={0} step={0.01} value={item.valor_medio || ''}
                onChange={e => set('valor_medio', Number(e.target.value))}
                className={inputCls} />
            </div>
          </div>

          <div className="flex gap-4">
            {([
              ['controle_estoque',    'Controle Estoque'],
              ['controle_patrimonio', 'Controle Patrimonial'],
              ['controla_lote',       'Controla Lote'],
              ['controla_serie',      'Controla N. Serie'],
              ['tem_validade',        'Controla Validade'],
            ] as [keyof EstItem, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                  checked={!!item[key]}
                  onChange={e => set(key, e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${borderB}`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-100'}`}>
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving || !item.codigo || !item.descricao}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
              text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
