import { useState } from 'react'
import {
  FileStack, Plus, Trash2, CheckCircle2, AlertTriangle, X,
  TrendingUp, TrendingDown, Loader2, Edit3, ChevronDown, ChevronUp, Filter,
} from 'lucide-react'
import {
  useModelosContrato, useCriarModelo, useAtualizarModelo, useExcluirModelo,
  type ModeloContrato,
} from '../../hooks/useContratos'
import { useAuth } from '../../contexts/AuthContext'
import { GRUPO_CONTRATO_OPTIONS, getGrupoContratoLabel } from '../../constants/contratos'
import type { GrupoContrato } from '../../types/contratos'
import { supabase } from '../../services/supabase'

const RECORRENCIAS = [
  { value: 'mensal',        label: 'Mensal' },
  { value: 'bimestral',     label: 'Bimestral' },
  { value: 'trimestral',    label: 'Trimestral' },
  { value: 'semestral',     label: 'Semestral' },
  { value: 'anual',         label: 'Anual' },
  { value: 'personalizado', label: 'Personalizado' },
]

interface ItemForm {
  descricao: string
  unidade: string
  quantidade: number
  valor_unitario: number
}

// ── Form de Modelo ───────────────────────────────────────────────────────────

function ModeloForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: ModeloContrato
  onSave: (data: any) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [tipo, setTipo] = useState<'receita' | 'despesa'>(initial?.tipo_contrato ?? 'despesa')
  const [grupoContrato, setGrupoContrato] = useState<GrupoContrato>(initial?.grupo_contrato as GrupoContrato ?? 'outro')
  const [objeto, setObjeto] = useState(initial?.objeto ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [clausulas, setClausulas] = useState(initial?.clausulas ?? '')
  const [recorrencia, setRecorrencia] = useState(initial?.recorrencia ?? 'mensal')
  const [indiceReajuste, setIndiceReajuste] = useState(initial?.indice_reajuste ?? '')
  const [itens, setItens] = useState<ItemForm[]>(
    (initial?.itens_padrao as ItemForm[] | undefined) ?? []
  )
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState('')

  const addItem = () => setItens(prev => [...prev, { descricao: '', unidade: 'un', quantidade: 1, valor_unitario: 0 }])
  const removeItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: keyof ItemForm, val: string | number) =>
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))

  const handleSubmit = async () => {
    setErro('')
    if (!nome.trim()) return setErro('Informe o nome do modelo')
    if (!objeto.trim()) return setErro('Informe o objeto do modelo')

    let arquivoUrl = initial?.arquivo_url ?? null

    if (arquivo) {
      const path = `modelos/${initial?.id ?? crypto.randomUUID()}/${arquivo.name}`
      const { error: upErr } = await supabase.storage
        .from('contratos-anexos')
        .upload(path, arquivo, { upsert: true })
      if (upErr) return setErro('Erro ao enviar arquivo: ' + upErr.message)
      const { data: { publicUrl } } = supabase.storage
        .from('contratos-anexos')
        .getPublicUrl(path)
      arquivoUrl = publicUrl
    }

    onSave({
      nome: nome.trim(),
      tipo_contrato: tipo,
      grupo_contrato: grupoContrato,
      objeto: objeto.trim(),
      descricao: descricao.trim() || null,
      clausulas: clausulas.trim() || null,
      recorrencia,
      indice_reajuste: indiceReajuste.trim() || null,
      itens_padrao: itens.length > 0 ? itens : [],
      arquivo_url: arquivoUrl,
      ativo: true,
    })
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400'
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1 block'

  return (
    <div className="space-y-5">
      {/* Tipo */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className={labelClass}>Tipo do Modelo</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTipo('despesa')}
            className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
              tipo === 'despesa'
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}>
            A Pagar (Despesa)
          </button>
          <button onClick={() => setTipo('receita')}
            className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
              tipo === 'receita'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}>
            A Receber (Receita)
          </button>
        </div>
      </div>

      {/* Grupo de Contrato e Template */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-800">Classificação</h2>
        <div>
          <label className={labelClass}>Grupo de Contrato *</label>
          <select
            value={grupoContrato}
            onChange={e => setGrupoContrato(e.target.value as GrupoContrato)}
            className={inputClass}
          >
            {GRUPO_CONTRATO_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Arquivo Template (PDF/DOCX)</label>
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={e => setArquivo(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-violet-50 file:text-violet-700 file:font-medium file:cursor-pointer hover:file:bg-violet-100"
          />
          {initial?.arquivo_url && !arquivo && (
            <a href={initial.arquivo_url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-violet-600 hover:underline mt-1 inline-flex items-center gap-1">
              <FileStack size={12} /> Ver template atual
            </a>
          )}
        </div>
      </div>

      {/* Dados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-800">Dados do Modelo</h2>
        <div>
          <label className={labelClass}>Nome do Modelo *</label>
          <input value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Ex: Contrato Padrão de Serviços" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Objeto Padrão *</label>
          <input value={objeto} onChange={e => setObjeto(e.target.value)}
            placeholder="Descrição resumida do objeto" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Descrição Detalhada</label>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Detalhes do escopo, condições padrão, etc."
            rows={3} className={`${inputClass} resize-none`} />
        </div>
      </div>

      {/* Cláusulas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-800">Cláusulas Padrão</h2>
        <textarea value={clausulas} onChange={e => setClausulas(e.target.value)}
          placeholder="Cláusulas padrão do contrato. Cada cláusula em uma linha ou use formatação livre..."
          rows={8} className={`${inputClass} resize-none font-mono text-xs leading-relaxed`} />
      </div>

      {/* Itens Padrão */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800">Itens Padrão</h2>
          <button onClick={addItem}
            className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-800 transition-colors">
            <Plus size={13} /> Adicionar Item
          </button>
        </div>
        {itens.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum item padrão. Adicione itens que se repetem neste tipo de contrato.</p>
        ) : (
          itens.map((it, idx) => (
            <div key={idx} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400">Item {idx + 1}</p>
                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={13} />
                </button>
              </div>
              <input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)}
                placeholder="Descrição do item" className={inputClass} />
              <div className="grid grid-cols-3 gap-2">
                <input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)}
                  placeholder="un" className={inputClass} />
                <input type="number" value={it.quantidade || ''} onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                  placeholder="Qtd" className={inputClass} min="0" step="0.01" />
                <input type="number" value={it.valor_unitario || ''} onChange={e => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)}
                  placeholder="Valor Un." className={inputClass} min="0" step="0.01" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recorrência */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-800">Recorrência Padrão</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {RECORRENCIAS.map(r => (
            <button key={r.value} onClick={() => setRecorrencia(r.value)}
              className={`py-2.5 rounded-xl text-[11px] font-semibold border-2 transition-all ${
                recorrencia === r.value
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
        <div>
          <label className={labelClass}>Índice de Reajuste</label>
          <input value={indiceReajuste} onChange={e => setIndiceReajuste(e.target.value)}
            placeholder="IPCA, IGP-M, INPC" className={inputClass} />
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{erro}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold
            text-slate-600 hover:bg-slate-50 transition-all">
          Cancelar
        </button>
        <button onClick={handleSubmit}
          disabled={isPending}
          className="flex-1 py-3.5 rounded-xl bg-violet-600 text-white text-sm font-bold
            hover:bg-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {isPending
            ? <Loader2 size={16} className="animate-spin" />
            : <CheckCircle2 size={16} />}
          {initial ? 'Salvar Alterações' : 'Criar Modelo'}
        </button>
      </div>
    </div>
  )
}

// ── Card de Modelo ───────────────────────────────────────────────────────────

function ModeloCard({
  modelo,
  onEdit,
  onDelete,
}: {
  modelo: ModeloContrato
  onEdit: () => void
  onDelete: () => void
}) {
  const { atLeast } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const isDespesa = modelo.tipo_contrato === 'despesa'
  const excluir = useExcluirModelo()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDespesa ? 'bg-amber-50' : 'bg-emerald-50'
          }`}>
            {isDespesa
              ? <TrendingDown size={16} className="text-amber-600" />
              : <TrendingUp size={16} className="text-emerald-600" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                isDespesa ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {isDespesa ? 'Despesa' : 'Receita'}
              </span>
              <span className="inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 bg-teal-50 text-teal-700">
                {getGrupoContratoLabel(modelo.grupo_contrato)}
              </span>
              <span className="inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 bg-violet-50 text-violet-700">
                {RECORRENCIAS.find(r => r.value === modelo.recorrencia)?.label ?? modelo.recorrencia}
              </span>
              {modelo.indice_reajuste && (
                <span className="inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 bg-slate-100 text-slate-600">
                  {modelo.indice_reajuste}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-800 mt-1">{modelo.nome}</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{modelo.objeto}</p>
          </div>
          <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600 shrink-0">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-[fadeIn_0.2s_ease]">
            {modelo.descricao && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Descrição</p>
                <p className="text-xs text-slate-600 mt-0.5">{modelo.descricao}</p>
              </div>
            )}
            {modelo.clausulas && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Cláusulas</p>
                <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                  {modelo.clausulas}
                </p>
              </div>
            )}
            {modelo.arquivo_url && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Template</p>
                <a href={modelo.arquivo_url} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-violet-600 hover:underline mt-0.5 inline-flex items-center gap-1">
                  <FileStack size={12} /> Ver arquivo do template
                </a>
              </div>
            )}
            {(modelo.itens_padrao as ItemForm[])?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Itens Padrão ({(modelo.itens_padrao as ItemForm[]).length})</p>
                <div className="mt-1 space-y-1">
                  {(modelo.itens_padrao as ItemForm[]).map((it, i) => (
                    <div key={i} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-1">
                      {it.descricao} — {it.quantidade} {it.unidade}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {atLeast('comprador') && (
          <div className="flex gap-2 mt-3">
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-[11px] font-semibold text-violet-600 hover:bg-violet-100 transition-all">
              <Edit3 size={11} />
              Editar
            </button>
            {atLeast('gerente') && (
              <button
                onClick={() => {
                  if (confirm('Excluir este modelo? Esta ação não pode ser desfeita.')) onDelete()
                }}
                disabled={excluir.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition-all disabled:opacity-50">
                <Trash2 size={11} />
                Excluir
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página Principal ─────────────────────────────────────────────────────────

export default function ModelosContrato() {
  const { atLeast } = useAuth()
  const { data: modelos = [], isLoading } = useModelosContrato()
  const criarModelo = useCriarModelo()
  const atualizarModelo = useAtualizarModelo()
  const excluirModelo = useExcluirModelo()

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingModelo, setEditingModelo] = useState<ModeloContrato | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [filtroGrupo, setFiltroGrupo] = useState<string>('')

  const modelosFiltrados = filtroGrupo
    ? modelos.filter(m => m.grupo_contrato === filtroGrupo)
    : modelos

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const handleCreate = async (data: any) => {
    try {
      await criarModelo.mutateAsync(data)
      showToast('success', 'Modelo criado com sucesso')
      setMode('list')
    } catch {
      showToast('error', 'Erro ao criar modelo')
    }
  }

  const handleUpdate = async (data: any) => {
    if (!editingModelo) return
    try {
      await atualizarModelo.mutateAsync({ id: editingModelo.id, ...data })
      showToast('success', 'Modelo atualizado com sucesso')
      setMode('list')
      setEditingModelo(null)
    } catch {
      showToast('error', 'Erro ao atualizar modelo')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await excluirModelo.mutateAsync(id)
      showToast('success', 'Modelo excluído')
    } catch {
      showToast('error', 'Erro ao excluir modelo')
    }
  }

  if (mode === 'create') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('list')}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all">
            <X size={16} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">Novo Modelo</h1>
            <p className="text-xs text-slate-400 mt-0.5">Crie um template reutilizável para contratos</p>
          </div>
        </div>
        <ModeloForm onSave={handleCreate} onCancel={() => setMode('list')} isPending={criarModelo.isPending} />
      </div>
    )
  }

  if (mode === 'edit' && editingModelo) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setMode('list'); setEditingModelo(null) }}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all">
            <X size={16} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">Editar Modelo</h1>
            <p className="text-xs text-slate-400 mt-0.5">{editingModelo.nome}</p>
          </div>
        </div>
        <ModeloForm initial={editingModelo} onSave={handleUpdate} onCancel={() => { setMode('list'); setEditingModelo(null) }} isPending={atualizarModelo.isPending} />
      </div>
    )
  }

  // ── List Mode ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <FileStack size={18} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">Modelos de Contrato</h1>
            <p className="text-xs text-slate-400 mt-0.5">Templates reutilizáveis para contratos</p>
          </div>
        </div>
        {atLeast('comprador') && (
          <button onClick={() => setMode('create')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-all shadow-sm">
            <Plus size={14} />
            Novo Modelo
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium animate-[fadeIn_0.2s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Filtro por Grupo */}
      {modelos.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filtroGrupo}
            onChange={e => setFiltroGrupo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
          >
            <option value="">Todos os grupos</option>
            {GRUPO_CONTRATO_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {filtroGrupo && (
            <button onClick={() => setFiltroGrupo('')}
              className="text-[10px] font-semibold text-violet-600 hover:text-violet-800">
              Limpar
            </button>
          )}
          <span className="text-[10px] text-slate-400 ml-auto">
            {modelosFiltrados.length} de {modelos.length} modelo{modelos.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-violet-400" />
        </div>
      ) : modelosFiltrados.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <FileStack size={24} className="text-violet-300" />
          </div>
          <p className="text-sm font-bold text-slate-600">
            {filtroGrupo ? 'Nenhum modelo neste grupo' : 'Nenhum modelo cadastrado'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {filtroGrupo ? 'Tente outro filtro ou crie um novo modelo' : 'Crie modelos para agilizar a criação de contratos'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {modelosFiltrados.map(m => (
            <ModeloCard
              key={m.id}
              modelo={m}
              onEdit={() => { setEditingModelo(m); setMode('edit') }}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
