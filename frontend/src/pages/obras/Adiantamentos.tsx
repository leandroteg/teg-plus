import { useState } from 'react'
import { Wallet, Plus, Filter, CheckCircle2, X, Save } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useAdiantamentos,
  useCriarAdiantamento,
  useAtualizarAdiantamento,
  useAprovarAdiantamento,
} from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import NumericInput from '../../components/NumericInput'
import { supabase } from '../../services/supabase'
import type { StatusAdiantamento } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<StatusAdiantamento, { label: string; light: string; dark: string }> = {
  solicitado: { label: 'Solicitado', light: 'bg-blue-100 text-blue-700',       dark: 'bg-blue-500/15 text-blue-300' },
  aprovado:   { label: 'Aprovado',   light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
  parcial:    { label: 'Parcial',    light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-300' },
  prestado:   { label: 'Prestado',   light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
  vencido:    { label: 'Vencido',    light: 'bg-red-100 text-red-700',         dark: 'bg-red-500/15 text-red-300' },
}

const BORDER_ACCENT: Record<string, string> = {
  blue: 'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
}

function SummaryCard({ label, value, accent, isLight }: {
  label: string; value: string; accent: string; isLight: boolean
}) {
  const borderAccent = BORDER_ACCENT[accent] ?? 'border-l-blue-500'
  return (
    <div className={`rounded-2xl border p-4 border-l-4 ${borderAccent} ${isLight
      ? 'bg-white border-slate-200 shadow-sm'
      : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <p className={`text-[11px] uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        {label}
      </p>
      <p className={`text-xl font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
        {value}
      </p>
    </div>
  )
}

const EMPTY_FORM = {
  obra_id: '',
  valor_solicitado: 0,
  finalidade: '',
  data_limite_prestacao: '',
  observacoes: '',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Adiantamentos() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: adiantamentos = [], isLoading } = useAdiantamentos({
    obra_id: obraFilter || undefined,
    status: statusFilter || undefined,
  })

  const criarAdiantamento = useCriarAdiantamento()
  const atualizarAdiantamento = useAtualizarAdiantamento()
  const aprovarAdiantamento = useAprovarAdiantamento()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [approveVal, setApproveVal] = useState(0)

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setShowCreateModal(true)
  }

  const handleCreate = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    await criarAdiantamento.mutateAsync({
      obra_id: form.obra_id,
      solicitante_id: user?.id ?? '',
      valor_solicitado: Number(form.valor_solicitado),
      valor_aprovado: 0,
      valor_prestado_contas: 0,
      saldo_pendente: 0,
      finalidade: form.finalidade,
      data_solicitacao: new Date().toISOString().split('T')[0],
      data_limite_prestacao: form.data_limite_prestacao || null,
      status: 'solicitado',
      observacoes: form.observacoes || null,
    })
    setShowCreateModal(false)
  }

  const openApprove = (id: string, valorSolicitado: number) => {
    setShowApproveModal(id)
    setApproveVal(valorSolicitado)
  }

  const handleApprove = async () => {
    if (!showApproveModal) return
    const { data: { user } } = await supabase.auth.getUser()
    await aprovarAdiantamento.mutateAsync({
      id: showApproveModal,
      aprovado_por: user?.id ?? '',
      valor_aprovado: Number(approveVal),
    })
    setShowApproveModal(null)
  }

  // Summary calculations
  const totalSolicitado = adiantamentos.reduce((s, a) => s + (a.valor_solicitado ?? 0), 0)
  const totalAprovado = adiantamentos.reduce((s, a) => s + (a.valor_aprovado ?? 0), 0)
  const totalSaldoPendente = adiantamentos.reduce((s, a) => s + (a.saldo_pendente ?? 0), 0)

  const selectClass = `px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-600'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-300 [&>option]:bg-slate-900'
  }`

  const inputClass = `w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-700'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-200 placeholder:text-slate-500'
  }`

  const labelClass = `block text-xs font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`

  // Keep atualizarAdiantamento wired (used when needed in future status updates)
  void atualizarAdiantamento

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Wallet size={20} className={isLight ? 'text-violet-600' : 'text-violet-400'} />
            Adiantamentos
          </h1>
          <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {adiantamentos.length} registros
          </p>
        </div>
        <button
          onClick={openCreate}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${isLight
            ? 'bg-teal-600 hover:bg-teal-700 shadow-sm'
            : 'bg-teal-600 hover:bg-teal-500'
          }`}
        >
          <Plus size={15} /> Novo Adiantamento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Solicitado" value={BRL(totalSolicitado)} accent="blue" isLight={isLight} />
        <SummaryCard label="Total Aprovado" value={BRL(totalAprovado)} accent="emerald" isLight={isLight} />
        <SummaryCard label="Saldo Pendente" value={BRL(totalSaldoPendente)} accent="amber" isLight={isLight} />
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
      ) : adiantamentos.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight
          ? 'bg-white border-slate-200'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Wallet size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-200' : 'text-slate-700'}`} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum adiantamento encontrado
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
                  <th className="text-left px-4 py-3">Obra</th>
                  <th className="text-left px-4 py-3">Solicitante</th>
                  <th className="text-left px-4 py-3">Finalidade</th>
                  <th className="text-right px-4 py-3">Solicitado</th>
                  <th className="text-right px-4 py-3">Aprovado</th>
                  <th className="text-right px-4 py-3">Saldo Pend.</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Limite</th>
                  <th className="text-center px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {adiantamentos.map(ad => {
                  const st = STATUS_CONFIG[ad.status] ?? STATUS_CONFIG.solicitado
                  const isVencido = ad.data_limite_prestacao && new Date(ad.data_limite_prestacao) < new Date()
                  return (
                    <tr
                      key={ad.id}
                      className={`border-b ${isLight
                        ? 'border-slate-100 hover:bg-slate-50'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                      } transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {ad.obra?.nome ?? '\u2014'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {ad.solicitante?.nome ?? '\u2014'}
                      </td>
                      <td className={`px-4 py-3 text-sm max-w-[180px] truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        {ad.finalidade}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {BRL(ad.valor_solicitado)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        {ad.valor_aprovado > 0 ? BRL(ad.valor_aprovado) : '\u2014'}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${ad.saldo_pendente > 0
                        ? (isLight ? 'text-amber-700' : 'text-amber-400')
                        : (isLight ? 'text-slate-400' : 'text-slate-500')
                      }`}>
                        {ad.saldo_pendente > 0 ? BRL(ad.saldo_pendente) : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${isVencido
                        ? 'text-red-500 font-bold'
                        : isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {ad.data_limite_prestacao ? fmtDate(ad.data_limite_prestacao) : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ad.status === 'solicitado' && (
                          <button
                            onClick={() => openApprove(ad.id, ad.valor_solicitado)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isLight
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                            title="Aprovar adiantamento"
                          >
                            <CheckCircle2 size={13} /> Aprovar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border shadow-xl p-6 ${isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#1e293b] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Novo Adiantamento</h2>
              <button onClick={() => setShowCreateModal(false)} className={`p-1.5 rounded-lg transition-colors ${isLight
                ? 'hover:bg-slate-100 text-slate-400'
                : 'hover:bg-white/[0.06] text-slate-500'
              }`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Obra *</label>
                <select value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))} className={inputClass}>
                  <option value="">Selecione...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Valor Solicitado (R$) *</label>
                <NumericInput value={form.valor_solicitado} onChange={v => setForm(f => ({ ...f, valor_solicitado: v }))} className={inputClass} min={0} step={0.01} />
              </div>
              <div>
                <label className={labelClass}>Finalidade *</label>
                <textarea value={form.finalidade} onChange={e => setForm(f => ({ ...f, finalidade: e.target.value }))} rows={2} placeholder="Finalidade do adiantamento..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Data Limite Prestacao</label>
                <input type="date" value={form.data_limite_prestacao} onChange={e => setForm(f => ({ ...f, data_limite_prestacao: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Observacoes</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Opcional..." className={inputClass} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-white/[0.06]'
              }`}>
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.obra_id || !form.finalidade || form.valor_solicitado <= 0 || criarAdiantamento.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={15} />
                {criarAdiantamento.isPending ? 'Salvando...' : 'Solicitar Adiantamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApproveModal(null)} />
          <div className={`relative w-full max-w-sm rounded-2xl border shadow-xl p-6 ${isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#1e293b] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Aprovar Adiantamento</h2>
              <button onClick={() => setShowApproveModal(null)} className={`p-1.5 rounded-lg transition-colors ${isLight
                ? 'hover:bg-slate-100 text-slate-400'
                : 'hover:bg-white/[0.06] text-slate-500'
              }`}>
                <X size={18} />
              </button>
            </div>
            <div>
              <label className={labelClass}>Valor Aprovado (R$) *</label>
              <NumericInput value={approveVal} onChange={setApproveVal} className={inputClass} min={0} step={0.01} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowApproveModal(null)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-white/[0.06]'
              }`}>
                Cancelar
              </button>
              <button
                onClick={handleApprove}
                disabled={approveVal <= 0 || aprovarAdiantamento.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle2 size={15} />
                {aprovarAdiantamento.isPending ? 'Aprovando...' : 'Confirmar Aprovacao'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
