import { useState } from 'react'
import { Plus, X, MapPin, Calendar, ArrowRight, Loader2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useSaidas, useAtualizarStatusSaida, useCriarSaida, useImoveis } from '../../hooks/useLocacao'
import { SAIDA_PIPELINE_STAGES } from '../../types/locacao'
import type { LocSaida, StatusSaida } from '../../types/locacao'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const NEXT_STATUS: Partial<Record<StatusSaida, { status: StatusSaida; label: string }>> = {
  pendente:                { status: 'aguardando_vistoria',      label: 'Solicitar Vistoria' },
  aguardando_vistoria:     { status: 'solucionando_pendencias',  label: 'Indicar Pendencias' },
  solucionando_pendencias: { status: 'encerramento_contratual',  label: 'Ir para Encerramento' },
  encerramento_contratual: { status: 'encerrado',                label: 'Encerrar' },
}

function NovaSaidaModal({ onClose }: { onClose: () => void }) {
  const { isDark } = useTheme()
  const { data: imoveis = [] } = useImoveis({ status: 'ativo' })
  const criar = useCriarSaida()
  const [imovelId, setImovelId] = useState('')
  const [dataAviso, setDataAviso] = useState('')
  const [dataLimite, setDataLimite] = useState('')
  const [caucao, setCaucao] = useState('')
  const [obs, setObs] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await criar.mutateAsync({
      imovel_id: imovelId || undefined,
      data_aviso: dataAviso || undefined,
      data_limite_saida: dataLimite || undefined,
      caucao_valor: caucao ? parseFloat(caucao) : undefined,
      observacoes: obs || undefined,
      caucao_devolvido: false,
      valores_em_aberto: [],
    } as Partial<LocSaida>)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>Iniciar Processo de Saida</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Imovel *</label>
            <select required value={imovelId} onChange={e => setImovelId(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}>
              <option value="">Selecionar imovel...</option>
              {imoveis.map(im => (
                <option key={im.id} value={im.id}>
                  {im.codigo ? `[${im.codigo}] ` : ''}{im.descricao}{im.cidade ? ` - ${im.cidade}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data do Aviso</label>
              <input type="date" value={dataAviso} onChange={e => setDataAviso(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data Limite Saida</label>
              <input type="date" value={dataLimite} onChange={e => setDataLimite(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Valor Caucao (R$)</label>
            <input type="number" placeholder="0,00" value={caucao} onChange={e => setCaucao(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Observacoes</label>
            <textarea rows={3} placeholder="Informacoes adicionais..." value={obs} onChange={e => setObs(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors resize-none ${inputCls}`} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={criar.isPending || !imovelId} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {criar.isPending && <Loader2 size={14} className="animate-spin" />}
              Iniciar Saida
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SaidaCard({ saida, isDark }: { saida: LocSaida; isDark: boolean }) {
  const atualizarStatus = useAtualizarStatusSaida()
  const next = NEXT_STATUS[saida.status]
  const stage = SAIDA_PIPELINE_STAGES.find(s => s.key === saida.status)

  const cardBg = isDark ? 'bg-white/[0.04] hover:bg-white/[0.07]' : 'bg-white hover:bg-slate-50'
  const border = isDark ? 'border-white/[0.08]' : 'border-slate-200'
  const txt = isDark ? 'text-slate-200' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`rounded-xl border p-3 transition-all ${cardBg} ${border}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${txt}`}>
            {saida.imovel?.descricao ?? 'Imovel'}
          </p>
          {saida.imovel?.cidade && (
            <p className={`text-xs flex items-center gap-1 mt-0.5 ${txtMuted}`}>
              <MapPin size={10} className="shrink-0" />
              {saida.imovel.cidade}{saida.imovel.uf ? `, ${saida.imovel.uf}` : ''}
            </p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${stage?.badgeClass ?? 'bg-slate-100 text-slate-600'}`}>
          {stage?.label ?? saida.status}
        </span>
      </div>

      {saida.data_limite_saida && (
        <p className={`text-xs flex items-center gap-1 mb-2 ${saida.status !== 'encerrado' ? 'text-amber-600' : txtMuted}`}>
          <Calendar size={10} className="shrink-0" />
          Limite: {fmtDate(saida.data_limite_saida)}
        </p>
      )}

      {next && (
        <button
          onClick={() => atualizarStatus.mutate({ id: saida.id, status: next.status })}
          disabled={atualizarStatus.isPending}
          className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {next.label} <ArrowRight size={11} />
        </button>
      )}
    </div>
  )
}

export default function SaidaPipeline() {
  const { isDark } = useTheme()
  const { data: saidas = [], isLoading } = useSaidas()
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
          <h1 className={`text-xl font-extrabold ${txt}`}>Saida</h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>Pipeline de saida de imoveis</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> Nova Saida
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {SAIDA_PIPELINE_STAGES.map(stage => {
          const items = saidas.filter(s => s.status === stage.key)
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
                    <p className={`text-xs ${txtMuted}`}>Nenhuma saida</p>
                  </div>
                ) : (
                  items.map(saida => (
                    <SaidaCard key={saida.id} saida={saida} isDark={isDark} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && <NovaSaidaModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
