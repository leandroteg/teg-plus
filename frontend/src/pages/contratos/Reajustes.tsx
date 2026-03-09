import { useState } from 'react'
import { TrendingUp, Search, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react'
import { useReajustes, useContratos } from '../../hooks/useContratos'
import { useTheme } from '../../contexts/ThemeContext'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })

const fmtPct = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

export default function ReajustesPage() {
  const { isLightSidebar: isLight } = useTheme()
  const [contratoFilter, setContratoFilter] = useState('')
  const [busca, setBusca] = useState('')

  const { data: reajustes = [], isLoading } = useReajustes(contratoFilter || undefined)
  const { data: contratos = [] } = useContratos()

  const filtered = reajustes.filter(r => {
    if (busca) {
      const q = busca.toLowerCase()
      return (
        r.indice_nome.toLowerCase().includes(q) ||
        r.observacoes?.toLowerCase().includes(q) ||
        r.contrato?.numero?.toLowerCase().includes(q) ||
        r.contrato?.objeto?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalDelta = filtered.reduce((s, r) => s + (r.valor_depois - r.valor_antes), 0)

  const cardCls = `rounded-2xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`
  const thCls = `${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'} text-xs font-semibold uppercase tracking-wider`
  const trCls = `border-b ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <TrendingUp size={20} className="text-indigo-500" />
          Reajustes
        </h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Historico de reajustes contratuais por indice
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Total Reajustes</p>
          <p className={`text-lg font-extrabold mt-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>{filtered.length}</p>
        </div>
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`}>Impacto Total</p>
          <p className={`text-lg font-extrabold mt-1 ${
            totalDelta >= 0
              ? isLight ? 'text-emerald-600' : 'text-emerald-400'
              : isLight ? 'text-red-600' : 'text-red-400'
          }`}>
            {fmt(totalDelta)}
          </p>
        </div>
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Contrato Ativo</p>
          <p className={`text-sm font-bold mt-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            {contratoFilter
              ? contratos.find(c => c.id === contratoFilter)?.numero ?? '-'
              : 'Todos'}
          </p>
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
            placeholder="Buscar indice, contrato, observacao..."
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

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isLight ? 'bg-indigo-50' : 'bg-indigo-500/10'}`}>
            <TrendingUp size={28} className={isLight ? 'text-indigo-300' : 'text-indigo-400/50'} />
          </div>
          <p className={`text-sm font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum reajuste encontrado</p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Os reajustes aparecerao aqui quando forem aplicados</p>
        </div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={thCls}>
                  {!contratoFilter && <th className="px-4 py-3">Contrato</th>}
                  <th className="px-4 py-3">Data Base</th>
                  <th className="px-4 py-3">Indice</th>
                  <th className="px-4 py-3 text-right">Percentual</th>
                  <th className="px-4 py-3 text-right">Valor Antes</th>
                  <th className="px-4 py-3 text-right">Valor Depois</th>
                  <th className="px-4 py-3 text-right">Diferenca</th>
                  <th className="px-4 py-3">Observacoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const delta = r.valor_depois - r.valor_antes
                  const isPositive = r.percentual_aplicado >= 0
                  return (
                    <tr key={r.id} className={trCls}>
                      {!contratoFilter && (
                        <td className="px-4 py-3">
                          <p className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                            {r.contrato?.numero ?? '-'}
                          </p>
                          <p className={`text-[10px] truncate max-w-[160px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                            {r.contrato?.objeto}
                          </p>
                        </td>
                      )}
                      <td className={`px-4 py-3 text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {fmtData(r.data_base)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5
                          ${isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-500/15 text-indigo-400'}`}>
                          {r.indice_nome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold
                          ${isPositive
                            ? isLight ? 'text-emerald-600' : 'text-emerald-400'
                            : isLight ? 'text-red-600' : 'text-red-400'
                          }`}>
                          {isPositive
                            ? <ArrowUpRight size={12} />
                            : <ArrowDownRight size={12} />}
                          {fmtPct(r.percentual_aplicado)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs text-right ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {fmt(r.valor_antes)}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold text-right ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        {fmt(r.valor_depois)}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold text-right ${
                        delta >= 0
                          ? isLight ? 'text-emerald-600' : 'text-emerald-400'
                          : isLight ? 'text-red-600' : 'text-red-400'
                      }`}>
                        {fmt(delta)}
                      </td>
                      <td className={`px-4 py-3 text-[11px] max-w-[180px] truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {r.observacoes ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
