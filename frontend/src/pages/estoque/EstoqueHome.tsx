import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package2, DollarSign, AlertTriangle, ArrowRight, RefreshCw,
  TrendingUp, Zap, BarChart3, ShieldAlert, Clock, FileText,
  ArrowLeftRight,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useEstoqueKPIs, useSaldosAbaixoMinimo, useMovimentacoes, useSolicitacoes, useAguardandoEntrada, useLiberadosRetirada } from '../../hooks/useEstoque'
import { useCautelas } from '../../hooks/useCautelas'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '\u2014'

// ── SpotlightMetric (padrão Compras/Locação) ────────────────────────────────
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

// ── MiniInfoCard (padrão Compras/Locação) ────────────────────────────────────
function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof Package2; iconTone: string; isDark: boolean
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
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} iten(s)</p>
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
export default function EstoqueHome() {
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight

  const { data: kpis, isLoading, refetch } = useEstoqueKPIs()
  const { data: abaixoMinimo = [] } = useSaldosAbaixoMinimo()
  const { data: movimentacoes = [] } = useMovimentacoes()
  const { data: solicitacoes = [] } = useSolicitacoes()
  const { data: cautelasEmAberto = [] } = useCautelas({ status: 'em_aberto' })
  const { data: aguardandoEntrada = [] } = useAguardandoEntrada()
  const { data: liberadosRetirada = [] } = useLiberadosRetirada()

  const cardClass = isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const bg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'

  // Cautelas vencidas (data_devolucao_prevista < hoje)
  const cautelasVencidas = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return cautelasEmAberto.filter(c =>
      c.data_devolucao_prevista && c.data_devolucao_prevista < today
    )
  }, [cautelasEmAberto])

  // Solicitações pendentes (aberta)
  const solicitacoesPendentes = useMemo(() =>
    solicitacoes.filter(s => s.status === 'aberta')
  , [solicitacoes])

  // Saldos com estoque positivo (regular)
  const saldosEmEstoque = useMemo(() => {
    // approximate from KPIs: total_itens - abaixo - aguardando - liberados - cautelas
    const total = kpis?.total_itens ?? 0
    const abaixo = abaixoMinimo.length
    return Math.max(total - abaixo, 0)
  }, [kpis, abaixoMinimo])

  // Pulso segments
  const statusSegments = useMemo(() => [
    { key: 'aguardando_entrada', label: 'Aguard. Entrada', value: aguardandoEntrada.length, barClass: 'bg-slate-400' },
    { key: 'em_estoque', label: 'Em Estoque', value: saldosEmEstoque, barClass: 'bg-emerald-500' },
    { key: 'liberado_retirada', label: 'Liber. Retirada', value: liberadosRetirada.length, barClass: 'bg-sky-500' },
    { key: 'em_cautela', label: 'Em Cautela', value: cautelasEmAberto.length, barClass: 'bg-violet-500' },
    { key: 'abaixo_minimo', label: 'Abaixo Mínimo', value: abaixoMinimo.length, barClass: 'bg-red-500' },
  ], [aguardandoEntrada, saldosEmEstoque, liberadosRetirada, cautelasEmAberto, abaixoMinimo])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
            <Package2 size={22} className="text-teal-500" /> Estoque
          </h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>Almoxarifado, cautelas e movimentações</p>
        </div>
        <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Hero 2 colunas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        {/* Núcleo de Estoque */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Núcleo de Estoque
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${txt}`}>
                  Indicadores gerais
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                <Package2 size={18} className="text-teal-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Total de Itens" value={kpis?.total_itens ?? 0} tone="teal" note="itens cadastrados ativos" isDark={isDark} />
              <SpotlightMetric label="Valor em Estoque" value={fmtCurrency(kpis?.valor_estoque_total ?? 0)} tone="emerald" note="saldo * valor médio" isDark={isDark} />
              <SpotlightMetric label="Moviment./Mês" value={kpis?.movimentacoes_mes ?? 0} tone="sky" note="últimos 30 dias" isDark={isDark} />
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
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(abaixoMinimo.length > 0 || cautelasVencidas.length > 0) ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={14} className={(abaixoMinimo.length > 0 || cautelasVencidas.length > 0) ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <MiniInfoCard
                label="Abaixo do Mínimo"
                value={abaixoMinimo.length}
                note="reposição necessária"
                icon={Zap}
                iconTone={abaixoMinimo.length > 0 ? 'text-amber-500' : 'text-slate-400'}
                isDark={isDark}
              />
              <MiniInfoCard
                label="Cautelas Vencidas"
                value={cautelasVencidas.length}
                note="devolução em atraso"
                icon={ShieldAlert}
                iconTone={cautelasVencidas.length > 0 ? 'text-red-500' : 'text-slate-400'}
                isDark={isDark}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso por Situação — barra única */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}>
            <TrendingUp size={14} className="text-teal-500" /> Pulso por Situação
          </h2>
        </div>
        <div className="px-4 py-3">
          <HorizontalStatusBar
            isDark={isDark}
            title="Distribuição atual — pipeline de estoque"
            emptyLabel="Nenhum item registrado"
            segments={statusSegments}
          />
        </div>
      </section>

      {/* Cards — 2 colunas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Itens Abaixo do Mínimo */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Itens Abaixo do Mínimo</p>
            <button onClick={() => nav('/estoque/itens')} className="text-xs text-teal-500 hover:text-teal-600 font-semibold flex items-center gap-1">Ver todos <ArrowRight size={12} /></button>
          </div>
          {abaixoMinimo.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhum item abaixo do estoque mínimo.</p>
          ) : (
            <div className="space-y-2">
              {abaixoMinimo.slice(0, 5).map(saldo => (
                <div key={saldo.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{saldo.item?.descricao ?? '\u2014'}</span>
                    <p className={`text-[10px] ${txtMuted}`}>{saldo.base?.nome ?? '\u2014'} · Cod: {saldo.item?.codigo ?? '\u2014'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-red-600">{saldo.saldo} {saldo.item?.unidade}</span>
                    <p className={`text-[10px] ${txtMuted}`}>min: {saldo.item?.estoque_minimo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimas Movimentações */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Últimas Movimentações</p>
            <button onClick={() => nav('/estoque/movimentacoes')} className="text-xs text-teal-500 hover:text-teal-600 font-semibold flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
          </div>
          {movimentacoes.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma movimentação recente.</p>
          ) : (
            <div className="space-y-2">
              {movimentacoes.slice(0, 5).map(mov => {
                const tipoLabel: Record<string, { label: string; cls: string }> = {
                  entrada: { label: 'Entrada', cls: 'bg-emerald-100 text-emerald-700' },
                  saida: { label: 'Saída', cls: 'bg-red-100 text-red-700' },
                  transferencia_in: { label: 'Transf. In', cls: 'bg-sky-100 text-sky-700' },
                  transferencia_out: { label: 'Transf. Out', cls: 'bg-amber-100 text-amber-700' },
                  ajuste_positivo: { label: 'Ajuste +', cls: 'bg-indigo-100 text-indigo-700' },
                  ajuste_negativo: { label: 'Ajuste -', cls: 'bg-orange-100 text-orange-700' },
                  baixa: { label: 'Baixa', cls: 'bg-slate-100 text-slate-700' },
                }
                const cfg = tipoLabel[mov.tipo] ?? { label: mov.tipo, cls: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={mov.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{(mov as any).item?.descricao ?? '\u2014'}</span>
                      <p className={`text-[10px] ${txtMuted}`}>{mov.quantidade} un · {fmtDate(mov.criado_em)}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cards — 2 colunas: Cautelas + Solicitações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Cautelas em Aberto */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Cautelas em Aberto</p>
            <button onClick={() => nav('/estoque/cautelas')} className="text-xs text-teal-500 hover:text-teal-600 font-semibold flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
          </div>
          {cautelasEmAberto.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma cautela em aberto.</p>
          ) : (
            <div className="space-y-2">
              {cautelasEmAberto.slice(0, 5).map(c => {
                const today = new Date().toISOString().split('T')[0]
                const vencida = c.data_devolucao_prevista && c.data_devolucao_prevista < today
                return (
                  <div key={c.id} className={`flex items-center justify-between gap-2 rounded-lg p-2 ${vencida ? (isDark ? 'bg-red-500/5 border border-red-500/10' : 'bg-red-50 border border-red-100') : 'bg-transparent'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {vencida && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                        <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{c.solicitante_nome}</span>
                      </div>
                      <p className={`text-[10px] ${txtMuted}`}>{c.obra_nome ?? '\u2014'} · Dev: {fmtDate(c.data_devolucao_prevista)}</p>
                    </div>
                    {vencida ? (
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-700'}`}>Vencida</span>
                    ) : (
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>Em aberto</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Solicitações Pendentes */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Solicitações Pendentes</p>
            <button onClick={() => nav('/estoque/solicitacoes')} className="text-xs text-teal-500 hover:text-teal-600 font-semibold flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
          </div>
          {solicitacoesPendentes.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma solicitação pendente.</p>
          ) : (
            <div className="space-y-2">
              {solicitacoesPendentes.slice(0, 5).map(sol => {
                const urgenciaMap: Record<string, { label: string; cls: string }> = {
                  normal: { label: 'Normal', cls: isDark ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-100 text-slate-600' },
                  urgente: { label: 'Urgente', cls: isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700' },
                  emergencia: { label: 'Emergência', cls: isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-700' },
                }
                const urg = urgenciaMap[sol.urgencia] ?? urgenciaMap.normal
                return (
                  <div key={sol.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sol.solicitante_nome}</span>
                      <p className={`text-[10px] ${txtMuted}`}>{sol.obra_nome ?? '\u2014'} · {fmtDate(sol.criado_em)}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${urg.cls}`}>{urg.label}</span>
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
