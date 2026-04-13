import { useState, useMemo } from 'react'
import { Tag, Plus, Search, X, Save, Loader2, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Trash2 } from 'lucide-react'
import { UpperInput } from '../../components/UpperInput'
import { useCadClasses, useSalvarClasse, useCadCategorias } from '../../hooks/useCadastros'
import { supabase } from '../../services/supabase'
import type { ClasseFinanceira } from '../../types/cadastros'
import AutoCodeField from '../../components/AutoCodeField'
import SmartTextField from '../../components/SmartTextField'
import SearchableSelect from '../../components/SearchableSelect'
import type { SelectOption } from '../../components/SearchableSelect'

const EMPTY: Partial<ClasseFinanceira> = { codigo: '', descricao: '', tipo: 'ambos', categoria_id: undefined, ativo: true }
const TIPO_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  receita: { label: 'Receita', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  despesa: { label: 'Despesa', bg: 'bg-rose-100',    text: 'text-rose-700' },
  ambos:   { label: 'Ambos',   bg: 'bg-slate-100',   text: 'text-slate-600' },
}

export default function ClassesFinanceiras() {
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<ClasseFinanceira> | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [sortCol, setSortCol] = useState<string>('descricao')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: classes = [], isLoading } = useCadClasses()
  const { data: categorias = [] } = useCadCategorias()
  const salvar = useSalvarClasse()

  const filtrados = useMemo(() => {
    let list = classes
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(c => c.codigo.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      let av: any, bv: any
      if (sortCol === 'categoria') { av = a.categoria?.descricao ?? ''; bv = b.categoria?.descricao ?? '' }
      else { av = (a as any)[sortCol] ?? ''; bv = (b as any)[sortCol] ?? '' }
      const cmp = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [classes, busca, sortCol, sortDir])

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const SortIcon = ({ col }: { col: string }) =>
    sortCol === col ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const selectAll = () => {
    if (selected.size === filtrados.length) setSelected(new Set())
    else setSelected(new Set(filtrados.map(i => i.id)))
  }
  const handleBulkDelete = async () => {
    if (!confirm(`Excluir ${selected.size} item(s)?`)) return
    await supabase.from('fin_classes_financeiras').delete().in('id', [...selected])
    setSelected(new Set())
    window.location.reload()
  }

  function openNew() { setEditItem({ ...EMPTY }); setShowForm(true) }
  function openEdit(item: ClasseFinanceira) { setEditItem({ ...item }); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null) }

  async function handleSave() {
    if (!editItem) return
    if (!editItem.descricao?.trim()) { alert('Descricao e obrigatoria'); return }
    try {
      await salvar.mutateAsync(editItem)
      closeForm()
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar classe')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Classes Financeiras</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtrados.length} item(s)</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova Classe
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por codigo ou descricao..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          <button onClick={() => setViewMode('table')}
            className={`p-2 ${viewMode === 'table' ? 'bg-violet-600 text-white' : 'bg-white text-slate-400 hover:text-slate-600'}`}>
            <LayoutList size={16} />
          </button>
          <button onClick={() => setViewMode('card')}
            className={`p-2 ${viewMode === 'card' ? 'bg-violet-600 text-white' : 'bg-white text-slate-400 hover:text-slate-600'}`}>
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Tag size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhuma classe encontrada</p>
          <p className="text-slate-400 text-sm mt-1">Cadastre a primeira classe financeira</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === filtrados.length && filtrados.length > 0}
                    onChange={selectAll} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('codigo')}>
                  <span className="flex items-center gap-1">Codigo <SortIcon col="codigo" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('descricao')}>
                  <span className="flex items-center gap-1">Descricao <SortIcon col="descricao" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('categoria')}>
                  <span className="flex items-center gap-1">Categoria <SortIcon col="categoria" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('tipo')}>
                  <span className="flex items-center gap-1">Tipo <SortIcon col="tipo" /></span>
                </th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('ativo')}>
                  <span className="flex items-center justify-center gap-1">Status <SortIcon col="ativo" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(c => {
                const t = TIPO_LABEL[c.tipo] || TIPO_LABEL.ambos
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openEdit(c)}>
                    <td className="px-4 py-2.5" onClick={ev => ev.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{c.codigo}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{c.descricao}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">
                      {c.categoria ? `${c.categoria.codigo} — ${c.categoria.descricao}` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full text-[10px] font-bold px-2 py-0.5 ${t.bg} ${t.text}`}>
                        {t.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${c.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => {
            const t = TIPO_LABEL[c.tipo] || TIPO_LABEL.ambos
            return (
              <div key={c.id} onClick={() => openEdit(c)}
                className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md cursor-pointer group transition-all
                  ${c.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <div onClick={ev => ev.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Tag size={16} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{c.descricao}</p>
                      <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-mono text-[10px]">{c.codigo}</span>
                      <span className={`inline-flex items-center rounded-full text-[10px] font-bold px-2 py-0.5 ${t.bg} ${t.text}`}>{t.label}</span>
                      <span className={`inline-block w-2 h-2 rounded-full ${c.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    </div>
                    {c.categoria && <p className="text-[10px] text-slate-400 mt-0.5">{c.categoria.codigo} — {c.categoria.descricao}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-sm font-semibold">
          <span>{selected.size} selecionado(s)</span>
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-xl transition-colors">
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}

      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">
                {editItem.id ? 'Editar Classe' : 'Nova Classe'}
              </h2>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <AutoCodeField prefix="CLS" table="fin_classes_financeiras" value={editItem.codigo ?? ''}
                  onChange={v => setEditItem({ ...editItem, codigo: v })} disabled={!!editItem.id} />
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo *</label>
                  <select value={editItem.tipo ?? 'ambos'} onChange={e => setEditItem({ ...editItem, tipo: e.target.value as any })}
                    className="input-base">
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>
              </div>
              <SmartTextField table="fin_classes_financeiras" column="descricao"
                value={editItem.descricao ?? ''} onChange={v => setEditItem({ ...editItem, descricao: v })}
                label="Descricao" placeholder="Nome da classe financeira" required />
              <SearchableSelect
                options={(categorias ?? []).map(cat => ({ value: cat.id, label: cat.descricao, code: cat.codigo }))}
                value={editItem.categoria_id ?? ''}
                onChange={v => setEditItem({ ...editItem, categoria_id: v || undefined })}
                placeholder="Buscar categoria..."
                label="Categoria"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editItem.ativo ?? true}
                  onChange={e => setEditItem({ ...editItem, ativo: e.target.checked })}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                <span className="text-xs font-semibold text-slate-600">Ativo</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={closeForm}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={salvar.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
                {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
