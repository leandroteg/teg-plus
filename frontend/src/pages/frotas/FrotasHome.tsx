import { useMemo, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car, AlertTriangle, Wrench, RefreshCw, TrendingUp, ArrowRight,
  FileWarning, ShieldAlert, ChevronDown,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useFrotasKPIs, useOrdensServico, useVeiculos } from '../../hooks/useFrotas'
import type { FrotasKPIs } from '../../types/frotas'

const IndicadoresFrota = lazy(() => import('./paineis/IndicadoresFrota'))
const PainelMotoristas = lazy(() => import('./paineis/PainelMotoristas'))

// ── Helpers ──────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

const PRIORIDADE_COLOR: Record<string, string> = {
  critica: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  alta:    'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  media:   'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  baixa:   'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
}

// ── SpotlightMetric (padrão Compras) ─────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    rose: isDark ? 'text-rose-400' : 'text-rose-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    sky: isDark ? 'text-sky-400' : 'text-sky-600',
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
  label: string; value: string | number; note?: string; icon: typeof Car; iconTone: string; isDark: boolean
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
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} veículo(s)</p>
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
export default function FrotasHome() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const [painelAtivo, setPainelAtivo] = useState<'painel' | 'indicadores' | 'motoristas'>('painel')
  const { data: kpis, isLoading, refetch } = useFrotasKPIs()
  const { data: osAbertas = [] } = useOrdensServico({
    status: ['aberta', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'em_execucao'],
  })
  const { data: veiculos = [] } = useVeiculos()

  const cardClass = isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const bg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'

  const k = kpis as FrotasKPIs | undefined

  // OS Criticas / Altas
  const osCriticasAltas = useMemo(() =>
    osAbertas.filter(o => o.prioridade === 'critica' || o.prioridade === 'alta').slice(0, 5)
  , [osAbertas])

  // Documentos vencendo (CRLV / Seguro)
  const docsVencendo = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const lim = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    return veiculos
      .filter(v => v.status !== 'baixado')
      .filter(v => {
        const crlv = v.vencimento_crlv
        const seguro = v.vencimento_seguro
        return (crlv && crlv <= lim) || (seguro && seguro <= lim)
      })
      .map(v => {
        const crlvVencido = v.vencimento_crlv && v.vencimento_crlv < today
        const seguroVencido = v.vencimento_seguro && v.vencimento_seguro < today
        const docs: string[] = []
        if (v.vencimento_crlv && v.vencimento_crlv <= lim) docs.push(`CRLV ${fmtDate(v.vencimento_crlv)}`)
        if (v.vencimento_seguro && v.vencimento_seguro <= lim) docs.push(`Seguro ${fmtDate(v.vencimento_seguro)}`)
        return { ...v, docs, vencido: !!(crlvVencido || seguroVencido) }
      })
      .sort((a, b) => {
        if (a.vencido && !b.vencido) return -1
        if (!a.vencido && b.vencido) return 1
        return 0
      })
      .slice(0, 5)
  }, [veiculos])

  // Status bar segments
  const statusSegments = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const v of veiculos.filter(v => v.status !== 'baixado')) {
      counts[v.status] = (counts[v.status] ?? 0) + 1
    }
    return [
      { key: 'disponivel',       label: 'Disponíveis',       value: counts.disponivel ?? 0,       barClass: 'bg-emerald-500' },
      { key: 'em_uso',           label: 'Em Uso',            value: counts.em_uso ?? 0,           barClass: 'bg-sky-500' },
      { key: 'em_manutencao',    label: 'Em Manutenção',     value: counts.em_manutencao ?? 0,    barClass: 'bg-amber-500' },
      { key: 'bloqueado',        label: 'Bloqueados',        value: counts.bloqueado ?? 0,        barClass: 'bg-red-500' },
      { key: 'em_entrada',       label: 'Em Entrada',        value: counts.em_entrada ?? 0,       barClass: 'bg-violet-500' },
      { key: 'aguardando_saida', label: 'Aguardando Saída',  value: counts.aguardando_saida ?? 0, barClass: 'bg-rose-500' },
    ]
  }, [veiculos])

  // Custo mensal total
  const custoMensal = (k?.custo_manutencao_mes ?? 0) + (k?.custo_abastecimento_mes ?? 0)

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
              <Car size={22} className="text-rose-500" /> Painel de Frotas
            </h1>
            <p className={`text-xs mt-0.5 ${txtMuted}`}>Gestão da frota, manutenções e disponibilidade</p>
          </div>
          <div className="relative">
            <select
              value={painelAtivo}
              onChange={e => setPainelAtivo(e.target.value as 'painel' | 'indicadores' | 'motoristas')}
              className={`appearance-none text-xs font-semibold rounded-lg pl-3 pr-7 py-1.5 cursor-pointer border transition-all ${
                isDark
                  ? 'bg-white/[0.06] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <option value="painel">Painel</option>
              <option value="indicadores">Indicadores</option>
              <option value="motoristas">Motoristas</option>
            </select>
            <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${txtMuted}`} />
          </div>
        </div>
        <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
          <RefreshCw size={16} />
        </button>
      </div>

      {painelAtivo === 'indicadores' && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <IndicadoresFrota />
        </Suspense>
      )}

      {painelAtivo === 'motoristas' && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <PainelMotoristas />
        </Suspense>
      )}

      {painelAtivo === 'painel' && (<>
      {/* Hero 2 colunas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        {/* Núcleo da Frota */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Núcleo da Frota
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${txt}`}>
                  Indicadores gerais
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
                <Car size={18} className="text-rose-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Total Frota" value={k?.total_veiculos ?? 0} tone="rose" note={`${k?.disponiveis ?? 0} disponíveis`} isDark={isDark} />
              <SpotlightMetric label="Disponibilidade" value={`${k?.taxa_disponibilidade ?? 0}%`} tone="emerald" note={`${k?.em_uso ?? 0} em uso`} isDark={isDark} />
              <SpotlightMetric label="Custo Mensal" value={BRL(custoMensal)} tone="amber" note="manutenção + abastecimento" isDark={isDark} />
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
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(k?.preventivas_vencidas ?? 0) > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={14} className={(k?.preventivas_vencidas ?? 0) > 0 || (k?.os_criticas ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <MiniInfoCard
                label="Preventivas Vencidas"
                value={k?.preventivas_vencidas ?? 0}
                note="atenção imediata"
                icon={AlertTriangle}
                iconTone={(k?.preventivas_vencidas ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'}
                isDark={isDark}
              />
              <MiniInfoCard
                label="OS Críticas"
                value={k?.os_criticas ?? 0}
                note="abertas / em andamento"
                icon={Wrench}
                iconTone={(k?.os_criticas ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400'}
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
            <TrendingUp size={14} className="text-rose-500" /> Pulso por Situação
          </h2>
        </div>
        <div className="px-4 py-3">
          <HorizontalStatusBar
            isDark={isDark}
            title="Distribuição atual da frota"
            emptyLabel="Nenhum veículo registrado"
            segments={statusSegments}
          />
        </div>
      </section>

      {/* OS Críticas + Documentos Vencendo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* OS Criticas / Altas */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>OS Críticas / Altas</p>
            <button onClick={() => nav('/frotas/ordens-servico')} className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
          </div>
          {osCriticasAltas.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma OS crítica ou alta aberta.</p>
          ) : (
            <div className="space-y-2">
              {osCriticasAltas.map(os => (
                <div key={os.id} className={`flex items-start gap-3 p-2.5 rounded-xl ${isDark ? 'bg-white/[0.04] border border-white/[0.06]' : 'bg-slate-50 border border-slate-200'}`}>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${PRIORIDADE_COLOR[os.prioridade]}`}>
                    {os.prioridade}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{os.veiculo?.placa ?? '—'}</p>
                    <p className={`text-[10px] truncate ${txtMuted}`}>{os.descricao_problema}</p>
                  </div>
                  <span className={`text-[10px] whitespace-nowrap ml-auto shrink-0 ${txtMuted}`}>{os.numero_os ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documentos Vencendo */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Documentos Vencendo</p>
            <button onClick={() => nav('/frotas/veiculos')} className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1">Ver todos <ArrowRight size={12} /></button>
          </div>
          {docsVencendo.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhum documento vencendo em breve.</p>
          ) : (
            <div className="space-y-2">
              {docsVencendo.map(v => (
                <div key={v.id} className={`flex items-center justify-between gap-2 rounded-lg p-2 ${
                  v.vencido
                    ? (isDark ? 'bg-red-500/5 border border-red-500/10' : 'bg-red-50 border border-red-100')
                    : (isDark ? 'bg-amber-500/5 border border-amber-500/10' : 'bg-amber-50 border border-amber-100')
                }`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {v.vencido
                        ? <ShieldAlert size={11} className="text-red-500 shrink-0" />
                        : <FileWarning size={11} className="text-amber-500 shrink-0" />
                      }
                      <span className={`text-xs font-semibold truncate ${
                        v.vencido
                          ? (isDark ? 'text-red-300' : 'text-red-700')
                          : (isDark ? 'text-amber-300' : 'text-amber-700')
                      }`}>{v.placa} — {v.marca} {v.modelo}</span>
                    </div>
                    <p className={`text-[10px] ${txtMuted}`}>{v.docs.join(' · ')}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    v.vencido
                      ? (isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-700')
                      : (isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700')
                  }`}>{v.vencido ? 'Vencido' : 'Vencendo'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>)}
    </div>
  )
}
