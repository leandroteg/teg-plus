import { useState, useMemo } from 'react'
import { Users, Plus, Search, ChevronRight, Phone, Mail, Briefcase, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Trash2 } from 'lucide-react'
import { useCadColaboradores, useSalvarColaborador, useCadObras, useAiCadastroParse } from '../../hooks/useCadastros'
import { supabase } from '../../services/supabase'
import type { Colaborador } from '../../types/cadastros'
import MagicModal from '../../components/MagicModal'
import ConfidenceField from '../../components/ConfidenceField'
import SmartTextField from '../../components/SmartTextField'

const EMPTY: Partial<Colaborador> = {
  nome: '', cpf: '', cargo: '', departamento: '', obra_id: undefined,
  email: '', telefone: '', data_admissao: undefined, ativo: true,
}

export default function ColaboradoresCad() {
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Colaborador> | null>(null)
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [sortCol, setSortCol] = useState<string>('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: colaboradores = [], isLoading } = useCadColaboradores()
  const { data: obras = [] } = useCadObras()
  const salvar = useSalvarColaborador()
  const aiParse = useAiCadastroParse()

  const filtered = useMemo(() => {
    let list = colaboradores
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(c => c.nome.toLowerCase().includes(q) || c.cpf?.includes(busca))
    }
    list = [...list].sort((a, b) => {
      let av: any, bv: any
      if (sortCol === 'obra') { av = a.obra?.nome ?? ''; bv = b.obra?.nome ?? '' }
      else { av = (a as any)[sortCol] ?? ''; bv = (b as any)[sortCol] ?? '' }
      const cmp = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [colaboradores, busca, sortCol, sortDir])

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
    await supabase.from('rh_colaboradores').delete().in('id', [...selected])
    setSelected(new Set())
    window.location.reload()
  }

  function openNew() { setEditItem({ ...EMPTY }); setConfidence({}); setShowForm(true) }
  function openEdit(c: Colaborador) { setEditItem({ ...c }); setConfidence({}); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null); setConfidence({}) }
  async function handleSave() { if (!editItem) return; await salvar.mutateAsync(editItem); closeForm() }

  async function handleAiParse(input: any) {
    try {
      const result = await aiParse.mutateAsync({ entity_type: 'colaborador', input_type: input.type, content: input.content, base64: input.base64, filename: input.filename })
      const newItem = { ...editItem }
      const newConf: Record<string, number> = {}
      for (const [k, f] of Object.entries(result.fields)) { ;(newItem as any)[k] = f.value; newConf[k] = f.confidence }
      setEditItem(newItem); setConfidence(newConf)
    } catch (err: any) { alert(err.message) }
  }

  const set = (k: string, v: any) => setEditItem(prev => prev ? { ...prev, [k]: v } : prev)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Colaboradores</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} item(s)</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Novo Colaborador
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
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
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Users size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhum colaborador encontrado</p>
          <p className="text-slate-400 text-sm mt-1">Cadastre o primeiro colaborador</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={selectAll} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('nome')}>
                  <span className="flex items-center gap-1">Nome <SortIcon col="nome" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('cargo')}>
                  <span className="flex items-center gap-1">Cargo <SortIcon col="cargo" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('obra')}>
                  <span className="flex items-center gap-1">Obra <SortIcon col="obra" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('telefone')}>
                  <span className="flex items-center gap-1">Telefone <SortIcon col="telefone" /></span>
                </th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('ativo')}>
                  <span className="flex items-center justify-center gap-1">Status <SortIcon col="ativo" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openEdit(c)}>
                  <td className="px-4 py-2.5" onClick={ev => ev.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{c.nome}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{c.cargo || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{c.obra?.nome || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden lg:table-cell">{c.telefone || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${c.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} onClick={() => openEdit(c)}
              className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md cursor-pointer group transition-all
                ${c.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className="flex items-center pt-1" onClick={ev => ev.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <Users size={16} className="text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{c.nome}</p>
                  {c.cargo && <p className="text-[10px] text-slate-400 flex items-center gap-1"><Briefcase size={9} />{c.cargo}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                    {c.obra?.nome && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">{c.obra.nome}</span>}
                    {c.telefone && <span className="flex items-center gap-1"><Phone size={10} />{c.telefone}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0 mt-2 group-hover:text-violet-500 transition-colors" />
              </div>
            </div>
          ))}
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
        <MagicModal title={editItem.id ? 'Editar Colaborador' : 'Novo Colaborador'} isNew={!editItem.id}
          aiEnabled showCpfField entityLabel="Colaborador" onClose={closeForm} onSave={handleSave}
          saving={salvar.isPending} onAiParse={handleAiParse} aiParsing={aiParse.isPending}
          aiDone={Object.keys(confidence).length > 0}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {confidence.nome !== undefined ? (
                <ConfidenceField label="Nome" value={editItem.nome ?? ''} onChange={v => set('nome', v)}
                  confidence={confidence.nome} required placeholder="Nome completo" />
              ) : (
                <SmartTextField table="rh_colaboradores" column="nome" value={editItem.nome ?? ''}
                  onChange={v => set('nome', v)} label="Nome" placeholder="Nome completo" required />
              )}
              <ConfidenceField label="CPF" value={editItem.cpf ?? ''} onChange={v => set('cpf', v)}
                confidence={confidence.cpf} placeholder="000.000.000-00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SmartTextField table="rh_colaboradores" column="cargo" value={editItem.cargo ?? ''}
                onChange={v => set('cargo', v)} label="Cargo" placeholder="Eletricista, Engenheiro..." />
              <SmartTextField table="rh_colaboradores" column="departamento" value={editItem.departamento ?? ''}
                onChange={v => set('departamento', v)} label="Departamento" placeholder="Engenharia, Compras..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Obra</label>
                <select value={editItem.obra_id ?? ''} onChange={e => set('obra_id', e.target.value || undefined)} className="input-base">
                  <option value="">Nenhuma</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>)}
                </select>
              </div>
              <ConfidenceField label="Data Admissao" value={editItem.data_admissao ?? ''} onChange={v => set('data_admissao', v)}
                type="date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ConfidenceField label="Email" value={editItem.email ?? ''} onChange={v => set('email', v)}
                confidence={confidence.email} type="email" placeholder="email@teg.com" />
              <ConfidenceField label="Telefone" value={editItem.telefone ?? ''} onChange={v => set('telefone', v)}
                confidence={confidence.telefone} type="tel" placeholder="(00) 00000-0000" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editItem.ativo ?? true}
                onChange={e => set('ativo', e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
              <span className="text-xs font-semibold text-slate-600">Ativo</span>
            </label>
          </div>
        </MagicModal>
      )}
    </div>
  )
}
