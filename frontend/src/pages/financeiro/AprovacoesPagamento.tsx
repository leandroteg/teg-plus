import { useState } from 'react'
import {
  FileCheck2, Search, Calendar, AlertTriangle,
  CheckCircle2, XCircle, Clock, Receipt,
  Shield, ChevronRight, Eye,
} from 'lucide-react'
import { useContasPagar } from '../../hooks/useFinanceiro'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

type Tab = 'pendentes' | 'aprovadas' | 'rejeitadas'

export default function AprovacoesPagamento() {
  const [tab, setTab] = useState<Tab>('pendentes')
  const [busca, setBusca] = useState('')
  const { data: contas = [], isLoading } = useContasPagar()

  const pendentes = contas.filter(cp =>
    cp.status === 'aguardando_aprovacao' || cp.status === 'aguardando_docs'
  )
  const aprovadas = contas.filter(cp =>
    ['aprovado_pgto', 'em_remessa', 'pago', 'conciliado'].includes(cp.status)
  )
  const rejeitadas = contas.filter(cp => cp.status === 'cancelado')

  const current = tab === 'pendentes' ? pendentes
    : tab === 'aprovadas' ? aprovadas
    : rejeitadas

  const filtered = current.filter(cp =>
    !busca || cp.fornecedor_nome.toLowerCase().includes(busca.toLowerCase())
      || cp.numero_documento?.toLowerCase().includes(busca.toLowerCase())
      || cp.descricao?.toLowerCase().includes(busca.toLowerCase())
  )

  const totalPendente = pendentes.reduce((s, cp) => s + cp.valor_original, 0)

  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'pendentes',  label: 'Pendentes',  count: pendentes.length,  color: 'amber'   },
    { key: 'aprovadas',  label: 'Aprovadas',  count: aprovadas.length,  color: 'emerald' },
    { key: 'rejeitadas', label: 'Rejeitadas', count: rejeitadas.length, color: 'red'     },
  ]

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <FileCheck2 size={20} className="text-emerald-600" />
          Aprovações de Pagamento
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Fila de aprovação — Diretoria (Laucídio)</p>
      </div>

      {/* ── Resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-widest">Aguardando</p>
          </div>
          <p className="text-2xl font-extrabold text-amber-700">{pendentes.length}</p>
          <p className="text-xs text-amber-500 font-medium mt-1">{fmt(totalPendente)}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border border-emerald-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest">Aprovadas</p>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">{aprovadas.length}</p>
          <p className="text-xs text-emerald-500 font-medium mt-1">neste período</p>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-1.5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-semibold transition-all
              ${tab === t.key
                ? `bg-${t.color}-600 text-white shadow-sm`
                : 'bg-white text-slate-500 border border-slate-200'
              }`}>
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
              ${tab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Busca ───────────────────────────────────────────── */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar fornecedor, documento..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white
            text-sm text-slate-700 placeholder-slate-400 focus:outline-none
            focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
      </div>

      {/* ── Lista ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <FileCheck2 size={28} className="text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {tab === 'pendentes' ? 'Nenhuma aprovação pendente' : 'Nenhum item encontrado'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {tab === 'pendentes' ? 'Todas as contas foram processadas' : 'Refine sua busca'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cp => {
            const vencido = !['pago', 'conciliado', 'cancelado'].includes(cp.status) &&
              new Date(cp.data_vencimento) < new Date()
            const isPendente = tab === 'pendentes'

            return (
              <div key={cp.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden
                transition-all hover:shadow-md
                ${vencido ? 'border-red-200' : 'border-slate-200'}`}>

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      ${isPendente ? 'bg-amber-50' : tab === 'aprovadas' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {isPendente
                        ? <Clock size={16} className="text-amber-600" />
                        : tab === 'aprovadas'
                          ? <CheckCircle2 size={16} className="text-emerald-600" />
                          : <XCircle size={16} className="text-red-500" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{cp.fornecedor_nome}</p>
                        <p className={`text-sm font-extrabold shrink-0
                          ${vencido ? 'text-red-600' : 'text-slate-800'}`}>
                          {fmt(cp.valor_original)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        {cp.numero_documento && (
                          <span className="text-slate-400 font-mono">{cp.numero_documento}</span>
                        )}
                        {cp.natureza && (
                          <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                            {cp.natureza}
                          </span>
                        )}
                        {cp.centro_custo && (
                          <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                            CC: {cp.centro_custo}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          Venc. {fmtData(cp.data_vencimento)}
                        </span>
                        {vencido && (
                          <span className="flex items-center gap-1 text-red-500 font-semibold">
                            <AlertTriangle size={10} />
                            Vencido
                          </span>
                        )}
                        {cp.aprovado_em && (
                          <span className="text-emerald-600 font-medium">
                            Aprovado em {fmtData(cp.aprovado_em)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action bar for pending items */}
                {isPendente && (
                  <div className="flex border-t border-slate-100">
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                      text-[11px] font-semibold text-slate-400 hover:text-slate-600
                      hover:bg-slate-50 transition-all">
                      <Eye size={12} />
                      Ver Docs
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                      text-[11px] font-semibold text-red-400 hover:text-red-600
                      hover:bg-red-50 transition-all">
                      <XCircle size={12} />
                      Rejeitar
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                      text-[11px] font-bold text-emerald-600 hover:text-emerald-700
                      hover:bg-emerald-50 transition-all">
                      <CheckCircle2 size={12} />
                      Aprovar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
