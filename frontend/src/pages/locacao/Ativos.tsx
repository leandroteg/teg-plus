import { useState } from 'react'
import { Building2, Search, List, LayoutGrid } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useImoveis } from '../../hooks/useLocacao'
import type { LocImovel } from '../../types/locacao'

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtCurrency = (v?: number) =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : '—'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  ativo:      { label: 'Ativo',      dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
  em_entrada: { label: 'Em Entrada', dot: 'bg-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  em_saida:   { label: 'Em Saída',   dot: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  inativo:    { label: 'Inativo',    dot: 'bg-slate-400',  bg: 'bg-slate-100', text: 'text-slate-600' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const STATUS_OPTS = [
  { value: '',         label: 'Todos' },
  { value: 'ativo',      label: 'Ativo' },
  { value: 'inativo',    label: 'Inativo' },
  { value: 'em_entrada', label: 'Em Entrada' },
  { value: 'em_saida',   label: 'Em Saída' },
]

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({ im, isDark }: { im: LocImovel; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <tr className={`border-b transition-colors cursor-pointer
      ${isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <td className="px-4 py-3">
        <p className={`text-sm font-semibold ${txt}`}>{im.descricao}</p>
        {(im.cidade || im.uf) && (
          <p className={`text-xs mt-0.5 ${txtMuted}`}>{[im.cidade, im.uf].filter(Boolean).join('/')}</p>
        )}
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>{im.locador_nome ?? '—'}</td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>{fmtCurrency(im.valor_aluguel_mensal)}</td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>
        {im.dia_vencimento ? `Dia ${im.dia_vencimento}` : '—'}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={im.status} />
      </td>
    </tr>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function ImovelCard({ im, isDark }: { im: LocImovel; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const enderecoCompleto = [im.endereco, im.numero, im.bairro].filter(Boolean).join(', ')
  const cidadeUF = [im.cidade, im.uf].filter(Boolean).join('/')

  return (
    <div className={`rounded-xl border p-4 transition-all cursor-pointer
      ${isDark
        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}>
      {/* Linha 1 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`text-sm font-bold ${txt}`}>{im.descricao}</p>
        <StatusBadge status={im.status} />
      </div>
      {/* Linha 2 */}
      {(enderecoCompleto || cidadeUF) && (
        <p className={`text-xs mb-2 ${txtMuted}`}>
          {[enderecoCompleto, cidadeUF].filter(Boolean).join(' — ')}
        </p>
      )}
      {/* Linha 3 */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${txtMuted}`}>
        {im.locador_nome && <span>Locador: <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{im.locador_nome}</span></span>}
        <span>{fmtCurrency(im.valor_aluguel_mensal)}<span className="font-normal">/mês</span></span>
        {im.dia_vencimento && <span>Venc. dia {im.dia_vencimento}</span>}
      </div>
      {/* Ações */}
      <div className="mt-3">
        <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
          ${isDark
            ? 'border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10'
            : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'}`}>
          Ver detalhes
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Ativos() {
  const { isDark } = useTheme()
  const { data: imoveis = [], isLoading } = useImoveis()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ativo')
  const [view, setView] = useState<'table' | 'card'>('table')

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const filtered = imoveis.filter(im => {
    if (statusFilter && im.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        im.descricao.toLowerCase().includes(q) ||
        im.cidade?.toLowerCase().includes(q) ||
        im.endereco?.toLowerCase().includes(q) ||
        im.locador_nome?.toLowerCase().includes(q) ||
        im.codigo?.toLowerCase().includes(q)
      )
    }
    return true
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[180px]
          ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input
            type="text"
            placeholder="Buscar imóvel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none
              ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>
        {/* Filtros status */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : isDark
                  ? 'border-white/10 text-slate-400 hover:border-white/20'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
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

      {/* Contador */}
      <p className={`text-xs ${txtMuted}`}>{filtered.length} imóvel(is)</p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Building2 size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhum imóvel encontrado</p>
        </div>
      ) : view === 'table' ? (
        /* Table View */
        <div className={`rounded-xl border overflow-hidden
          ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {['Imóvel', 'Locador', 'Valor/mês', 'Vencimento', 'Status'].map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(im => (
                  <TableRow key={im.id} im={im} isDark={isDark} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="space-y-2">
          {filtered.map(im => (
            <ImovelCard key={im.id} im={im} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  )
}
