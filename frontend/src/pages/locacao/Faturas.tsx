import { useState, useMemo } from 'react'
import { FileText, Search, List, LayoutGrid, Upload, Send, ArrowUp, ArrowDown } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useFaturas } from '../../hooks/useLocacao'
import type { StatusFatura, TipoFatura, LocFatura } from '../../types/locacao'
import { STATUS_FATURA_LABEL, TIPO_FATURA_LABEL } from '../../types/locacao'

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtCurrency = (v?: number) =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : '—'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const isOverdue = (vencimento?: string, status?: StatusFatura) => {
  if (!vencimento || status === 'pago') return false
  return new Date(vencimento + 'T00:00:00') < new Date()
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: StatusFatura }) {
  const cfg = STATUS_FATURA_LABEL[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const STATUS_OPTS: { value: StatusFatura | ''; label: string }[] = [
  { value: '',                  label: 'Todos' },
  { value: 'previsto',          label: 'Previsto' },
  { value: 'lancado',           label: 'Lançado' },
  { value: 'enviado_pagamento', label: 'Enviado Pgto' },
  { value: 'pago',              label: 'Pago' },
]

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({ fat, isDark }: { fat: LocFatura; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const overdue = isOverdue(fat.vencimento, fat.status)
  return (
    <tr className={`border-b transition-colors cursor-pointer
      ${isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}
      ${overdue ? (isDark ? 'bg-red-500/[0.04]' : 'bg-red-50/60') : ''}`}>
      <td className={`px-4 py-3 text-sm font-medium ${txt}`}>
        <span className="block truncate max-w-[160px]">{fat.imovel?.descricao ?? '—'}</span>
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>{TIPO_FATURA_LABEL[fat.tipo]}</td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>{fmtDate(fat.competencia)}</td>
      <td className={`px-4 py-3 text-sm font-medium ${overdue ? 'text-red-500' : txtMuted}`}>
        {fmtDate(fat.vencimento)}
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>{fmtCurrency(fat.valor_previsto)}</td>
      <td className={`px-4 py-3 text-sm font-medium ${fat.valor_confirmado ? (isDark ? 'text-green-400' : 'text-green-700') : txtMuted}`}>
        {fmtCurrency(fat.valor_confirmado)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={fat.status} />
      </td>
    </tr>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function FaturaCard({ fat, isDark }: { fat: LocFatura; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const overdue = isOverdue(fat.vencimento, fat.status)

  return (
    <div className={`rounded-xl border p-4 transition-all cursor-pointer
      ${isDark
        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'}
      ${overdue ? (isDark ? 'border-red-500/20' : 'border-red-200') : ''}`}>
      {/* Linha 1 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`text-sm font-bold ${txt}`}>{TIPO_FATURA_LABEL[fat.tipo]}</p>
        <StatusBadge status={fat.status} />
      </div>
      {/* Linha 2 */}
      <p className={`text-xs mb-2 ${txtMuted}`}>{fat.imovel?.descricao ?? '—'}</p>
      {/* Linha 3 */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${txtMuted}`}>
        {fat.competencia && <span>Compet. {fmtDate(fat.competencia)}</span>}
        <span className={overdue ? 'text-red-500 font-semibold' : ''}>
          Venc. {fmtDate(fat.vencimento)}
        </span>
        <span>
          {fmtCurrency(fat.valor_previsto)}
          {fat.valor_confirmado != null && (
            <span className={`ml-1 font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
              → {fmtCurrency(fat.valor_confirmado)}
            </span>
          )}
        </span>
      </div>
      {/* Ações */}
      {(fat.status === 'previsto' || fat.status === 'lancado') && (
        <div className="mt-3 flex gap-2">
          {fat.status === 'previsto' && (
            <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
              ${isDark
                ? 'border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10'
                : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'}`}>
              <Upload size={12} /> Upload Boleto
            </button>
          )}
          {fat.status === 'lancado' && (
            <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
              ${isDark
                ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}>
              <Send size={12} /> Enviar Pagamento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Faturas() {
  const { isDark } = useTheme()
  const { data: faturas = [], isLoading } = useFaturas()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFatura | ''>('')
  const [tipoFilter, setTipoFilter] = useState<TipoFatura | ''>('')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [sortCol, setSortCol] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const filtered = useMemo(() => {
    let items = faturas.filter(fat => {
      if (statusFilter && fat.status !== statusFilter) return false
      if (tipoFilter && fat.tipo !== tipoFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return fat.imovel?.descricao?.toLowerCase().includes(q) || fat.descricao?.toLowerCase().includes(q)
      }
      return true
    })
    if (sortCol) {
      items = [...items].sort((a, b) => {
        let va: any, vb: any
        switch (sortCol) {
          case 'imovel': va = a.imovel?.descricao || ''; vb = b.imovel?.descricao || ''; break
          case 'tipo': va = a.tipo; vb = b.tipo; break
          case 'competencia': va = a.competencia || ''; vb = b.competencia || ''; break
          case 'vencimento': va = a.vencimento || '9999'; vb = b.vencimento || '9999'; break
          case 'previsto': va = a.valor_previsto ?? 0; vb = b.valor_previsto ?? 0; break
          case 'confirmado': va = a.valor_confirmado ?? 0; vb = b.valor_confirmado ?? 0; break
          default: return 0
        }
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return items
  }, [faturas, statusFilter, tipoFilter, search, sortCol, sortDir])

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
            placeholder="Buscar fatura..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none
              ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>
        {/* Filtro status */}
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
        {/* Filtro tipo */}
        <select
          value={tipoFilter}
          onChange={e => setTipoFilter(e.target.value as TipoFatura | '')}
          className={`text-xs rounded-xl border px-3 py-2 outline-none font-semibold
            ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}
        >
          <option value="">Todos tipos</option>
          {Object.entries(TIPO_FATURA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
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
      <p className={`text-xs ${txtMuted}`}>{filtered.length} fatura(s)</p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileText size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhuma fatura encontrada</p>
        </div>
      ) : view === 'table' ? (
        /* Table View */
        <div className={`rounded-xl border overflow-hidden
          ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {[
                    { key: 'imovel', label: 'Imóvel' },
                    { key: 'tipo', label: 'Tipo' },
                    { key: 'competencia', label: 'Competência' },
                    { key: 'vencimento', label: 'Vencimento' },
                    { key: 'previsto', label: 'Previsto' },
                    { key: 'confirmado', label: 'Confirmado' },
                    { key: '', label: 'Status' },
                  ].map(col => (
                    <th key={col.label}
                      className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted} ${col.key ? 'cursor-pointer select-none hover:text-slate-600' : ''}`}
                      onClick={() => col.key && toggleSort(col.key)}>
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(fat => (
                  <TableRow key={fat.id} fat={fat} isDark={isDark} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="space-y-2">
          {filtered.map(fat => (
            <FaturaCard key={fat.id} fat={fat} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  )
}
