import { useNavigate } from 'react-router-dom'
import {
  FileText, TrendingUp, TrendingDown, AlertTriangle,
  Clock, RefreshCw, ArrowRight, Zap, CalendarClock, ChevronRight,
  FileSignature, Banknote, AlertOctagon,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useContratosDashboard, useContratos, useAditivos, useParcelas as useParcelasList } from '../../hooks/useContratos'
import { GRUPO_CONTRATO_LABEL } from '../../constants/contratos'
import type { GrupoContrato } from '../../types/contratos'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_LABEL: Record<string, { label: string; dot: string }> = {
  previsto: { label: 'Previsto', dot: 'bg-slate-400' }, pendente: { label: 'Pendente', dot: 'bg-amber-400' },
  liberado: { label: 'Liberado', dot: 'bg-blue-400' }, pago: { label: 'Pago', dot: 'bg-emerald-500' },
  cancelado: { label: 'Cancelado', dot: 'bg-gray-400' },
}

function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const c = STATUS_LABEL[status] ?? { label: status, dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} /> {c.label}
    </span>
  )
}

// ── SpotlightMetric ──────────────────────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    indigo: isDark ? 'text-indigo-400' : 'text-indigo-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
    slate: isDark ? 'text-slate-400' : 'text-slate-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ── MiniInfoCard ─────────────────────────────────────────────────────────────
