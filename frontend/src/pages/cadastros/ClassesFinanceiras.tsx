import { useState } from 'react'
import { Tag, Plus, Search, X, Save, Loader2 } from 'lucide-react'
import { UpperInput } from '../../components/UpperInput'
import { useCadClasses, useSalvarClasse, useCadCategorias } from '../../hooks/useCadastros'
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

  const { data: classes = [], isLoading } = useCadClasses()
  const { data: categorias = [] } = useCadCategorias()
  const salvar = useSalvarClasse()

  const filtrados = busca.trim()
    ? classes.filter(c =>
        c.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        c.descricao.toLowerCase().includes(busca.toLowerCase())
      )
    : classes

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
          <p className="text-xs text-slate-400 mt-0.5">{filtrados.length} classes</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova Classe
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por codigo ou descricao..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
            focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
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
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Codigo</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Descricao</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tipo</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(c => {
                const t = TIPO_LABEL[c.tipo] || TIPO_LABEL.ambos
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.codigo}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{c.descricao}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                      {c.categoria ? `${c.categoria.codigo} — ${c.categoria.descricao}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full text-[10px] font-bold px-2 py-0.5 ${t.bg} ${t.text}`}>
                        {t.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${c.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(c)}
                        className="text-[10px] text-violet-600 font-semibold hover:underline">Editar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
