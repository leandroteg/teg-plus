import { useState } from 'react'
import { Warehouse, Plus, Search, X, Save, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import type { EstBase } from '../../types/estoque'

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

const EMPTY: Partial<EstBase> = {
  codigo: '', nome: '', endereco: '', cidade: '', uf: '', cep: '',
  cnpj: '', telefone: '', email: '', ativa: true,
}

function useAllBases() {
  return useQuery<EstBase[]>({
    queryKey: ['est-bases-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_bases')
        .select('*')
        .order('nome')
      if (error) return []
      return (data ?? []) as EstBase[]
    },
  })
}

function useSalvarBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<EstBase> & { id?: string }) => {
      const { id, criado_em, ...rest } = payload as any
      if (id) {
        const { error } = await supabase.from('est_bases').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('est_bases').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-bases-all'] })
      qc.invalidateQueries({ queryKey: ['est-bases'] })
    },
  })
}

export default function Bases() {
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<EstBase> | null>(null)

  const { data: bases = [], isLoading } = useAllBases()
  const salvar = useSalvarBase()

  const filtrados = busca.trim()
    ? bases.filter(b =>
        b.nome.toLowerCase().includes(busca.toLowerCase()) ||
        b.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        (b.cnpj ?? '').includes(busca) ||
        (b.cidade ?? '').toLowerCase().includes(busca.toLowerCase())
      )
    : bases

  function openNew() { setEditItem({ ...EMPTY }); setShowForm(true) }
  function openEdit(item: EstBase) { setEditItem({ ...item }); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null) }

  async function handleSave() {
    if (!editItem) return
    if (!editItem.nome?.trim()) { alert('Nome e obrigatorio'); return }
    try {
      await salvar.mutateAsync(editItem)
      closeForm()
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar base')
    }
  }

  async function handleToggleAtiva(base: EstBase) {
    try {
      await salvar.mutateAsync({ id: base.id, ativa: !base.ativa })
    } catch (err: any) {
      alert(err?.message || 'Erro ao alterar status')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Bases / Almoxarifados</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtrados.length} bases cadastradas</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova Base
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, codigo, CNPJ ou cidade..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
            focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Warehouse size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhuma base encontrada</p>
          <p className="text-slate-400 text-sm mt-1">Cadastre a primeira base / almoxarifado</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Codigo</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:table-cell">CNPJ</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Endereco</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Cidade/UF</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ativa</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(b => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.codigo}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{b.nome}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono hidden lg:table-cell">{b.cnpj || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell truncate max-w-[200px]">{b.endereco || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                    {b.cidade ? `${b.cidade}${b.uf ? `/${b.uf}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleAtiva(b)}
                      className={`inline-block w-8 h-4 rounded-full relative transition-colors cursor-pointer ${
                        b.ativa ? 'bg-emerald-400' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                        b.ativa ? 'left-4' : 'left-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(b)}
                      className="text-[10px] text-violet-600 font-semibold hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Create/Edit ──────────────────────────────────────── */}
      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">
                {editItem.id ? 'Editar Base' : 'Nova Base'}
              </h2>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Codigo</label>
                  <input value={editItem.codigo ?? ''} onChange={e => setEditItem({ ...editItem, codigo: e.target.value })}
                    className="input-base" placeholder="BASE-01" disabled={!!editItem.id} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nome *</label>
                  <input value={editItem.nome ?? ''} onChange={e => setEditItem({ ...editItem, nome: e.target.value })}
                    className="input-base" placeholder="Almoxarifado Central" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">CNPJ</label>
                <input value={editItem.cnpj ?? ''} onChange={e => setEditItem({ ...editItem, cnpj: e.target.value })}
                  className="input-base" placeholder="00.000.000/0000-00" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Endereco</label>
                <input value={editItem.endereco ?? ''} onChange={e => setEditItem({ ...editItem, endereco: e.target.value })}
                  className="input-base" placeholder="Rua, numero, complemento" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Cidade</label>
                  <input value={editItem.cidade ?? ''} onChange={e => setEditItem({ ...editItem, cidade: e.target.value })}
                    className="input-base" placeholder="Cidade" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">UF</label>
                  <select value={editItem.uf ?? ''} onChange={e => setEditItem({ ...editItem, uf: e.target.value })}
                    className="input-base">
                    <option value="">—</option>
                    {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">CEP</label>
                  <input value={editItem.cep ?? ''} onChange={e => setEditItem({ ...editItem, cep: e.target.value })}
                    className="input-base" placeholder="00000-000" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Telefone</label>
                  <input value={editItem.telefone ?? ''} onChange={e => setEditItem({ ...editItem, telefone: e.target.value })}
                    className="input-base" placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                  <input value={editItem.email ?? ''} onChange={e => setEditItem({ ...editItem, email: e.target.value })}
                    className="input-base" placeholder="base@empresa.com" type="email" />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editItem.ativa ?? true}
                  onChange={e => setEditItem({ ...editItem, ativa: e.target.checked })}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                <span className="text-xs font-semibold text-slate-600">Ativa</span>
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
