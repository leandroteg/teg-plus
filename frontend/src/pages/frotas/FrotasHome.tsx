import { AlertTriangle, Car, Wrench, Fuel, Radio, TrendingUp, Clock } from 'lucide-react'
import { useFrotasKPIs, useOrdensServico, useVeiculos, useOcorrenciasTel } from '../../hooks/useFrotas'
import type { FrotasKPIs } from '../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const PRIORIDADE_COLOR: Record<string, string> = {
  critica: 'bg-red-500/15 text-red-300 border-red-500/30',
  alta:    'bg-orange-500/15 text-orange-300 border-orange-500/30',
  media:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  baixa:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

const STATUS_VEICULO_DOT: Record<string, string> = {
  disponivel:     'bg-emerald-400',
  em_uso:         'bg-sky-400',
  em_manutencao:  'bg-amber-400',
  bloqueado:      'bg-red-400',
  baixado:        'bg-slate-600',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent = 'rose', warn = false,
}: {
  label: string; value: string | number; sub?: string; accent?: string; warn?: boolean
}) {
  const border = warn ? 'border-l-red-500' : `border-l-${accent}-500`
  return (
    <div className={`glass-card rounded-2xl p-4 border-l-4 ${border}`}>
      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Disponibilidade circular ──────────────────────────────────────────────────
function DisponibilidadeGauge({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444'
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.5" fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black text-white">{pct}%</span>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FrotasHome() {
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
        <h1 className="text-xl font-bold text-white">Painel de Frotas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Visão geral da frota, manutenções e ocorrências</p>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total da Frota"    value={k?.total_veiculos ?? 0} sub={`${k?.disponiveis ?? 0} disponíveis`} accent="rose" />
            <KpiCard label="Disponibilidade"   value={`${k?.taxa_disponibilidade ?? 0}%`} sub={`${k?.em_uso ?? 0} em uso`} accent="emerald" />
            <KpiCard label="OS Abertas"        value={k?.os_abertas ?? 0} sub={`${k?.os_criticas ?? 0} críticas`} accent="orange" warn={(k?.os_criticas ?? 0) > 0} />
            <KpiCard label="Em Manutenção"     value={(k?.em_manutencao ?? 0) + (k?.bloqueados ?? 0)} sub={`${k?.bloqueados ?? 0} bloqueados`} accent="amber" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Prev. Vencidas"    value={k?.preventivas_vencidas ?? 0} sub="atenção imediata" accent="red" warn={(k?.preventivas_vencidas ?? 0) > 0} />
            <KpiCard label="Prev. em 7 dias"   value={k?.preventivas_proximas_7d ?? 0} sub="programar" accent="amber" />
            <KpiCard label="Custo Manutenção"  value={BRL(k?.custo_manutencao_mes ?? 0)} sub="mês atual" accent="rose" />
            <KpiCard label="Custo Abastecimento" value={BRL(k?.custo_abastecimento_mes ?? 0)} sub="mês atual" accent="blue" />
          </div>
        </>
      )}

      {/* ── Status dos Veículos ───────────────────────────────── */}
      {(veiculos ?? []).length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Car size={15} className="text-rose-400" />
              Status da Frota
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              {[
                ['disponivel','bg-emerald-400','Disponível'],
                ['em_uso','bg-sky-400','Em Uso'],
                ['em_manutencao','bg-amber-400','Manutenção'],
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/4 border border-white/5 text-[11px] text-slate-300"
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_VEICULO_DOT[v.status] ?? 'bg-slate-600'}`} />
                {v.placa}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Grid: OS + Ocorrências ───────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* OS Críticas/Altas */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Wrench size={15} className="text-orange-400" />
            OS Críticas / Altas Abertas
            {osCriticasAltas.length > 0 && (
              <span className="ml-auto text-[10px] bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                {osCriticasAltas.length}
              </span>
            )}
          </h2>

          {osCriticasAltas.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Nenhuma OS crítica ou alta aberta</p>
          ) : osCriticasAltas.map(os => (
            <div key={os.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/3 border border-white/5">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${PRIORIDADE_COLOR[os.prioridade]}`}>
                {os.prioridade}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{os.veiculo?.placa}</p>
                <p className="text-[11px] text-slate-400 truncate">{os.descricao_problema}</p>
              </div>
              <span className="text-[10px] text-slate-500 whitespace-nowrap ml-auto">{os.numero_os ?? '—'}</span>
            </div>
          ))}
        </div>

        {/* Ocorrências Telemetria */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Radio size={15} className="text-rose-400" />
            Ocorrências Pendentes
            {otelPendentes.length > 0 && (
              <span className="ml-auto text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                {otelPendentes.length}
              </span>
            )}
          </h2>

          {otelPendentes.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Nenhuma ocorrência pendente</p>
          ) : otelPendentes.map(oc => (
            <div key={oc.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/3 border border-white/5">
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{oc.veiculo?.placa}</p>
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
        <div className="glass-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-emerald-400" />
            Composição da Frota
          </h2>
          <div className="flex items-center gap-6">
            <DisponibilidadeGauge pct={k.taxa_disponibilidade} />
            <div className="flex-1 space-y-2">
              {[
                { label: 'Disponíveis',   val: k.disponiveis,    color: 'bg-emerald-500' },
                { label: 'Em Uso',        val: k.em_uso,         color: 'bg-sky-500' },
                { label: 'Manutenção',    val: k.em_manutencao,  color: 'bg-amber-500' },
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
