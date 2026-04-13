import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Building2, Plus, Search, ChevronRight, CheckCircle2, AlertCircle,
  Phone, Mail, Loader2, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Trash2,
} from 'lucide-react'
import { UpperInput } from '../../components/UpperInput'
import { useCadFornecedores, useSalvarFornecedor, useAiCadastroParse } from '../../hooks/useCadastros'
import { useConsultaCNPJ, useConsultaCEP } from '../../hooks/useConsultas'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Fornecedor } from '../../types/financeiro'
import type { AiCadastroResult } from '../../types/cadastros'
import MagicModal from '../../components/MagicModal'
import ConfidenceField from '../../components/ConfidenceField'
import SmartTextField from '../../components/SmartTextField'

const EMPTY: Partial<Fornecedor> = {
  razao_social: '', nome_fantasia: '', cnpj: '',
  telefone: '', email: '', contato_nome: '',
  banco_nome: '', agencia: '', conta: '', pix_chave: '', pix_tipo: '',
  ativo: true,
}

const onlyDigits = (value?: string | null) => String(value ?? '').replace(/\D/g, '')
const normalizeStatus = (value?: string | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
const formatStatus = (value?: string | null) => {
  const normalized = normalizeStatus(value)
  if (!normalized) return 'Situacao irregular'
  return normalized.charAt(0) + normalized.slice(1).toLowerCase()
}

export default function FornecedoresCad() {
  const [busca, setBusca] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Fornecedor> | null>(null)
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [sortCol, setSortCol] = useState<string>('razao_social')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cnpjDirty, setCnpjDirty] = useState(false)

  const { data: fornecedores = [], isLoading } = useCadFornecedores()
  const salvar = useSalvarFornecedor()
  const aiParse = useAiCadastroParse()
  const { isAdmin } = useAuth()

  const cnpjLookup = useConsultaCNPJ(useCallback((r) => {
    setEditItem(prev => prev ? {
      ...prev,
      razao_social: r.razao_social || prev.razao_social,
      nome_fantasia: r.nome_fantasia || prev.nome_fantasia,
      telefone: r.telefone || prev.telefone,
      email: r.email || prev.email,
      cep: r.endereco?.cep || (prev as any).cep,
      endereco: r.endereco?.logradouro ? [r.endereco.logradouro, r.endereco.numero].filter(Boolean).join(', ') : (prev as any).endereco,
      cidade: r.endereco?.cidade || (prev as any).cidade,
      uf: r.endereco?.uf || (prev as any).uf,
    } : prev)
  }, []))

  const cepLookup = useConsultaCEP(useCallback((r) => {
    setEditItem(prev => prev ? {
      ...prev,
      endereco: (prev as any).endereco || r.logradouro,
      cidade: (prev as any).cidade || r.cidade,
      uf: (prev as any).uf || r.uf,
    } : prev)
  }, []))

  const filtered = useMemo(() => {
    let list = fornecedores.filter(f => showInactive || f.ativo)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(f =>
        f.razao_social.toLowerCase().includes(q) ||
        f.nome_fantasia?.toLowerCase().includes(q) ||
        f.cnpj?.includes(q) ||
        f.numero_cadastro?.toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      const av = (a as any)[sortCol] ?? ''
      const bv = (b as any)[sortCol] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [fornecedores, busca, showInactive, sortCol, sortDir])

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
    await supabase.from('cmp_fornecedores').delete().in('id', [...selected])
    setSelected(new Set())
    window.location.reload()
  }

  function openNew() {
    setEditItem({ ...EMPTY })
    setConfidence({})
    setCnpjDirty(false)
    cnpjLookup.limpar()
    setShowForm(true)
  }
  function openEdit(f: Fornecedor) {
    setEditItem({ ...f })
    setConfidence({})
    setCnpjDirty(false)
    cnpjLookup.limpar()
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditItem(null); setConfidence({}); setCnpjDirty(false); cnpjLookup.limpar() }

  const currentCnpjDigits = onlyDigits(editItem?.cnpj)
  const lookupCnpjDigits = onlyDigits(cnpjLookup.dados?.cnpj)
  const cnpjLookupMatches = Boolean(cnpjLookup.dados && lookupCnpjDigits === currentCnpjDigits)
  const cnpjStatus = cnpjLookupMatches ? normalizeStatus(cnpjLookup.dados?.situacao) : ''
  const cnpjStatusLabel = cnpjLookupMatches ? formatStatus(cnpjLookup.dados?.situacao) : ''
  const isCnpjActive = cnpjStatus === 'ATIVA'
  const invalidCnpjStatus = Boolean(cnpjStatus && !isCnpjActive)
  const cnpjInputClassName = cnpjLookupMatches
    ? isCnpjActive
      ? 'text-emerald-700 font-semibold'
      : 'text-red-600 font-semibold'
    : ''
  const sensitiveLocked = Boolean(editItem?.id && !isAdmin)
  const sensitiveLockMessage = sensitiveLocked
    ? 'Campos cadastrais e bancarios ficam bloqueados apos o cadastro. Solicite alteracao ao Leandro ou outro Admin.'
    : null

  function getCnpjValidationMessage() {
    if (!editItem) return null
    const mustValidateCnpj = !editItem.id || cnpjDirty || cnpjLookupMatches || cnpjLookup.loading
    if (!mustValidateCnpj) return null
    if (currentCnpjDigits.length !== 14) return 'Informe um CNPJ com 14 digitos.'
    if (cnpjLookup.loading) return 'Aguarde a validacao do CNPJ.'
    if (!cnpjLookupMatches) return 'Busque e valide o CNPJ antes de salvar.'
    if (!isCnpjActive) {
      const status = cnpjStatusLabel || 'Situacao irregular'
      return `CNPJ ${status} nao pode ser cadastrado.`
    }
    return null
  }

  const cnpjValidationMessage = getCnpjValidationMessage()

  useEffect(() => {
    const cep = onlyDigits((editItem as any)?.cep)
    const hasEndereco = Boolean((editItem as any)?.endereco)
    if (showForm && cep.length === 8 && !hasEndereco) {
      cepLookup.consultar(cep)
    }
    if (hasEndereco && cepLookup.erro) {
      cepLookup.limpar()
    }
  }, [showForm, (editItem as any)?.cep, (editItem as any)?.endereco, cepLookup.consultar, cepLookup.limpar, cepLookup.erro])

  function handleCnpjChange(value: string) {
    set('cnpj', onlyDigits(value).slice(0, 14))
    setCnpjDirty(true)
    cnpjLookup.limpar()
    setConfidence(prev => {
      const next = { ...prev }
      delete next.cnpj
      return next
    })
  }

  function handleCepChange(value: string) {
    set('cep', onlyDigits(value).slice(0, 8))
    cepLookup.limpar()
    setConfidence(prev => {
      const next = { ...prev }
      delete next.cep
      return next
    })
  }

  async function handleSave() {
    if (!editItem) return
    if (!editItem.razao_social?.trim()) {
      alert('Razao Social e obrigatoria')
      return
    }
    if (sensitiveLocked) {
      const original = fornecedores.find(f => f.id === editItem.id)
      if (original && hasSensitiveChanges(original, editItem)) {
        alert('Campos importantes desse fornecedor precisam de aprovacao do Leandro ou outro Admin.')
        return
      }
    }
    const cnpjMessage = getCnpjValidationMessage()
    if (cnpjMessage) {
      alert(cnpjMessage)
      return
    }
    try {
      await salvar.mutateAsync(editItem)
      closeForm()
    } catch (err: any) {
      console.error('Erro ao salvar fornecedor:', err)
      alert(err?.message || 'Erro ao salvar fornecedor. Tente novamente.')
    }
  }

  async function handleAiParse(input: { type: string; content: string; base64?: string; filename?: string }) {
    const cleanDigits = input.content.replace(/\D/g, '')
    const isCnpjLike = input.type === 'cnpj' || (input.type === 'text' && /^\d{11,14}$/.test(cleanDigits))
    if (isCnpjLike) {
      set('cnpj', cleanDigits)
      setConfidence(prev => ({ ...prev, cnpj: 1.0 }))
      if (cleanDigits.length === 14) {
        cnpjLookup.consultar(cleanDigits)
      } else {
        cnpjLookup.limpar()
        alert(`CNPJ deve ter 14 digitos (digitou ${cleanDigits.length}). Verifique e corrija no campo abaixo.`)
      }
      return
    }

    try {
      const result = await aiParse.mutateAsync({
        entity_type: 'fornecedor',
        input_type: input.type as any,
        content: input.content,
        base64: input.base64,
        filename: input.filename,
      })
      const newItem = { ...editItem }
      const newConf: Record<string, number> = {}
      for (const [key, field] of Object.entries(result.fields)) {
        ;(newItem as any)[key] = field.value
        newConf[key] = field.confidence
      }
      setEditItem(newItem)
      setConfidence(newConf)
    } catch (err: any) {
      alert(err.message || 'Erro ao processar')
    }
  }

  const set = (k: string, v: any) => setEditItem(prev => prev ? { ...prev, [k]: v } : prev)

  function hasSensitiveChanges(original: Fornecedor, next: Partial<Fornecedor>) {
    const keys = [
      'numero_cadastro', 'razao_social', 'nome_fantasia', 'cnpj', 'inscricao_estadual',
      'endereco', 'cidade', 'uf', 'cep', 'banco_codigo', 'banco_nome', 'agencia',
      'conta', 'tipo_conta', 'boleto', 'pix_chave', 'pix_tipo', 'omie_id', 'ativo',
    ]
    return keys.some(key => String((original as any)[key] ?? '') !== String((next as any)[key] ?? ''))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Fornecedores</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} item(s)</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Novo Fornecedor
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por codigo, nome, CNPJ..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
        </div>
        <button onClick={() => setShowInactive(!showInactive)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
            showInactive ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200'
          }`}>
          {showInactive ? 'Mostrando inativos' : 'Mostrar inativos'}
        </button>
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
          <Building2 size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhum fornecedor encontrado</p>
          <p className="text-slate-400 text-sm mt-1">Cadastre o primeiro fornecedor</p>
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
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort('numero_cadastro')}>
                  <span className="flex items-center gap-1">Codigo <SortIcon col="numero_cadastro" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('razao_social')}>
                  <span className="flex items-center gap-1">Razao Social <SortIcon col="razao_social" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('nome_fantasia')}>
                  <span className="flex items-center gap-1">Fantasia <SortIcon col="nome_fantasia" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('cnpj')}>
                  <span className="flex items-center gap-1">CNPJ <SortIcon col="cnpj" /></span>
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('telefone')}>
                  <span className="flex items-center gap-1">Telefone <SortIcon col="telefone" /></span>
                </th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none" onClick={() => toggleSort('ativo')}>
                  <span className="flex items-center justify-center gap-1">Status <SortIcon col="ativo" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(f => (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openEdit(f)}>
                  <td className="px-4 py-2.5" onClick={ev => ev.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleSelect(f.id)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 font-mono hidden sm:table-cell">{f.numero_cadastro || '---'}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{f.razao_social}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{f.nome_fantasia || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 font-mono hidden lg:table-cell">
                    {f.cnpj ? f.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">{f.telefone || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${f.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} onClick={() => openEdit(f)}
              className={`bg-white rounded-2xl border shadow-sm p-4
                transition-all hover:shadow-md cursor-pointer group
                ${f.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className="flex items-center pt-1" onClick={ev => ev.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleSelect(f.id)}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-slate-800 truncate">{f.razao_social}</p>
                    {f.ativo && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                  </div>
                  {f.nome_fantasia && (
                    <p className="text-[10px] text-slate-400">{f.nome_fantasia}</p>
                  )}
                  {f.numero_cadastro && (
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono text-[10px] mt-1 mr-1 inline-block">
                      {f.numero_cadastro}
                    </span>
                  )}
                  {f.cnpj && (
                    <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-mono text-[10px] mt-1 inline-block">
                      {f.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                    </span>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                    {f.telefone && <span className="flex items-center gap-1"><Phone size={10} />{f.telefone}</span>}
                    {f.email && <span className="flex items-center gap-1"><Mail size={10} />{f.email}</span>}
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

      {/* Magic Modal */}
      {showForm && editItem && (
        <MagicModal
          title={editItem.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          isNew={!editItem.id}
          aiEnabled
          showCnpjField
          entityLabel="Fornecedor"
          onClose={closeForm}
          onSave={handleSave}
          saving={salvar.isPending}
          saveDisabled={Boolean(cnpjValidationMessage)}
          saveDisabledReason={cnpjValidationMessage}
          onAiParse={handleAiParse}
          aiParsing={aiParse.isPending}
          aiDone={Object.keys(confidence).length > 0}
        >
          <div className="space-y-4">
            {editItem.numero_cadastro && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Codigo do fornecedor</span>
                <span className="font-mono text-sm font-bold text-slate-700">{editItem.numero_cadastro}</span>
              </div>
            )}
            {sensitiveLockMessage && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                {sensitiveLockMessage}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {confidence.razao_social !== undefined ? (
                <ConfidenceField label="Razao Social" value={editItem.razao_social ?? ''} onChange={v => set('razao_social', v)}
                  confidence={confidence.razao_social} required placeholder="Razao social da empresa" disabled={sensitiveLocked} />
              ) : (
                <SmartTextField table="cmp_fornecedores" column="razao_social" value={editItem.razao_social ?? ''}
                  onChange={v => set('razao_social', v)} label="Razao Social" placeholder="Razao social da empresa" required disabled={sensitiveLocked} />
              )}
              {confidence.nome_fantasia !== undefined ? (
                <ConfidenceField label="Nome Fantasia" value={editItem.nome_fantasia ?? ''} onChange={v => set('nome_fantasia', v)}
                  confidence={confidence.nome_fantasia} placeholder="Nome fantasia" disabled={sensitiveLocked} />
              ) : (
                <SmartTextField table="cmp_fornecedores" column="nome_fantasia" value={editItem.nome_fantasia ?? ''}
                  onChange={v => set('nome_fantasia', v)} label="Nome Fantasia" placeholder="Nome fantasia" disabled={sensitiveLocked} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <ConfidenceField label="CNPJ" value={editItem.cnpj ?? ''} onChange={handleCnpjChange}
                  confidence={confidence.cnpj} showConfidence={false} inputClassName={cnpjInputClassName}
                  placeholder="00.000.000/0000-00"
                  disabled={sensitiveLocked}
                  onBlur={() => cnpjLookup.consultar(editItem.cnpj ?? '')} />
                {cnpjLookup.loading && (
                  <div className="absolute right-2 top-7 flex items-center gap-1 text-violet-500">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[9px] font-semibold">Buscando...</span>
                  </div>
                )}
                {cnpjLookup.erro && (
                  <p className="text-[9px] text-red-500 mt-0.5">{cnpjLookup.erro}</p>
                )}
                {cnpjLookupMatches && !cnpjLookup.erro && (
                  <p className={`text-[9px] mt-0.5 flex items-center gap-1 ${invalidCnpjStatus ? 'text-red-500' : 'text-emerald-600'}`}>
                    {invalidCnpjStatus ? <AlertCircle size={9} /> : <CheckCircle2 size={9} />}
                    {cnpjStatusLabel}
                  </p>
                )}
              </div>
              <ConfidenceField label="Contato" value={editItem.contato_nome ?? ''} onChange={v => set('contato_nome', v)}
                confidence={confidence.contato_nome} placeholder="Nome do contato" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ConfidenceField label="Telefone" value={editItem.telefone ?? ''} onChange={v => set('telefone', v)}
                confidence={confidence.telefone} type="tel" placeholder="(00) 0000-0000" />
              <ConfidenceField label="Email" value={editItem.email ?? ''} onChange={v => set('email', v)}
                confidence={confidence.email} type="email" placeholder="email@empresa.com" />
              <div className="relative">
                <ConfidenceField label="CEP" value={(editItem as any).cep ?? ''} onChange={handleCepChange}
                  confidence={confidence.cep} placeholder="00000-000"
                  disabled={sensitiveLocked}
                  onBlur={() => cepLookup.consultar((editItem as any).cep ?? '')} />
                {cepLookup.loading && (
                  <div className="absolute right-2 top-7 flex items-center gap-1 text-violet-500">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[9px] font-semibold">Buscando...</span>
                  </div>
                )}
                {cepLookup.erro && (
                  <p className="text-[9px] text-red-500 mt-0.5">{cepLookup.erro}</p>
                )}
              </div>
            </div>
            <ConfidenceField label="Endereco" value={(editItem as any).endereco ?? ''} onChange={v => set('endereco', v)}
              confidence={confidence.endereco} placeholder="Rua, numero, complemento" disabled={sensitiveLocked} />
            <div className="grid grid-cols-2 gap-3">
              <ConfidenceField label="Cidade" value={(editItem as any).cidade ?? ''} onChange={v => set('cidade', v)}
                confidence={confidence.cidade} placeholder="Cidade" disabled={sensitiveLocked} />
              <ConfidenceField label="UF" value={(editItem as any).uf ?? ''} onChange={v => set('uf', v)}
                confidence={confidence.uf} placeholder="MG" disabled={sensitiveLocked} />
            </div>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Dados Bancarios</p>
              <div className="grid grid-cols-3 gap-3">
                <ConfidenceField label="Banco" value={editItem.banco_nome ?? ''} onChange={v => set('banco_nome', v)} placeholder="Banco" disabled={sensitiveLocked} />
                <ConfidenceField label="Agencia" value={editItem.agencia ?? ''} onChange={v => set('agencia', v)} placeholder="0000" disabled={sensitiveLocked} />
                <ConfidenceField label="Conta" value={editItem.conta ?? ''} onChange={v => set('conta', v)} placeholder="00000-0" disabled={sensitiveLocked} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <ConfidenceField label="PIX Chave" value={editItem.pix_chave ?? ''} onChange={v => set('pix_chave', v)} placeholder="Chave PIX" disabled={sensitiveLocked} />
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">PIX Tipo</label>
                  <select value={editItem.pix_tipo ?? ''} onChange={e => set('pix_tipo', e.target.value)} disabled={sensitiveLocked} className="input-base">
                    <option value="">Selecione</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">Email</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Aleatoria</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </MagicModal>
      )}
    </div>
  )
}
