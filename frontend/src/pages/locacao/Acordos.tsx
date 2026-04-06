import { useState } from 'react'
import { Handshake, Search, List, LayoutGrid, Plus, X, Loader2, FileText } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAcordos, useImoveis } from '../../hooks/useLocacao'
import { supabase } from '../../services/supabase'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import type { TipoAcordo, LocAcordo } from '../../types/locacao'

// ── Tipo config ───────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<TipoAcordo, string> = {
  benfeitoria: 'Benfeitoria',
  abatimento:  'Abatimento',
  multa:       'Multa',
  negociacao:  'Negociação',
  outro:       'Outro',
}

const TIPO_CFG: Record<TipoAcordo, { bg: string; text: string }> = {
  benfeitoria: { bg: 'bg-green-50',   text: 'text-green-700' },
  abatimento:  { bg: 'bg-blue-50',    text: 'text-blue-700' },
  multa:       { bg: 'bg-red-50',     text: 'text-red-700' },
  negociacao:  { bg: 'bg-violet-50',  text: 'text-violet-700' },
  outro:       { bg: 'bg-slate-100',  text: 'text-slate-600' },
}

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtCurrency = (v?: number) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

// ── Badge ─────────────────────────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo?: TipoAcordo }) {
  if (!tipo) return null
  const cfg = TIPO_CFG[tipo]
  return (
    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {TIPO_LABEL[tipo]}
    </span>
  )
}

// ── Hook create ───────────────────────────────────────────────────────────────
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

// ── Modal ─────────────────────────────────────────────────────────────────────
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
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Imóvel</label>
            <select value={imovelId} onChange={e => setImovelId(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              <option value="">Selecionar imóvel...</option>
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
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Título *</label>
            <input required type="text" placeholder="Descrição breve do acordo..." value={titulo} onChange={e => setTitulo(e.target.value)}
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
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Descrição</label>
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

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({ ac, isDark }: { ac: LocAcordo; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <tr className={`border-b transition-colors cursor-pointer
      ${isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <td className={`px-4 py-3 text-sm font-medium ${txt}`}>
        <span className="block truncate max-w-[160px]">{ac.imovel?.descricao ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        <TipoBadge tipo={ac.tipo} />
      </td>
      <td className={`px-4 py-3 text-sm font-medium ${txt}`}>
        <span className="block truncate max-w-[200px]">{ac.titulo}</span>
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>{fmtDate(ac.data_acordo)}</td>
      <td className={`px-4 py-3 text-sm font-medium ${ac.valor != null ? (isDark ? 'text-green-400' : 'text-green-700') : txtMuted}`}>
        {fmtCurrency(ac.valor)}
      </td>
    </tr>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function AcordoCard({ ac, isDark }: { ac: LocAcordo; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`rounded-xl border p-4 transition-all cursor-pointer
      ${isDark
        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}>
      {/* Linha 1 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`text-sm font-bold ${txt}`}>{ac.titulo}</p>
        <TipoBadge tipo={ac.tipo} />
      </div>
      {/* Linha 2 */}
      <div className={`flex items-center gap-2 text-xs mb-2 ${txtMuted}`}>
        <span>{ac.imovel?.descricao ?? '—'}</span>
        {ac.data_acordo && <span>· {fmtDate(ac.data_acordo)}</span>}
      </div>
      {/* Linha 3 */}
      {(ac.valor != null || ac.descricao) && (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${txtMuted}`}>
          {ac.valor != null && (
            <span className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
              {fmtCurrency(ac.valor)}
            </span>
          )}
          {ac.descricao && (
            <span className="line-clamp-1 flex-1">{ac.descricao}</span>
          )}
        </div>
      )}
      {/* Documento */}
      {ac.documento_url && (
        <div className="mt-2">
          <a href={ac.documento_url} target="_blank" rel="noreferrer"
            className={`flex items-center gap-1 text-xs font-semibold
              ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>
            <FileText size={12} /> Documento
          </a>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Acordos() {
  const { isDark } = useTheme()
  const { data: acordos = [], isLoading } = useAcordos()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [showModal, setShowModal] = useState(false)

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

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
      {/* Header com botão */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${txtMuted}`}>{acordos.length} acordos</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> Novo Acordo
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[180px]
          ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input
            type="text"
            placeholder="Buscar acordo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none
              ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>
        {/* Toggle view */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('table')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'table'
              ? isDark ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <List size={16} />
          </button>
          <button
            onClick={() => setView('card')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'card'
              ? isDark ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Handshake size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhum acordo encontrado</p>
        </div>
      ) : view === 'table' ? (
        /* Table View */
        <div className={`rounded-xl border overflow-hidden
          ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {['Imóvel', 'Tipo', 'Título', 'Data', 'Valor'].map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(ac => (
                  <TableRow key={ac.id} ac={ac} isDark={isDark} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="space-y-2">
          {filtered.map(ac => (
            <AcordoCard key={ac.id} ac={ac} isDark={isDark} />
          ))}
        </div>
      )}

      {showModal && <NovoAcordoModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
