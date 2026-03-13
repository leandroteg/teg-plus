import { AlertTriangle, Car, Wrench, Fuel, Radio, TrendingUp, Clock } from 'lucide-react'
import { useFrotasKPIs, useOrdensServico, useVeiculos, useOcorrenciasTel } from '../../hooks/useFrotas'
import { useTheme } from '../../contexts/ThemeContext'
import type { FrotasKPIs } from '../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const PRIORIDADE_COLOR: Record<string, string> = {
  critica: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  alta:    'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  media:   'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  baixa:   'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
}

const STATUS_VEICULO_DOT: Record<string, string> = {
  disponivel:     'bg-emerald-400',
  em_uso:         'bg-sky-400',
  em_manutencao:  'bg-amber-400',
  bloqueado:      'bg-red-400',
  baixado:        'bg-slate-600',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const ACCENT_BORDER: Record<string, string> = {
  teal: 'border-l-teal-500',
  emerald: 'border-l-emerald-500',
  orange: 'border-l-orange-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
  blue: 'border-l-blue-500',
  violet: 'border-l-violet-500',
  rose: 'border-l-rose-500',
}

function KpiCard({
  label, value, sub, accent = 'teal', warn = false, isLight = false,
}: {
  label: string; value: string | number; sub?: string; accent?: string; warn?: boolean; isLight?: boolean
}) {
  const border = warn ? 'border-l-red-500' : (ACCENT_BORDER[accent] ?? 'border-l-teal-500')
  return (
    <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'} rounded-2xl border p-4 border-l-4 ${border}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Disponibilidade circular ──────────────────────────────────────────────────
function DisponibilidadeGauge({ pct, isLight = false }: { pct: number; isLight?: boolean }) {
  const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444'
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'} strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.5" fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{pct}%</span>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FrotasHome() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: kpis, isLoading } = useFrotasKPIs()
  const { data: osAbertas }       = useOrdensServico({
    status: ['aberta', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'em_execucao'],
  })
  const { data: veiculos }        = useVeiculos()
  const { data: ocorrencias }     = useOcorrenciasTel({ status: 'registrada' })

  const k = kpis as FrotasKPIs | undefined

  const osCriticasAltas = (osAbertas ?? [])
    .filter(o => o.prioridade === 'critica' || o.prioridade === 'alta')
    .slice(0, 5)

  const otelPendentes = (ocorrencias ?? []).slice(0, 5)

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Painel de Frotas</h1>
        <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Visao geral da frota, manutencoes e ocorrencias</p>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'} rounded-2xl border h-20 animate-pulse`} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total da Frota"    value={k?.total_veiculos ?? 0} sub={`${k?.disponiveis ?? 0} disponiveis`} accent="teal" isLight={isLight} />
            <KpiCard label="Disponibilidade"   value={`${k?.taxa_disponibilidade ?? 0}%`} sub={`${k?.em_uso ?? 0} em uso`} accent="emerald" isLight={isLight} />
            <KpiCard label="OS Abertas"        value={k?.os_abertas ?? 0} sub={`${k?.os_criticas ?? 0} criticas`} accent="orange" warn={(k?.os_criticas ?? 0) > 0} isLight={isLight} />
            <KpiCard label="Em Manutencao"     value={(k?.em_manutencao ?? 0) + (k?.bloqueados ?? 0)} sub={`${k?.bloqueados ?? 0} bloqueados`} accent="amber" isLight={isLight} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KpiCard label="Prev. Vencidas"    value={k?.preventivas_vencidas ?? 0} sub="atencao imediata" accent="red" warn={(k?.preventivas_vencidas ?? 0) > 0} isLight={isLight} />
            <KpiCard label="Prev. em 7 dias"   value={k?.preventivas_proximas_7d ?? 0} sub="programar" accent="amber" isLight={isLight} />
            <KpiCard label="Custo Manutencao"  value={BRL(k?.custo_manutencao_mes ?? 0)} sub="mes atual" accent="teal" isLight={isLight} />
            <KpiCard label="Custo Abastecimento" value={BRL(k?.custo_abastecimento_mes ?? 0)} sub="mes atual" accent="blue" isLight={isLight} />
            <KpiCard label="Ocorrencias" value={k?.ocorrencias_abertas ?? 0} sub="pendentes" accent="violet" warn={(k?.ocorrencias_abertas ?? 0) > 0} isLight={isLight} />
          </div>
        </>
      )}

      {/* ── Status dos Veiculos ───────────────────────────────── */}
      {(veiculos ?? []).length > 0 && (
        <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'} rounded-2xl border p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <Car size={15} className="text-teal-500" />
              Status da Frota
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              {[
                ['disponivel','bg-emerald-400','Disponivel'],
                ['em_uso','bg-sky-400','Em Uso'],
                ['em_manutencao','bg-amber-400','Manutencao'],
                ['bloqueado','bg-red-400','Bloqueado'],
              ].map(([, dotCls, lbl]) => (
                <span key={lbl} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${dotCls}`} />
                  {lbl}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(veiculos ?? []).filter(v => v.status !== 'baixado').map(v => (
              <div
                key={v.id}
                title={`${v.marca} ${v.modelo} — ${v.status.replace('_',' ')}`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] ${
                  isLight
                    ? 'bg-slate-100 border border-slate-200 text-slate-600'
                    : 'bg-white/[0.04] border border-white/[0.06] text-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_VEICULO_DOT[v.status] ?? 'bg-slate-600'}`} />
                {v.placa}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Grid: OS + Ocorrencias ───────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* OS Criticas/Altas */}
        <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'} rounded-2xl border p-4 space-y-2`}>
          <h2 className={`text-sm font-semibold flex items-center gap-2 mb-3 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Wrench size={15} className="text-orange-400" />
            OS Criticas / Altas Abertas
            {osCriticasAltas.length > 0 && (
              <span className="ml-auto text-[10px] bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                {osCriticasAltas.length}
              </span>
            )}
          </h2>

          {osCriticasAltas.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Nenhuma OS critica ou alta aberta</p>
          ) : osCriticasAltas.map(os => (
            <div key={os.id} className={`flex items-start gap-3 p-2.5 rounded-xl ${
              isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/[0.04] border border-white/[0.06]'
            }`}>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${PRIORIDADE_COLOR[os.prioridade]}`}>
                {os.prioridade}
              </span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{os.veiculo?.placa}</p>
                <p className="text-[11px] text-slate-400 truncate">{os.descricao_problema}</p>
              </div>
              <span className="text-[10px] text-slate-500 whitespace-nowrap ml-auto">{os.numero_os ?? '—'}</span>
            </div>
          ))}
        </div>

        {/* Ocorrencias Telemetria */}
        <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'} rounded-2xl border p-4 space-y-2`}>
          <h2 className={`text-sm font-semibold flex items-center gap-2 mb-3 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Radio size={15} className="text-teal-500" />
            Ocorrencias Pendentes
            {otelPendentes.length > 0 && (
              <span className="ml-auto text-[10px] bg-red-500/15 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                {otelPendentes.length}
              </span>
            )}
          </h2>

          {otelPendentes.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Nenhuma ocorrencia pendente</p>
          ) : otelPendentes.map(oc => (
            <div key={oc.id} className={`flex items-start gap-3 p-2.5 rounded-xl ${
              isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/[0.04] border border-white/[0.06]'
            }`}>
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{oc.veiculo?.placa}</p>
                <p className="text-[11px] text-slate-400">{oc.tipo_ocorrencia.replace(/_/g, ' ')}</p>
              </div>
              <span className="text-[10px] text-slate-500 whitespace-nowrap ml-auto">
                {new Date(oc.data_ocorrencia).toLocaleDateString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Disponibilidade Visual ────────────────────────────── */}
      {k && (
        <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'} rounded-2xl border p-4`}>
          <h2 className={`text-sm font-semibold flex items-center gap-2 mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <TrendingUp size={15} className="text-emerald-400" />
            Composicao da Frota
          </h2>
          <div className="flex items-center gap-6">
            <DisponibilidadeGauge pct={k.taxa_disponibilidade} isLight={isLight} />
            <div className="flex-1 space-y-2">
              {[
                { label: 'Disponiveis',   val: k.disponiveis,    color: 'bg-emerald-500' },
                { label: 'Em Uso',        val: k.em_uso,         color: 'bg-sky-500' },
                { label: 'Manutencao',    val: k.em_manutencao,  color: 'bg-amber-500' },
                { label: 'Bloqueados',    val: k.bloqueados,     color: 'bg-red-500' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-2">
                  <div className={`h-1.5 rounded-full ${row.color}`} style={{ width: `${k.total_veiculos ? (row.val / k.total_veiculos) * 100 : 0}%`, minWidth: row.val > 0 ? 4 : 0 }} />
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{row.label} ({row.val})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
