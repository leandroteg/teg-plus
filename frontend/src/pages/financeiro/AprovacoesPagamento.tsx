import { useState } from 'react'
import {
  FileCheck2, Search, Calendar, AlertTriangle,
  CheckCircle2, XCircle, Clock, Eye,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useContasPagar, useAprovarPagamento } from '../../hooks/useFinanceiro'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

type Tab = 'pendentes' | 'aprovadas' | 'rejeitadas'

export default function AprovacoesPagamento() {
  const { isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('pendentes')
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const { data: contas = [], isLoading } = useContasPagar()
  const aprovarMutation = useAprovarPagamento()

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

  const tabs: { key: Tab; label: string; count: number; active: string }[] = [
    { key: 'pendentes',  label: 'Pendentes',  count: pendentes.length,  active: 'bg-amber-600 text-white shadow-sm'   },
    { key: 'aprovadas',  label: 'Aprovadas',  count: aprovadas.length,  active: 'bg-emerald-600 text-white shadow-sm' },
    { key: 'rejeitadas', label: 'Rejeitadas', count: rejeitadas.length, active: 'bg-red-600 text-white shadow-sm'     },
  ]

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const handleAprovar = (cp: typeof contas[0]) => {
    if (!confirm(`Aprovar pagamento de ${fmt(cp.valor_original)} para ${cp.fornecedor_nome}?`)) return
    aprovarMutation.mutate({ cpId: cp.id }, {
      onSuccess: () => showToast('success', `Pagamento aprovado — ${cp.fornecedor_nome}`),
      onError: () => showToast('error', 'Erro ao aprovar pagamento'),
    })
  }

  const handleRejeitar = (cp: typeof contas[0]) => {
    if (!confirm(`Rejeitar pagamento de ${fmt(cp.valor_original)} para ${cp.fornecedor_nome}?`)) return
    // Rejection is a status change to 'cancelado' — uses direct supabase update
    // For now we just show feedback; full rejection flow requires a dedicated hook
    showToast('error', 'Rejeição não implementada — use o módulo Contas a Pagar')
  }

  return (
    <div className="space-y-5">

      {/* Toast feedback */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <FileCheck2 size={20} className="text-emerald-600" />
          Aprovações de Pagamento
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Fila de aprovação — Diretoria (Laucídio)</p>
      </div>

      {/* ── Resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
              <Clock size={16} className="text-amber-600" />
            </div>
            <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-widest">Aguardando</p>
          </div>
          <p className="text-2xl font-extrabold text-amber-700">{pendentes.length}</p>
          <p className="text-xs text-amber-500 font-medium mt-1">{fmt(totalPendente)}</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
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
                ? t.active
                : isDark ? 'bg-[#1e293b] text-slate-400 border border-white/[0.06]' : 'bg-white text-slate-500 border border-slate-200'
              }`}>
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
              ${tab === t.key ? 'bg-white/20 text-white' : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
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
          className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`} />
      </div>

      {/* ── Lista ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <FileCheck2 size={28} className="text-emerald-300" />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {tab === 'pendentes' ? 'Nenhuma aprovação pendente' : 'Nenhum item encontrado'}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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
              <div key={cp.id} className={`rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'} ${vencido ? 'border-red-200' : isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      ${isPendente ? (isDark ? 'bg-amber-500/10' : 'bg-amber-50') : tab === 'aprovadas' ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-red-500/10' : 'bg-red-50')}`}>
                      {isPendente
                        ? <Clock size={16} className="text-amber-600" />
                        : tab === 'aprovadas'
                          ? <CheckCircle2 size={16} className="text-emerald-600" />
                          : <XCircle size={16} className="text-red-500" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cp.fornecedor_nome}</p>
                        <p className={`text-sm font-extrabold shrink-0
                          ${vencido ? 'text-red-600' : isDark ? 'text-white' : 'text-slate-800'}`}>
                          {fmt(cp.valor_original)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        {cp.numero_documento && (
                          <span className="text-slate-400 font-mono">{cp.numero_documento}</span>
                        )}
                        {cp.natureza && (
                          <span className={`px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                            {cp.natureza}
                          </span>
                        )}
                        {cp.centro_custo && (
                          <span className={`px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
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
                  <div className={`flex ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
                    <button
                      onClick={() => window.open(`/financeiro/cp`, '_self')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5
                      text-[11px] font-semibold transition-all ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                      <Eye size={12} />
                      Ver Docs
                    </button>
                    <div className={`w-px ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />
                    <button
                      onClick={() => handleRejeitar(cp)}
                      disabled={aprovarMutation.isPending}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5
                      text-[11px] font-semibold text-red-400 hover:text-red-600 transition-all disabled:opacity-50 ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                      <XCircle size={12} />
                      Rejeitar
                    </button>
                    <div className={`w-px ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />
                    <button
                      onClick={() => handleAprovar(cp)}
                      disabled={aprovarMutation.isPending}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5
                      text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-all disabled:opacity-50 ${isDark ? 'hover:bg-emerald-500/10' : 'hover:bg-emerald-50'}`}>
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
