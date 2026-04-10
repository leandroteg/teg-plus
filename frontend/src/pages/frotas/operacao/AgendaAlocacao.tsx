import { useState } from 'react'
import { CalendarDays, Plus, CornerDownLeft, X } from 'lucide-react'
import {
  useAlocacoes,
  useCriarAlocacao,
  useEncerrarAlocacao,
  useVeiculos,
} from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroAlocacao } from '../../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const FMT = (d: string) => new Date(d).toLocaleDateString('pt-BR')

function diasAlocado(dataSaida: string): number {
  const diff = Date.now() - new Date(dataSaida).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function isVencido(data?: string): boolean {
  if (!data) return false
  return new Date(data) < new Date()
}

// ── Retorno Modal ─────────────────────────────────────────────────────────────
function RetornoModal({
  alocacao,
  onClose,
  isLight,
}: {
  alocacao: FroAlocacao
  onClose: () => void
  isLight: boolean
}) {
  const encerrar = useEncerrarAlocacao()
  const [hodometro, setHodometro] = useState('')
  const [obs, setObs] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await encerrar.mutateAsync({
      id: alocacao.id,
      hodometro_retorno: hodometro ? +hodometro : undefined,
      observacoes: obs || undefined,
    })
    onClose()
  }

  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
      : 'bg-white/6 border border-white/12 text-white'
  }`
  const lbl = `block text-xs font-bold mb-1 ${!isDark ? 'text-slate-600' : 'text-slate-300'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 ${
          !isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${!isDark ? 'text-slate-800' : 'text-white'}`}>
            Registrar Retorno
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

        <div className={`p-3 rounded-xl text-sm ${!isDark ? 'bg-slate-50 border border-slate-200' : 'bg-white/4 border border-white/8'}`}>
          <p className={`font-semibold ${!isDark ? 'text-slate-800' : 'text-white'}`}>
            {alocacao.veiculo?.placa} — {alocacao.veiculo?.marca} {alocacao.veiculo?.modelo}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Saída: {FMT(alocacao.data_saida)} · {alocacao.obra?.nome ?? 'Sem obra'}
          </p>
        </div>

        <div>
          <label className={lbl}>Hodômetro de Retorno (km)</label>
          <input
            type="number"
            className={inp}
            value={hodometro}
            onChange={e => setHodometro(e.target.value)}
            placeholder="Ex: 58320"
          />
        </div>

        <div>
          <label className={lbl}>Observações</label>
          <textarea
            className={`${inp} resize-none`}
            rows={2}
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Condições do veículo, ocorrências..."
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
            disabled={encerrar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm shadow-rose-500/20 text-sm text-white font-semibold disabled:opacity-50"
          >
            {encerrar.isPending ? 'Registrando...' : 'Confirmar Retorno'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Nova Alocação Modal ───────────────────────────────────────────────────────
function NovaAlocacaoModal({
  onClose,
  isLight,
}: {
  onClose: () => void
  isLight: boolean
}) {
  const criar = useCriarAlocacao()
  const { data: veiculos = [] } = useVeiculos({ status: 'disponivel' })
  const [form, setForm] = useState({
    veiculo_id: '',
    obra_id: '',
    responsavel_nome: '',
    data_saida: new Date().toISOString().split('T')[0],
    data_retorno_prev: '',
    observacoes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await criar.mutateAsync({
      veiculo_id: form.veiculo_id,
      obra_id: form.obra_id || undefined,
      responsavel_nome: form.responsavel_nome || undefined,
      data_saida: form.data_saida,
      data_retorno_prev: form.data_retorno_prev || undefined,
      observacoes: form.observacoes || undefined,
      status: 'ativa',
    })
    onClose()
  }

  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
      : 'bg-white/6 border border-white/12 text-white'
  }`
  const sel = inp + (!isDark ? '' : ' [&>option]:bg-slate-900')
  const lbl = `block text-xs font-bold mb-1 ${!isDark ? 'text-slate-600' : 'text-slate-300'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 ${
          !isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${!isDark ? 'text-slate-800' : 'text-white'}`}>
            Nova Alocação
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
            <label className={lbl}>Veículo *</label>
            <select
              className={sel}
              value={form.veiculo_id}
              onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))}
              required
            >
              <option value="">Selecione...</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Obra / CC</label>
            <input
              className={inp}
              value={form.obra_id}
              onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))}
              placeholder="ID ou código da obra"
            />
          </div>
        </div>

        <div>
          <label className={lbl}>Responsável</label>
          <input
            className={inp}
            value={form.responsavel_nome}
            onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))}
            placeholder="Nome do responsável"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Data de Saída *</label>
            <input
              type="date"
              className={inp}
              value={form.data_saida}
              onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={lbl}>Retorno Previsto</label>
            <input
              type="date"
              className={inp}
              value={form.data_retorno_prev}
              onChange={e => setForm(f => ({ ...f, data_retorno_prev: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className={lbl}>Observações</label>
          <textarea
            className={`${inp} resize-none`}
            rows={2}
            value={form.observacoes}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            placeholder="Detalhes da alocação..."
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
            disabled={criar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm shadow-rose-500/20 text-sm text-white font-semibold disabled:opacity-50"
          >
            {criar.isPending ? 'Criando...' : 'Criar Alocação'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AgendaAlocacao() {
  const { isDark } = useTheme()
  const { data: alocacoes = [], isLoading } = useAlocacoes({ status: 'ativa' })
  const [novaModal, setNovaModal] = useState(false)
  const [retornoAloc, setRetornoAloc] = useState<FroAlocacao | null>(null)

  const card = `rounded-2xl shadow-sm border ${
    !isDark ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'
  }`
  const th = `text-[10px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 text-left`

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className={`text-xl font-bold flex items-center gap-2 ${
              !isDark ? 'text-slate-800' : 'text-white'
            }`}
          >
            <CalendarDays size={20} className="text-rose-500" />
            Agenda de Alocação
          </h1>
          <p className="text-sm text-slate-500">
            {alocacoes.length} ativo{alocacoes.length !== 1 ? 's' : ''} em campo
          </p>
        </div>
        <button
          onClick={() => setNovaModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm shadow-rose-500/20 text-sm text-white font-semibold w-full sm:w-auto"
        >
          <Plus size={15} /> Nova Alocação
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-xl h-14 animate-pulse ${
                !isDark ? 'bg-slate-100' : 'bg-white/5'
              }`}
            />
          ))}
        </div>
      ) : alocacoes.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <CalendarDays
            size={32}
            className={`mx-auto mb-2 opacity-30 ${!isDark ? 'text-slate-400' : 'text-slate-500'}`}
          />
          <p className="text-sm text-slate-500">Nenhuma alocação ativa no momento</p>
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                className={`border-b ${
                  !isDark ? 'bg-slate-50 border-slate-200' : 'bg-white/4 border-white/8'
                }`}
              >
                <tr>
                  <th className={th}>Ativo</th>
                  <th className={th}>Obra / CC</th>
                  <th className={th}>Responsável</th>
                  <th className={th}>Saída</th>
                  <th className={th}>Retorno Prev.</th>
                  <th className={th}>Dias Alocado</th>
                  <th className={th}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {alocacoes.map(al => {
                  const vencido = isVencido(al.data_retorno_prev)
                  return (
                    <tr
                      key={al.id}
                      className={`transition-colors ${
                        !isDark ? 'hover:bg-slate-50' : 'hover:bg-white/3'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p
                          className={`text-sm font-bold ${
                            !isDark ? 'text-slate-800' : 'text-white'
                          }`}
                        >
                          {al.veiculo?.placa}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {al.veiculo?.marca} {al.veiculo?.modelo}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className={`text-sm ${
                            !isDark ? 'text-slate-700' : 'text-slate-200'
                          }`}
                        >
                          {al.obra?.nome ?? '—'}
                        </p>
                        {al.obra?.codigo && (
                          <p className="text-[10px] text-slate-500">{al.obra.codigo}</p>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${
                          !isDark ? 'text-slate-700' : 'text-slate-300'
                        }`}
                      >
                        {al.responsavel_nome ?? '—'}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${
                          !isDark ? 'text-slate-700' : 'text-slate-300'
                        }`}
                      >
                        {FMT(al.data_saida)}
                      </td>
                      <td className="px-4 py-3">
                        {al.data_retorno_prev ? (
                          <span
                            className={`text-sm font-semibold ${
                              vencido ? 'text-red-500' : !isDark ? 'text-slate-700' : 'text-slate-300'
                            }`}
                          >
                            {FMT(al.data_retorno_prev)}
                            {vencido && (
                              <span className="ml-1 text-[10px] font-bold text-red-500">
                                ATRASADO
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-bold ${
                            !isDark ? 'text-slate-800' : 'text-white'
                          }`}
                        >
                          {diasAlocado(al.data_saida)} d
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setRetornoAloc(al)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                        >
                          <CornerDownLeft size={12} /> Retorno
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {novaModal && (
        <NovaAlocacaoModal onClose={() => setNovaModal(false)} isLight={isLight} />
      )}
      {retornoAloc && (
        <RetornoModal
          alocacao={retornoAloc}
          onClose={() => setRetornoAloc(null)}
          isLight={isLight}
        />
      )}
    </div>
  )
}
