import { useState } from 'react'
import {
  Package2, Plus, Search, AlertTriangle, ChevronDown,
  X, Save, Loader2,
} from 'lucide-react'
import { useEstoqueItens, useSalvarItem, useBases } from '../../hooks/useEstoque'
import type { EstItem } from '../../types/estoque'

const CURVA_COLOR = {
  A: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Curva A' },
  B: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Curva B' },
  C: { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Curva C' },
}

const UNIDADES = ['UN', 'M', 'M2', 'M3', 'KG', 'TON', 'L', 'CX', 'PCT', 'RL', 'PR', 'JG']

const EMPTY_FORM: Partial<EstItem> = {
  codigo: '', descricao: '', categoria: '', unidade: 'UN', curva_abc: 'C',
  estoque_minimo: 0, estoque_maximo: 0, ponto_reposicao: 0, lead_time_dias: 0,
  controla_lote: false, controla_serie: false, tem_validade: false,
  valor_medio: 0,
}

export default function Itens() {
  const [busca, setBusca] = useState('')
  const [curvaFiltro, setCurvaFiltro] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<EstItem> | null>(null)

  const { data: itens = [], isLoading } = useEstoqueItens(
    curvaFiltro ? { curva_abc: curvaFiltro as 'A' | 'B' | 'C' } : undefined
  )
  const salvar = useSalvarItem()

  const filtrados = busca.trim()
    ? itens.filter(i =>
        i.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        i.codigo.toLowerCase().includes(busca.toLowerCase())
      )
    : itens

  function openNew() {
    setEditItem({ ...EMPTY_FORM })
    setShowForm(true)
  }

  function openEdit(item: EstItem) {
    setEditItem({ ...item })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditItem(null)
  }

  async function handleSave() {
    if (!editItem) return
    await salvar.mutateAsync(editItem)
    closeForm()
  }

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Catálogo de Itens</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtrados.length} itens encontrados</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Item
        </button>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por código ou descrição..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        {(['', 'A', 'B', 'C'] as const).map(c => (
          <button
            key={c}
            onClick={() => setCurvaFiltro(c)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              curvaFiltro === c
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {c === '' ? 'Todos' : `Curva ${c}`}
          </button>
        ))}
      </div>

      {/* ── Lista ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Package2 size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhum item encontrado</p>
          <p className="text-slate-400 text-sm mt-1">Cadastre o primeiro item do catálogo</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Código</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Descrição</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Curva</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:table-cell">Mín / Máx</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:table-cell">P. Reposição</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valor Médio</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(item => {
                const curva = CURVA_COLOR[item.curva_abc]
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 truncate max-w-[200px]">{item.descricao}</p>
                      {item.categoria && (
                        <p className="text-[10px] text-slate-400">{item.categoria}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-2 py-0.5 ${curva.bg} ${curva.text}`}>
                        {curva.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className="text-xs text-slate-600">
                        {item.estoque_minimo} / {item.estoque_maximo} {item.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className="text-xs text-slate-600">
                        {item.ponto_reposicao} {item.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-slate-700">
                        {(item.valor_medio ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(item)}
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
      )}

      {/* ── Modal Cadastro/Edição ──────────────────────────────── */}
      {showForm && editItem && (
        <ItemFormModal
          item={editItem}
          onChange={setEditItem}
          onSave={handleSave}
          onClose={closeForm}
          saving={salvar.isPending}
        />
      )}
    </div>
  )
}

// ── Item Form Modal ───────────────────────────────────────────────────────────
function ItemFormModal({
  item, onChange, onSave, onClose, saving
}: {
  item: Partial<EstItem>
  onChange: (v: Partial<EstItem>) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  const set = (k: keyof EstItem, v: any) => onChange({ ...item, [k]: v })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-extrabold text-slate-800">
            {item.id ? 'Editar Item' : 'Novo Item'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Código *</label>
              <input value={item.codigo ?? ''} onChange={e => set('codigo', e.target.value)}
                className="input-base" placeholder="EX-0001" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Unidade *</label>
              <select value={item.unidade ?? 'UN'} onChange={e => set('unidade', e.target.value)}
                className="input-base">
                {UNIDADES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Descrição *</label>
            <input value={item.descricao ?? ''} onChange={e => set('descricao', e.target.value)}
              className="input-base" placeholder="Nome completo do item" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Categoria</label>
              <input value={item.categoria ?? ''} onChange={e => set('categoria', e.target.value)}
                className="input-base" placeholder="Ex: Elétrico, Civil..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Curva ABC</label>
              <select value={item.curva_abc ?? 'C'} onChange={e => set('curva_abc', e.target.value)}
                className="input-base">
                <option value="A">A — Alta rotatividade</option>
                <option value="B">B — Média rotatividade</option>
                <option value="C">C — Baixa rotatividade</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Estoque Mínimo</label>
              <input type="number" min={0} value={item.estoque_minimo ?? 0}
                onChange={e => set('estoque_minimo', Number(e.target.value))}
                className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Estoque Máximo</label>
              <input type="number" min={0} value={item.estoque_maximo ?? 0}
                onChange={e => set('estoque_maximo', Number(e.target.value))}
                className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Ponto Reposição</label>
              <input type="number" min={0} value={item.ponto_reposicao ?? 0}
                onChange={e => set('ponto_reposicao', Number(e.target.value))}
                className="input-base" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Lead Time (dias)</label>
              <input type="number" min={0} value={item.lead_time_dias ?? 0}
                onChange={e => set('lead_time_dias', Number(e.target.value))}
                className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Valor Médio (R$)</label>
              <input type="number" min={0} step={0.01} value={item.valor_medio ?? 0}
                onChange={e => set('valor_medio', Number(e.target.value))}
                className="input-base" />
            </div>
          </div>

          <div className="flex gap-4">
            {([
              ['controla_lote',   'Controla Lote'],
              ['controla_serie',  'Controla N° Série'],
              ['tem_validade',    'Controla Validade'],
            ] as [keyof EstItem, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                  checked={!!item[key]}
                  onChange={e => set(key, e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-600">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-colors">
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
