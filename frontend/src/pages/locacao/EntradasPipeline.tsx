import { useState } from 'react'
import { Plus, X, MapPin, Calendar, User, ArrowRight, Loader2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useEntradas, useAtualizarStatusEntrada, useCriarEntrada } from '../../hooks/useLocacao'
import { ENTRADA_PIPELINE_STAGES } from '../../types/locacao'
import type { LocEntrada, StatusEntrada, CriarEntradaPayload } from '../../types/locacao'
import LocFluxoTimeline from '../../components/locacao/LocFluxoTimeline'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const NEXT_STATUS: Partial<Record<StatusEntrada, { status: StatusEntrada; label: string }>> = {
  pendente:              { status: 'aguardando_vistoria',  label: 'Solicitar Vistoria' },
  aguardando_vistoria:   { status: 'aguardando_assinatura', label: 'Vistoria Concluida' },
  aguardando_assinatura: { status: 'liberado',             label: 'Marcar como Liberado' },
}

function NovaEntradaModal({ onClose }: { onClose: () => void }) {
  const { isDark } = useTheme()
  const criar = useCriarEntrada()
  const [form, setForm] = useState<CriarEntradaPayload>({
    locador_nome: '',
    endereco: '',
    cidade: '',
    uf: '',
    valor_aluguel: undefined,
    data_prevista_inicio: '',
    observacoes: '',
  })

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await criar.mutateAsync(form)
    onClose()
  }

  const set = (k: keyof CriarEntradaPayload, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>Nova Entrada de Imovel</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Locador / Proprietario</label>
              <input type="text" placeholder="Nome do locador" value={form.locador_nome ?? ''} onChange={e => set('locador_nome', e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
            </div>
            <div className="col-span-2">
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Endereco</label>
              <input type="text" placeholder="Rua, numero, complemento..." value={form.endereco ?? ''} onChange={e => set('endereco', e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Cidade</label>
              <input type="text" placeholder="Cidade" value={form.cidade ?? ''} onChange={e => set('cidade', e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>UF</label>
              <input type="text" placeholder="SP" maxLength={2} value={form.uf ?? ''} onChange={e => set('uf', e.target.value.toUpperCase())}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Valor Aluguel (R$)</label>
              <input type="number" placeholder="0,00" value={form.valor_aluguel ?? ''} onChange={e => set('valor_aluguel', parseFloat(e.target.value))}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data Prevista Inicio</label>
              <input type="date" value={form.data_prevista_inicio ?? ''} onChange={e => set('data_prevista_inicio', e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
            </div>
            <div className="col-span-2">
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Observacoes</label>
              <textarea rows={3} placeholder="Informacoes adicionais..." value={form.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors resize-none ${inputCls}`} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={criar.isPending} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {criar.isPending && <Loader2 size={14} className="animate-spin" />}
              Criar Entrada
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EntradaCard({ entrada, isDark }: { entrada: LocEntrada; isDark: boolean }) {
  const atualizarStatus = useAtualizarStatusEntrada()
  const next = NEXT_STATUS[entrada.status]
  const stage = ENTRADA_PIPELINE_STAGES.find(s => s.key === entrada.status)

  const cardBg = isDark ? 'bg-white/[0.04] hover:bg-white/[0.07]' : 'bg-white hover:bg-slate-50'
  const border = isDark ? 'border-white/[0.08]' : 'border-slate-200'
  const txt = isDark ? 'text-slate-200' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`rounded-xl border p-3 transition-all ${cardBg} ${border}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${txt}`}>
            {entrada.locador_nome || 'Sem locador'}
          </p>
          {(entrada.endereco || entrada.cidade) && (
            <p className={`text-xs flex items-center gap-1 mt-0.5 truncate ${txtMuted}`}>
              <MapPin size={10} className="shrink-0" />
              {[entrada.endereco, entrada.cidade, entrada.uf].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${stage?.badgeClass ?? 'bg-slate-100 text-slate-600'}`}>
          {stage?.label ?? entrada.status}
        </span>
      </div>

      {entrada.data_prevista_inicio && (
        <p className={`text-xs flex items-center gap-1 mb-2 ${txtMuted}`}>
          <Calendar size={10} className="shrink-0" />
          Inicio previsto: {fmtDate(entrada.data_prevista_inicio)}
        </p>
      )}

      {next && (
        <button
          onClick={() => atualizarStatus.mutate({ id: entrada.id, status: next.status })}
          disabled={atualizarStatus.isPending}
          className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {next.label} <ArrowRight size={11} />
        </button>
      )}
    </div>
  )
}

export default function EntradasPipeline() {
  const { isDark } = useTheme()
  const { data: entradas = [], isLoading } = useEntradas()
  const [showModal, setShowModal] = useState(false)

  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const colBg = isDark ? 'bg-white/[0.02]' : 'bg-slate-50'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${txt}`}>Entradas</h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>Pipeline de entrada de imoveis</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> Nova Entrada
        </button>
      </div>

      {/* Pipeline kanban */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {ENTRADA_PIPELINE_STAGES.map(stage => {
          const items = entradas.filter(e => e.status === stage.key)
          return (
            <div key={stage.key} className={`rounded-2xl border p-3 min-w-[240px] flex-1 max-w-xs ${bg}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                <p className={`text-xs font-bold ${txt}`}>{stage.label}</p>
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.badgeClass}`}>{items.length}</span>
              </div>
              <div className={`rounded-xl p-2 space-y-2 min-h-[120px] ${colBg}`}>
                {items.length === 0 ? (
                  <div className="flex items-center justify-center h-20">
                    <p className={`text-xs ${txtMuted}`}>Nenhuma entrada</p>
                  </div>
                ) : (
                  items.map(entrada => (
                    <EntradaCard key={entrada.id} entrada={entrada} isDark={isDark} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && <NovaEntradaModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
