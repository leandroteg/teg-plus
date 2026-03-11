import { useState } from 'react'
import { ClipboardList, Plus, Filter, Pencil, Trash2, X, Check, Save } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useApontamentos,
  useCriarApontamento,
  useAtualizarApontamento,
  useExcluirApontamento,
  useObrasFrentes,
} from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { ObraApontamento, StatusApontamento } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<StatusApontamento, { label: string; light: string; dark: string }> = {
  rascunho:   { label: 'Rascunho',   light: 'bg-slate-100 text-slate-600',       dark: 'bg-slate-500/15 text-slate-400' },
  confirmado: { label: 'Confirmado', light: 'bg-blue-100 text-blue-700',         dark: 'bg-blue-500/15 text-blue-300' },
  validado:   { label: 'Validado',   light: 'bg-emerald-100 text-emerald-700',   dark: 'bg-emerald-500/15 text-emerald-300' },
}

const EMPTY_FORM = {
  obra_id: '',
  frente_id: '',
  data_apontamento: new Date().toISOString().split('T')[0],
  atividade: '',
  quantidade_executada: 0,
  unidade: 'un',
  horas_trabalhadas: 0,
  observacoes: '',
  status: 'rascunho' as StatusApontamento,
}

// ── Frente Selector (sub-component) ─────────────────────────────────────────

