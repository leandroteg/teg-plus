import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, TrendingUp, TrendingDown, AlertTriangle,
  Clock, CheckCircle2, RefreshCw, ArrowRight,
  CalendarDays, DollarSign, AlertOctagon, Banknote,
  FileSignature, Pause,
} from 'lucide-react'
import { useContratosDashboard, useContratos, useAditivos, useParcelas as useParcelasList } from '../../hooks/useContratos'
import { getGrupoContratoLabel } from '../../constants/contratos'
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
  const { data: contratosAll = [] } = useContratos()
  const { data: aditivosAll = [] } = useAditivos()
  const { data: parcelasAll = [] } = useParcelasList()

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

      {/* ── Acompanhamento de Contratos ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Distribution Bar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Distribuicao por Status</h3>
          {(() => {
            const STATUS_COLORS: Record<string, { dot: string; label: string }> = {
              em_negociacao: { dot: 'bg-yellow-400', label: 'Em Negociacao' },
              assinado:      { dot: 'bg-blue-400',   label: 'Assinado' },
              vigente:       { dot: 'bg-emerald-500', label: 'Vigente' },
              suspenso:      { dot: 'bg-orange-400',  label: 'Suspenso' },
              encerrado:     { dot: 'bg-slate-400',   label: 'Encerrado' },
              rescindido:    { dot: 'bg-red-400',     label: 'Rescindido' },
            }
            const statusCounts = Object.entries(STATUS_COLORS).map(([key, cfg]) => ({
              key, ...cfg, count: contratosAll.filter(c => c.status === key).length
            })).filter(s => s.count > 0)
            const total = contratosAll.length || 1
            return (
              <div>
                <div className="flex h-4 rounded-full overflow-hidden mb-3">
                  {statusCounts.map(s => (
                    <div key={s.key} className={`${s.dot} transition-all`} style={{ width: `${(s.count / total) * 100}%` }}
                      title={`${s.label}: ${s.count}`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  {statusCounts.map(s => (
                    <div key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                      {s.label} <span className="font-bold">{s.count}</span>
                      <span className="text-slate-400">({Math.round((s.count / total) * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Proximos Vencimentos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Proximos Vencimentos</h3>
          {(() => {
            const hoje = new Date()
            const proximos = contratosAll
              .filter(c => c.status === 'vigente' && c.data_fim_previsto)
              .map(c => {
                const fim = new Date(c.data_fim_previsto + 'T00:00:00')
                const dias = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
                return { ...c, diasRestantes: dias }
              })
              .sort((a, b) => a.diasRestantes - b.diasRestantes)
              .slice(0, 5)
            if (!proximos.length) return <p className="text-sm text-slate-400">Nenhum contrato vigente com data de vencimento</p>
            return (
              <div className="space-y-2">
                {proximos.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => nav(`/contratos/previsao?contrato=${c.id}`)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.objeto}</p>
                      <p className="text-xs text-slate-500">{c.numero}</p>
                    </div>
                    <span className={`ml-3 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                      c.diasRestantes < 0 ? 'bg-red-100 text-red-700' :
                      c.diasRestantes < 30 ? 'bg-red-100 text-red-700' :
                      c.diasRestantes < 90 ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {c.diasRestantes < 0 ? `${Math.abs(c.diasRestantes)}d vencido` : `${c.diasRestantes}d`}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Alertas Ativos — full width */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(() => {
              const hoje = new Date()
              const suspensos = contratosAll.filter(c => c.status === 'suspenso').length
              const vencendo30d = contratosAll.filter(c => {
                if (c.status !== 'vigente' || !c.data_fim_previsto) return false
                const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / (1000*60*60*24))
                return dias >= 0 && dias <= 30
              }).length
              const aditivosPendentes = aditivosAll.filter((a: any) => a.status === 'em_aprovacao').length
              const parcelasAtrasadas = parcelasAll.filter((p: any) => {
                if (p.status === 'pago' || p.status === 'cancelado') return false
                return new Date(p.data_vencimento + 'T00:00:00') < hoje
              }).length

              const alerts = [
                { label: 'Suspensos', count: suspensos, Icon: AlertOctagon, bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
                { label: 'Vencendo em 30d', count: vencendo30d, Icon: Clock, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
                { label: 'Aditivos Pendentes', count: aditivosPendentes, Icon: FileSignature, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                { label: 'Parcelas Atrasadas', count: parcelasAtrasadas, Icon: Banknote, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
              ]
              return alerts.map(a => (
                <div key={a.label} className={`${a.bg} border ${a.border} rounded-2xl p-4 text-center`}>
                  <div className="flex justify-center mb-1">
                    <a.Icon size={20} className={a.text} />
                  </div>
                  <p className={`text-2xl font-black ${a.text}`}>{a.count}</p>
                  <p className={`text-xs font-medium ${a.text} opacity-80`}>{a.label}</p>
                </div>
              ))
            })()}
          </div>
        </div>

        {/* Distribuicao por Grupo — full width */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Por Tipo de Contrato</h3>
          {(() => {
            const grupos = contratosAll.reduce((acc: Record<string, number>, c) => {
              const g = c.grupo_contrato || 'outro'
              acc[g] = (acc[g] || 0) + 1
              return acc
            }, {})
            const sorted = Object.entries(grupos).sort((a, b) => b[1] - a[1])
            const maxCount = Math.max(...sorted.map(([, v]) => v), 1)
            if (!sorted.length) return <p className="text-sm text-slate-400">Nenhum contrato cadastrado</p>
            return (
              <div className="space-y-2">
                {sorted.map(([grupo, count]) => (
                  <div key={grupo} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-48 truncate text-right">
                      {getGrupoContratoLabel(grupo)}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-violet-500 rounded-full transition-all"
                        style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
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
