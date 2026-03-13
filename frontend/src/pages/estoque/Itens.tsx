import { useState, useMemo } from 'react'
import {
  Package2, Plus, Search, AlertTriangle, ArrowUpDown, LayoutList, LayoutGrid,
  X, Save, Loader2, Download, Truck, PackageCheck, RefreshCw, ClipboardCheck,
} from 'lucide-react'
import {
  useEstoqueItens, useSalvarItem, useSaldos,
  useAguardandoEntrada, useEmMovimentacao, useLiberadosRetirada,
} from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
import type {
  EstItem, EstSaldo, EstSolicitacao, EstoqueEntradaItem, EstoqueMovimentacaoItem,
  EstoquePipelineTab, ESTOQUE_PIPELINE_STAGES,
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
  devolucao: 'Devolução', baixa: 'Baixa',
}

const UNIDADES = ['UN', 'M', 'M2', 'M3', 'KG', 'TON', 'L', 'CX', 'PCT', 'RL', 'PR', 'JG']

const EMPTY_FORM: Partial<EstItem> = {
  codigo: '', descricao: '', categoria: '', unidade: 'UN', curva_abc: 'C',
  estoque_minimo: 0, estoque_maximo: 0, ponto_reposicao: 0, lead_time_dias: 0,
  controla_lote: false, controla_serie: false, tem_validade: false, valor_medio: 0,
}

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
  const { isLightSidebar: isLight } = useTheme()
  const [activeTab, setActiveTab] = useState<EstoquePipelineTab>('em_estoque')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [busca, setBusca] = useState('')
  const [curvaFiltro, setCurvaFiltro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<EstItem> | null>(null)

  // Data
  const { data: saldos = [], isLoading: loadingSaldos } = useSaldos()
  const { data: entradas = [], isLoading: loadingEntradas } = useAguardandoEntrada()
  const { data: liberados = [], isLoading: loadingLiberados } = useLiberadosRetirada()
  const { data: movs = [], isLoading: loadingMovs } = useEmMovimentacao()
  const salvar = useSalvarItem()

  const accent = isLight ? STATUS_ACCENT : STATUS_ACCENT_DARK

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

  const card = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Estoque
          </h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Visão geral do estoque por item
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
      <div className={`flex gap-1 p-1 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
        {STAGES.map(stage => {
          const active = activeTab === stage.tab
          const a = accent[stage.tab]
          return (
            <button
              key={stage.tab}
              onClick={() => setActiveTab(stage.tab)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${active
                  ? `${a.bg} ${a.text} ${a.border} border shadow-sm`
                  : isLight
                    ? 'text-slate-500 hover:bg-white hover:shadow-sm border border-transparent'
                    : 'text-slate-400 hover:bg-white/[0.04] border border-transparent'
                }`}
            >
              {stage.tab === 'aguardando_entrada' && <PackageCheck size={15} />}
              {stage.tab === 'em_estoque' && <Package2 size={15} />}
              {stage.tab === 'liberado_retirada' && <ClipboardCheck size={15} />}
              {stage.tab === 'em_movimentacao' && <Truck size={15} />}
              {stage.label}
              <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${active ? a.badge : isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-500'}`}>
                {counts[stage.tab]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por código ou descrição..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
              ${isLight ? 'border-slate-200 bg-white text-slate-800' : 'border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-500'}`}
          />
        </div>

        {activeTab === 'em_estoque' && (
          <div className="flex gap-1">
            {(['', 'A', 'B', 'C'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCurvaFiltro(c)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  curvaFiltro === c
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : isLight
                      ? 'bg-white text-slate-500 border-slate-200'
                      : 'bg-white/[0.03] text-slate-400 border-white/[0.08]'
                }`}
              >
                {c === '' ? 'Todos' : `Curva ${c}`}
              </button>
            ))}
          </div>
        )}

        <div className={`flex gap-0.5 p-0.5 rounded-lg border ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.06] bg-white/[0.02]'}`}>
          <button onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'table'
              ? (isLight ? 'bg-white shadow-sm text-slate-700' : 'bg-white/[0.08] text-slate-200')
              : (isLight ? 'text-slate-400' : 'text-slate-500')}`}>
            <LayoutList size={14} />
          </button>
          <button onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'cards'
              ? (isLight ? 'bg-white shadow-sm text-slate-700' : 'bg-white/[0.08] text-slate-200')
              : (isLight ? 'text-slate-400' : 'text-slate-500')}`}>
            <LayoutGrid size={14} />
          </button>
        </div>

        <button onClick={exportCSV}
          className={`p-2 rounded-xl border transition-colors ${isLight ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
          <Download size={14} />
        </button>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'em_estoque' && (
            viewMode === 'table'
              ? <SaldosTable data={saldosFiltrados} isLight={isLight} onEdit={openEdit} />
              : <SaldosCards data={saldosFiltrados} isLight={isLight} />
          )}
          {activeTab === 'aguardando_entrada' && (
            viewMode === 'table'
              ? <EntradasTable data={entradasFiltradas} isLight={isLight} />
              : <EntradasCards data={entradasFiltradas} isLight={isLight} />
          )}
          {activeTab === 'liberado_retirada' && (
            viewMode === 'table'
              ? <LiberadosTable data={liberadosFiltrados} isLight={isLight} />
              : <LiberadosCards data={liberadosFiltrados} isLight={isLight} />
          )}
          {activeTab === 'em_movimentacao' && (
            viewMode === 'table'
              ? <MovsTable data={movsFiltradas} isLight={isLight} />
              : <MovsCards data={movsFiltradas} isLight={isLight} />
          )}
        </>
      )}

      {/* ── Item Form Modal ────────────────────────────────────────── */}
      {showForm && editItem && (
        <ItemFormModal
          item={editItem}
          onChange={setEditItem}
          onSave={handleSave}
          onClose={closeForm}
          saving={salvar.isPending}
          isLight={isLight}
        />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Em Estoque — Table & Cards
// ═════════════════════════════════════════════════════════════════════════════

function SaldosTable({ data, isLight, onEdit }: { data: EstSaldo[]; isLight: boolean; onEdit: (item: EstItem) => void }) {
  if (data.length === 0) return <EmptyState icon={Package2} msg="Nenhum item em estoque" isLight={isLight} />
  const card = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  const thCls = `text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/[0.04] bg-white/[0.02]'}`}>
            <th className={thCls}>Código</th>
            <th className={thCls}>Descrição</th>
            <th className={`${thCls} hidden md:table-cell`}>Base</th>
            <th className={`${thCls} hidden md:table-cell`}>Curva</th>
            <th className={`${thCls} text-right`}>Saldo</th>
            <th className={`${thCls} text-right hidden lg:table-cell`}>Reservado</th>
            <th className={`${thCls} text-right hidden lg:table-cell`}>Disponível</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
          {data.map(s => {
            const abaixo = s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)
            const curva = CURVA_COLOR[s.item?.curva_abc ?? 'C']
            const disponivel = s.saldo - (s.saldo_reservado ?? 0)
            return (
              <tr key={s.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
                <td className={`px-4 py-3 font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {s.item?.codigo ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <p className={`font-semibold truncate max-w-[220px] ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    {s.item?.descricao ?? '—'}
                  </p>
                  {abaixo && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold mt-0.5">
                      <AlertTriangle size={10} /> Abaixo do mínimo
                    </span>
                  )}
                </td>
                <td className={`px-4 py-3 hidden md:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {s.base?.nome ?? '—'}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {s.item?.curva_abc && (
                    <span className={`inline-flex rounded-full text-[10px] font-bold px-2 py-0.5
                      ${isLight ? `${curva.bg} ${curva.text}` : `${curva.darkBg} ${curva.darkText}`}`}>
                      {s.item.curva_abc}
                    </span>
                  )}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                  {s.saldo} {s.item?.unidade}
                </td>
                <td className={`px-4 py-3 text-right hidden lg:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {s.saldo_reservado ?? 0}
                </td>
                <td className={`px-4 py-3 text-right hidden lg:table-cell font-semibold ${
                  disponivel <= 0 ? 'text-red-500' : isLight ? 'text-emerald-600' : 'text-emerald-400'
                }`}>
                  {disponivel} {s.item?.unidade}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => s.item && onEdit(s.item as EstItem)}
                    className="text-[10px] text-blue-600 font-semibold hover:underline"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SaldosCards({ data, isLight }: { data: EstSaldo[]; isLight: boolean }) {
  if (data.length === 0) return <EmptyState icon={Package2} msg="Nenhum item em estoque" isLight={isLight} />
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {data.map(s => {
        const abaixo = s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)
        const curva = CURVA_COLOR[s.item?.curva_abc ?? 'C']
        const disponivel = s.saldo - (s.saldo_reservado ?? 0)
        return (
          <div key={s.id} className={`rounded-2xl border p-4 transition-all hover:shadow-md
            ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className={`font-mono text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{s.item?.codigo}</p>
                <p className={`font-semibold text-sm truncate mt-0.5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {s.item?.descricao}
                </p>
              </div>
              {s.item?.curva_abc && (
                <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 shrink-0
                  ${isLight ? `${curva.bg} ${curva.text}` : `${curva.darkBg} ${curva.darkText}`}`}>
                  Curva {s.item.curva_abc}
                </span>
              )}
            </div>
            <div className={`border-t my-3 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`} />
            <div className="flex items-center justify-between text-xs">
              <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>{s.base?.nome ?? '—'}</span>
              <span className={`font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                {s.saldo} {s.item?.unidade}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>
                Min: {s.item?.estoque_minimo} · Repos: {s.item?.ponto_reposicao}
              </span>
              <span className={disponivel <= 0 ? 'text-red-500 font-bold' : isLight ? 'text-emerald-600' : 'text-emerald-400'}>
                Disp: {disponivel}
              </span>
            </div>
            {abaixo && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-600 font-semibold">
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
// Aguardando Entrada — Table & Cards
// ═════════════════════════════════════════════════════════════════════════════

function EntradasTable({ data, isLight }: { data: EstoqueEntradaItem[]; isLight: boolean }) {
  if (data.length === 0) return <EmptyState icon={PackageCheck} msg="Nenhuma entrada pendente" isLight={isLight} />
  const card = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  const thCls = `text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/[0.04] bg-white/[0.02]'}`}>
            <th className={thCls}>Código</th>
            <th className={thCls}>Descrição</th>
            <th className={`${thCls} text-right`}>Quantidade</th>
            <th className={`${thCls} hidden md:table-cell`}>Tipo</th>
            <th className={`${thCls} hidden md:table-cell`}>Fornecedor / Origem</th>
            <th className={`${thCls} hidden lg:table-cell`}>NF</th>
            <th className={`${thCls} text-right`}>Data</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
          {data.map(e => (
            <tr key={e.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
              <td className={`px-4 py-3 font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{e.codigo}</td>
              <td className="px-4 py-3">
                <p className={`font-semibold truncate max-w-[200px] ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{e.descricao}</p>
              </td>
              <td className={`px-4 py-3 text-right font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                {e.quantidade} {e.unidade}
              </td>
              <td className={`px-4 py-3 hidden md:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {TIPO_LABEL[e.tipo] ?? e.tipo}
              </td>
              <td className={`px-4 py-3 hidden md:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {e.fornecedor_nome || e.base_nome || '—'}
              </td>
              <td className={`px-4 py-3 hidden lg:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {e.nf_numero || '—'}
              </td>
              <td className={`px-4 py-3 text-right text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {fmtDate(e.criado_em)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EntradasCards({ data, isLight }: { data: EstoqueEntradaItem[]; isLight: boolean }) {
  if (data.length === 0) return <EmptyState icon={PackageCheck} msg="Nenhuma entrada pendente" isLight={isLight} />
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {data.map(e => (
        <div key={e.id} className={`rounded-2xl border p-4 transition-all hover:shadow-md
          ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className={`font-mono text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{e.codigo}</p>
              <p className={`font-semibold text-sm truncate mt-0.5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                {e.descricao}
              </p>
            </div>
            <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 shrink-0
              ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/20 text-slate-400'}`}>
              {TIPO_LABEL[e.tipo] ?? e.tipo}
            </span>
          </div>
          <div className={`border-t my-3 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`} />
          <div className="flex items-center justify-between text-xs">
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
              Qtd: {e.quantidade} {e.unidade}
            </span>
            {e.nf_numero && (
              <span className={`font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>NF {e.nf_numero}</span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>
              {e.fornecedor_nome || e.base_nome || '—'}
            </span>
            <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>{fmtDate(e.criado_em)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Liberado para Retirada — Table & Cards
// ═════════════════════════════════════════════════════════════════════════════

const URGENCIA_BADGE: Record<string, { light: string; dark: string }> = {
  normal:  { light: 'bg-slate-100 text-slate-600',  dark: 'bg-slate-500/20 text-slate-400'  },
  urgente: { light: 'bg-amber-100 text-amber-700',  dark: 'bg-amber-500/20 text-amber-400'  },
  critica: { light: 'bg-red-100 text-red-700',      dark: 'bg-red-500/20 text-red-400'      },
}

function LiberadosTable({ data, isLight }: { data: EstSolicitacao[]; isLight: boolean }) {
  if (data.length === 0) return <EmptyState icon={ClipboardCheck} msg="Nenhuma solicitação liberada" isLight={isLight} />
  const card = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  const thCls = `text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/[0.04] bg-white/[0.02]'}`}>
            <th className={thCls}>Número</th>
            <th className={thCls}>Solicitante</th>
            <th className={`${thCls} hidden md:table-cell`}>Obra</th>
            <th className={`${thCls} hidden md:table-cell`}>Urgência</th>
            <th className={`${thCls} hidden lg:table-cell`}>Status</th>
            <th className={`${thCls} text-right`}>Itens</th>
            <th className={`${thCls} text-right`}>Data</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
          {data.map(s => {
            const urg = URGENCIA_BADGE[s.urgencia] ?? URGENCIA_BADGE.normal
            return (
              <tr key={s.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
                <td className={`px-4 py-3 font-mono text-xs font-semibold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                  {s.numero}
                </td>
                <td className="px-4 py-3">
                  <p className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{s.solicitante_nome}</p>
                </td>
                <td className={`px-4 py-3 hidden md:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {s.obra_nome}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`inline-flex rounded-full text-[10px] font-bold px-2 py-0.5 capitalize
                    ${isLight ? urg.light : urg.dark}`}>
                    {s.urgencia}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`inline-flex rounded-full text-[10px] font-bold px-2 py-0.5
                    ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>
                    {s.status === 'aprovada' ? 'Aprovada' : 'Em Separação'}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                  {s.itens?.length ?? 0}
                </td>
                <td className={`px-4 py-3 text-right text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {fmtDate(s.criado_em)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LiberadosCards({ data, isLight }: { data: EstSolicitacao[]; isLight: boolean }) {
  if (data.length === 0) return <EmptyState icon={ClipboardCheck} msg="Nenhuma solicitação liberada" isLight={isLight} />
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {data.map(s => {
        const urg = URGENCIA_BADGE[s.urgencia] ?? URGENCIA_BADGE.normal
        return (
          <div key={s.id} className={`rounded-2xl border p-4 transition-all hover:shadow-md
            ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className={`font-mono text-[10px] font-semibold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{s.numero}</p>
                <p className={`font-semibold text-sm mt-0.5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {s.solicitante_nome}
                </p>
              </div>
              <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 capitalize shrink-0
                ${isLight ? urg.light : urg.dark}`}>
                {s.urgencia}
              </span>
            </div>
            <div className={`border-t my-3 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`} />
            <div className="flex items-center justify-between text-xs">
              <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>{s.obra_nome}</span>
              <span className={`font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                {s.itens?.length ?? 0} itens
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className={`rounded-full font-bold px-2 py-0.5
                ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>
                {s.status === 'aprovada' ? 'Aprovada' : 'Em Separação'}
              </span>
              <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>{fmtDate(s.criado_em)}</span>
            </div>
            {s.itens && s.itens.length > 0 && (
              <div className={`mt-3 pt-2 border-t space-y-1 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                {s.itens.slice(0, 3).map(it => (
                  <div key={it.id} className={`flex items-center justify-between text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span className="truncate max-w-[180px]">{it.item?.descricao ?? it.descricao_livre ?? '—'}</span>
                    <span className="font-semibold">{it.quantidade} {it.item?.unidade ?? it.unidade ?? 'UN'}</span>
                  </div>
                ))}
                {s.itens.length > 3 && (
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
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
// Em Movimentação — Table & Cards
// ═════════════════════════════════════════════════════════════════════════════

function MovsTable({ data, isLight }: { data: EstoqueMovimentacaoItem[]; isLight: boolean }) {
  if (data.length === 0) return <EmptyState icon={Truck} msg="Nenhuma movimentação ativa" isLight={isLight} />
  const card = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  const thCls = `text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/[0.04] bg-white/[0.02]'}`}>
            <th className={thCls}>Código</th>
            <th className={thCls}>Descrição</th>
            <th className={`${thCls} text-right`}>Quantidade</th>
            <th className={`${thCls} hidden md:table-cell`}>Tipo</th>
            <th className={`${thCls} hidden md:table-cell`}>Origem → Destino</th>
            <th className={`${thCls} hidden lg:table-cell`}>Responsável</th>
            <th className={`${thCls} text-right`}>Data</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
          {data.map(m => (
            <tr key={m.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
              <td className={`px-4 py-3 font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{m.codigo}</td>
              <td className="px-4 py-3">
                <p className={`font-semibold truncate max-w-[200px] ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{m.descricao}</p>
                {m.obra_nome && <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{m.obra_nome}</p>}
              </td>
              <td className={`px-4 py-3 text-right font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                {m.quantidade} {m.unidade}
              </td>
              <td className={`px-4 py-3 hidden md:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {TIPO_LABEL[m.tipo] ?? m.tipo}
              </td>
              <td className={`px-4 py-3 hidden md:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {m.base_nome ?? '—'}{m.base_destino_nome ? ` → ${m.base_destino_nome}` : ''}
              </td>
              <td className={`px-4 py-3 hidden lg:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {m.responsavel_nome || '—'}
              </td>
              <td className={`px-4 py-3 text-right text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {fmtDate(m.criado_em)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MovsCards({ data, isLight }: { data: EstoqueMovimentacaoItem[]; isLight: boolean }) {
  if (data.length === 0) return <EmptyState icon={Truck} msg="Nenhuma movimentação ativa" isLight={isLight} />
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {data.map(m => (
        <div key={m.id} className={`rounded-2xl border p-4 transition-all hover:shadow-md
          ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className={`font-mono text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{m.codigo}</p>
              <p className={`font-semibold text-sm truncate mt-0.5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                {m.descricao}
              </p>
            </div>
            <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 shrink-0
              ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'}`}>
              {TIPO_LABEL[m.tipo] ?? m.tipo}
            </span>
          </div>
          <div className={`border-t my-3 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`} />
          <div className="flex items-center justify-between text-xs">
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
              Qtd: {m.quantidade} {m.unidade}
            </span>
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
              {m.base_nome ?? ''}{m.base_destino_nome ? ` → ${m.base_destino_nome}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>
              {m.responsavel_nome || m.obra_nome || '—'}
            </span>
            <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>{fmtDate(m.criado_em)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state helper ───────────────────────────────────────────────────────
function EmptyState({ icon: Icon, msg, isLight }: { icon: any; msg: string; isLight: boolean }) {
  return (
    <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
      <Icon size={40} className={`mx-auto ${isLight ? 'text-slate-200' : 'text-slate-600'}`} />
      <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{msg}</p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Item Form Modal (preserved from original)
// ═════════════════════════════════════════════════════════════════════════════

function ItemFormModal({
  item, onChange, onSave, onClose, saving, isLight
}: {
  item: Partial<EstItem>
  onChange: (v: Partial<EstItem>) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  isLight: boolean
}) {
  const set = (k: keyof EstItem, v: any) => onChange({ ...item, [k]: v })

  const modalBg = isLight ? 'bg-white' : 'bg-[#111827]'
  const borderB = isLight ? 'border-slate-100' : 'border-white/[0.06]'
  const labelCls = isLight ? 'text-slate-600' : 'text-slate-300'
  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderB}`}>
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            {item.id ? 'Editar Item' : 'Novo Item'}
          </h2>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
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
              <input type="number" min={0} step={0.01} value={item.valor_medio ?? 0}
                onChange={e => set('valor_medio', Number(e.target.value))}
                className={inputCls} />
            </div>
          </div>

          <div className="flex gap-4">
            {([
              ['controla_lote',   'Controla Lote'],
              ['controla_serie',  'Controla N. Série'],
              ['tem_validade',    'Controla Validade'],
            ] as [keyof EstItem, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                  checked={!!item[key]}
                  onChange={e => set(key, e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-xs font-semibold ${labelCls}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex justify-end gap-2 ${borderB}`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
              ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
