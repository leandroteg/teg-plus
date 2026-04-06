import { useState } from 'react'
import { Handshake, Search, Plus, X, Loader2, FileText } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAcordos, useImoveis } from '../../hooks/useLocacao'
import { supabase } from '../../services/supabase'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import type { TipoAcordo, LocAcordo } from '../../types/locacao'

const TIPO_LABEL: Record<TipoAcordo, string> = {
  benfeitoria: 'Benfeitoria',
  abatimento:  'Abatimento',
  multa:       'Multa',
  negociacao:  'Negociacao',
  outro:       'Outro',
}

const TIPO_COLOR: Record<TipoAcordo, string> = {
  benfeitoria: 'bg-green-100 text-green-700',
  abatimento:  'bg-blue-100 text-blue-700',
  multa:       'bg-red-100 text-red-700',
  negociacao:  'bg-violet-100 text-violet-700',
  outro:       'bg-slate-100 text-slate-600',
}

const fmtCurrency = (v?: number) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

function useCreateAcordo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<LocAcordo>) => {
      const { data, error } = await supabase.from('loc_acordos').insert(payload).select().single()
      if (error) throw error
      return data as LocAcordo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_acordos'] }),
  })
}

function NovoAcordoModal({ onClose }: { onClose: () => void }) {
  const { isDark } = useTheme()
  const { data: imoveis = [] } = useImoveis({ status: 'ativo' })
  const criar = useCreateAcordo()

  const [imovelId, setImovelId] = useState('')
  const [tipo, setTipo] = useState<TipoAcordo>('benfeitoria')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [dataAcordo, setDataAcordo] = useState('')

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
      titulo,
      descricao: descricao || undefined,
      valor: valor ? parseFloat(valor) : undefined,
      data_acordo: dataAcordo || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>Novo Acordo</h3>
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
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoAcordo)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Titulo *</label>
            <input required type="text" placeholder="Descricao breve do acordo..." value={titulo} onChange={e => setTitulo(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Valor (R$)</label>
              <input type="number" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data do Acordo</label>
              <input type="date" value={dataAcordo} onChange={e => setDataAcordo(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`} />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Descricao</label>
            <textarea rows={3} placeholder="Detalhes..." value={descricao} onChange={e => setDescricao(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={criar.isPending || !titulo} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {criar.isPending && <Loader2 size={14} className="animate-spin" />}
              Criar Acordo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Acordos() {
  const { isDark } = useTheme()
  const { data: acordos = [], isLoading } = useAcordos()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const cardHover = isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'

  const filtered = acordos.filter(ac => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      ac.titulo.toLowerCase().includes(q) ||
      ac.imovel?.descricao?.toLowerCase().includes(q) ||
      ac.descricao?.toLowerCase().includes(q)
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
          <h1 className={`text-xl font-extrabold ${txt}`}>Acordos</h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>{acordos.length} acordos registrados</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> Novo Acordo
        </button>
      </div>

      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
        <Search size={14} className={txtMuted} />
        <input
          type="text"
          placeholder="Buscar acordo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Handshake size={36} className={txtMuted} />
            <p className={`text-sm ${txtMuted}`}>Nenhum acordo encontrado</p>
          </div>
        ) : (
          filtered.map(ac => (
            <div key={ac.id} className={`rounded-xl border p-4 flex items-start gap-3 transition-all ${bg} ${cardHover}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                <Handshake size={18} className="text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${txt}`}>{ac.titulo}</p>
                    <p className={`text-xs ${txtMuted} mt-0.5`}>{ac.imovel?.descricao ?? '—'}</p>
                  </div>
                  <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                    {ac.tipo && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TIPO_COLOR[ac.tipo]}`}>
                        {TIPO_LABEL[ac.tipo]}
                      </span>
                    )}
                    {ac.valor != null && (
                      <span className={`text-xs font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                        {fmtCurrency(ac.valor)}
                      </span>
                    )}
                  </div>
                </div>
                {ac.descricao && (
                  <p className={`text-xs mt-1 line-clamp-2 ${txtMuted}`}>{ac.descricao}</p>
                )}
                <div className={`flex items-center gap-3 mt-1 text-[10px] ${txtMuted}`}>
                  {ac.data_acordo && <span>Data: {fmtDate(ac.data_acordo)}</span>}
                  {ac.documento_url && (
                    <a href={ac.documento_url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-indigo-500 hover:underline">
                      <FileText size={10} /> Documento
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && <NovoAcordoModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
