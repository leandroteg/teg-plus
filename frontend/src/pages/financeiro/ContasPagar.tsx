import { useState } from 'react'
import {
  Receipt, Search, Calendar, AlertTriangle,
  CheckCircle2, Clock, FileText,
} from 'lucide-react'
import { useContasPagar } from '../../hooks/useFinanceiro'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; icon: typeof Clock }> = {
  previsto:              { label: 'Previsto',       dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600',    icon: Calendar },
  aprovado:              { label: 'Aprovado',       dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700',     icon: CheckCircle2 },
  aguardando_docs:       { label: 'Aguard. Docs',   dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',    icon: FileText },
  aguardando_aprovacao:  { label: 'Aguard. Aprov.', dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700',   icon: Clock },
  aprovado_pgto:         { label: 'Pgto Aprovado',  dot: 'bg-indigo-400',  bg: 'bg-indigo-50',   text: 'text-indigo-700',   icon: CheckCircle2 },
  em_remessa:            { label: 'Em Remessa',     dot: 'bg-cyan-400',    bg: 'bg-cyan-50',     text: 'text-cyan-700',     icon: Receipt },
  pago:                  { label: 'Pago',           dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700',  icon: CheckCircle2 },
  conciliado:            { label: 'Conciliado',     dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700',    icon: CheckCircle2 },
  cancelado:             { label: 'Cancelado',      dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500',     icon: Clock },
}

const FILTROS_STATUS: { label: string; value: string }[] = [
  { label: 'Todos',           value: '' },
  { label: 'Em Aberto',       value: 'previsto' },
  { label: 'Aguard. Aprov.',  value: 'aguardando_aprovacao' },
  { label: 'Aprov. Pgto',     value: 'aprovado_pgto' },
  { label: 'Em Remessa',      value: 'em_remessa' },
  { label: 'Pagos',           value: 'pago' },
  { label: 'Conciliados',     value: 'conciliado' },
]

export default function ContasPagar() {
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const { data: contas = [], isLoading } = useContasPagar(
    statusFilter ? { status: statusFilter } : undefined
  )

  const filtered = contas.filter(cp =>
    !busca || cp.fornecedor_nome.toLowerCase().includes(busca.toLowerCase())
      || cp.descricao?.toLowerCase().includes(busca.toLowerCase())
      || cp.numero_documento?.toLowerCase().includes(busca.toLowerCase())
  )

  const totalAberto = filtered
    .filter(cp => !['pago', 'conciliado', 'cancelado'].includes(cp.status))
    .reduce((s, cp) => s + cp.valor_original, 0)
  const totalPago = filtered
    .filter(cp => ['pago', 'conciliado'].includes(cp.status))
    .reduce((s, cp) => s + cp.valor_pago, 0)

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <Receipt size={20} className="text-emerald-600" />
          Contas a Pagar
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Gestão de pagamentos e obrigações</p>
      </div>

      {/* ── Resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</p>
          <p className="text-lg font-extrabold text-slate-800 mt-1">{filtered.length}</p>
          <p className="text-[10px] text-slate-400">títulos</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-widest">Em Aberto</p>
          <p className="text-lg font-extrabold text-amber-600 mt-1">{fmt(totalAberto)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Pago</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-1">{fmt(totalPago)}</p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, documento..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white
              text-sm text-slate-700 placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {FILTROS_STATUS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
                ${statusFilter === f.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200'
                }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Receipt size={28} className="text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhuma conta encontrada</p>
          <p className="text-xs text-slate-400 mt-1">As contas a pagar aparecerão aqui quando criadas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cp => {
            const vencido = !['pago', 'conciliado', 'cancelado'].includes(cp.status) &&
              new Date(cp.data_vencimento) < new Date()
            const cfg = STATUS_CONFIG[cp.status]

            return (
              <div key={cp.id} className={`bg-white rounded-2xl border shadow-sm p-4
                transition-all hover:shadow-md
                ${vencido ? 'border-red-200' : 'border-slate-200'}`}>

                {/* Top line */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${vencido ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    {vencido
                      ? <AlertTriangle size={16} className="text-red-500" />
                      : <Receipt size={16} className="text-emerald-600" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{cp.fornecedor_nome}</p>
                      <p className={`text-sm font-extrabold shrink-0
                        ${vencido ? 'text-red-600' : 'text-emerald-600'}`}>
                        {fmt(cp.valor_original)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${cfg?.bg} ${cfg?.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                        {cfg?.label ?? cp.status}
                      </span>
                      {cp.numero_documento && (
                        <span className="text-slate-400 font-mono">{cp.numero_documento}</span>
                      )}
                      {cp.natureza && (
                        <span className="text-slate-400">{cp.natureza}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        Venc. {fmtData(cp.data_vencimento)}
                      </span>
                      {cp.centro_custo && (
                        <span>CC: {cp.centro_custo}</span>
                      )}
                      {cp.data_pagamento && (
                        <span className="text-emerald-600 font-medium">
                          Pago em {fmtData(cp.data_pagamento)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
