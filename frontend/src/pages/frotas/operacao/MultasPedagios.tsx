import { useState } from 'react'
import { AlertCircle, Plus, X, AlertTriangle } from 'lucide-react'
import { UpperInput, UpperTextarea } from '../../../components/UpperInput'
import { useMultas, useSalvarMulta, useVeiculos } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroMulta, StatusMulta, TipoMulta } from '../../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function isVencido(data?: string): boolean {
  if (!data) return false
  return new Date(data) < new Date()
}

const STATUS_BADGE: Record<StatusMulta, string> = {
  recebida:   'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  contestada: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  paga:       'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  vencida:    'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  cancelada:  'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
}

const STATUS_LABEL: Record<StatusMulta, string> = {
  recebida: 'Recebida', contestada: 'Contestada', paga: 'Paga',
  vencida: 'Vencida', cancelada: 'Cancelada',
}

// ── Registrar Modal ───────────────────────────────────────────────────────────
function RegistrarModal({
  onClose,
  isLight,
}: {
  onClose: () => void
  isLight: boolean
}) {
  const salvar = useSalvarMulta()
  const { data: veiculos = [] } = useVeiculos()
  const [form, setForm] = useState({
    tipo: 'multa' as TipoMulta,
    veiculo_id: '',
    data_infracao: '',
    data_vencimento: '',
    valor: '',
    ait: '',
    descricao: '',
    observacoes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await salvar.mutateAsync({
      tipo: form.tipo,
      veiculo_id: form.veiculo_id,
      data_infracao: form.data_infracao || undefined,
      data_vencimento: form.data_vencimento || undefined,
      valor: +form.valor,
      ait: form.ait || undefined,
      descricao: form.descricao || undefined,
      observacoes: form.observacoes || undefined,
      status: 'recebida',
    })
    onClose()
  }

  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
      : 'bg-white/6 border border-white/12 text-white'
  }`
  const sel = inp + (isLight ? '' : ' [&>option]:bg-slate-900')
  const lbl = `block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 ${
          isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Registrar Multa / Pedágio
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isLight
                ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Tipo *</label>
            <select
              className={sel}
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoMulta }))}
              required
            >
              <option value="multa">Multa</option>
              <option value="pedagio">Pedágio</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Veículo *</label>
            <select
              className={sel}
              value={form.veiculo_id}
              onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))}
              required
            >
              <option value="">Selecione...</option>
              {veiculos.filter(v => v.status !== 'baixado').map(v => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Data Infração</label>
            <input
              type="date"
              className={inp}
              value={form.data_infracao}
              onChange={e => setForm(f => ({ ...f, data_infracao: e.target.value }))}
            />
          </div>
          <div>
            <label className={lbl}>Vencimento</label>
            <input
              type="date"
              className={inp}
              value={form.data_vencimento}
              onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              className={inp}
              value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              required
              placeholder="0,00"
            />
          </div>
          {form.tipo === 'multa' && (
            <div>
              <label className={lbl}>AIT / Auto</label>
              <input
                className={inp}
                value={form.ait}
                onChange={e => setForm(f => ({ ...f, ait: e.target.value }))}
                placeholder="123456789"
              />
            </div>
          )}
        </div>

        <div>
          <label className={lbl}>Descrição</label>
          <UpperInput
            className={inp}
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="Ex: Excesso de velocidade — 60km/h em 40km/h"
          />
        </div>

        <div>
          <label className={lbl}>Observações</label>
          <UpperTextarea
            className={`${inp} resize-none`}
            rows={2}
            value={form.observacoes}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 font-medium py-2.5 rounded-xl border text-sm ${
              isLight
                ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                : 'border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm shadow-rose-500/20 text-sm text-white font-semibold disabled:opacity-50"
          >
            {salvar.isPending ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type TipoFiltro = 'todos' | TipoMulta
type StatusFiltro = '' | StatusMulta

export default function MultasPedagios() {
  const { isDark } = useTheme()
  const isLight = !isDark
  const salvar = useSalvarMulta()
  const [modal, setModal] = useState(false)
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('')

  const { data: todasMultas = [], isLoading } = useMultas()

  // Filtro local
  const multas: FroMulta[] = todasMultas.filter(m => {
    if (tipoFiltro !== 'todos' && m.tipo !== tipoFiltro) return false
    if (statusFiltro && m.status !== statusFiltro) return false
    return true
  })

  const totalFiltrado = multas.reduce((s, m) => s + m.valor, 0)

  // KPIs usando todas as multas (sem filtros de UI)
  const mesAtual = new Date().toISOString().slice(0, 7)
  const totalMultasValor = todasMultas.filter(m => m.tipo === 'multa').reduce((s, m) => s + m.valor, 0)
  const totalMultasQtd   = todasMultas.filter(m => m.tipo === 'multa').length
  const totalPedagiosValor = todasMultas.filter(m => m.tipo === 'pedagio').reduce((s, m) => s + m.valor, 0)
  const totalPedagiosQtd   = todasMultas.filter(m => m.tipo === 'pedagio').length
  const multasVencidasValor = todasMultas
    .filter(m => m.status === 'vencida' || m.status === 'recebida')
    .reduce((s, m) => s + m.valor, 0)
  const multasVencidasQtd = todasMultas.filter(m => m.status === 'vencida').length
  const pagasMesValor = todasMultas
    .filter(m => m.status === 'paga' && m.data_pagamento?.startsWith(mesAtual))
    .reduce((s, m) => s + m.valor, 0)

  const card = `rounded-2xl shadow-sm border ${
    isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'
  }`
  const th = `text-[10px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 text-left`
  const sel = `px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-slate-50 border border-slate-200 text-slate-800'
      : 'bg-white/6 border border-white/10 text-white [&>option]:bg-slate-900'
  }`

  async function handlePagar(multa: FroMulta) {
    await salvar.mutateAsync({
      ...multa,
      status: 'paga',
      data_pagamento: new Date().toISOString().split('T')[0],
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className={`text-xl font-bold flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-white'
            }`}
          >
            <AlertCircle size={20} className="text-rose-500" />
            Multas &amp; Pedágios
          </h1>
          <p className="text-sm text-slate-500">
            {multas.length} registro{multas.length !== 1 ? 's' : ''} ·{' '}
            <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>
              {BRL(totalFiltrado)}
            </span>
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm shadow-rose-500/20 text-sm text-white font-semibold w-full sm:w-auto"
        >
          <Plus size={15} /> Registrar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`${card} p-3 border-l-4 border-l-rose-500`}>
          <p className="text-[10px] text-slate-500 uppercase mb-1">Multas</p>
          <p className={`text-base font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
            {BRL(totalMultasValor)}
          </p>
          <p className="text-[10px] text-slate-500">{totalMultasQtd} registros</p>
        </div>
        <div className={`${card} p-3 border-l-4 border-l-amber-500`}>
          <p className="text-[10px] text-slate-500 uppercase mb-1">Pedágios</p>
          <p className={`text-base font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
            {BRL(totalPedagiosValor)}
          </p>
          <p className="text-[10px] text-slate-500">{totalPedagiosQtd} registros</p>
        </div>
        <div
          className={`${card} p-3 border-l-4 ${
            multasVencidasQtd > 0 ? 'border-l-red-500' : 'border-l-slate-400'
          }`}
        >
          <p className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1">
            {multasVencidasQtd > 0 && <AlertTriangle size={10} className="text-red-400" />}
            Em Aberto
          </p>
          <p
            className={`text-base font-black ${
              multasVencidasQtd > 0 ? 'text-red-500' : isLight ? 'text-slate-800' : 'text-white'
            }`}
          >
            {BRL(multasVencidasValor)}
          </p>
          <p className="text-[10px] text-slate-500">{multasVencidasQtd} vencida{multasVencidasQtd !== 1 ? 's' : ''}</p>
        </div>
        <div className={`${card} p-3 border-l-4 border-l-emerald-500`}>
          <p className="text-[10px] text-slate-500 uppercase mb-1">Pagas no Mês</p>
          <p className={`text-base font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
            {BRL(pagasMesValor)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex gap-1 p-1 rounded-xl ${isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/4 border border-white/8'}`}>
          {(['todos', 'multa', 'pedagio'] as TipoFiltro[]).map(t => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tipoFiltro === t
                  ? 'bg-rose-500 text-white'
                  : isLight
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'todos' ? 'Todos' : t === 'multa' ? 'Multas' : 'Pedágios'}
            </button>
          ))}
        </div>
        <select
          className={sel}
          value={statusFiltro}
          onChange={e => setStatusFiltro(e.target.value as StatusFiltro)}
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as StatusMulta[]).map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`rounded-xl h-14 animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/5'}`} />
          ))}
        </div>
      ) : multas.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <p className="text-sm text-slate-500">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                className={`border-b ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/4 border-white/8'
                }`}
              >
                <tr>
                  <th className={th}>Tipo</th>
                  <th className={th}>Ativo</th>
                  <th className={th}>Data Infração</th>
                  <th className={th}>Vencimento</th>
                  <th className={th}>Valor</th>
                  <th className={th}>AIT</th>
                  <th className={th}>Status</th>
                  <th className={th}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {multas.map(m => {
                  const vencido = isVencido(m.data_vencimento)
                  return (
                    <tr
                      key={m.id}
                      className={`transition-colors ${
                        isLight ? 'hover:bg-slate-50' : 'hover:bg-white/3'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                            m.tipo === 'multa'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {m.tipo === 'multa' ? 'Multa' : 'Pedágio'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          {m.veiculo?.placa ?? '—'}
                        </p>
                        <p className="text-[10px] text-slate-500">{m.veiculo?.modelo}</p>
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {m.data_infracao ? new Date(m.data_infracao).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {m.data_vencimento ? (
                          <span
                            className={`text-sm font-semibold ${
                              vencido && m.status !== 'paga' && m.status !== 'cancelada'
                                ? 'text-red-500'
                                : isLight ? 'text-slate-700' : 'text-slate-300'
                            }`}
                          >
                            {new Date(m.data_vencimento).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {BRL(m.valor)}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        {m.ait ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${STATUS_BADGE[m.status]}`}>
                          {STATUS_LABEL[m.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(m.status === 'recebida' || m.status === 'contestada' || m.status === 'vencida') && (
                          <button
                            onClick={() => handlePagar(m)}
                            disabled={salvar.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                          >
                            Pagar
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

      {modal && <RegistrarModal onClose={() => setModal(false)} isLight={isLight} />}
    </div>
  )
}