function FrenteSelect({
  obraId, value, onChange, isLight, selectClass,
}: {
  obraId: string; value: string; onChange: (v: string) => void; isLight: boolean; selectClass: string
}) {
  const { data: frentes = [] } = useObrasFrentes(obraId || undefined)
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={selectClass}>
      <option value="">Sem frente</option>
      {frentes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
    </select>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Apontamentos() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: apontamentos = [], isLoading } = useApontamentos({
    obra_id: obraFilter || undefined,
    status: statusFilter || undefined,
  })

  const criarApontamento = useCriarApontamento()
  const atualizarApontamento = useAtualizarApontamento()
  const excluirApontamento = useExcluirApontamento()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ObraApontamento | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (ap: ObraApontamento) => {
    setEditing(ap)
    setForm({
      obra_id: ap.obra_id,
      frente_id: ap.frente_id ?? '',
      data_apontamento: ap.data_apontamento,
      atividade: ap.atividade,
      quantidade_executada: ap.quantidade_executada,
      unidade: ap.unidade ?? 'un',
      horas_trabalhadas: ap.horas_trabalhadas,
      observacoes: ap.observacoes ?? '',
      status: ap.status,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    const payload = {
      obra_id: form.obra_id,
      frente_id: form.frente_id || null,
      data_apontamento: form.data_apontamento,
      atividade: form.atividade,
      quantidade_executada: Number(form.quantidade_executada),
      unidade: form.unidade,
      horas_trabalhadas: Number(form.horas_trabalhadas),
      observacoes: form.observacoes || null,
      status: form.status,
    }
    if (editing) {
      await atualizarApontamento.mutateAsync({ id: editing.id, ...payload })
    } else {
      await criarApontamento.mutateAsync(payload)
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await excluirApontamento.mutateAsync(id)
    setDeleteConfirm(null)
  }

  const selectClass = `px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-600'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-300 [&>option]:bg-slate-900'
  }`

  const inputClass = `w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-700'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-200 placeholder:text-slate-500'
  }`

  const labelClass = `block text-xs font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`

  const isSaving = criarApontamento.isPending || atualizarApontamento.isPending

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <ClipboardList size={20} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            Apontamentos
          </h1>
          <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {apontamentos.length} registros
          </p>
        </div>
        <button
          onClick={openCreate}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${isLight
            ? 'bg-teal-600 hover:bg-teal-700 shadow-sm'
            : 'bg-teal-600 hover:bg-teal-500'
          }`}
        >
          <Plus size={15} /> Novo Apontamento
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        <select value={obraFilter} onChange={e => setObraFilter(e.target.value)} className={selectClass}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className={`w-8 h-8 border-[3px] rounded-full animate-spin ${isLight
            ? 'border-teal-500 border-t-transparent'
            : 'border-teal-400 border-t-transparent'
          }`} />
        </div>
      ) : apontamentos.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight
          ? 'bg-white border-slate-200'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <ClipboardList size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-200' : 'text-slate-700'}`} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum apontamento encontrado
          </p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Ajuste os filtros ou crie um novo apontamento
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${isLight
                  ? 'bg-slate-50 text-slate-600'
                  : 'bg-white/[0.02] text-slate-400'
                } text-xs font-semibold uppercase tracking-wider`}>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Obra</th>
                  <th className="text-left px-4 py-3">Frente</th>
                  <th className="text-left px-4 py-3">Atividade</th>
                  <th className="text-right px-4 py-3">Qtd.</th>
                  <th className="text-left px-4 py-3">Unidade</th>
                  <th className="text-right px-4 py-3">Horas</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.map(ap => {
                  const st = STATUS_CONFIG[ap.status] ?? STATUS_CONFIG.rascunho
                  return (
                    <tr
                      key={ap.id}
                      className={`border-b ${isLight
                        ? 'border-slate-100 hover:bg-slate-50'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                      } transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {fmtDate(ap.data_apontamento)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {ap.obra?.nome ?? '\u2014'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {ap.frente?.nome ?? '\u2014'}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium max-w-[200px] truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {ap.atividade}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {ap.quantidade_executada.toLocaleString('pt-BR')}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {ap.unidade ?? '\u2014'}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {ap.horas_trabalhadas}h
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(ap)}
                            className={`p-1.5 rounded-lg transition-colors ${isLight
                              ? 'hover:bg-slate-100 text-slate-400 hover:text-blue-600'
                              : 'hover:bg-white/[0.06] text-slate-500 hover:text-blue-400'
                            }`}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          {deleteConfirm === ap.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(ap.id)}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                title="Confirmar exclusao"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className={`p-1.5 rounded-lg transition-colors ${isLight
                                  ? 'hover:bg-slate-100 text-slate-400'
                                  : 'hover:bg-white/[0.06] text-slate-500'
                                }`}
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(ap.id)}
                              className={`p-1.5 rounded-lg transition-colors ${isLight
                                ? 'hover:bg-red-50 text-slate-400 hover:text-red-600'
                                : 'hover:bg-red-500/10 text-slate-500 hover:text-red-400'
                              }`}
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className={`relative w-full max-w-lg rounded-2xl border shadow-xl p-6 ${isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#1e293b] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {editing ? 'Editar Apontamento' : 'Novo Apontamento'}
              </h2>
              <button onClick={() => setShowModal(false)} className={`p-1.5 rounded-lg transition-colors ${isLight
                ? 'hover:bg-slate-100 text-slate-400'
                : 'hover:bg-white/[0.06] text-slate-500'
              }`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Obra *</label>
                  <select value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value, frente_id: '' }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Frente</label>
                  <FrenteSelect
                    obraId={form.obra_id}
                    value={form.frente_id}
                    onChange={v => setForm(f => ({ ...f, frente_id: v }))}
                    isLight={isLight}
                    selectClass={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Data *</label>
                  <input type="date" value={form.data_apontamento} onChange={e => setForm(f => ({ ...f, data_apontamento: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusApontamento }))} className={inputClass}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Atividade *</label>
                <input type="text" value={form.atividade} onChange={e => setForm(f => ({ ...f, atividade: e.target.value }))} placeholder="Descricao da atividade" className={inputClass} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Quantidade *</label>
                  <input type="number" value={form.quantidade_executada} onChange={e => setForm(f => ({ ...f, quantidade_executada: Number(e.target.value) }))} className={inputClass} min={0} step="0.01" />
                </div>
                <div>
                  <label className={labelClass}>Unidade</label>
                  <input type="text" value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="un, m, kg..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Horas Trab.</label>
                  <input type="number" value={form.horas_trabalhadas} onChange={e => setForm(f => ({ ...f, horas_trabalhadas: Number(e.target.value) }))} className={inputClass} min={0} step="0.5" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Observacoes</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Observacoes opcionais..." className={inputClass} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-white/[0.06]'
              }`}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.obra_id || !form.atividade || isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={15} />
                {isSaving ? 'Salvando...' : editing ? 'Salvar Alteracoes' : 'Criar Apontamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
