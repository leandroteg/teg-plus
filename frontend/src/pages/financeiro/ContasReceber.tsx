import { useState } from 'react'
import {
  DollarSign, Search, Calendar, AlertTriangle, TrendingUp,
  RefreshCw, Zap, XCircle, CheckCircle2,
} from 'lucide-react'
import { useContasReceber } from '../../hooks/useFinanceiro'
import { useLastSync, useTriggerSync, useOmieConfig } from '../../hooks/useOmie'

// ── SyncBar ───────────────────────────────────────────────────────────────────

function SyncBar() {
  const { data: config } = useOmieConfig()
  const { data: log, isLoading } = useLastSync('contas_receber')
  const trigger = useTriggerSync('contas_receber')

  const webhookUrl = config?.n8n_webhook_url ?? ''
  const omieEnabled = config?.omie_enabled === 'true'
  if (!omieEnabled) return null

  const status = log?.status
  const isPending = trigger.isPending || status === 'running'

  const lastSyncText = log?.executado_em
    ? new Date(log.executado_em).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : 'Nunca sincronizado'

  return (
    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
      {isLoading || isPending ? (
        <RefreshCw size={13} className="text-emerald-500 animate-spin shrink-0" />
      ) : status === 'success' ? (
        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
      ) : status === 'error' ? (
        <XCircle size={13} className="text-red-500 shrink-0" />
      ) : (
        <Zap size={13} className="text-emerald-400 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-emerald-700 leading-none">
          {isPending ? 'Sincronizando com Omie...' : 'Omie'}
        </p>
        <p className="text-[10px] text-emerald-600/70 mt-0.5">
          {isPending ? 'Aguarde a conclusão' : lastSyncText}
        </p>
      </div>
      <button
        onClick={() => webhookUrl && trigger.mutate({ webhookUrl })}
        disabled={isPending || !webhookUrl}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white
          text-[10px] font-bold hover:bg-emerald-700 transition-all shrink-0
          disabled:opacity-50 disabled:cursor-not-allowed">
        <RefreshCw size={10} className={isPending ? 'animate-spin' : ''} />
        {isPending ? 'Aguarde' : 'Sincronizar Omie'}
      </button>
    </div>
  )
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  previsto:    { label: 'Previsto',    dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600'   },
  faturado:    { label: 'Faturado',    dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  parcial:     { label: 'Parcial',     dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  recebido:    { label: 'Recebido',    dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  conciliado:  { label: 'Conciliado',  dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700'   },
  vencido:     { label: 'Vencido',     dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-700'     },
  cancelado:   { label: 'Cancelado',   dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500'    },
}

const FILTROS: { label: string; value: string }[] = [
  { label: 'Todos',       value: '' },
  { label: 'Previstos',   value: 'previsto' },
  { label: 'Faturados',   value: 'faturado' },
  { label: 'Vencidos',    value: 'vencido' },
  { label: 'Recebidos',   value: 'recebido' },
  { label: 'Conciliados', value: 'conciliado' },
]

export default function ContasReceber() {
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const { data: contas = [], isLoading } = useContasReceber()

  const filtered = contas
    .filter(cr => !statusFilter || cr.status === statusFilter)
    .filter(cr =>
      !busca || cr.cliente_nome.toLowerCase().includes(busca.toLowerCase())
        || cr.numero_nf?.toLowerCase().includes(busca.toLowerCase())
        || cr.descricao?.toLowerCase().includes(busca.toLowerCase())
    )

  const totalAberto = filtered
    .filter(cr => !['recebido', 'conciliado', 'cancelado'].includes(cr.status))
    .reduce((s, cr) => s + cr.valor_original, 0)
  const totalRecebido = filtered
    .filter(cr => ['recebido', 'conciliado'].includes(cr.status))
    .reduce((s, cr) => s + cr.valor_recebido, 0)
  const totalVencido = filtered
    .filter(cr => cr.status === 'vencido' || (
      !['recebido', 'conciliado', 'cancelado'].includes(cr.status) &&
      new Date(cr.data_vencimento) < new Date()
    ))
    .reduce((s, cr) => s + cr.valor_original, 0)

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <DollarSign size={20} className="text-emerald-600" />
          Contas a Receber
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Faturamento e recebimentos</p>
      </div>

      {/* ── Omie Sync Status ─────────────────────────────────── */}
      <SyncBar />

      {/* ── Resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</p>
          <p className="text-lg font-extrabold text-slate-800 mt-1">{filtered.length}</p>
          <p className="text-[10px] text-slate-400">títulos</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-widest">Em Aberto</p>
          <p className="text-lg font-extrabold text-blue-600 mt-1">{fmt(totalAberto)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Recebido</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-1">{fmt(totalRecebido)}</p>
        </div>
      </div>

      {totalVencido > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-700">Títulos vencidos</p>
            <p className="text-xs text-red-500">{fmt(totalVencido)} em atraso</p>
          </div>
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente, NF, descrição..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white
              text-sm text-slate-700 placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {FILTROS.map(f => (
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
            <DollarSign size={28} className="text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum título encontrado</p>
          <p className="text-xs text-slate-400 mt-1">As contas a receber aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cr => {
            const vencido = !['recebido', 'conciliado', 'cancelado'].includes(cr.status) &&
              new Date(cr.data_vencimento) < new Date()
            const cfg = STATUS_CONFIG[cr.status]

            return (
              <div key={cr.id} className={`bg-white rounded-2xl border shadow-sm p-4
                transition-all hover:shadow-md
                ${vencido ? 'border-red-200' : 'border-slate-200'}`}>

                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${vencido ? 'bg-red-50' : 'bg-blue-50'}`}>
                    {vencido
                      ? <AlertTriangle size={16} className="text-red-500" />
                      : <TrendingUp size={16} className="text-blue-600" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{cr.cliente_nome}</p>
                      <p className={`text-sm font-extrabold shrink-0
                        ${vencido ? 'text-red-600' : 'text-blue-600'}`}>
                        {fmt(cr.valor_original)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${cfg?.bg} ${cfg?.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                        {cfg?.label ?? cr.status}
                      </span>
                      {cr.numero_nf && (
                        <span className="text-slate-400 font-mono">NF {cr.numero_nf}</span>
                      )}
                      {cr.natureza && (
                        <span className="text-slate-400">{cr.natureza}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        Venc. {fmtData(cr.data_vencimento)}
                      </span>
                      {cr.centro_custo && (
                        <span>CC: {cr.centro_custo}</span>
                      )}
                      {cr.data_recebimento && (
                        <span className="text-emerald-600 font-medium">
                          Recebido em {fmtData(cr.data_recebimento)}
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
