import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, DollarSign, AlertCircle, Wrench, Calendar, ArrowRight,
  AlertTriangle, RefreshCw, KeySquare, TrendingUp, Zap, CalendarClock,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useLocacaoKPIs, useFaturas, useEntradas, useSaidas, useSolicitacoesLocacao, useImoveis,
} from '../../hooks/useLocacao'
import {
  ENTRADA_PIPELINE_STAGES, SAIDA_PIPELINE_STAGES, TIPO_FATURA_LABEL, STATUS_FATURA_LABEL,
} from '../../types/locacao'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

// ── SpotlightMetric (padrão Compras) ─────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    indigo: isDark ? 'text-indigo-400' : 'text-indigo-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    teal: isDark ? 'text-teal-400' : 'text-teal-600',
    sky: isDark ? 'text-sky-400' : 'text-sky-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
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

// ── MiniInfoCard (padrão Compras) ────────────────────────────────────────────
function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof Building2; iconTone: string; isDark: boolean
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

// ── HorizontalStatusBar (padrão Compras — barra única h-10) ──────────────────
function HorizontalStatusBar({ title, segments, emptyLabel, isDark }: {
  title: string
  segments: { key: string; label: string; value: number; barClass: string }[]
  emptyLabel: string; isDark: boolean
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} imóvel(is)</p>
      </div>
      {total === 0 ? (
        <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
          {emptyLabel}
        </div>
      ) : (
        <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          {segments.map(seg => {
            if (seg.value === 0) return null
            const pct = (seg.value / total) * 100
            const showLabel = pct >= 14
            const showValue = pct >= 22
            return (
              <div key={seg.key} className={`${seg.barClass} relative flex items-center justify-center transition-all`}
                style={{ width: `${Math.max(pct, 4)}%` }} title={`${seg.label}: ${seg.value}`}>
                {showLabel && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-2">
                    {seg.label} {showValue ? seg.value : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
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
  const { data: imoveis = [] } = useImoveis()

  const cardClass = isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const bg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'

  // Contagens p/ pipeline
  const entradasAndamento = useMemo(() => entradas.filter(e => e.status !== 'liberado'), [entradas])
  const saidasAndamento = useMemo(() => saidas.filter(s => s.status !== 'encerrado'), [saidas])

  // Imóveis por situação
  const imoveisAtivos = useMemo(() => imoveis.filter(i => i.status === 'ativo').length, [imoveis])
  const imoveisEmEntrada = useMemo(() => imoveis.filter(i => i.status === 'em_entrada').length, [imoveis])
  const imoveisEmSaida = useMemo(() => imoveis.filter(i => i.status === 'em_saida').length, [imoveis])

  // Contratos vencendo/vencidos (via join no useImoveis)
  const contratosVencidos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return imoveis.filter(i => { const d = (i as any).contrato?.data_fim_previsto; return d && d < today && i.status === 'ativo' })
  }, [imoveis])
  const contratosVencendo = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const lim = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
    return imoveis.filter(i => { const d = (i as any).contrato?.data_fim_previsto; return d && d >= today && d <= lim && i.status === 'ativo' })
  }, [imoveis])

  // Próximas faturas
  const proximasFaturas = useMemo(() =>
    [...faturas].filter(f => f.status !== 'pago' && f.vencimento).sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? '')).slice(0, 5)
  , [faturas])

  // Status bar — barra ÚNICA com todos os status
  const statusSegments = useMemo(() => {
    const entradaCounts: Record<string, number> = {}
    entradas.forEach(e => { entradaCounts[e.status] = (entradaCounts[e.status] || 0) + 1 })
    const saidaCounts: Record<string, number> = {}
    saidas.forEach(s => { saidaCounts[s.status] = (saidaCounts[s.status] || 0) + 1 })

    return [
      // Entradas
      { key: 'e_pendente', label: 'Ent. Pendente', value: entradaCounts['pendente'] || 0, barClass: 'bg-slate-400' },
      { key: 'e_vistoria', label: 'Ent. Vistoria', value: entradaCounts['aguardando_vistoria'] || 0, barClass: 'bg-blue-500' },
      { key: 'e_assinatura', label: 'Ent. Assinatura', value: entradaCounts['aguardando_assinatura'] || 0, barClass: 'bg-violet-500' },
      { key: 'e_liberado', label: 'Liberado', value: entradaCounts['liberado'] || 0, barClass: 'bg-emerald-500' },
      // Gestão
      { key: 'g_ativo', label: 'Ativos', value: imoveisAtivos - contratosVencendo.length - contratosVencidos.length, barClass: 'bg-indigo-500' },
      { key: 'g_vencendo', label: 'Vencendo', value: contratosVencendo.length, barClass: 'bg-amber-400' },
      { key: 'g_vencido', label: 'Vencidos', value: contratosVencidos.length, barClass: 'bg-red-600' },
      { key: 'g_entrada', label: 'Em Entrada', value: imoveisEmEntrada, barClass: 'bg-cyan-500' },
      { key: 'g_saida', label: 'Em Saída', value: imoveisEmSaida, barClass: 'bg-orange-500' },
      // Devoluções
      { key: 's_pendente', label: 'Dev. Pendente', value: saidaCounts['pendente'] || 0, barClass: 'bg-amber-500' },
      { key: 's_vistoria', label: 'Dev. Vistoria', value: saidaCounts['aguardando_vistoria'] || 0, barClass: 'bg-sky-500' },
      { key: 's_pendencias', label: 'Pendências', value: saidaCounts['solucionando_pendencias'] || 0, barClass: 'bg-red-500' },
      { key: 's_encerramento', label: 'Encerramento', value: saidaCounts['encerramento_contratual'] || 0, barClass: 'bg-violet-400' },
      { key: 's_encerrado', label: 'Encerrado', value: saidaCounts['encerrado'] || 0, barClass: 'bg-slate-500' },
    ]
  }, [entradas, saidas, imoveisAtivos, imoveisEmEntrada, imoveisEmSaida, contratosVencendo, contratosVencidos])

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

      {/* Hero 2 colunas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        {/* Núcleo de Locações */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Núcleo de Locações
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${txt}`}>
                  Indicadores gerais
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                <KeySquare size={18} className="text-indigo-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Imóveis Ativos" value={kpis?.imoveisAtivos ?? 0} tone="indigo" note="carteira ativa" isDark={isDark} />
              <SpotlightMetric label="Valor Total/mês" value={fmtCurrency(kpis?.valorTotalMensal ?? 0)} tone="emerald" note="aluguéis mensais" isDark={isDark} />
              <SpotlightMetric label="Em Andamento" value={entradasAndamento.length + saidasAndamento.length} tone="sky" note="entradas + devoluções" isDark={isDark} />
            </div>
          </div>
        </section>

        {/* Janela Crítica */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Janela Crítica
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${txt}`}>
                  O que exige ação agora
                </h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${contratosVencidos.length > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={14} className={contratosVencidos.length > 0 || contratosVencendo.length > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <MiniInfoCard
                label="Faturas vencendo"
                value={kpis?.faturasVencendo ?? 0}
                note="próximos 7 dias"
                icon={Zap}
                iconTone={(kpis?.faturasVencendo ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400'}
                isDark={isDark}
              />
              <MiniInfoCard
                label="Manutenções"
                value={kpis?.manutencoesAbertas ?? 0}
                note="abertas/em andamento"
                icon={Wrench}
                iconTone={(kpis?.manutencoesAbertas ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'}
                isDark={isDark}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso por Status — barra única */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}>
            <TrendingUp size={14} className="text-indigo-500" /> Pulso por Situação
          </h2>
        </div>
        <div className="px-4 py-3">
          <HorizontalStatusBar
            isDark={isDark}
            title="Distribuição atual — entradas, gestão e devoluções"
            emptyLabel="Nenhum imóvel registrado"
            segments={statusSegments}
          />
        </div>
      </section>

      {/* Faturas + Urgentes */}
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
            <p className={`text-sm font-bold ${txt}`}>Contratos Vencendo / Vencidos</p>
            <button onClick={() => nav('/locacoes/gestao')} className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1">Ver todos <ArrowRight size={12} /></button>
          </div>
          {contratosVencidos.length === 0 && contratosVencendo.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhum contrato vencendo ou vencido.</p>
          ) : (
            <div className="space-y-2">
              {contratosVencidos.slice(0, 3).map(imo => (
                <div key={imo.id} className={`flex items-center justify-between gap-2 rounded-lg p-2 ${isDark ? 'bg-red-500/5 border border-red-500/10' : 'bg-red-50 border border-red-100'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={11} className="text-red-500 shrink-0" />
                      <span className={`text-xs font-semibold truncate ${isDark ? 'text-red-300' : 'text-red-700'}`}>{imo.endereco || imo.descricao}</span>
                    </div>
                    <p className={`text-[10px] ${txtMuted}`}>{imo.cidade || ''}{imo.cidade ? ' · ' : ''}Venceu {fmtDate((imo as any).contrato?.data_fim_previsto)}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-700'}`}>Vencido</span>
                </div>
              ))}
              {contratosVencendo.slice(0, 3).map(imo => (
                <div key={imo.id} className={`flex items-center justify-between gap-2 rounded-lg p-2 ${isDark ? 'bg-amber-500/5 border border-amber-500/10' : 'bg-amber-50 border border-amber-100'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-amber-500 shrink-0" />
                      <span className={`text-xs font-semibold truncate ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{imo.endereco || imo.descricao}</span>
                    </div>
                    <p className={`text-[10px] ${txtMuted}`}>{imo.cidade || ''}{imo.cidade ? ' · ' : ''}Vence {fmtDate((imo as any).contrato?.data_fim_previsto)}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>Vencendo</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Entradas + Devoluções em Andamento */}
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
              {entradasAndamento.slice(0, 5).map(e => {
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
              {saidasAndamento.slice(0, 5).map(s => {
                const stage = SAIDA_PIPELINE_STAGES.find(st => st.key === s.status)
                const isUrgent = s.data_limite_saida && new Date(s.data_limite_saida) <= new Date(Date.now() + 7 * 86400000)
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.imovel?.descricao ?? '—'}</span>
                      {s.data_limite_saida && <p className={`text-[10px] ${isUrgent ? 'text-amber-600 font-semibold' : txtMuted}`}>Limite: {fmtDate(s.data_limite_saida)}</p>}
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
