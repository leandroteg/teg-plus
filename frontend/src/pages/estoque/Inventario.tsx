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
import type { EstInventario, TipoInventario } from '../../types/estoque'

const STATUS_CONFIG = {
  aberto:       { label: 'Aberto',       bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  em_contagem:  { label: 'Em Contagem',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  concluido:    { label: 'Concluído',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelado:    { label: 'Cancelado',    bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
}

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function Inventario() {
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoInventario>('ciclico')
  const [baseId, setBaseId] = useState('')
  const [responsavel, setResponsavel] = useState('')

  const { data: inventarios = [], isLoading } = useInventarios()
  const { data: bases = [] } = useBases()
  const abrirInventario = useAbrirInventario()
  const concluir = useConcluirInventario()

  async function handleAbrir() {
    await abrirInventario.mutateAsync({ tipo, base_id: baseId || undefined, responsavel: responsavel || undefined })
    setShowForm(false)
    setBaseId('')
    setResponsavel('')
  }

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Inventários</h1>
          <p className="text-xs text-slate-400 mt-0.5">{inventarios.length} inventários</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Inventário
        </button>
      </div>

      {/* ── Lista ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : inventarios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ClipboardList size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhum inventário realizado</p>
          <p className="text-slate-400 text-sm mt-1">Abra um novo inventário para começar a contagem</p>
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
            />
          ))}
        </div>
      )}

      {/* ── Modal Novo Inventário ──────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Novo Inventário</h2>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as TipoInventario)}
                  className="input-base">
                  <option value="ciclico">Cíclico — itens selecionados</option>
                  <option value="periodico">Periódico — base completa</option>
                  <option value="surpresa">Surpresa — amostral</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Base (opcional)</label>
                <select value={baseId} onChange={e => setBaseId(e.target.value)}
                  className="input-base">
                  <option value="">Todas as bases</option>
                  {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Responsável</label>
                <input value={responsavel} onChange={e => setResponsavel(e.target.value)}
                  className="input-base" placeholder="Nome do responsável..." />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold
                  text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleAbrir} disabled={abrirInventario.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
                {abrirInventario.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ClipboardList size={14} />
                }
                Abrir Inventário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inventário Card com contagem ──────────────────────────────────────────────
function InventarioCard({
  inventario, isExpanded, onToggle, onConcluir, concluding
}: {
  inventario: EstInventario
  isExpanded: boolean
  onToggle: () => void
  onConcluir: () => void
  concluding: boolean
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
          <ClipboardList size={16} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold text-slate-800">{inventario.numero}</p>
            <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {inventario.tipo} · {inventario.base?.nome ?? 'Todas as bases'}
            {inventario.responsavel ? ` · ${inventario.responsavel}` : ''}
            {' · '}{fmtData(inventario.data_abertura)}
          </p>
        </div>
        {inventario.acuracia != null && (
          <div className="text-right shrink-0 mr-2">
            <p className={`text-sm font-extrabold ${inventario.acuracia >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {inventario.acuracia.toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400">Acurácia</p>
          </div>
        )}
        {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100">
          {inventario.status !== 'concluido' && inventario.status !== 'cancelado' && (
            <div className="px-4 py-2 bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-slate-500">
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

          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {itens.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">Carregando itens...</p>
            ) : itens.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {item.item?.descricao ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Sistema: {item.saldo_sistema ?? '—'} {item.item?.unidade}
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
                      className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-200 text-center
                        focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
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
                  <p className="text-xs font-semibold text-slate-600 shrink-0">
                    {item.saldo_contado ?? '—'} {item.item?.unidade}
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
