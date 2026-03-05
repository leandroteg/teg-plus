import { useState } from 'react'
import {
  Building2, Plus, Search, ChevronRight, CheckCircle2,
  Phone, Mail, MapPin,
} from 'lucide-react'
import { useCadFornecedores, useSalvarFornecedor, useAiCadastroParse } from '../../hooks/useCadastros'
import type { Fornecedor } from '../../types/financeiro'
import type { AiCadastroResult } from '../../types/cadastros'
import MagicModal from '../../components/MagicModal'
import ConfidenceField from '../../components/ConfidenceField'

const EMPTY: Partial<Fornecedor> = {
  razao_social: '', nome_fantasia: '', cnpj: '',
  telefone: '', email: '', contato_nome: '',
  banco_nome: '', agencia: '', conta: '', pix_chave: '', pix_tipo: '',
  ativo: true,
}

export default function FornecedoresCad() {
  const [busca, setBusca] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Fornecedor> | null>(null)
  const [confidence, setConfidence] = useState<Record<string, number>>({})

  const { data: fornecedores = [], isLoading } = useCadFornecedores()
  const salvar = useSalvarFornecedor()
  const aiParse = useAiCadastroParse()

  const filtered = fornecedores
    .filter(f => showInactive || f.ativo)
    .filter(f => {
      if (!busca.trim()) return true
      const q = busca.toLowerCase()
      return f.razao_social.toLowerCase().includes(q) ||
        f.nome_fantasia?.toLowerCase().includes(q) ||
        f.cnpj?.includes(q)
    })

  function openNew() {
    setEditItem({ ...EMPTY })
    setConfidence({})
    setShowForm(true)
  }
  function openEdit(f: Fornecedor) {
    setEditItem({ ...f })
    setConfidence({})
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditItem(null); setConfidence({}) }

  async function handleSave() {
    if (!editItem) return
    if (!editItem.razao_social?.trim()) {
      alert('Razão Social é obrigatória')
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
    try {
      const result = await aiParse.mutateAsync({
        entity_type: 'fornecedor',
        input_type: input.type as any,
        content: input.content,
        base64: input.base64,
        filename: input.filename,
      })
      // Apply AI results to form
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Fornecedores</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} fornecedores</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Novo Fornecedor
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
        </div>
        <button onClick={() => setShowInactive(!showInactive)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
            showInactive ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200'
          }`}>
          {showInactive ? 'Mostrando inativos' : 'Mostrar inativos'}
        </button>
      </div>

      {/* List */}
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
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} onClick={() => openEdit(f)}
              className={`bg-white rounded-2xl border shadow-sm p-4
                transition-all hover:shadow-md cursor-pointer group
                ${f.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-start gap-3">
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
          onAiParse={handleAiParse}
          aiParsing={aiParse.isPending}
          aiDone={Object.keys(confidence).length > 0}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ConfidenceField label="Razao Social" value={editItem.razao_social ?? ''} onChange={v => set('razao_social', v)}
                confidence={confidence.razao_social} required placeholder="Razao social da empresa" />
              <ConfidenceField label="Nome Fantasia" value={editItem.nome_fantasia ?? ''} onChange={v => set('nome_fantasia', v)}
                confidence={confidence.nome_fantasia} placeholder="Nome fantasia" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ConfidenceField label="CNPJ" value={editItem.cnpj ?? ''} onChange={v => set('cnpj', v)}
                confidence={confidence.cnpj} placeholder="00.000.000/0000-00" />
              <ConfidenceField label="Contato" value={editItem.contato_nome ?? ''} onChange={v => set('contato_nome', v)}
                confidence={confidence.contato_nome} placeholder="Nome do contato" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ConfidenceField label="Telefone" value={editItem.telefone ?? ''} onChange={v => set('telefone', v)}
                confidence={confidence.telefone} type="tel" placeholder="(00) 0000-0000" />
              <ConfidenceField label="Email" value={editItem.email ?? ''} onChange={v => set('email', v)}
                confidence={confidence.email} type="email" placeholder="email@empresa.com" />
              <ConfidenceField label="CEP" value={(editItem as any).cep ?? ''} onChange={v => set('cep', v)}
                confidence={confidence.cep} placeholder="00000-000" />
            </div>
            <ConfidenceField label="Endereco" value={(editItem as any).endereco ?? ''} onChange={v => set('endereco', v)}
              confidence={confidence.endereco} placeholder="Rua, numero, complemento" />
            <div className="grid grid-cols-2 gap-3">
              <ConfidenceField label="Cidade" value={(editItem as any).cidade ?? ''} onChange={v => set('cidade', v)}
                confidence={confidence.cidade} placeholder="Cidade" />
              <ConfidenceField label="UF" value={(editItem as any).uf ?? ''} onChange={v => set('uf', v)}
                confidence={confidence.uf} placeholder="MG" />
            </div>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Dados Bancarios</p>
              <div className="grid grid-cols-3 gap-3">
                <ConfidenceField label="Banco" value={editItem.banco_nome ?? ''} onChange={v => set('banco_nome', v)} placeholder="Banco" />
                <ConfidenceField label="Agencia" value={editItem.agencia ?? ''} onChange={v => set('agencia', v)} placeholder="0000" />
                <ConfidenceField label="Conta" value={editItem.conta ?? ''} onChange={v => set('conta', v)} placeholder="00000-0" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <ConfidenceField label="PIX Chave" value={editItem.pix_chave ?? ''} onChange={v => set('pix_chave', v)} placeholder="Chave PIX" />
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">PIX Tipo</label>
                  <select value={editItem.pix_tipo ?? ''} onChange={e => set('pix_tipo', e.target.value)} className="input-base">
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
