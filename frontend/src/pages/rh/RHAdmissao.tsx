// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHAdmissao.tsx — Pipeline de Admissão
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  UserPlus, Clock, FileSearch, UserCheck, CheckCircle2, X, Plus,
  ChevronRight, Briefcase, Building2, Calendar, DollarSign, FileText,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useRHAdmissoes, useSalvarRHAdmissao, useSalvarRHColaborador } from '../../hooks/useRH'
import { useCadObras } from '../../hooks/useCadastros'
import type { RHAdmissao, StatusAdmissao } from '../../types/rh'
import { TIPOS_CONTRATO, DOCUMENTOS_ADMISSAO } from '../../types/rh'

const STAGES: { key: StatusAdmissao; label: string; icon: any; color: string; bg: string }[] = [
  { key: 'pendente', label: 'Pendente', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500' },
  { key: 'avaliacao_documentos', label: 'Avaliação Docs', icon: FileSearch, color: 'text-blue-500', bg: 'bg-blue-500' },
  { key: 'aguardando_cadastro', label: 'Aguardando Cadastro', icon: UserCheck, color: 'text-violet-500', bg: 'bg-violet-500' },
  { key: 'concluida', label: 'Concluída', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500' },
]

const EMPTY: Partial<RHAdmissao> = {
  nome_candidato: '', cpf: '', cargo_previsto: '', departamento_previsto: '',
  tipo_contrato: 'CLT', salario_previsto: undefined, data_prevista_inicio: undefined,
  observacoes: '', documentos_pendentes: [...DOCUMENTOS_ADMISSAO], documentos_recebidos: [],
}

export default function RHAdmissao() {
  const { isLightSidebar: isLight } = useTheme()
  const { perfil } = useAuth()
  const { data: admissoes = [], isLoading } = useRHAdmissoes()
  const { data: obras = [] } = useCadObras()
  const salvarAdmissao = useSalvarRHAdmissao()
  const salvarColaborador = useSalvarRHColaborador()

  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<RHAdmissao> | null>(null)
  const [activeTab, setActiveTab] = useState<StatusAdmissao | 'todas'>('todas')

  const filtered = activeTab === 'todas' ? admissoes : admissoes.filter(a => a.status === activeTab)

  function openNew() {
    setEditItem({ ...EMPTY, registrado_por: perfil?.id })
    setShowForm(true)
  }

  function openEdit(a: RHAdmissao) {
    setEditItem({ ...a })
    setShowForm(true)
  }

  async function handleSave() {
    if (!editItem?.nome_candidato) return
    await salvarAdmissao.mutateAsync(editItem)
    setShowForm(false)
    setEditItem(null)
  }

  async function handleAvancar(adm: RHAdmissao) {
    const next: Record<string, StatusAdmissao> = {
      pendente: 'avaliacao_documentos',
      avaliacao_documentos: 'aguardando_cadastro',
    }
    if (next[adm.status]) {
      await salvarAdmissao.mutateAsync({ id: adm.id, status: next[adm.status] })
    }
  }

  async function handleConcluir(adm: RHAdmissao) {
    // Criar o colaborador
    const colab = await salvarColaborador.mutateAsync({
      nome: adm.nome_candidato,
      cpf: adm.cpf,
      cargo: adm.cargo_previsto,
      departamento: adm.departamento_previsto,
      obra_id: adm.obra_prevista_id,
      tipo_contrato: adm.tipo_contrato || 'CLT',
      salario: adm.salario_previsto,
      data_admissao: adm.data_prevista_inicio || new Date().toISOString().split('T')[0],
      ativo: true,
      status_admissao: 'ativo',
    })
    // Atualizar admissão
    await salvarAdmissao.mutateAsync({
      id: adm.id,
      status: 'concluida',
      colaborador_id: (colab as any)?.id,
    })
  }

  function toggleDoc(doc: string) {
    if (!editItem) return
    const recebidos = [...(editItem.documentos_recebidos || [])]
    const pendentes = [...(editItem.documentos_pendentes || [])]
    if (recebidos.includes(doc)) {
      setEditItem({
        ...editItem,
        documentos_recebidos: recebidos.filter(d => d !== doc),
        documentos_pendentes: [...pendentes, doc],
      })
    } else {
      setEditItem({
        ...editItem,
        documentos_recebidos: [...recebidos, doc],
        documentos_pendentes: pendentes.filter(d => d !== doc),
      })
    }
  }

  const set = (k: string, v: any) => setEditItem(prev => prev ? { ...prev, [k]: v } : prev)

  const counts = {
    todas: admissoes.length,
    pendente: admissoes.filter(a => a.status === 'pendente').length,
    avaliacao_documentos: admissoes.filter(a => a.status === 'avaliacao_documentos').length,
    aguardando_cadastro: admissoes.filter(a => a.status === 'aguardando_cadastro').length,
    concluida: admissoes.filter(a => a.status === 'concluida').length,
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <UserPlus size={20} className="text-violet-400" />
            Admissão
          </h1>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline de admissão de novos colaboradores</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Nova Admissão
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <TabBtn label="Todas" count={counts.todas} active={activeTab === 'todas'} onClick={() => setActiveTab('todas')} isLight={isLight} />
        {STAGES.map(s => (
          <TabBtn key={s.key} label={s.label} count={counts[s.key]} active={activeTab === s.key}
            onClick={() => setActiveTab(s.key)} isLight={isLight} color={s.color} />
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <UserPlus size={40} className={isLight ? 'text-slate-200 mx-auto mb-3' : 'text-slate-600 mx-auto mb-3'} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma admissão encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(adm => {
            const stage = STAGES.find(s => s.key === adm.status) || STAGES[0]
            const Icon = stage.icon
            const docsTotal = (adm.documentos_pendentes?.length || 0) + (adm.documentos_recebidos?.length || 0)
            const docsOk = adm.documentos_recebidos?.length || 0
            return (
              <div key={adm.id} onClick={() => openEdit(adm)}
                className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
                  isLight ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isLight ? `${stage.bg}/10` : `${stage.bg}/20`
                  }`}>
                    <Icon size={18} className={stage.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{adm.nome_candidato}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {adm.cargo_previsto && (
                        <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Briefcase size={9} />{adm.cargo_previsto}
                        </span>
                      )}
                      {adm.tipo_contrato && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          adm.tipo_contrato === 'PJ'
                            ? isLight ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-400'
                            : isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/15 text-blue-400'
                        }`}>{adm.tipo_contrato}</span>
                      )}
                      {adm.data_prevista_inicio && (
                        <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Calendar size={9} />{new Date(adm.data_prevista_inicio).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {docsTotal > 0 && (
                        <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <FileText size={9} />{docsOk}/{docsTotal} docs
                        </span>
                      )}
                    </div>
                  </div>
                  {adm.status !== 'concluida' && adm.status !== 'cancelada' && (
                    <button onClick={e => { e.stopPropagation(); adm.status === 'aguardando_cadastro' ? handleConcluir(adm) : handleAvancar(adm) }}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                        adm.status === 'aguardando_cadastro'
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : isLight ? 'bg-violet-100 text-violet-600 hover:bg-violet-200' : 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                      }`}>
                      {adm.status === 'aguardando_cadastro' ? 'Concluir' : 'Avançar'}
                    </button>
                  )}
                  <ChevronRight size={14} className={`shrink-0 ${isLight ? 'text-slate-300 group-hover:text-violet-500' : 'text-slate-600 group-hover:text-violet-400'} transition-colors`} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowForm(false); setEditItem(null) }}>
          <div onClick={e => e.stopPropagation()}
            className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
            }`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${
              isLight ? 'bg-white border-slate-100' : 'bg-slate-900 border-slate-700'
            }`}>
              <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {editItem.id ? 'Editar Admissão' : 'Nova Admissão'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditItem(null) }}
                className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Dados básicos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Nome do Candidato *</label>
                  <input value={editItem.nome_candidato || ''} onChange={e => set('nome_candidato', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>CPF</label>
                  <input value={editItem.cpf || ''} onChange={e => set('cpf', e.target.value)} placeholder="000.000.000-00"
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tipo Contrato</label>
                  <select value={editItem.tipo_contrato || 'CLT'} onChange={e => set('tipo_contrato', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                    {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Cargo Previsto</label>
                  <input value={editItem.cargo_previsto || ''} onChange={e => set('cargo_previsto', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Departamento</label>
                  <input value={editItem.departamento_previsto || ''} onChange={e => set('departamento_previsto', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Obra</label>
                  <select value={editItem.obra_prevista_id || ''} onChange={e => set('obra_prevista_id', e.target.value || undefined)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                    <option value="">Nenhuma</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Salário Previsto</label>
                  <input type="number" step="0.01" value={editItem.salario_previsto || ''} onChange={e => set('salario_previsto', Number(e.target.value) || undefined)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Data Prevista Início</label>
                  <input type="date" value={editItem.data_prevista_inicio || ''} onChange={e => set('data_prevista_inicio', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
              </div>

              {/* Documentos checklist */}
              {editItem.id && (
                <div>
                  <label className={`block text-xs font-bold mb-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Documentos</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DOCUMENTOS_ADMISSAO.map(doc => {
                      const checked = editItem.documentos_recebidos?.includes(doc) || false
                      return (
                        <label key={doc} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                          checked
                            ? isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300'
                            : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05]'
                        }`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleDoc(doc)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                          <span className="font-medium">{doc}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Observações</label>
                <textarea rows={3} value={editItem.observacoes || ''} onChange={e => set('observacoes', e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
              </div>
            </div>

            <div className={`flex justify-end gap-2 px-5 py-4 border-t ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
              <button onClick={() => { setShowForm(false); setEditItem(null) }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'}`}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={salvarAdmissao.isPending || !editItem.nome_candidato}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50">
                {salvarAdmissao.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ label, count, active, onClick, isLight, color }: {
  label: string; count: number; active: boolean; onClick: () => void; isLight: boolean; color?: string
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
        active
          ? isLight ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
          : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-transparent'
      }`}>
      {label}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        active
          ? isLight ? 'bg-violet-200 text-violet-700' : 'bg-violet-500/30 text-violet-200'
          : isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-slate-500'
      }`}>{count}</span>
    </button>
  )
}
