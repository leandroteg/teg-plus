import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, TrendingUp, TrendingDown, AlertTriangle,
  Clock, CheckCircle2, RefreshCw, ArrowRight,
  CalendarDays, DollarSign,
} from 'lucide-react'
import { useContratosDashboard } from '../../hooks/useContratos'
import type { TipoContrato } from '../../types/contratos'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  previsto:  { label: 'Previsto',   dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600'   },
  pendente:  { label: 'Pendente',   dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  liberado:  { label: 'Liberado',   dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  pago:      { label: 'Pago',       dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  cancelado: { label: 'Cancelado',  dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500'    },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_LABEL[status] ?? { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

export default function DashboardContratos() {
  const nav = useNavigate()
  const { data, isLoading, refetch } = useContratosDashboard()

  const resumo = data?.resumo ?? {
    total_contratos: 0, vigentes: 0,
    contratos_receita: 0, contratos_despesa: 0,
    valor_total_receita: 0, valor_total_despesa: 0,
  }
  const parcelas = data?.parcelas ?? {
    previstas: 0, pendentes: 0, liberadas: 0, pagas: 0,
    valor_pendente: 0, valor_liberado: 0,
  }
  const proximas = data?.proximas_parcelas ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Painel de Contratos</h1>
          <p className="text-xs text-slate-400 mt-0.5">Gestão de contratos, parcelas e pagamentos</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard titulo="Contratos Vigentes" valor={resumo.vigentes}
          icon={FileText} cor="text-indigo-600" hexCor="#6366F1"
          subtitulo={`${resumo.total_contratos} total`} />
        <KpiCard titulo="A Receber" valor={fmt(resumo.valor_total_receita)}
          icon={TrendingUp} cor="text-emerald-600" hexCor="#10B981"
          subtitulo={`${resumo.contratos_receita} contratos`} />
        <KpiCard titulo="A Pagar" valor={fmt(resumo.valor_total_despesa)}
          icon={TrendingDown} cor="text-amber-600" hexCor="#D97706"
          subtitulo={`${resumo.contratos_despesa} contratos`} />
        <KpiCard titulo="Parcelas Pendentes" valor={parcelas.pendentes}
          icon={AlertTriangle}
          cor={parcelas.pendentes > 0 ? 'text-red-600' : 'text-slate-400'}
          hexCor={parcelas.pendentes > 0 ? '#DC2626' : '#94A3B8'}
          subtitulo={parcelas.pendentes > 0 ? fmt(parcelas.valor_pendente) : 'Nenhuma'} />
      </div>

      {/* ── Status das Parcelas ──────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <CalendarDays size={12} /> Parcelas por Status
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { key: 'previstas', label: 'Previstas', valor: parcelas.previstas, cor: 'slate' },
            { key: 'pendentes', label: 'Pendentes', valor: parcelas.pendentes, cor: 'amber' },
            { key: 'liberadas', label: 'Liberadas', valor: parcelas.liberadas, cor: 'blue' },
            { key: 'pagas',     label: 'Pagas',     valor: parcelas.pagas,     cor: 'emerald' },
          ].map(s => (
            <div key={s.key} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
              <div className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 bg-${s.cor}-50 text-${s.cor}-700`}>
                <span className={`w-1.5 h-1.5 rounded-full bg-${s.cor}-400`} />
                {s.label}
              </div>
              <p className="text-lg font-extrabold text-slate-800 mt-2">{s.valor}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Próximas Parcelas ────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <Clock size={14} className="text-amber-500" /> Próximas Parcelas
          </h2>
          <button onClick={() => nav('/contratos/previsao')}
            className="text-[10px] text-indigo-600 font-semibold flex items-center gap-0.5">
            Ver todas <ArrowRight size={10} />
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {proximas.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">Nenhuma parcela próxima</p>
          ) : (
            proximas.slice(0, 8).map(p => {
              const vencido = new Date(p.data_vencimento) < new Date()
              const isDespesa = p.tipo_contrato === 'despesa'
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
                    ${vencido ? 'bg-red-50 text-red-600' : isDespesa ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {fmtData(p.data_vencimento).split('/')[0]}
                  </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">
                      {p.contrato_objeto || 'Contrato sem titulo'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 truncate">
                        {[p.contraparte, p.contrato_numero].filter(Boolean).join(' • ') || 'Contrato sem referencia'}
                      </span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        isDespesa ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {isDespesa ? 'Pagar' : 'Receber'}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-extrabold ${vencido ? 'text-red-600' : isDespesa ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {fmt(p.valor)}
                    </p>
                    <p className={`text-[10px] font-medium ${vencido ? 'text-red-500' : 'text-slate-400'}`}>
                      {fmtData(p.data_vencimento)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

function KpiCard({ titulo, valor, icon: Icon, cor, hexCor, subtitulo }: {
  titulo: string; valor: number | string; icon: typeof DollarSign;
  cor: string; hexCor: string; subtitulo?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex">
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}>
          <Icon size={14} className={cor} />
        </div>
        <p className={`text-xl font-extrabold ${cor} leading-none`}>{valor}</p>
        <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-widest">{titulo}</p>
        {subtitulo && <p className="text-[10px] text-slate-400 mt-0.5">{subtitulo}</p>}
      </div>
    </div>
  )
}
