import { useState } from 'react'
import {
  ClipboardList, Plus, CheckCircle2, Clock, X,
  Save, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  useInventarios, useInventario,
  useAbrirInventario, useSalvarContagem, useConcluirInventario,
  useBases,
} from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
import type { EstInventario, TipoInventario } from '../../types/estoque'

const STATUS_CONFIG = {
  aberto:       { label: 'Aberto',       bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  em_contagem:  { label: 'Em Contagem',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  concluido:    { label: 'Conclu\u00eddo',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelado:    { label: 'Cancelado',    bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
}

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function Inventario() {
  const { isLightSidebar: isLight } = useTheme()
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoInventario>('ciclico')
  const [baseId, setBaseId] = useState('')
  const [curvaFiltro, setCurvaFiltro] = useState('')
  const [responsavel, setResponsavel] = useState('')

  const { data: inventarios = [], isLoading } = useInventarios()
  const { data: bases = [] } = useBases()
  const abrirInventario = useAbrirInventario()
  const concluir = useConcluirInventario()

  async function handleAbrir() {
    await abrirInventario.mutateAsync({
      tipo,
      base_id: baseId || undefined,
      curva_filtro: curvaFiltro ? curvaFiltro as 'A' | 'B' | 'C' : undefined,
      responsavel,
    })
    setShowForm(false)
    setBaseId('')
    setCurvaFiltro('')
    setResponsavel('')
  }

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  const labelCls = isLight ? 'text-slate-600' : 'text-slate-300'

  return (
    <div className="space-y-4">

      {/* -- Header --------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{'Invent\u00e1rios'}</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{inventarios.length} {'invent\u00e1rios'}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Inventario
        </button>
      </div>

      {/* -- Lista --------------------------------------------------- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : inventarios.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <ClipboardList size={40} className={isLight ? 'text-slate-200' : 'text-slate-600'} />
          <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum inventario realizado</p>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Abra um novo inventario para comecar a contagem</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inventarios.map(inv => (
            <InventarioCard
              key={inv.id}
              inventario={inv}
              isExpanded={selectedId === inv.id}
              onToggle={() => setSelectedId(selectedId === inv.id ? null : inv.id)}
              onConcluir={() => concluir.mutateAsync({ inventario_id: inv.id, aprovado_por: '' })}
              concluding={concluir.isPending}
              isLight={isLight}
            />
          ))}
        </div>
      )}

      {/* -- Modal Novo Inventario ---------------------------------- */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isLight ? 'bg-white' : 'bg-[#111827]'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Novo Inventario</h2>
              <button onClick={() => setShowForm(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as TipoInventario)}
                  className={inputCls}>
                  <option value="ciclico">Ciclico -- itens selecionados</option>
                  <option value="periodico">Periodico -- base completa</option>
                  <option value="surpresa">Surpresa -- amostral</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Base (opcional)</label>
                <select value={baseId} onChange={e => setBaseId(e.target.value)}
                  className={inputCls}>
                  <option value="">Todas as bases</option>
                  {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Filtrar por Curva ABC</label>
                <select value={curvaFiltro} onChange={e => setCurvaFiltro(e.target.value)}
                  className={inputCls}>
                  <option value="">Todas as curvas</option>
                  <option value="A">Curva A</option>
                  <option value="B">Curva B</option>
                  <option value="C">Curva C</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Responsavel</label>
                <input value={responsavel} onChange={e => setResponsavel(e.target.value)}
                  className={inputCls} placeholder="Nome do responsavel..." />
              </div>
            </div>

            <div className={`px-6 py-4 border-t flex justify-end gap-2 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <button onClick={() => setShowForm(false)}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
                  ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
                Cancelar
              </button>
              <button onClick={handleAbrir} disabled={abrirInventario.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
                {abrirInventario.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ClipboardList size={14} />
                }
                Abrir Inventario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -- Inventario Card com contagem ------------------------------------------------
function InventarioCard({
  inventario, isExpanded, onToggle, onConcluir, concluding, isLight
}: {
  inventario: EstInventario
  isExpanded: boolean
  onToggle: () => void
  onConcluir: () => void
  concluding: boolean
  isLight: boolean
}) {
  const cfg = STATUS_CONFIG[inventario.status]
  const { data: detail } = useInventario(isExpanded ? inventario.id : undefined)
  const salvarContagem = useSalvarContagem()
  const [contagens, setContagens] = useState<Record<string, number>>({})

  const itens = detail?.itens ?? []
  const contados = itens.filter(i => i.saldo_contado != null).length

  async function handleSalvarContagem(itemId: string) {
    const valor = contagens[itemId]
    if (valor == null) return
    await salvarContagem.mutateAsync({ id: itemId, saldo_contado: valor })
  }

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
          <ClipboardList size={16} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{inventario.numero}</p>
            <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {inventario.tipo} - {inventario.base?.nome ?? 'Todas as bases'}
            {inventario.responsavel ? ` - ${inventario.responsavel}` : ''}
            {' - '}{fmtData(inventario.data_abertura)}
          </p>
        </div>
        {inventario.acuracia != null && (
          <div className="text-right shrink-0 mr-2">
            <p className={`text-sm font-extrabold ${inventario.acuracia >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {inventario.acuracia.toFixed(1)}%
            </p>
            <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Acuracia</p>
          </div>
        )}
        {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
      </div>

      {isExpanded && (
        <div className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          {inventario.status !== 'concluido' && inventario.status !== 'cancelado' && (
            <div className={`px-4 py-2 flex items-center justify-between ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {contados}/{itens.length} itens contados
              </p>
              <button
                onClick={onConcluir}
                disabled={concluding || contados === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700
                  text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {concluding ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Concluir
              </button>
            </div>
          )}

          <div className={`divide-y max-h-80 overflow-y-auto ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
            {itens.length === 0 ? (
              <p className={`text-center text-sm py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Carregando itens...</p>
            ) : itens.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                    {item.item?.descricao ?? '--'}
                  </p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Sistema: {item.saldo_sistema ?? '--'} {item.item?.unidade}
                    {item.divergencia !== 0 && (
                      <span className={`ml-2 font-semibold ${item.divergencia < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        ({item.divergencia > 0 ? '+' : ''}{item.divergencia})
                      </span>
                    )}
                  </p>
                </div>
                {inventario.status !== 'concluido' ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      placeholder={String(item.saldo_contado ?? '')}
                      value={contagens[item.id] ?? ''}
                      onChange={e => setContagens(p => ({ ...p, [item.id]: Number(e.target.value) }))}
                      className={`w-20 px-2 py-1 text-xs rounded-lg border text-center
                        focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                        ${isLight ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.04] text-slate-200'}`}
                    />
                    <button
                      onClick={() => handleSalvarContagem(item.id)}
                      disabled={salvarContagem.isPending || contagens[item.id] == null}
                      className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center
                        justify-center text-blue-600 transition-colors disabled:opacity-40"
                    >
                      <Save size={12} />
                    </button>
                  </div>
                ) : (
                  <p className={`text-xs font-semibold shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {item.saldo_contado ?? '--'} {item.item?.unidade}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
