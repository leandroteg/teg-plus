import { BarChart3, AlertTriangle, TrendingUp } from 'lucide-react'
import {
  useVeiculos,
  useFrotasKPIs,
  useAlocacoes,
  useMultas,
  useAbastecimentos,
  useOrdensServico,
} from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Circular Gauge ────────────────────────────────────────────────────────────
function CircularGauge({
  value,
  max = 100,
  color = '#14b8a6',
  size = 72,
}: {
  value: number
  max?: number
  color?: string
  size?: number
}) {
  const radius = (size - 10) / 2
  const circ = 2 * Math.PI * radius
  const pct = Math.min(value / max, 1)
  const dash = pct * circ
  const gap = circ - dash

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={8}
        stroke="currentColor"
        className="text-slate-200 dark:text-white/10"
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={8}
        stroke={color}
        fill="none"
        strokeDasharray={`${dash} ${gap}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  accent: string
  alert?: boolean
  gauge?: { pct: number; color: string }
  isLight: boolean
}

function KpiCard({ label, value, sub, accent, alert, gauge, isLight }: KpiCardProps) {
  return (
    <div
      className={`rounded-2xl shadow-sm border-l-4 p-4 flex items-center gap-4 ${accent} ${
        isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
      } ${alert ? 'ring-1 ring-red-500/40' : ''}`}
    >
      {gauge && (
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 72, height: 72 }}>
          <CircularGauge value={gauge.pct} color={gauge.color} />
          <span
            className={`absolute text-sm font-black ${isLight ? 'text-slate-800' : 'text-white'}`}
            style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
          >
            {Math.round(gauge.pct)}%
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p
          className={`text-2xl font-black leading-none ${
            alert ? 'text-red-500' : isLight ? 'text-slate-800' : 'text-white'
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
      </div>
      {alert && <AlertTriangle size={18} className="text-red-400 shrink-0" />}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Indicadores() {
  const { isLightSidebar: isLight } = useTheme()

  const mesAtual = new Date().toISOString().slice(0, 7)

  const { data: veiculos = [] }    = useVeiculos()
  const { data: kpis }             = useFrotasKPIs()
  const { data: alocacoes = [] }   = useAlocacoes({ status: 'ativa' })
  const { data: multas = [] }      = useMultas()
  const { data: abastecimentos = [] } = useAbastecimentos({ mes: mesAtual })
  const { data: ordens = [] }      = useOrdensServico({ status: 'concluida' })

  // ── Derived metrics ────────────────────────────────────────────────────────
  const totalAtivos   = veiculos.filter(v => v.status !== 'baixado').length
  const disponiveis   = veiculos.filter(v => v.status === 'disponivel').length
  const disponibilidadePct = totalAtivos > 0 ? Math.round((disponiveis / totalAtivos) * 100) : 0

  const custoAbastMes = abastecimentos.reduce((s, a) => s + (a.valor_total ?? 0), 0)
  const custoMultasMes = multas
    .filter(m => m.status === 'paga' && m.data_pagamento?.startsWith(mesAtual))
    .reduce((s, m) => s + m.valor, 0)
  const custoTotalMes = custoAbastMes + custoMultasMes

  const osConcluidas = ordens.filter(o => {
    const dt = (o as { data_conclusao?: string }).data_conclusao
    return dt?.startsWith(mesAtual)
  }).length

  const ativosLocados = veiculos.filter(v => v.propriedade === 'locada' && v.status !== 'baixado').length

  const multasAbertas = multas
    .filter(m => m.status === 'recebida' || m.status === 'vencida')
    .reduce((s, m) => s + m.valor, 0)
  const multasAbertasQtd = multas.filter(m => m.status === 'recebida' || m.status === 'vencida').length

  const preventivasVencidas = kpis?.preventivas_vencidas ?? 0

  const alocacoesAtivas = alocacoes.length

  // ── Gauge colors ───────────────────────────────────────────────────────────
  const dispColor =
    disponibilidadePct >= 80 ? '#10b981' : disponibilidadePct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 size={20} className="text-teal-500" />
        <div>
          <h1 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Indicadores de Frota
          </h1>
          <p className="text-sm text-slate-500">Painel analítico — {mesAtual}</p>
        </div>
      </div>

      {/* KPI Grid — Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Disponibilidade"
          value={`${disponibilidadePct}%`}
          sub={`${disponiveis} de ${totalAtivos} ativos`}
          accent="border-l-teal-500"
          gauge={{ pct: disponibilidadePct, color: dispColor }}
          isLight={isLight}
        />
        <KpiCard
          label="Custo Total Mês"
          value={BRL(custoTotalMes)}
          sub={`Combust. ${BRL(custoAbastMes)} + Multas ${BRL(custoMultasMes)}`}
          accent="border-l-violet-500"
          isLight={isLight}
        />
        <KpiCard
          label="OS Concluídas no Mês"
          value={osConcluidas}
          sub="ordens de serviço"
          accent="border-l-emerald-500"
          isLight={isLight}
        />
        <KpiCard
          label="Ativos Locados"
          value={ativosLocados}
          sub="veículos/máquinas"
          accent="border-l-sky-500"
          isLight={isLight}
        />
      </div>

      {/* KPI Grid — Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Multas em Aberto"
          value={BRL(multasAbertas)}
          sub={`${multasAbertasQtd} registro${multasAbertasQtd !== 1 ? 's' : ''}`}
          accent={multasAbertasQtd > 0 ? 'border-l-red-500' : 'border-l-slate-400'}
          alert={multasAbertasQtd > 0}
          isLight={isLight}
        />
        <KpiCard
          label="Frota Total"
          value={totalAtivos}
          sub="ativos cadastrados"
          accent="border-l-slate-500"
          isLight={isLight}
        />
        <KpiCard
          label="Alocações Ativas"
          value={alocacoesAtivas}
          sub="veículos em campo"
          accent="border-l-rose-500"
          isLight={isLight}
        />
        <KpiCard
          label="Preventivas Vencidas"
          value={preventivasVencidas}
          sub="requer atenção"
          accent={preventivasVencidas > 0 ? 'border-l-red-500' : 'border-l-slate-400'}
          alert={preventivasVencidas > 0}
          isLight={isLight}
        />
      </div>

      {/* Status breakdown */}
      <div
        className={`rounded-2xl shadow-sm border p-4 ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'
        }`}
      >
        <p
          className={`text-sm font-bold mb-3 flex items-center gap-2 ${
            isLight ? 'text-slate-700' : 'text-white'
          }`}
        >
          <TrendingUp size={15} className="text-teal-500" /> Status da Frota
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(
            [
              { label: 'Disponível',     count: veiculos.filter(v => v.status === 'disponivel').length,      cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
              { label: 'Em Uso',         count: veiculos.filter(v => v.status === 'em_uso').length,           cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
              { label: 'Em Manutenção',  count: veiculos.filter(v => v.status === 'em_manutencao').length,   cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
              { label: 'Bloqueado',      count: veiculos.filter(v => v.status === 'bloqueado').length,        cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
              { label: 'Baixado',        count: veiculos.filter(v => v.status === 'baixado').length,          cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
            ] as const
          ).map(s => (
            <div key={s.label} className={`rounded-xl p-3 text-center ${s.cls}`}>
              <p className="text-2xl font-black">{s.count}</p>
              <p className="text-[10px] font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
