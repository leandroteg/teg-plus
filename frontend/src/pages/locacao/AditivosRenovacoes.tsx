import { useState } from 'react'
import { RefreshCw, Search, Plus, X, Loader2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAditivos, useCriarAditivo, useImoveis } from '../../hooks/useLocacao'
import { STATUS_ADITIVO_LABEL } from '../../types/locacao'
import type { StatusAditivo, TipoAditivo } from '../../types/locacao'

const TIPO_LABEL: Record<TipoAditivo, string> = {
  renovacao:        'Renovacao',
  reajuste:         'Reajuste',
  alteracao_valor:  'Alteracao de Valor',
  outro:            'Outro',
}

const fmtCurrency = (v?: number) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

function NovoAditivoModal({ onClose }: { onClose: () => void }) {
  const { isDark } = useTheme()
  const { data: imoveis = [] } = useImoveis({ status: 'ativo' })
  const criar = useCriarAditivo()

  const [imovelId, setImovelId] = useState('')
  const [tipo, setTipo] = useState<TipoAditivo>('renovacao')
  const [descricao, setDescricao] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [valorAnterior, setValorAnterior] = useState('')
  const [valorNovo, setValorNovo] = useState('')

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
      tipo,
      descricao: descricao || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      valor_anterior: valorAnterior ? parseFloat(valorAnterior) : undefined,
      valor_novo: valorNovo ? parseFloat(valorNovo) : undefined,
      status: 'rascunho',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>Novo Aditivo / Renovacao</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Imovel</label>
            <select value={imovelId} onChange={e => setImovelId(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              <option value="">Selecionar imovel...</option>
              {imoveis.map(im => <option key={im.id} value={im.id}>{im.descricao}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoAditivo)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data Inicio</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data Fim</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Valor Anterior (R$)</label>
              <input type="number" placeholder="0,00" value={valorAnterior} onChange={e => setValorAnterior(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Novo Valor (R$)</label>
              <input type="number" placeholder="0,00" value={valorNovo} onChange={e => setValorNovo(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Descricao</label>
            <textarea rows={3} placeholder="Detalhes do aditivo..." value={descricao} onChange={e => setDescricao(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={criar.isPending} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {criar.isPending && <Loader2 size={14} className="animate-spin" />}
              Criar Aditivo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AditivosRenovacoes() {
  const { isDark } = useTheme()
  const { data: aditivos = [], isLoading } = useAditivos()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const cardHover = isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'

  const filtered = aditivos.filter(ad => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      ad.imovel?.descricao?.toLowerCase().includes(q) ||
      ad.descricao?.toLowerCase().includes(q) ||
      ad.tipo?.toLowerCase().includes(q)
    )
  })

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
          <h1 className={`text-xl font-extrabold ${txt}`}>Aditivos e Renovacoes</h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>{aditivos.length} registros</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> Novo Aditivo
        </button>
      </div>

      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
        <Search size={14} className={txtMuted} />
        <input
          type="text"
          placeholder="Buscar aditivo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw size={36} className={txtMuted} />
            <p className={`text-sm ${txtMuted}`}>Nenhum aditivo encontrado</p>
          </div>
        ) : (
          filtered.map(ad => {
            const st = STATUS_ADITIVO_LABEL[ad.status]
            return (
              <div key={ad.id} className={`rounded-xl border p-4 flex items-start gap-3 transition-all ${bg} ${cardHover}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                  <RefreshCw size={18} className="text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${txt}`}>
                        {ad.tipo ? TIPO_LABEL[ad.tipo] : 'Aditivo'} — {ad.imovel?.descricao ?? '—'}
                      </p>
                      {ad.descricao && (
                        <p className={`text-xs ${txtMuted} mt-0.5 line-clamp-1`}>{ad.descricao}</p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${st.bg} ${st.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                  <div className={`flex gap-3 mt-2 text-xs ${txtMuted}`}>
                    {ad.data_inicio && <span>Inicio: {fmtDate(ad.data_inicio)}</span>}
                    {ad.data_fim && <span>Fim: {fmtDate(ad.data_fim)}</span>}
                    {ad.valor_novo && (
                      <span>Novo valor: <span className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{fmtCurrency(ad.valor_novo)}</span></span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {showModal && <NovoAditivoModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
