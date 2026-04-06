import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, DollarSign, AlertCircle, Wrench, Calendar, ArrowRight,
  MapPin, AlertTriangle, FileText, RefreshCw, KeySquare,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useLocacaoKPIs, useFaturas, useEntradas, useSaidas, useSolicitacoesLocacao,
} from '../../hooks/useLocacao'
import {
  ENTRADA_PIPELINE_STAGES, SAIDA_PIPELINE_STAGES, TIPO_FATURA_LABEL, STATUS_FATURA_LABEL,
} from '../../types/locacao'
import type { StatusEntrada, StatusSaida } from '../../types/locacao'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

// ── Reusable components ─────────────────────────────────────────────────────
function SpotlightMetric({ label, value, Icon, tone, isDark }: {
  label: string; value: string | number; Icon: typeof Building2; tone: string; isDark: boolean
}) {
  const tones: Record<string, { icon: string; iconBg: string }> = {
    indigo:  { icon: 'text-indigo-500',  iconBg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50' },
    emerald: { icon: 'text-emerald-500', iconBg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' },
    amber:   { icon: 'text-amber-500',   iconBg: isDark ? 'bg-amber-500/10' : 'bg-amber-50' },
    red:     { icon: 'text-red-500',     iconBg: isDark ? 'bg-red-500/10' : 'bg-red-50' },
    sky:     { icon: 'text-sky-500',     iconBg: isDark ? 'bg-sky-500/10' : 'bg-sky-50' },
    slate:   { icon: 'text-slate-400',   iconBg: isDark ? 'bg-white/[0.04]' : 'bg-slate-50' },
  }
  const t = tones[tone] || tones.slate
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.iconBg}`}>
        <Icon size={18} className={t.icon} />
      </div>
      <div>
        <p className={`text-[1.85rem] font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        <p className={`text-[10px] uppercase tracking-widest font-semibold mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      </div>
    </div>
  )
}

function MiniInfoCard({ label, value, Icon, tone, isDark }: {
  label: string; value: string | number; Icon: typeof Building2; tone: string; isDark: boolean
}) {
  const tones: Record<string, { bg: string; text: string; iconColor: string }> = {
    amber:   { bg: isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200', text: isDark ? 'text-amber-300' : 'text-amber-800', iconColor: 'text-amber-500' },
    red:     { bg: isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200', text: isDark ? 'text-red-300' : 'text-red-800', iconColor: 'text-red-500' },
    orange:  { bg: isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200', text: isDark ? 'text-orange-300' : 'text-orange-800', iconColor: 'text-orange-500' },
    slate:   { bg: isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200', text: isDark ? 'text-slate-300' : 'text-slate-700', iconColor: 'text-slate-400' },
  }
  const t = tones[tone] || tones.slate
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-2.5 ${t.bg}`}>
      <Icon size={14} className={t.iconColor} />
      <div>
        <p className={`text-lg font-extrabold leading-none ${t.text}`}>{value}</p>
        <p className={`text-[9px] uppercase tracking-wider font-semibold mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      </div>
    </div>
  )
}

function HorizontalStatusBar({ segments, isDark }: {
  segments: { label: string; count: number; color: string }[]; isDark: boolean
}) {
  const total = segments.reduce((s, seg) => s + seg.count, 0)
  if (total === 0) return null
  const colors: Record<string, string> = {
    slate: 'bg-slate-400', blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500',
    amber: 'bg-amber-500', red: 'bg-red-500', green: 'bg-green-500',
  }
  return (
    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pulso por Status</p>
      <div className="flex rounded-full overflow-hidden h-3 gap-px">
        {segments.filter(s => s.count > 0).map(seg => (
          <div key={seg.label} className={`${colors[seg.color] || 'bg-slate-300'} transition-all`} style={{ width: `${(seg.count / total) * 100}%` }} title={`${seg.label}: ${seg.count}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segments.filter(s => s.count > 0).map(seg => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${colors[seg.color] || 'bg-slate-300'}`} />
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{seg.label}</span>
            <span className={`text-[10px] font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LocacaoHome() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const { data: kpis, isLoading, refetch } = useLocacaoKPIs()
  const { data: faturas = [] } = useFaturas()
  const { data: entradas = [] } = useEntradas()
  const { data: saidas = [] } = useSaidas()
  const { data: solicitacoes = [] } = useSolicitacoesLocacao()

  const bg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  // Pipeline segments
  const entradaSegments = useMemo(() =>
    ENTRADA_PIPELINE_STAGES.map(s => ({ label: s.label, count: entradas.filter(e => e.status === s.key).length, color: s.color }))
  , [entradas])

  const saidaSegments = useMemo(() =>
    SAIDA_PIPELINE_STAGES.map(s => ({ label: s.label, count: saidas.filter(sa => sa.status === s.key).length, color: s.color }))
  , [saidas])

  // Próximas 5 faturas não pagas
  const proximasFaturas = useMemo(() =>
    [...faturas].filter(f => f.status !== 'pago' && f.vencimento).sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? '')).slice(0, 5)
  , [faturas])

  // Entradas/saídas em andamento
  const entradasAndamento = useMemo(() => entradas.filter(e => e.status !== 'liberado').slice(0, 5), [entradas])
  const saidasAndamento = useMemo(() => saidas.filter(s => s.status !== 'encerrado').slice(0, 5), [saidas])

  // Solicitações urgentes
  const urgentes = useMemo(() => solicitacoes.filter(s => s.urgencia === 'urgente' || s.urgencia === 'alta').slice(0, 4), [solicitacoes])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
            <KeySquare size={22} className="text-indigo-500" /> Locação de Imóveis
          </h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>Gestão de contratos, faturas e manutenções</p>
        </div>
        <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Hero: 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.52fr_0.88fr] gap-3">
        {/* Núcleo */}
        <div className={`rounded-2xl border p-5 ${bg}`}>
          <p className={`text-[9px] font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`}>Núcleo de Locações</p>
          <div className="grid grid-cols-3 gap-4">
            <SpotlightMetric label="Imóveis Ativos" value={kpis?.imoveisAtivos ?? 0} Icon={Building2} tone="indigo" isDark={isDark} />
            <SpotlightMetric label="Valor Total/mês" value={fmtCurrency(kpis?.valorTotalMensal ?? 0)} Icon={DollarSign} tone="emerald" isDark={isDark} />
            <SpotlightMetric label="Em Andamento" value={(entradasAndamento.length + saidasAndamento.length)} Icon={ArrowRight} tone="sky" isDark={isDark} />
          </div>
        </div>

        {/* Janela Crítica */}
        <div className={`rounded-2xl border p-5 ${bg}`}>
          <p className={`text-[9px] font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Janela Crítica</p>
          <div className="grid grid-cols-1 gap-2.5">
            <MiniInfoCard label="Faturas vencendo (7d)" value={kpis?.faturasVencendo ?? 0} Icon={AlertCircle} tone={(kpis?.faturasVencendo ?? 0) > 0 ? 'amber' : 'slate'} isDark={isDark} />
            <MiniInfoCard label="Manutenções abertas" value={kpis?.manutencoesAbertas ?? 0} Icon={Wrench} tone={(kpis?.manutencoesAbertas ?? 0) > 0 ? 'red' : 'slate'} isDark={isDark} />
            <MiniInfoCard label="Contratos expirando (60d)" value={kpis?.contratosExpirando ?? 0} Icon={Calendar} tone={(kpis?.contratosExpirando ?? 0) > 0 ? 'orange' : 'slate'} isDark={isDark} />
          </div>
        </div>
      </div>

      {/* Pulso por Status — Entradas */}
      {entradas.length > 0 && <HorizontalStatusBar segments={entradaSegments} isDark={isDark} />}

      {/* Pulso por Status — Saídas */}
      {saidas.length > 0 && (
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Devoluções por Status</p>
          <div className="flex rounded-full overflow-hidden h-3 gap-px">
            {saidaSegments.filter(s => s.count > 0).map(seg => {
              const colors: Record<string, string> = { amber: 'bg-amber-500', blue: 'bg-blue-500', red: 'bg-red-500', violet: 'bg-violet-500', slate: 'bg-slate-400' }
              const total = saidaSegments.reduce((s, x) => s + x.count, 0)
              return <div key={seg.label} className={`${colors[seg.color] || 'bg-slate-300'}`} style={{ width: `${(seg.count / total) * 100}%` }} title={`${seg.label}: ${seg.count}`} />
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {saidaSegments.filter(s => s.count > 0).map(seg => {
              const colors: Record<string, string> = { amber: 'bg-amber-500', blue: 'bg-blue-500', red: 'bg-red-500', violet: 'bg-violet-500', slate: 'bg-slate-400' }
              return (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${colors[seg.color] || 'bg-slate-300'}`} />
                  <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{seg.label}</span>
                  <span className={`text-[10px] font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>{seg.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Faturas Próximas + Solicitações Urgentes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Faturas Próximas</p>
            <button onClick={() => nav('/locacoes/gestao')} className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
          </div>
          {proximasFaturas.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma fatura vencendo em breve.</p>
          ) : (
            <div className="space-y-2">
              {proximasFaturas.map(fat => {
                const stCfg = STATUS_FATURA_LABEL[fat.status]
                return (
                  <div key={fat.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fat.imovel?.descricao ?? '—'}</span>
                      <p className={`text-[10px] ${txtMuted}`}>{TIPO_FATURA_LABEL[fat.tipo]} · Vence {fmtDate(fat.vencimento)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fat.valor_previsto ? fmtCurrency(fat.valor_previsto) : '—'}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${stCfg.bg} ${stCfg.text}`}>{stCfg.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Solicitações Urgentes</p>
            <button onClick={() => nav('/locacoes/gestao')} className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
          </div>
          {urgentes.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma solicitação urgente.</p>
          ) : (
            <div className="space-y-2">
              {urgentes.map(sol => (
                <div key={sol.id} className={`flex items-center justify-between gap-2 rounded-lg p-2 ${isDark ? 'bg-red-500/5 border border-red-500/10' : 'bg-red-50 border border-red-100'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={11} className="text-red-500 shrink-0" />
                      <span className={`text-xs font-semibold truncate ${isDark ? 'text-red-300' : 'text-red-700'}`}>{sol.titulo}</span>
                    </div>
                    <p className={`text-[10px] ${txtMuted}`}>{sol.imovel?.descricao || '—'}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-700'}`}>{sol.urgencia}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Entradas + Saídas em Andamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Entradas em Andamento</p>
            <button onClick={() => nav('/locacoes/entradas')} className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
          </div>
          {entradasAndamento.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma entrada em andamento.</p>
          ) : (
            <div className="space-y-2">
              {entradasAndamento.map(e => {
                const stage = ENTRADA_PIPELINE_STAGES.find(s => s.key === e.status)
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{e.endereco || e.imovel?.descricao || '—'}</span>
                      <p className={`text-[10px] ${txtMuted}`}>{[e.cidade, e.uf].filter(Boolean).join(', ')}</p>
                    </div>
                    {stage && <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${stage.badgeClass}`}>{stage.label}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Devoluções em Andamento</p>
            <button onClick={() => nav('/locacoes/saida')} className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
          </div>
          {saidasAndamento.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma devolução em andamento.</p>
          ) : (
            <div className="space-y-2">
              {saidasAndamento.map(s => {
                const stage = SAIDA_PIPELINE_STAGES.find(st => st.key === s.status)
                const isUrgent = s.data_limite_saida && new Date(s.data_limite_saida) <= new Date(Date.now() + 7 * 86400000)
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.imovel?.descricao ?? '—'}</span>
                      {s.data_limite_saida && <p className={`text-[10px] ${isUrgent ? 'text-amber-600 font-semibold' : txtMuted}`}>Limite: {fmtDate(s.data_limite_saida)}{isUrgent ? ' ⚠' : ''}</p>}
                    </div>
                    {stage && <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${stage.badgeClass}`}>{stage.label}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