function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof FileText; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 flex-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <Icon size={16} className={iconTone} />
      <p className={`text-2xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {note && <p className={`text-[8px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardContratos() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const { data, isLoading, refetch } = useContratosDashboard()
  const { data: contratosAll = [] } = useContratos()
  const { data: aditivosAll = [] } = useAditivos()
  const { data: parcelasAll = [] } = useParcelasList()

  const resumo = data?.resumo ?? { total_contratos: 0, vigentes: 0, contratos_receita: 0, contratos_despesa: 0, valor_total_receita: 0, valor_total_despesa: 0 }
  const parcelas = data?.parcelas ?? { previstas: 0, pendentes: 0, liberadas: 0, pagas: 0, valor_pendente: 0, valor_liberado: 0 }
  const proximas = data?.proximas_parcelas ?? []
  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  const hoje = new Date()
  const suspensos = contratosAll.filter(c => c.status === 'suspenso').length
  const vencendo30d = contratosAll.filter(c => {
    if (c.status !== 'vigente' || !c.data_fim_previsto) return false
    const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
    return dias >= 0 && dias <= 30
  }).length
  const parcelasAtrasadas = parcelasAll.filter((p: any) => {
    if (p.status === 'pago' || p.status === 'cancelado') return false
    return new Date(p.data_vencimento + 'T00:00:00') < hoje
  }).length

  // Status bar — segmentando vigentes em subcategorias
  const vigentes = contratosAll.filter(c => c.status === 'vigente')
  const vigentesOk = vigentes.filter(c => {
    if (!c.data_fim_previsto) return true
    const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
    return dias > 90
  }).length
  const aVencer90d = vigentes.filter(c => {
    if (!c.data_fim_previsto) return false
    const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
    return dias > 30 && dias <= 90
  }).length
  const aVencer30d = vigentes.filter(c => {
    if (!c.data_fim_previsto) return false
    const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
    return dias > 0 && dias <= 30
  }).length
  const vencidos = vigentes.filter(c => {
    if (!c.data_fim_previsto) return false
    return new Date(c.data_fim_previsto + 'T00:00:00') < hoje
  }).length

  const statusCounts = [
    { key: 'em_negociacao', barClass: 'bg-yellow-400',  label: 'Em Negociacao',  value: contratosAll.filter(c => c.status === 'em_negociacao').length },
    { key: 'assinado',      barClass: 'bg-blue-400',    label: 'Assinado',       value: contratosAll.filter(c => c.status === 'assinado').length },
    { key: 'vigente_ok',    barClass: 'bg-emerald-500', label: 'Vigentes',       value: vigentesOk },
    { key: 'a_vencer_90d',  barClass: 'bg-amber-400',   label: 'A Vencer 90d',   value: aVencer90d },
    { key: 'a_vencer_30d',  barClass: 'bg-orange-500',  label: 'A Vencer 30d',   value: aVencer30d },
    { key: 'vencidos',      barClass: 'bg-red-500',     label: 'Vencidos',       value: vencidos },
    { key: 'suspenso',      barClass: 'bg-violet-400',  label: 'Suspenso',       value: contratosAll.filter(c => c.status === 'suspenso').length },
    { key: 'encerrado',     barClass: 'bg-slate-400',   label: 'Encerrado',      value: contratosAll.filter(c => c.status === 'encerrado').length },
    { key: 'rescindido',    barClass: 'bg-red-400',     label: 'Rescindido',     value: contratosAll.filter(c => c.status === 'rescindido').length },
  ].filter(s => s.value > 0)
  const totalContratos = contratosAll.length || 1

  // Por grupo
  const grupos = contratosAll.reduce((acc: Record<string, number>, c) => {
    const g = c.grupo_contrato || 'outro'
    acc[g] = (acc[g] || 0) + 1
    return acc
  }, {})
  const gruposSorted = Object.entries(grupos).sort((a, b) => b[1] - a[1])
  const maxGrupo = Math.max(...gruposSorted.map(([, v]) => v), 1)

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel de Contratos</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Gestao de contratos, parcelas e pagamentos</p>
        </div>
        <button onClick={() => refetch()} className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nucleo de Contratos</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores do portfolio</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                <FileText size={18} className="text-indigo-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Vigentes" value={resumo.vigentes} tone="indigo" isDark={isDark} note={`${resumo.total_contratos} total`} />
              <SpotlightMetric label="A Receber" value={fmt(resumo.valor_total_receita)} tone="emerald" isDark={isDark} note={`${resumo.contratos_receita} contratos`} />
              <SpotlightMetric label="A Pagar" value={fmt(resumo.valor_total_despesa)} tone="amber" isDark={isDark} note={`${resumo.contratos_despesa} contratos`} />
            </div>
          </div>
        </section>

        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Janela Critica</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>O que exige acao agora</h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(vencendo30d + parcelasAtrasadas) > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Zap size={14} className={(vencendo30d + parcelasAtrasadas) > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Vencendo 30d" value={vencendo30d} icon={CalendarClock}
                iconTone={vencendo30d > 0 ? (isDark ? 'text-red-400' : 'text-red-500') : 'text-slate-400'}
                note={vencendo30d > 0 ? 'renovar urgente' : 'tudo ok'} isDark={isDark} />
              <MiniInfoCard label="Parcelas Atrasadas" value={parcelasAtrasadas} icon={Banknote}
                iconTone={parcelasAtrasadas > 0 ? (isDark ? 'text-amber-400' : 'text-amber-500') : 'text-slate-400'}
                note={parcelas.pendentes > 0 ? fmt(parcelas.valor_pendente) : 'nenhuma'} isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-indigo-500" /> Pulso por Status
          </h2>
          <div className="flex items-center gap-3">
            {statusCounts.slice(0, 4).map(s => (
              <span key={s.key} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${s.barClass}`} />
                <span className="text-[10px] text-slate-500">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          {statusCounts.length === 0 ? (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Nenhum contrato</div>
          ) : (
            <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
              {statusCounts.map(s => {
                const pct = (s.value / totalContratos) * 100
                return (
                  <div key={s.key} className={`${s.barClass} relative flex items-center justify-center transition-all`}
                    style={{ width: `${Math.max(pct, 4)}%` }} title={`${s.label}: ${s.value}`}>
                    {pct >= 14 && <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-1">{s.label} {pct >= 22 ? s.value : ''}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Row: Proximas Parcelas + Por Tipo */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Clock size={14} className="text-amber-500" /> Proximas Parcelas
            </h2>
            <button onClick={() => nav('/contratos/previsao')} className="flex items-center gap-0.5 text-[10px] text-indigo-600 font-semibold">
              Ver todas <ChevronRight size={11} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {proximas.length === 0 ? (
              <p className={`text-center text-sm py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma parcela proxima</p>
            ) : proximas.slice(0, 6).map((p: any) => {
              const vencido = new Date(p.data_vencimento) < hoje
              const isDespesa = p.tipo_contrato === 'despesa'
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    vencido ? 'bg-red-50 text-red-600' : isDespesa ? (isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600') : (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                  }`}>{fmtData(p.data_vencimento).split('/')[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{p.contrato_objeto || 'Contrato'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.contraparte || ''}</span>
                      <StatusBadge status={p.status} isDark={isDark} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-extrabold ${vencido ? 'text-red-600' : isDespesa ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(p.valor)}</p>
                    <p className={`text-[10px] ${vencido ? 'text-red-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtData(p.data_vencimento)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <FileText size={14} className="text-indigo-500" /> Por Tipo de Contrato
            </h2>
          </div>
          <div className="p-4 space-y-2.5">
            {gruposSorted.length === 0 ? (
              <p className={`text-center text-sm py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum contrato</p>
            ) : gruposSorted.slice(0, 8).map(([grupo, count]) => (
              <div key={grupo} className="flex items-center gap-3">
                <p className={`text-[11px] font-semibold text-right shrink-0 w-[120px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {GRUPO_CONTRATO_LABEL[grupo as GrupoContrato] ?? grupo}
                </p>
                <div className="flex-1 relative">
                  <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-600 transition-all duration-500"
                      style={{ width: `${Math.max((count / maxGrupo) * 100, 4)}%` }} />
                  </div>
                </div>
                <p className={`text-[11px] font-extrabold shrink-0 w-[30px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{count}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
