// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHDesligamento.tsx — Fluxo de Desligamento
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  UserMinus, Plus, X, Search, User, Calendar, CheckSquare,
  Square, ChevronRight, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useRHColaboradores, useRHDesligamentos, useSalvarRHDesligamento } from '../../hooks/useRH'
import type { RHDesligamento, StatusDesligamento } from '../../types/rh'
import { TIPOS_DESLIGAMENTO, CHECKLIST_DESLIGAMENTO } from '../../types/rh'

export default function RHDesligamento() {
  const { isLightSidebar: isLight } = useTheme()
  const { perfil } = useAuth()
  const { data: desligamentos = [], isLoading } = useRHDesligamentos()
  const { data: colaboradores = [] } = useRHColaboradores({ ativo: true })
  const salvar = useSalvarRHDesligamento()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<RHDesligamento>>({})
  const [buscaColab, setBuscaColab] = useState('')
  const [activeTab, setActiveTab] = useState<StatusDesligamento | 'todos'>('todos')
  const [editDetail, setEditDetail] = useState<RHDesligamento | null>(null)

  const filtered = activeTab === 'todos' ? desligamentos : desligamentos.filter(d => d.status === activeTab)

  const colabsFiltrados = buscaColab.trim()
    ? colaboradores.filter(c => c.nome.toLowerCase().includes(buscaColab.toLowerCase()))
    : []

  function openNew() {
    setForm({
      tipo: 'sem_justa_causa',
      data_desligamento: new Date().toISOString().split('T')[0],
      cumpriu_aviso: true,
      checklist: Object.fromEntries(Object.keys(CHECKLIST_DESLIGAMENTO).map(k => [k, false])),
      registrado_por: perfil?.id,
      status: 'em_andamento',
    })
    setBuscaColab('')
    setShowForm(true)
  }

  function selectColab(id: string) {
    const c = colaboradores.find(x => x.id === id)
    if (!c) return
    setForm(f => ({ ...f, colaborador_id: c.id }))
    setBuscaColab(c.nome)
  }

  async function handleSave() {
    if (!form.colaborador_id || !form.data_desligamento) return
    await salvar.mutateAsync(form)
    setShowForm(false)
  }

  async function toggleCheckItem(desl: RHDesligamento, key: string) {
    const checklist = { ...(desl.checklist || {}) }
    checklist[key] = !checklist[key]
    await salvar.mutateAsync({ id: desl.id, checklist })
  }

  async function concluirDesligamento(desl: RHDesligamento) {
    await salvar.mutateAsync({
      id: desl.id,
      status: 'concluido',
      colaborador_id: desl.colaborador_id,
      data_desligamento: desl.data_desligamento,
      motivo: desl.motivo,
    })
    setEditDetail(null)
  }

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const counts = {
    todos: desligamentos.length,
    em_andamento: desligamentos.filter(d => d.status === 'em_andamento').length,
    concluido: desligamentos.filter(d => d.status === 'concluido').length,
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <UserMinus size={20} className="text-red-400" />
            Desligamento
          </h1>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Fluxo de offboarding de colaboradores</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Novo Desligamento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {[
          { key: 'todos' as const, label: 'Todos', count: counts.todos },
          { key: 'em_andamento' as const, label: 'Em Andamento', count: counts.em_andamento },
          { key: 'concluido' as const, label: 'Concluídos', count: counts.concluido },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === t.key
                ? isLight ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-transparent'
            }`}>
            {t.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === t.key
                ? isLight ? 'bg-red-200 text-red-700' : 'bg-red-500/30 text-red-200'
                : isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-slate-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <UserMinus size={40} className={isLight ? 'text-slate-200 mx-auto mb-3' : 'text-slate-600 mx-auto mb-3'} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum desligamento encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(desl => {
            const checkTotal = Object.keys(CHECKLIST_DESLIGAMENTO).length
            const checkDone = Object.values(desl.checklist || {}).filter(Boolean).length
            const tipoLabel = TIPOS_DESLIGAMENTO.find(t => t.value === desl.tipo)?.label || desl.tipo
            return (
              <div key={desl.id} onClick={() => setEditDetail(desl)}
                className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
                  isLight ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    desl.status === 'concluido'
                      ? isLight ? 'bg-emerald-50 border border-emerald-100' : 'bg-emerald-500/15 border border-emerald-500/20'
                      : isLight ? 'bg-red-50 border border-red-100' : 'bg-red-500/15 border border-red-500/20'
                  }`}>
                    {desl.status === 'concluido'
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : <Clock size={18} className="text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {desl.colaborador?.nome || '—'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        isLight ? 'bg-red-50 text-red-600' : 'bg-red-500/15 text-red-400'
                      }`}>{tipoLabel}</span>
                      <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Calendar size={9} />{new Date(desl.data_desligamento).toLocaleDateString('pt-BR')}
                      </span>
                      {desl.colaborador?.cargo && (
                        <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{desl.colaborador.cargo}</span>
                      )}
                      <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        Checklist: {checkDone}/{checkTotal}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className={`shrink-0 ${isLight ? 'text-slate-300' : 'text-slate-600'} transition-colors`} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Detalhe/Checklist */}
      {editDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditDetail(null)}>
          <div onClick={e => e.stopPropagation()}
            className={`w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
            }`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
              <div>
                <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{editDetail.colaborador?.nome}</h2>
                <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {TIPOS_DESLIGAMENTO.find(t => t.value === editDetail.tipo)?.label} — {new Date(editDetail.data_desligamento).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button onClick={() => setEditDetail(null)} className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className={`text-xs font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Checklist de Desligamento</p>
              {Object.entries(CHECKLIST_DESLIGAMENTO).map(([key, label]) => {
                const checked = editDetail.checklist?.[key] || false
                return (
                  <button key={key} onClick={() => editDetail.status !== 'concluido' && toggleCheckItem(editDetail, key)}
                    disabled={editDetail.status === 'concluido'}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      checked
                        ? isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20'
                        : isLight ? 'bg-slate-50 border border-slate-200 hover:bg-slate-100' : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]'
                    } ${editDetail.status === 'concluido' ? 'cursor-default' : 'cursor-pointer'}`}>
                    {checked ? (
                      <CheckSquare size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <Square size={16} className={`shrink-0 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                    )}
                    <span className={`text-xs font-medium ${
                      checked
                        ? isLight ? 'text-emerald-700' : 'text-emerald-300'
                        : isLight ? 'text-slate-600' : 'text-slate-400'
                    }`}>{label}</span>
                  </button>
                )
              })}

              {editDetail.motivo && (
                <div className={`mt-3 p-3 rounded-xl ${isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                  <p className={`text-[10px] font-bold mb-0.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>Motivo</p>
                  <p className={`text-xs ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>{editDetail.motivo}</p>
                </div>
              )}
            </div>

            {editDetail.status === 'em_andamento' && (
              <div className={`px-5 py-4 border-t ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
                <button onClick={() => concluirDesligamento(editDetail)}
                  disabled={salvar.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                  <CheckCircle2 size={15} /> Concluir Desligamento
                </button>
                <p className={`text-[10px] text-center mt-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Isso irá inativar o colaborador no sistema
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Novo Desligamento */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()}
            className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
            }`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
              <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Novo Desligamento</h2>
              <button onClick={() => setShowForm(false)} className={`p-1.5 rounded-lg ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Buscar colaborador */}
              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Colaborador *</label>
                <div className="relative">
                  <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input value={buscaColab} onChange={e => { setBuscaColab(e.target.value); if (form.colaborador_id) setForm(f => ({ ...f, colaborador_id: undefined })) }}
                    placeholder="Buscar colaborador..."
                    className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
                {colabsFiltrados.length > 0 && !form.colaborador_id && (
                  <div className={`mt-1 rounded-xl border max-h-40 overflow-y-auto ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800'}`}>
                    {colabsFiltrados.slice(0, 8).map(c => (
                      <button key={c.id} onClick={() => selectColab(c.id)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 ${
                          isLight ? 'text-slate-700' : 'text-slate-300'
                        }`}>
                        <User size={12} className="text-red-400" />
                        <span className="font-semibold">{c.nome}</span>
                        {c.cargo && <span className="text-slate-400">• {c.cargo}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tipo *</label>
                  <select value={form.tipo || ''} onChange={e => set('tipo', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                    {TIPOS_DESLIGAMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Data Desligamento *</label>
                  <input type="date" value={form.data_desligamento || ''} onChange={e => set('data_desligamento', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Data Aviso</label>
                  <input type="date" value={form.data_aviso || ''} onChange={e => set('data_aviso', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input type="checkbox" checked={form.cumpriu_aviso ?? true} onChange={e => set('cumpriu_aviso', e.target.checked)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500" />
                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Cumpriu aviso prévio</span>
                  </label>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Motivo</label>
                <textarea rows={2} value={form.motivo || ''} onChange={e => set('motivo', e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Observações</label>
                <textarea rows={2} value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
              </div>
            </div>

            <div className={`flex justify-end gap-2 px-5 py-4 border-t ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
              <button onClick={() => setShowForm(false)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'}`}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={salvar.isPending || !form.colaborador_id}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
                {salvar.isPending ? 'Salvando...' : 'Iniciar Desligamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
