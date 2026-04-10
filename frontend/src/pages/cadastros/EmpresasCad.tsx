import { useState, useCallback, useMemo } from 'react'
import { Building, Plus, Search, ChevronRight, X, Save, Loader2, CheckCircle2, Upload, ImageIcon, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Trash2 } from 'lucide-react'
import { useCadEmpresas, useSalvarEmpresa } from '../../hooks/useCadastros'
import { useConsultaCNPJ } from '../../hooks/useConsultas'
import { supabase } from '../../services/supabase'
import type { Empresa } from '../../types/cadastros'
import AutoCodeField from '../../components/AutoCodeField'
import SmartTextField from '../../components/SmartTextField'

const EMPTY: Partial<Empresa> = {
  codigo: '', razao_social: '', nome_fantasia: '', cnpjs: [], ativo: true,
}

export default function EmpresasCad() {
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Empresa> | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [sortCol, setSortCol] = useState<string>('razao_social')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: empresas = [], isLoading } = useCadEmpresas()
  const salvar = useSalvarEmpresa()

  const cnpjLookup = useConsultaCNPJ(useCallback((r) => {
    setEditItem(prev => prev ? {
      ...prev,
      razao_social: prev.razao_social || r.razao_social,
      nome_fantasia: prev.nome_fantasia || r.nome_fantasia,
    } : prev)
  }, []))

  const filtered = useMemo(() => {
    let list = empresas
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(e =>
        e.razao_social.toLowerCase().includes(q) ||
        e.nome_fantasia?.toLowerCase().includes(q) ||
        e.codigo.toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      const av = (a as any)[sortCol] ?? ''
      const bv = (b as any)[sortCol] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [empresas, busca, sortCol, sortDir])

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
    await supabase.from('sys_empresas').delete().in('id', [...selected])
    setSelected(new Set())
    salvar.reset?.()
    window.location.reload()
  }

  function openNew() { setEditItem({ ...EMPTY, cnpjs: [] }); setShowForm(true) }
  function openEdit(e: Empresa) { setEditItem({ ...e, cnpjs: [...(e.cnpjs || [])] }); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null) }

  async function handleSave() {
    if (!editItem) return
    if (!editItem.razao_social?.trim()) { alert('Razao Social e obrigatoria'); return }
    try {
      await salvar.mutateAsync(editItem)
      closeForm()
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar empresa')
    }
  }

  const set = (k: string, v: any) => setEditItem(prev => prev ? { ...prev, [k]: v } : prev)

  function addCnpj() {
    if (!editItem) return
    set('cnpjs', [...(editItem.cnpjs || []), ''])
  }
  function removeCnpj(idx: number) {
    if (!editItem) return
    const arr = [...(editItem.cnpjs || [])]
    arr.splice(idx, 1)
    set('cnpjs', arr)
  }
  function setCnpj(idx: number, val: string) {
    if (!editItem) return
    const arr = [...(editItem.cnpjs || [])]
    arr[idx] = val.replace(/\D/g, '').slice(0, 14)
    set('cnpjs', arr)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Empresas</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} item(s)</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova Empresa
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
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
          <Building size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhuma empresa encontrada</p>
          <p className="text-slate-400 text-sm mt-1">Cadastre a primeira empresa</p>
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
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('razao_social')}>
                  <span className="flex items-center gap-1">Razao Social <SortIcon col="razao_social" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none hidden md:table-cell" onClick={() => toggleSort('nome_fantasia')}>
                  <span className="flex items-center gap-1">Nome Fantasia <SortIcon col="nome_fantasia" /></span>
                </th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('ativo')}>
                  <span className="flex items-center justify-center gap-1">Status <SortIcon col="ativo" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openEdit(e)}>
                  <td className="px-4 py-2.5" onClick={ev => ev.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{e.codigo}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{e.razao_social}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{e.nome_fantasia || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${e.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} onClick={() => openEdit(e)}
              className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md cursor-pointer group transition-all
                ${e.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className="flex items-center pt-1" onClick={ev => ev.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <Building size={16} className="text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-slate-800 truncate">{e.razao_social}</p>
                    <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-mono text-[10px]">{e.codigo}</span>
                  </div>
                  {e.nome_fantasia && <p className="text-[10px] text-slate-400">{e.nome_fantasia}</p>}
                  {e.cnpjs?.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {e.cnpjs.map((c, i) => (
                        <span key={i} className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-mono text-[10px]">
                          {c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0 mt-2 group-hover:text-violet-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk delete bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-sm font-semibold">
          <span>{selected.size} selecionado(s)</span>
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-xl transition-colors">
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}

      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">
                {editItem.id ? 'Editar Empresa' : 'Nova Empresa'}
              </h2>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <AutoCodeField prefix="EMP" table="sys_empresas" value={editItem.codigo ?? ''} onChange={v => set('codigo', v)}
                disabled={!!editItem.id} />
              <SmartTextField table="sys_empresas" column="razao_social" value={editItem.razao_social ?? ''}
                onChange={v => set('razao_social', v)} label="Razao Social" placeholder="Nome completo da empresa" required />
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nome Fantasia</label>
                <input value={editItem.nome_fantasia ?? ''} onChange={e => set('nome_fantasia', e.target.value)}
                  className="input-base" placeholder="Nome fantasia" />
              </div>

              {/* Logo upload */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Logo da Empresa</label>
                <div className="flex items-center gap-3">
                  {(editItem as any).logo_url ? (
                    <img src={(editItem as any).logo_url} alt="Logo" className="h-12 rounded-lg bg-slate-100 object-contain p-1" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
                      <ImageIcon size={18} className="text-slate-300" />
                    </div>
                  )}
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                    <Upload size={12} /> {(editItem as any).logo_url ? 'Trocar' : 'Enviar logo'}
                    <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const path = `${editItem.id ?? 'new'}/${Date.now()}.${file.name.split('.').pop()}`
                      const { error: upErr } = await supabase.storage.from('empresa-logos').upload(path, file, { upsert: true })
                      if (upErr) { alert('Erro no upload: ' + upErr.message); return }
                      const { data: { publicUrl } } = supabase.storage.from('empresa-logos').getPublicUrl(path)
                      set('logo_url' as any, publicUrl)
                    }} />
                  </label>
                  {(editItem as any).logo_url && (
                    <button type="button" onClick={() => set('logo_url' as any, null)}
                      className="text-[10px] text-red-500 hover:text-red-700 font-semibold">Remover</button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-600">CNPJs</label>
                  <button type="button" onClick={addCnpj}
                    className="text-[10px] font-bold text-violet-600 hover:text-violet-700 flex items-center gap-0.5">
                    <Plus size={10} /> Adicionar CNPJ
                  </button>
                </div>
                {(editItem.cnpjs || []).length === 0 && (
                  <p className="text-xs text-slate-400 italic">Nenhum CNPJ cadastrado</p>
                )}
                <div className="space-y-2">
                  {(editItem.cnpjs || []).map((c, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            value={c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                            onChange={e => setCnpj(i, e.target.value)}
                            onBlur={() => { if (i === 0) cnpjLookup.consultar(c) }}
                            className="input-base flex-1 font-mono text-sm"
                            placeholder="00.000.000/0000-00"
                          />
                          {i === 0 && cnpjLookup.loading && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-violet-500">
                              <Loader2 size={12} className="animate-spin" />
                              <span className="text-[9px] font-semibold">Buscando...</span>
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => removeCnpj(i)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                      {i === 0 && cnpjLookup.dados && !cnpjLookup.erro && (
                        <p className="text-[9px] text-emerald-600 mt-0.5 ml-1 flex items-center gap-1">
                          <CheckCircle2 size={9} /> {cnpjLookup.dados.razao_social} — {cnpjLookup.dados.situacao}
                        </p>
                      )}
                      {i === 0 && cnpjLookup.erro && (
                        <p className="text-[9px] text-red-500 mt-0.5 ml-1">{cnpjLookup.erro}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Endereco e contato */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">{`Endere\u00e7o e Contato`}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{`Endere\u00e7o`}</label>
                    <input value={(editItem as any).endereco ?? ''} onChange={e => set('endereco', e.target.value)}
                      className="input-base" placeholder="Rua, numero, bairro" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Cidade</label>
                      <input value={(editItem as any).cidade ?? ''} onChange={e => set('cidade', e.target.value)}
                        className="input-base" placeholder="Cidade" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">UF</label>
                      <input value={(editItem as any).uf ?? ''} onChange={e => set('uf', e.target.value)}
                        className="input-base" placeholder="UF" maxLength={2} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">CEP</label>
                      <input value={(editItem as any).cep ?? ''} onChange={e => set('cep', e.target.value)}
                        className="input-base" placeholder="00000-000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Telefone</label>
                      <input value={(editItem as any).telefone ?? ''} onChange={e => set('telefone', e.target.value)}
                        className="input-base" placeholder="(00) 0000-0000" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">E-mail</label>
                      <input value={(editItem as any).email ?? ''} onChange={e => set('email', e.target.value)}
                        className="input-base" placeholder="contato@empresa.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{`Inscri\u00e7\u00e3o Estadual`}</label>
                    <input value={(editItem as any).inscricao_estadual ?? ''} onChange={e => set('inscricao_estadual', e.target.value)}
                      className="input-base" placeholder="00.000.000-0" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editItem.ativo ?? true}
                  onChange={e => set('ativo', e.target.checked)}
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
