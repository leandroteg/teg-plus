import { useState, useMemo } from 'react'
import { HardHat, Plus, Search, ChevronRight, MapPin, User, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Trash2 } from 'lucide-react'
import { UpperInput } from '../../components/UpperInput'
import { useCadObras, useSalvarObra, useCadCentrosCusto, useAiCadastroParse } from '../../hooks/useCadastros'
import { supabase } from '../../services/supabase'
import type { Obra } from '../../types/cadastros'
import MagicModal from '../../components/MagicModal'
import ConfidenceField from '../../components/ConfidenceField'
import AutoCodeField from '../../components/AutoCodeField'
import SmartTextField from '../../components/SmartTextField'

const EMPTY: Partial<Obra> = {
  codigo: '', nome: '', municipio: '', uf: '', status: 'ativo',
  responsavel_nome: '', responsavel_email: '', centro_custo_id: undefined,
}
const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  ativo:     { label: 'Ativo',     bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pausado:   { label: 'Pausado',   bg: 'bg-amber-100',   text: 'text-amber-700' },
  concluido: { label: 'Concluido', bg: 'bg-slate-100',   text: 'text-slate-600' },
}

export default function ObrasCad() {
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Obra> | null>(null)
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [sortCol, setSortCol] = useState<string>('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: obras = [], isLoading } = useCadObras()
  const { data: centros = [] } = useCadCentrosCusto()
  const salvar = useSalvarObra()
  const aiParse = useAiCadastroParse()

  const filtered = useMemo(() => {
    let list = obras
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(o => o.nome.toLowerCase().includes(q) || o.codigo.toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      const av = (a as any)[sortCol] ?? ''
      const bv = (b as any)[sortCol] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [obras, busca, sortCol, sortDir])

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
    await supabase.from('sys_obras').delete().in('id', [...selected])
    setSelected(new Set())
    window.location.reload()
  }

  function openNew() { setEditItem({ ...EMPTY }); setConfidence({}); setShowForm(true) }
  function openEdit(o: Obra) { setEditItem({ ...o }); setConfidence({}); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null); setConfidence({}) }

  async function handleSave() {
    if (!editItem) return
    try {
      await salvar.mutateAsync(editItem)
      closeForm()
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar obra')
    }
  }

  async function handleAiParse(input: any) {
    try {
      const result = await aiParse.mutateAsync({ entity_type: 'obra', input_type: input.type, content: input.content, base64: input.base64, filename: input.filename })
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
          <h1 className="text-xl font-extrabold text-slate-800">Obras / Projetos</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} item(s)</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova Obra
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou codigo..."
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
          <HardHat size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhuma obra encontrada</p>
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
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('codigo')}>
                  <span className="flex items-center gap-1">Codigo <SortIcon col="codigo" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('nome')}>
                  <span className="flex items-center gap-1">Nome <SortIcon col="nome" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('municipio')}>
                  <span className="flex items-center gap-1">Municipio <SortIcon col="municipio" /></span>
                </th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('status')}>
                  <span className="flex items-center justify-center gap-1">Status <SortIcon col="status" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(o => {
                const s = STATUS_MAP[o.status ?? ''] || STATUS_MAP.ativo
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openEdit(o)}>
                    <td className="px-4 py-2.5" onClick={ev => ev.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{o.codigo}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{o.nome}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{o.municipio ? `${o.municipio}/${o.uf}` : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>{s.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const s = STATUS_MAP[o.status ?? ''] || STATUS_MAP.ativo
            return (
              <div key={o.id} onClick={() => openEdit(o)}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md cursor-pointer group transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex items-center pt-1" onClick={ev => ev.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <HardHat size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-slate-800 truncate">{o.nome}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                    <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-mono text-[10px]">{o.codigo}</span>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                      {o.centro_custo?.descricao && <span className="bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full font-semibold">{o.centro_custo.descricao}</span>}
                      {o.municipio && <span className="flex items-center gap-1"><MapPin size={10} />{o.municipio}/{o.uf}</span>}
                      {o.responsavel_nome && <span className="flex items-center gap-1"><User size={10} />{o.responsavel_nome}</span>}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0 mt-2 group-hover:text-violet-500 transition-colors" />
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
        <MagicModal title={editItem.id ? 'Editar Obra' : 'Nova Obra'} isNew={!editItem.id}
          aiEnabled entityLabel="Obra" onClose={closeForm} onSave={handleSave}
          saving={salvar.isPending} onAiParse={handleAiParse} aiParsing={aiParse.isPending}
          aiDone={Object.keys(confidence).length > 0}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <AutoCodeField prefix="OBR" table="sys_obras" value={editItem.codigo ?? ''} onChange={v => set('codigo', v)}
                disabled={!!editItem.id} />
              <SmartTextField table="sys_obras" column="nome" value={editItem.nome ?? ''} onChange={v => set('nome', v)}
                label="Nome" placeholder="SE Frutal" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Centro de Custo</label>
              <select value={editItem.centro_custo_id ?? ''} onChange={e => set('centro_custo_id', e.target.value || undefined)} className="input-base">
                <option value="">Nenhum</option>
                {centros.map(cc => <option key={cc.id} value={cc.id}>{cc.codigo} — {cc.descricao}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ConfidenceField label="Municipio" value={editItem.municipio ?? ''} onChange={v => set('municipio', v)}
                confidence={confidence.municipio} placeholder="Cidade" />
              <ConfidenceField label="UF" value={editItem.uf ?? ''} onChange={v => set('uf', v)}
                confidence={confidence.uf} placeholder="MG" />
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                <select value={editItem.status ?? 'ativo'} onChange={e => set('status', e.target.value)} className="input-base">
                  <option value="ativo">Ativo</option>
                  <option value="pausado">Pausado</option>
                  <option value="concluido">Concluido</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ConfidenceField label="Responsavel" value={editItem.responsavel_nome ?? ''} onChange={v => set('responsavel_nome', v)}
                confidence={confidence.responsavel_nome} placeholder="Nome do responsavel" />
              <ConfidenceField label="Email Responsavel" value={editItem.responsavel_email ?? ''} onChange={v => set('responsavel_email', v)}
                confidence={confidence.responsavel_email} type="email" placeholder="email@teg.com" />
            </div>
          </div>
        </MagicModal>
      )}
    </div>
  )
}
