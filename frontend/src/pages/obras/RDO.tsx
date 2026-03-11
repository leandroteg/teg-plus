import { useState } from 'react'
import { CloudSun, Plus, Filter, Users, Wrench, Pencil, Trash2, X, Check, Save } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useRDOs,
  useCriarRDO,
  useAtualizarRDO,
  useExcluirRDO,
} from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { ObraRDO, CondicaoClimatica, StatusRDO } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const WEATHER_ICON: Record<CondicaoClimatica, string> = {
  sol:          '\u2600\uFE0F',
  nublado:      '\u26C5',
  chuva:        '\uD83C\uDF27\uFE0F',
  chuva_forte:  '\u26C8\uFE0F',
  tempestade:   '\uD83C\uDF2A\uFE0F',
}

const WEATHER_LABEL: Record<CondicaoClimatica, string> = {
  sol:          'Sol',
  nublado:      'Nublado',
  chuva:        'Chuva',
  chuva_forte:  'Chuva Forte',
  tempestade:   'Tempestade',
}

const STATUS_CONFIG: Record<StatusRDO, { label: string; light: string; dark: string }> = {
  rascunho:   { label: 'Rascunho',   light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-300' },
  finalizado: { label: 'Finalizado', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
}

const EMPTY_FORM = {
  obra_id: '',
  data: new Date().toISOString().split('T')[0],
  condicao_climatica: 'sol' as CondicaoClimatica,
  efetivo_proprio: 0,
  efetivo_terceiro: 0,
  equipamentos_operando: 0,
  equipamentos_parados: 0,
  resumo_atividades: '',
  ocorrencias: '',
  horas_improdutivas: 0,
  motivo_improdutividade: '',
  status: 'rascunho' as StatusRDO,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RDO() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')

  const { data: rdos = [], isLoading } = useRDOs({
    obra_id: obraFilter || undefined,
  })

  const criarRDO = useCriarRDO()
  const atualizarRDO = useAtualizarRDO()
  const excluirRDO = useExcluirRDO()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ObraRDO | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (rdo: ObraRDO) => {
    setEditing(rdo)
    setForm({
      obra_id: rdo.obra_id,
      data: rdo.data,
      condicao_climatica: rdo.condicao_climatica,
      efetivo_proprio: rdo.efetivo_proprio,
      efetivo_terceiro: rdo.efetivo_terceiro,
      equipamentos_operando: rdo.equipamentos_operando,
      equipamentos_parados: rdo.equipamentos_parados,
      resumo_atividades: rdo.resumo_atividades ?? '',
      ocorrencias: rdo.ocorrencias ?? '',
      horas_improdutivas: rdo.horas_improdutivas,
      motivo_improdutividade: rdo.motivo_improdutividade ?? '',
      status: rdo.status,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    const payload = {
      obra_id: form.obra_id,
      data: form.data,
      condicao_climatica: form.condicao_climatica,
      efetivo_proprio: Number(form.efetivo_proprio),
      efetivo_terceiro: Number(form.efetivo_terceiro),
      equipamentos_operando: Number(form.equipamentos_operando),
      equipamentos_parados: Number(form.equipamentos_parados),
      resumo_atividades: form.resumo_atividades || null,
      ocorrencias: form.ocorrencias || null,
      horas_improdutivas: Number(form.horas_improdutivas),
      motivo_improdutividade: form.motivo_improdutividade || null,
      status: form.status,
    }
    if (editing) {
      await atualizarRDO.mutateAsync({ id: editing.id, ...payload })
    } else {
      await criarRDO.mutateAsync(payload)
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await excluirRDO.mutateAsync(id)
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

  const isSaving = criarRDO.isPending || atualizarRDO.isPending

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <CloudSun size={20} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
            RDO - Relatorio Diario de Obra
          </h1>
          <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {rdos.length} registros
          </p>
        </div>
        <button
          onClick={openCreate}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${isLight
            ? 'bg-teal-600 hover:bg-teal-700 shadow-sm'
            : 'bg-teal-600 hover:bg-teal-500'
          }`}
        >
          <Plus size={15} /> Novo RDO
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        <select value={obraFilter} onChange={e => setObraFilter(e.target.value)} className={selectClass}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
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
      ) : rdos.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight
          ? 'bg-white border-slate-200'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <CloudSun size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-200' : 'text-slate-700'}`} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum RDO encontrado
          </p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Crie um novo Relatorio Diario de Obra
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
                  <th className="text-center px-4 py-3">Clima</th>
                  <th className="text-center px-4 py-3">
                    <span className="flex items-center justify-center gap-1">
                      <Users size={12} /> Efetivo
                    </span>
                  </th>
                  <th className="text-center px-4 py-3">
                    <span className="flex items-center justify-center gap-1">
                      <Wrench size={12} /> Equip.
                    </span>
                  </th>
                  <th className="text-right px-4 py-3">Hrs Improd.</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {rdos.map(rdo => {
                  const st = STATUS_CONFIG[rdo.status] ?? STATUS_CONFIG.rascunho
                  const totalEfetivo = rdo.efetivo_proprio + rdo.efetivo_terceiro
                  const totalEquip = rdo.equipamentos_operando + rdo.equipamentos_parados
                  return (
                    <tr
                      key={rdo.id}
                      className={`border-b ${isLight
                        ? 'border-slate-100 hover:bg-slate-50'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                      } transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {fmtDate(rdo.data)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {rdo.obra?.nome ?? '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg" title={WEATHER_LABEL[rdo.condicao_climatica]}>
                          {WEATHER_ICON[rdo.condicao_climatica] ?? '\u2014'}
                        </span>
                        <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {WEATHER_LABEL[rdo.condicao_climatica]}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          {totalEfetivo}
                        </p>
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {rdo.efetivo_proprio}P + {rdo.efetivo_terceiro}T
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          {totalEquip}
                        </p>
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <span className="text-emerald-500">{rdo.equipamentos_operando}</span>
                          {' / '}
                          <span className={rdo.equipamentos_parados > 0 ? 'text-red-400' : ''}>{rdo.equipamentos_parados}</span>
                        </p>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${rdo.horas_improdutivas > 0
                        ? 'text-red-500 font-bold'
                        : isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {rdo.horas_improdutivas > 0 ? `${rdo.horas_improdutivas}h` : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(rdo)}
                            className={`p-1.5 rounded-lg transition-colors ${isLight
                              ? 'hover:bg-slate-100 text-slate-400 hover:text-blue-600'
                              : 'hover:bg-white/[0.06] text-slate-500 hover:text-blue-400'
                            }`}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          {deleteConfirm === rdo.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(rdo.id)}
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
                              onClick={() => setDeleteConfirm(rdo.id)}
                              className={`p-1.5 rounded-lg transition-colors ${isLight
                                ? 'hover:bg-red-50 text-red-400 hover:text-red-600'
                                : 'hover:bg-red-500/10 text-red-400 hover:text-red-500'
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
          <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-xl p-6 ${isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#1e293b] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {editing ? 'Editar RDO' : 'Novo RDO'}
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
                  <select value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Data *</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Condicao Climatica</label>
                  <select value={form.condicao_climatica} onChange={e => setForm(f => ({ ...f, condicao_climatica: e.target.value as CondicaoClimatica }))} className={inputClass}>
                    {Object.entries(WEATHER_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusRDO }))} className={inputClass}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Efetivo Proprio</label>
                  <input type="number" value={form.efetivo_proprio} onChange={e => setForm(f => ({ ...f, efetivo_proprio: Number(e.target.value) }))} className={inputClass} min={0} />
                </div>
                <div>
                  <label className={labelClass}>Efetivo Terceiro</label>
                  <input type="number" value={form.efetivo_terceiro} onChange={e => setForm(f => ({ ...f, efetivo_terceiro: Number(e.target.value) }))} className={inputClass} min={0} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Equip. Operando</label>
                  <input type="number" value={form.equipamentos_operando} onChange={e => setForm(f => ({ ...f, equipamentos_operando: Number(e.target.value) }))} className={inputClass} min={0} />
                </div>
                <div>
                  <label className={labelClass}>Equip. Parados</label>
                  <input type="number" value={form.equipamentos_parados} onChange={e => setForm(f => ({ ...f, equipamentos_parados: Number(e.target.value) }))} className={inputClass} min={0} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Resumo de Atividades</label>
                <textarea value={form.resumo_atividades} onChange={e => setForm(f => ({ ...f, resumo_atividades: e.target.value }))} rows={2} placeholder="Principais atividades do dia..." className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Ocorrencias</label>
                <textarea value={form.ocorrencias} onChange={e => setForm(f => ({ ...f, ocorrencias: e.target.value }))} rows={2} placeholder="Ocorrencias relevantes..." className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Horas Improdutivas</label>
                  <input type="number" value={form.horas_improdutivas} onChange={e => setForm(f => ({ ...f, horas_improdutivas: Number(e.target.value) }))} className={inputClass} min={0} step="0.5" />
                </div>
                <div>
                  <label className={labelClass}>Motivo Improdutividade</label>
                  <input type="text" value={form.motivo_improdutividade} onChange={e => setForm(f => ({ ...f, motivo_improdutividade: e.target.value }))} placeholder="Se houver..." className={inputClass} />
                </div>
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
                disabled={!form.obra_id || isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={15} />
                {isSaving ? 'Salvando...' : editing ? 'Salvar Alteracoes' : 'Criar RDO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
