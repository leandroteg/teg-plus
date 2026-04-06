import { useState } from 'react'
import { RefreshCw, Search, List, LayoutGrid, Plus, X, Loader2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAditivos, useCriarAditivo, useImoveis } from '../../hooks/useLocacao'
import { STATUS_ADITIVO_LABEL } from '../../types/locacao'
import type { StatusAditivo, TipoAditivo, LocAditivo } from '../../types/locacao'

// ── Tipo label ────────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<TipoAditivo, string> = {
  renovacao:       'Renovação',
  reajuste:        'Reajuste',
  alteracao_valor: 'Alteração de Valor',
  outro:           'Outro',
}

const TIPO_CFG: Record<TipoAditivo, { bg: string; text: string }> = {
  renovacao:       { bg: 'bg-blue-50',   text: 'text-blue-700' },
  reajuste:        { bg: 'bg-amber-50',  text: 'text-amber-700' },
  alteracao_valor: { bg: 'bg-green-50',  text: 'text-green-700' },
  outro:           { bg: 'bg-slate-100', text: 'text-slate-600' },
}

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtCurrency = (v?: number) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

// ── Badges ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: StatusAditivo }) {
  const cfg = STATUS_ADITIVO_LABEL[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo?: TipoAditivo }) {
  if (!tipo) return null
  const cfg = TIPO_CFG[tipo]
  return (
    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {TIPO_LABEL[tipo]}
    </span>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
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
          <h3 className={`text-base font-bold ${txt}`}>Novo Aditivo / Renovação</h3>
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
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoAditivo)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none ${inputCls}`}>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Data Início</label>
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
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Descrição</label>
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

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({ ad, isDark }: { ad: LocAditivo; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <tr className={`border-b transition-colors cursor-pointer
      ${isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <td className={`px-4 py-3 text-sm font-medium ${txt}`}>
        <span className="block truncate max-w-[160px]">{ad.imovel?.descricao ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        <TipoBadge tipo={ad.tipo} />
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>
        {ad.data_inicio || ad.data_fim
          ? `${fmtDate(ad.data_inicio)} – ${fmtDate(ad.data_fim)}`
          : '—'}
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>
        {ad.valor_anterior != null ? fmtCurrency(ad.valor_anterior) : '—'}
        {ad.valor_novo != null && (
          <span className={`ml-1 font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
            → {fmtCurrency(ad.valor_novo)}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={ad.status} />
      </td>
    </tr>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function AditivoCard({ ad, isDark }: { ad: LocAditivo; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`rounded-xl border p-4 transition-all cursor-pointer
      ${isDark
        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}>
      {/* Linha 1 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-bold ${txt}`}>{ad.tipo ? TIPO_LABEL[ad.tipo] : 'Aditivo'}</p>
          <TipoBadge tipo={ad.tipo} />
        </div>
        <StatusBadge status={ad.status} />
      </div>
      {/* Linha 2 */}
      <p className={`text-xs mb-2 ${txtMuted}`}>{ad.imovel?.descricao ?? '—'}</p>
      {/* Linha 3 */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${txtMuted}`}>
        {(ad.data_inicio || ad.data_fim) && (
          <span>{fmtDate(ad.data_inicio)} – {fmtDate(ad.data_fim)}</span>
        )}
        {(ad.valor_anterior != null || ad.valor_novo != null) && (
          <span>
            {fmtCurrency(ad.valor_anterior)}
            {ad.valor_novo != null && (
              <span className={`ml-1 font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                → {fmtCurrency(ad.valor_novo)}
              </span>
            )}
          </span>
        )}
        {ad.indice_reajuste && <span>Índice: {ad.indice_reajuste}</span>}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AditivosRenovacoes() {
  const { isDark } = useTheme()
  const { data: aditivos = [], isLoading } = useAditivos()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [showModal, setShowModal] = useState(false)

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

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
      {/* Header com botão */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${txtMuted}`}>{aditivos.length} registros</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> Novo Aditivo
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
            placeholder="Buscar aditivo..."
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
          <RefreshCw size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhum aditivo encontrado</p>
        </div>
      ) : view === 'table' ? (
        /* Table View */
        <div className={`rounded-xl border overflow-hidden
          ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {['Imóvel', 'Tipo', 'Período', 'Valor Anterior → Novo', 'Status'].map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(ad => (
                  <TableRow key={ad.id} ad={ad} isDark={isDark} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="space-y-2">
          {filtered.map(ad => (
            <AditivoCard key={ad.id} ad={ad} isDark={isDark} />
          ))}
        </div>
      )}

      {showModal && <NovoAditivoModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
