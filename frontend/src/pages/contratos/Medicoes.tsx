import { useState } from 'react'
import { Receipt, Search, Filter } from 'lucide-react'
import { useMedicoes, useContratos } from '../../hooks/useContratos'
import { useTheme } from '../../contexts/ThemeContext'
import type { StatusMedicao } from '../../types/contratos'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })

const STATUS_CFG: Record<StatusMedicao, { label: string; dot: string; bg: string; bgDark: string; text: string; textDark: string }> = {
  rascunho:     { label: 'Rascunho',      dot: 'bg-gray-400',    bg: 'bg-gray-100',    bgDark: 'bg-gray-500/15',    text: 'text-gray-600',    textDark: 'text-gray-400'    },
  em_aprovacao: { label: 'Em Aprovacao',   dot: 'bg-amber-400',   bg: 'bg-amber-50',    bgDark: 'bg-amber-500/15',   text: 'text-amber-700',   textDark: 'text-amber-400'   },
  aprovado:     { label: 'Aprovado',       dot: 'bg-emerald-500', bg: 'bg-emerald-50',  bgDark: 'bg-emerald-500/15', text: 'text-emerald-700', textDark: 'text-emerald-400' },
  rejeitado:    { label: 'Rejeitado',      dot: 'bg-red-400',     bg: 'bg-red-50',      bgDark: 'bg-red-500/15',     text: 'text-red-600',     textDark: 'text-red-400'     },
  faturado:     { label: 'Faturado',       dot: 'bg-blue-400',    bg: 'bg-blue-50',     bgDark: 'bg-blue-500/15',    text: 'text-blue-700',    textDark: 'text-blue-400'    },
}

const FILTROS_STATUS = [
  { label: 'Todos',          value: '' },
  { label: 'Rascunho',       value: 'rascunho' },
  { label: 'Em Aprovacao',   value: 'em_aprovacao' },
  { label: 'Aprovados',      value: 'aprovado' },
  { label: 'Faturados',      value: 'faturado' },
]

function StatusBadge({ status, isLight }: { status: StatusMedicao; isLight: boolean }) {
  const c = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5
      ${isLight ? `${c.bg} ${c.text}` : `${c.bgDark} ${c.textDark}`}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

export default function MedicoesPage() {
  const { isLightSidebar: isLight } = useTheme()
  const [contratoFilter, setContratoFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')

  const { data: medicoes = [], isLoading } = useMedicoes(contratoFilter || undefined)
  const { data: contratos = [] } = useContratos()

  const filtered = medicoes.filter(m => {
    if (statusFilter && m.status !== statusFilter) return false
    if (busca) {
      const q = busca.toLowerCase()
      return (
        m.numero_bm.toLowerCase().includes(q) ||
        m.contrato?.numero?.toLowerCase().includes(q) ||
        m.contrato?.objeto?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalMedido = filtered.reduce((s, m) => s + m.valor_medido, 0)
  const totalLiquido = filtered.reduce((s, m) => s + m.valor_liquido, 0)

  const cardCls = `rounded-2xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`
  const thCls = `${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'} text-xs font-semibold uppercase tracking-wider`
  const trCls = `border-b ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Receipt size={20} className="text-indigo-500" />
          Medicoes
        </h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Boletins de medicao de contratos
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Total Medicoes</p>
          <p className={`text-lg font-extrabold mt-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>{filtered.length}</p>
        </div>
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`}>Valor Medido</p>
          <p className={`text-lg font-extrabold mt-1 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>{fmt(totalMedido)}</p>
        </div>
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-emerald-500' : 'text-emerald-400'}`}>Valor Liquido</p>
          <p className={`text-lg font-extrabold mt-1 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>{fmt(totalLiquido)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar BM, contrato..."
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
              ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-white/[0.08] bg-white/[0.03] text-slate-200'}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <select
            value={contratoFilter}
            onChange={e => setContratoFilter(e.target.value)}
            className={`px-3 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30
              ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-white/[0.08] bg-white/[0.03] text-slate-200'}`}
          >
            <option value="">Todos Contratos</option>
            {contratos.map(c => (
              <option key={c.id} value={c.id}>{c.numero} - {c.objeto?.slice(0, 30)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTROS_STATUS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
              ${statusFilter === f.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : isLight
                  ? 'bg-white text-slate-500 border border-slate-200'
                  : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isLight ? 'bg-indigo-50' : 'bg-indigo-500/10'}`}>
            <Receipt size={28} className={isLight ? 'text-indigo-300' : 'text-indigo-400/50'} />
          </div>
          <p className={`text-sm font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma medicao encontrada</p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>As medicoes aparecerao aqui quando forem criadas</p>
        </div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={thCls}>
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">BM</th>
                  <th className="px-4 py-3">Periodo</th>
                  <th className="px-4 py-3 text-right">Valor Medido</th>
                  <th className="px-4 py-3 text-right">Retencao</th>
                  <th className="px-4 py-3 text-right">Valor Liquido</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className={trCls}>
                    <td className="px-4 py-3">
                      <p className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        {m.contrato?.numero ?? '-'}
                      </p>
                      <p className={`text-[10px] truncate max-w-[180px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {m.contrato?.objeto}
                      </p>
                    </td>
                    <td className={`px-4 py-3 text-xs font-mono font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {m.numero_bm}
                    </td>
                    <td className={`px-4 py-3 text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {fmtData(m.periodo_inicio)} — {fmtData(m.periodo_fim)}
                    </td>
                    <td className={`px-4 py-3 text-xs font-bold text-right ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      {fmt(m.valor_medido)}
                    </td>
                    <td className={`px-4 py-3 text-xs text-right ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
                      {fmt(m.valor_retencao)}
                    </td>
                    <td className={`px-4 py-3 text-xs font-bold text-right ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                      {fmt(m.valor_liquido)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={m.status} isLight={isLight} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
