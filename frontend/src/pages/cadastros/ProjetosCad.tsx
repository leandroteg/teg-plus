import { useState, useMemo } from 'react'
import { FolderKanban, Plus, Search, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useCadCentrosCusto } from '../../hooks/useCadastros'
import MagicModal from '../../components/MagicModal'

interface Projeto {
  id: string
  nome: string
  codigo: string
  descricao?: string
  status: string
  responsavel?: string
  centro_custo_id?: string
  data_inicio?: string
  data_termino_previsto?: string
  portfolio_id?: string
  created_at: string
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  planejamento: { label: 'Planejamento', bg: 'bg-blue-100', text: 'text-blue-700' },
  em_andamento: { label: 'Em Andamento', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pausado:      { label: 'Pausado',      bg: 'bg-amber-100', text: 'text-amber-700' },
  concluido:    { label: 'Concluido',    bg: 'bg-slate-100', text: 'text-slate-600' },
  cancelado:    { label: 'Cancelado',    bg: 'bg-red-100', text: 'text-red-600' },
}

const EMPTY: Partial<Projeto> = {
  nome: '', codigo: '', descricao: '', status: 'planejamento',
  responsavel: '', centro_custo_id: undefined, data_inicio: '', data_termino_previsto: '',
}

export default function ProjetosCad() {
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Projeto> | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [sortCol, setSortCol] = useState<string>('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const qc = useQueryClient()

  const { data: projetos = [], isLoading } = useQuery<Projeto[]>({
    queryKey: ['cad-projetos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pmo_projetos').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Projeto[]
    },
  })

  const { data: centros = [] } = useCadCentrosCusto()

  const salvar = useMutation({
    mutationFn: async (item: Partial<Projeto>) => {
      if (item.id) {
        const { error } = await supabase.from('pmo_projetos').update(item).eq('id', item.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('pmo_projetos').insert(item)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cad-projetos'] })
      qc.invalidateQueries({ queryKey: ['cad-projetos-count'] })
      setShowForm(false); setEditItem(null)
    },
  })

  const filtered = useMemo(() => {
    let list = projetos
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(p => p.nome?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.responsavel?.toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      const av = (a as any)[sortCol] ?? ''
      const bv = (b as any)[sortCol] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [projetos, busca, sortCol, sortDir])

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
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(i => i.id)))
  }
  const handleBulkDelete = async () => {
    if (!confirm(`Excluir ${selected.size} item(s)?`)) return
    await supabase.from('pmo_projetos').delete().in('id', [...selected])
    setSelected(new Set())
    qc.invalidateQueries({ queryKey: ['cad-projetos'] })
  }

  const form = editItem ?? EMPTY

  const handleSave = () => {
    const { id, nome, codigo, ...rest } = form
    if (!nome?.trim()) return
    salvar.mutate(id ? { id, nome, codigo, ...rest } : { nome, codigo, ...rest })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Projetos</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} item(s)</p>
        </div>
        <button onClick={() => { setEditItem({ ...EMPTY }); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-all">
          <Plus size={14} /> Novo Projeto
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar projeto..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
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
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FolderKanban size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Nenhum projeto encontrado</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400">
                <th className="px-4 py-2.5 w-10">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={selectAll} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                </th>
                <th className="text-left px-4 py-2.5 font-semibold cursor-pointer select-none" onClick={() => toggleSort('codigo')}>
                  <span className="flex items-center gap-1">CODIGO <SortIcon col="codigo" /></span>
                </th>
                <th className="text-left px-4 py-2.5 font-semibold cursor-pointer select-none" onClick={() => toggleSort('nome')}>
                  <span className="flex items-center gap-1">NOME <SortIcon col="nome" /></span>
                </th>
                <th className="text-left px-4 py-2.5 font-semibold cursor-pointer select-none" onClick={() => toggleSort('responsavel')}>
                  <span className="flex items-center gap-1">RESPONSAVEL <SortIcon col="responsavel" /></span>
                </th>
                <th className="text-left px-4 py-2.5 font-semibold cursor-pointer select-none" onClick={() => toggleSort('data_inicio')}>
                  <span className="flex items-center gap-1">INICIO <SortIcon col="data_inicio" /></span>
                </th>
                <th className="text-left px-4 py-2.5 font-semibold cursor-pointer select-none" onClick={() => toggleSort('data_termino_previsto')}>
                  <span className="flex items-center gap-1">TERMINO <SortIcon col="data_termino_previsto" /></span>
                </th>
                <th className="text-center px-4 py-2.5 font-semibold cursor-pointer select-none" onClick={() => toggleSort('status')}>
                  <span className="flex items-center justify-center gap-1">STATUS <SortIcon col="status" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const st = STATUS_MAP[p.status] || STATUS_MAP.planejamento
                return (
                  <tr key={p.id} onClick={() => { setEditItem(p); setShowForm(true) }}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5" onClick={ev => ev.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.codigo || '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{p.nome}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.responsavel || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400">{p.data_inicio ? new Date(p.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400">{p.data_termino_previsto ? new Date(p.data_termino_previsto + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.planejamento
            return (
              <div key={p.id} onClick={() => { setEditItem(p); setShowForm(true) }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md cursor-pointer group transition-all">
                <div className="flex items-center gap-3">
                  <div onClick={ev => ev.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <FolderKanban size={16} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-slate-800 truncate">{p.nome}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      {p.codigo && <span className="font-mono">{p.codigo}</span>}
                      {p.responsavel && <span>{p.responsavel}</span>}
                      {p.data_inicio && <span>{new Date(p.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
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

      {/* Form Modal */}
      {showForm && (
        <MagicModal title={editItem?.id ? 'Editar Projeto' : 'Novo Projeto'} onClose={() => { setShowForm(false); setEditItem(null) }}>
          <div className="space-y-3 p-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Codigo</label>
                <input value={form.codigo || ''} onChange={e => setEditItem({ ...form, codigo: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="PRJ-001" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                <select value={form.status || 'planejamento'} onChange={e => setEditItem({ ...form, status: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nome *</label>
              <input value={form.nome || ''} onChange={e => setEditItem({ ...form, nome: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome do projeto" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Descricao</label>
              <textarea value={form.descricao || ''} onChange={e => setEditItem({ ...form, descricao: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Descricao do projeto" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Responsavel</label>
              <input value={form.responsavel || ''} onChange={e => setEditItem({ ...form, responsavel: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome do responsavel" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Centro de Custo</label>
              <select value={form.centro_custo_id || ''} onChange={e => setEditItem({ ...form, centro_custo_id: e.target.value || undefined })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Data Inicio</label>
                <input type="date" value={form.data_inicio || ''} onChange={e => setEditItem({ ...form, data_inicio: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Termino Previsto</label>
                <input type="date" value={form.data_termino_previsto || ''} onChange={e => setEditItem({ ...form, data_termino_previsto: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={handleSave} disabled={salvar.isPending || !form.nome?.trim()}
              className="w-full py-2.5 bg-violet-600 text-white font-semibold text-sm rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-all">
              {salvar.isPending ? 'Salvando...' : editItem?.id ? 'Salvar Alteracoes' : 'Cadastrar Projeto'}
            </button>
          </div>
        </MagicModal>
      )}
    </div>
  )
}
