// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHMovimentacoes.tsx — Nova Movimentação
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  TrendingUp, Plus, X, Calendar, DollarSign, Briefcase, Building2,
  HardHat, Search, User, ArrowRight, CheckCircle2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useRHColaboradores, useRHMovimentacoes, useSalvarRHMovimentacao } from '../../hooks/useRH'
import { useCadObras } from '../../hooks/useCadastros'
import type { RHMovimentacao, TipoMovimentacao } from '../../types/rh'
import { TIPOS_MOVIMENTACAO } from '../../types/rh'

export default function RHMovimentacoes() {
  const { isLightSidebar: isLight } = useTheme()
  const { perfil } = useAuth()
  const { data: movimentacoes = [], isLoading } = useRHMovimentacoes()
  const { data: colaboradores = [] } = useRHColaboradores({ ativo: true })
  const { data: obras = [] } = useCadObras()
  const salvar = useSalvarRHMovimentacao()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<RHMovimentacao>>({})
  const [buscaColab, setBuscaColab] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [success, setSuccess] = useState(false)

  const filteredMovs = filtroTipo ? movimentacoes.filter(m => m.tipo === filtroTipo) : movimentacoes

  const colabsFiltrados = buscaColab.trim()
    ? colaboradores.filter(c => c.nome.toLowerCase().includes(buscaColab.toLowerCase()) || c.matricula?.includes(buscaColab))
    : []

  function openNew() {
    setForm({
      data_efetivacao: new Date().toISOString().split('T')[0],
      registrado_por: perfil?.id,
    })
    setBuscaColab('')
    setShowForm(true)
    setSuccess(false)
  }

  function selectColab(id: string) {
    const c = colaboradores.find(x => x.id === id)
    if (!c) return
    setForm(f => ({
      ...f,
      colaborador_id: c.id,
      cargo_anterior: c.cargo,
      departamento_anterior: c.departamento,
      setor_anterior: c.setor,
      obra_anterior_id: c.obra_id,
      salario_anterior: c.salario,
    }))
    setBuscaColab(c.nome)
  }

  async function handleSave() {
    if (!form.colaborador_id || !form.tipo) return
    await salvar.mutateAsync(form)
    setSuccess(true)
    setTimeout(() => {
      setShowForm(false)
      setSuccess(false)
    }, 1500)
  }

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const selectedColab = form.colaborador_id ? colaboradores.find(c => c.id === form.colaborador_id) : null

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <TrendingUp size={20} className="text-violet-400" />
            Movimentações
          </h1>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Promoções, transferências, reajustes e outros</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Nova Movimentação
        </button>
      </div>

      {/* Filtro por tipo */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setFiltroTipo('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            !filtroTipo
              ? isLight ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-transparent'
          }`}>
          Todas ({movimentacoes.length})
        </button>
        {TIPOS_MOVIMENTACAO.map(t => {
          const count = movimentacoes.filter(m => m.tipo === t.value).length
          if (count === 0) return null
          return (
            <button key={t.value} onClick={() => setFiltroTipo(t.value)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filtroTipo === t.value
                  ? isLight ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-transparent'
              }`}>
              <span>{t.icon}</span> {t.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredMovs.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <TrendingUp size={40} className={isLight ? 'text-slate-200 mx-auto mb-3' : 'text-slate-600 mx-auto mb-3'} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma movimentação registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMovs.map(mov => {
            const tipoInfo = TIPOS_MOVIMENTACAO.find(t => t.value === mov.tipo)
            return (
              <div key={mov.id} className={`rounded-2xl border p-4 ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${
                    isLight ? 'bg-violet-50 border border-violet-100' : 'bg-violet-500/15 border border-violet-500/20'
                  }`}>
                    {tipoInfo?.icon || '📝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{tipoInfo?.label || mov.tipo}</p>
                      <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(mov.data_efetivacao).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-violet-600' : 'text-violet-400'}`}>
                      {mov.colaborador?.nome || '—'}
                      {mov.colaborador?.matricula && ` (${mov.colaborador.matricula})`}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                      {mov.cargo_anterior && mov.cargo_novo && (
                        <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Briefcase size={9} />{mov.cargo_anterior} <ArrowRight size={8} /> {mov.cargo_novo}
                        </span>
                      )}
                      {mov.departamento_anterior && mov.departamento_novo && (
                        <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Building2 size={9} />{mov.departamento_anterior} <ArrowRight size={8} /> {mov.departamento_novo}
                        </span>
                      )}
                      {mov.salario_anterior != null && mov.salario_novo != null && (
                        <span className={`text-[10px] flex items-center gap-1 ${
                          mov.salario_novo > mov.salario_anterior
                            ? 'text-emerald-500'
                            : isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          <DollarSign size={9} />
                          R$ {mov.salario_anterior.toLocaleString('pt-BR')} <ArrowRight size={8} /> R$ {mov.salario_novo.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                    {mov.motivo && (
                      <p className={`text-[10px] mt-1 italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>"{mov.motivo}"</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Nova Movimentação */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()}
            className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
            }`}>

            {success ? (
              <div className="flex flex-col items-center justify-center p-12 gap-3">
                <CheckCircle2 size={48} className="text-emerald-500" />
                <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Movimentação registrada!</p>
              </div>
            ) : (
              <>
                <div className={`flex items-center justify-between px-5 py-4 border-b ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
                  <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Nova Movimentação</h2>
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
                        placeholder="Buscar por nome ou matrícula..."
                        className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                    </div>
                    {colabsFiltrados.length > 0 && !form.colaborador_id && (
                      <div className={`mt-1 rounded-xl border max-h-40 overflow-y-auto ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800'}`}>
                        {colabsFiltrados.slice(0, 8).map(c => (
                          <button key={c.id} onClick={() => selectColab(c.id)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 flex items-center gap-2 ${
                              isLight ? 'text-slate-700' : 'text-slate-300'
                            }`}>
                            <User size={12} className="text-violet-400" />
                            <span className="font-semibold">{c.nome}</span>
                            {c.matricula && <span className="text-slate-400">({c.matricula})</span>}
                            {c.cargo && <span className="text-slate-400">• {c.cargo}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedColab && (
                      <div className={`mt-1.5 px-3 py-2 rounded-xl text-xs ${
                        isLight ? 'bg-violet-50 text-violet-700' : 'bg-violet-500/10 text-violet-300'
                      }`}>
                        Selecionado: <strong>{selectedColab.nome}</strong> — {selectedColab.cargo || 'Sem cargo'} — {selectedColab.departamento || 'Sem dept'}
                        {selectedColab.salario != null && ` — R$ ${selectedColab.salario.toLocaleString('pt-BR')}`}
                      </div>
                    )}
                  </div>

                  {/* Tipo */}
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tipo de Movimentação *</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TIPOS_MOVIMENTACAO.map(t => (
                        <button key={t.value} onClick={() => set('tipo', t.value)}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                            form.tipo === t.value
                              ? isLight ? 'bg-violet-100 text-violet-700 border border-violet-300' : 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                              : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-white/10'
                          }`}>
                          <span>{t.icon}</span> {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data efetivação */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Data Efetivação</label>
                      <input type="date" value={form.data_efetivacao || ''} onChange={e => set('data_efetivacao', e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                    </div>
                  </div>

                  {/* Campos condicionais por tipo */}
                  {(form.tipo === 'promocao' || form.tipo === 'mudanca_cargo') && (
                    <div>
                      <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Novo Cargo</label>
                      <input value={form.cargo_novo || ''} onChange={e => set('cargo_novo', e.target.value)}
                        placeholder={form.cargo_anterior ? `Atual: ${form.cargo_anterior}` : 'Novo cargo'}
                        className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                    </div>
                  )}

                  {(form.tipo === 'transferencia' || form.tipo === 'mudanca_departamento') && (
                    <div>
                      <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Novo Departamento</label>
                      <input value={form.departamento_novo || ''} onChange={e => set('departamento_novo', e.target.value)}
                        placeholder={form.departamento_anterior ? `Atual: ${form.departamento_anterior}` : 'Novo departamento'}
                        className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                    </div>
                  )}

                  {form.tipo === 'mudanca_obra' && (
                    <div>
                      <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Nova Obra</label>
                      <select value={form.obra_nova_id || ''} onChange={e => set('obra_nova_id', e.target.value || undefined)}
                        className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                        <option value="">Selecione</option>
                        {obras.map(o => <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>)}
                      </select>
                    </div>
                  )}

                  {(form.tipo === 'reajuste' || form.tipo === 'promocao') && (
                    <div>
                      <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Novo Salário</label>
                      <input type="number" step="0.01" value={form.salario_novo || ''} onChange={e => set('salario_novo', Number(e.target.value) || undefined)}
                        placeholder={form.salario_anterior ? `Atual: R$ ${form.salario_anterior.toLocaleString('pt-BR')}` : 'Novo salário'}
                        className={`w-full px-3 py-2 rounded-xl border text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
                    </div>
                  )}

                  {/* Motivo */}
                  <div>
                    <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Motivo / Justificativa</label>
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
                  <button onClick={handleSave} disabled={salvar.isPending || !form.colaborador_id || !form.tipo}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50">
                    {salvar.isPending ? 'Registrando...' : 'Registrar Movimentação'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
