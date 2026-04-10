import { useState } from 'react'
import { FolderKanban, Plus, Search, Calendar } from 'lucide-react'
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
  concluido:    { label: 'Concluído',    bg: 'bg-slate-100', text: 'text-slate-600' },
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

  const filtered = projetos.filter(p => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return p.nome?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.responsavel?.toLowerCase().includes(q)
  })

  const form = editItem ?? EMPTY

  const handleSave = () => {
    const { id, nome, codigo, ...rest } = form
    if (!nome?.trim()) return
    salvar.mutate(id ? { id, nome, codigo, ...rest } : { nome, codigo, ...rest })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <FolderKanban size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Projetos</h1>
            <p className="text-xs text-slate-400">{projetos.length} projeto(s) cadastrado(s)</p>
          </div>
        </div>
        <button onClick={() => { setEditItem({ ...EMPTY }); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-all">
          <Plus size={14} /> Novo Projeto
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar projeto..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FolderKanban size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Nenhum projeto encontrado</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400">
                <th className="text-left px-4 py-2.5 font-semibold">CÓDIGO</th>
                <th className="text-left px-4 py-2.5 font-semibold">NOME</th>
                <th className="text-left px-4 py-2.5 font-semibold">RESPONSÁVEL</th>
                <th className="text-left px-4 py-2.5 font-semibold">INÍCIO</th>
                <th className="text-left px-4 py-2.5 font-semibold">TÉRMINO</th>
                <th className="text-center px-4 py-2.5 font-semibold">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const st = STATUS_MAP[p.status] || STATUS_MAP.planejamento
                return (
                  <tr key={p.id} onClick={() => { setEditItem(p); setShowForm(true) }}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
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
      )}

      {/* Form Modal */}
      {showForm && (
        <MagicModal title={editItem?.id ? 'Editar Projeto' : 'Novo Projeto'} onClose={() => { setShowForm(false); setEditItem(null) }}>
          <div className="space-y-3 p-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Código</label>
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
              <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição</label>
              <textarea value={form.descricao || ''} onChange={e => setEditItem({ ...form, descricao: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Descrição do projeto" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Responsável</label>
              <input value={form.responsavel || ''} onChange={e => setEditItem({ ...form, responsavel: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome do responsável" />
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
                <label className="block text-xs font-semibold text-slate-500 mb-1">Data Início</label>
                <input type="date" value={form.data_inicio || ''} onChange={e => setEditItem({ ...form, data_inicio: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Término Previsto</label>
                <input type="date" value={form.data_termino_previsto || ''} onChange={e => setEditItem({ ...form, data_termino_previsto: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={handleSave} disabled={salvar.isPending || !form.nome?.trim()}
              className="w-full py-2.5 bg-violet-600 text-white font-semibold text-sm rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-all">
              {salvar.isPending ? 'Salvando...' : editItem?.id ? 'Salvar Alterações' : 'Cadastrar Projeto'}
            </button>
          </div>
        </MagicModal>
      )}
    </div>
  )
}
