import { useState } from 'react'
import { FileText, Search, Filter } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useFaturas } from '../../hooks/useLocacao'
import type { StatusFatura, TipoFatura } from '../../types/locacao'
import { STATUS_FATURA_LABEL, TIPO_FATURA_LABEL } from '../../types/locacao'

const fmtCurrency = (v?: number) =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : '—'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

function StatusBadgeFatura({ status }: { status: StatusFatura }) {
  const c = STATUS_FATURA_LABEL[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

export default function Faturas() {
  const { isDark } = useTheme()
  const { data: faturas = [], isLoading } = useFaturas()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFatura | ''>('')
  const [tipoFilter, setTipoFilter] = useState<TipoFatura | ''>('')

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const tdBorder = isDark ? 'border-white/[0.06]' : 'border-slate-100'

  const filtered = faturas.filter(fat => {
    if (statusFilter && fat.status !== statusFilter) return false
    if (tipoFilter && fat.tipo !== tipoFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        fat.imovel?.descricao?.toLowerCase().includes(q) ||
        fat.descricao?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const isOverdue = (vencimento?: string) => {
    if (!vencimento) return false
    return new Date(vencimento + 'T00:00:00') < new Date()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className={`text-xl font-extrabold ${txt}`}>Faturas</h1>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>{faturas.length} faturas no total</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[180px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input
            type="text"
            placeholder="Buscar fatura..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFatura | '')}
          className={`text-sm rounded-xl border px-3 py-2 outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
        >
          <option value="">Todos status</option>
          {Object.entries(STATUS_FATURA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={tipoFilter}
          onChange={e => setTipoFilter(e.target.value as TipoFatura | '')}
          className={`text-sm rounded-xl border px-3 py-2 outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
        >
          <option value="">Todos tipos</option>
          {Object.entries(TIPO_FATURA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className={`rounded-2xl border overflow-hidden ${bg}`}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={36} className={txtMuted} />
            <p className={`text-sm ${txtMuted}`}>Nenhuma fatura encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${tdBorder}`}>
                  {['Imovel', 'Tipo', 'Competencia', 'Vencimento', 'Valor Previsto', 'Valor Confirmado', 'Status'].map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(fat => (
                  <tr key={fat.id} className={`border-b last:border-0 ${tdBorder} ${isOverdue(fat.vencimento) && fat.status !== 'pago' ? (isDark ? 'bg-red-500/5' : 'bg-red-50') : ''}`}>
                    <td className={`px-4 py-3 text-sm font-medium ${txt}`}>
                      <span className="block truncate max-w-[160px]">{fat.imovel?.descricao ?? '—'}</span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}>{TIPO_FATURA_LABEL[fat.tipo]}</td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}>{fmtDate(fat.competencia)}</td>
                    <td className={`px-4 py-3 text-sm ${isOverdue(fat.vencimento) && fat.status !== 'pago' ? 'text-red-600 font-semibold' : txtMuted}`}>
                      {fmtDate(fat.vencimento)}
                    </td>
                    <td className={`px-4 py-3 text-sm ${txtMuted}`}>{fmtCurrency(fat.valor_previsto)}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${fat.valor_confirmado ? (isDark ? 'text-green-400' : 'text-green-700') : txtMuted}`}>
                      {fmtCurrency(fat.valor_confirmado)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadgeFatura status={fat.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
