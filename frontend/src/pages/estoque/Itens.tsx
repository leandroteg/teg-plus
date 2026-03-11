import { useState } from 'react'
import {
  Package2, Plus, Search, AlertTriangle, ChevronDown,
  X, Save, Loader2,
} from 'lucide-react'
import { useEstoqueItens, useSalvarItem, useBases } from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
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
  const { isLightSidebar: isLight } = useTheme()
  const [busca, setBusca] = useState('')
  const [curvaFiltro, setCurvaFiltro] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<EstItem> | null>(null)

  const { data: itens = [], isLoading } = useEstoqueItens(
    curvaFiltro ? { curva: curvaFiltro as 'A' | 'B' | 'C' } : undefined
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

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  return (
    <div className="space-y-4">

      {/* -- Header --------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Catalogo de Itens</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{filtrados.length} itens encontrados</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Item
        </button>
      </div>

      {/* -- Filtros ------------------------------------------------- */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por codigo ou descricao..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
              ${isLight ? 'border-slate-200 bg-white text-slate-800' : 'border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-500'}`}
          />
        </div>
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

      {/* -- Lista --------------------------------------------------- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <Package2 size={40} className={isLight ? 'text-slate-200' : 'text-slate-600'} />
          <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum item encontrado</p>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Cadastre o primeiro item do catalogo</p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${card}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/[0.04] bg-white/[0.02]'}`}>
                <th className={`text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Codigo</th>
                <th className={`text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Descricao</th>
                <th className={`text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest hidden md:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Curva</th>
                <th className={`text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest hidden lg:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Min / Max</th>
                <th className={`text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest hidden lg:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>P. Reposicao</th>
                <th className={`text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Valor Medio</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
              {filtrados.map(item => {
                const curva = CURVA_COLOR[item.curva_abc]
                return (
                  <tr key={item.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
                    <td className={`px-4 py-3 font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{item.codigo}</td>
                    <td className="px-4 py-3">
                      <p className={`font-semibold truncate max-w-[200px] ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{item.descricao}</p>
                      {item.categoria && (
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{item.categoria}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-2 py-0.5 ${curva.bg} ${curva.text}`}>
                        {curva.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        {item.estoque_minimo} / {item.estoque_maximo} {item.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        {item.ponto_reposicao} {item.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
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

      {/* -- Modal Cadastro/Edicao ---------------------------------- */}
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

// -- Item Form Modal ---------------------------------------------------------------
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
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Codigo *</label>
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
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Descricao *</label>
            <input value={item.descricao ?? ''} onChange={e => set('descricao', e.target.value)}
              className={inputCls} placeholder="Nome completo do item" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Categoria</label>
              <input value={item.categoria ?? ''} onChange={e => set('categoria', e.target.value)}
                className={inputCls} placeholder="Ex: Eletrico, Civil..." />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Curva ABC</label>
              <select value={item.curva_abc ?? 'C'} onChange={e => set('curva_abc', e.target.value)}
                className={inputCls}>
                <option value="A">A -- Alta rotatividade</option>
                <option value="B">B -- Media rotatividade</option>
                <option value="C">C -- Baixa rotatividade</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Estoque Minimo</label>
              <input type="number" min={0} value={item.estoque_minimo ?? 0}
                onChange={e => set('estoque_minimo', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Estoque Maximo</label>
              <input type="number" min={0} value={item.estoque_maximo ?? 0}
                onChange={e => set('estoque_maximo', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Ponto Reposicao</label>
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
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Valor Medio (R$)</label>
              <input type="number" min={0} step={0.01} value={item.valor_medio ?? 0}
                onChange={e => set('valor_medio', Number(e.target.value))}
                className={inputCls} />
            </div>
          </div>

          <div className="flex gap-4">
            {([
              ['controla_lote',   'Controla Lote'],
              ['controla_serie',  'Controla N. Serie'],
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
