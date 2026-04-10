import { useNavigate } from 'react-router-dom'
import {
  Landmark, TrendingDown, Wrench, FileText,
  ArrowLeftRight, CheckCircle2, ArrowRight,
  AlertTriangle, Archive, ArrowDownUp, DollarSign,
} from 'lucide-react'
import { usePatrimonialKPIs, useImobilizados, useMovimentacoesPatrimonial } from '../../hooks/usePatrimonial'
import { useTheme } from '../../contexts/ThemeContext'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// ── SpotlightMetric (padrao Compras) ─────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
    indigo: isDark ? 'text-indigo-400' : 'text-indigo-600',
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

// ── MiniInfoCard (padrao Compras) ────────────────────────────────────────────
function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof Landmark; iconTone: string; isDark: boolean
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

// ── HorizontalStatusBar (padrao Compras) ────────────────────────────────────
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
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} ativo(s)</p>
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
            return (
              <div key={seg.key} className={`${seg.barClass} relative flex items-center justify-center transition-all`}
                style={{ width: `${Math.max(pct, 4)}%` }} title={`${seg.label}: ${seg.value}`}>
                {showLabel && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-2">
                    {seg.label} {pct >= 22 ? seg.value : ''}
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

export default function PatrimonialHome() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const { data: kpis } = usePatrimonialKPIs()
  const { data: imobilizados = [] } = useImobilizados()
  const { data: movimentacoes = [] } = useMovimentacoesPatrimonial()

  const aguardandoEntrada = imobilizados.filter(i => i.status === 'pendente_registro').length
  const ativos = imobilizados.filter(i => i.status === 'ativo').length
  const emManutencao = kpis?.imobilizados_em_manutencao ?? 0
  const depreciados = imobilizados.filter(i => (i.percentual_depreciado ?? 0) >= 100).length
  const baixados = imobilizados.filter(i => i.status === 'baixado').length
  const recentes = movimentacoes.slice(0, 6)

  const card = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'
  const borderSub = isDark ? 'border-white/[0.04]' : 'border-slate-100'

  return (
    <div className="space-y-4">
      {/* ── Spotlight KPIs ── */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <SpotlightMetric label="Total Ativos" value={kpis?.total_imobilizados ?? 0} tone="amber" isDark={isDark} />
          <SpotlightMetric label="Valor Liquido" value={fmt(kpis?.valor_total_liquido ?? 0)} tone="emerald" isDark={isDark} />
          <SpotlightMetric label="Depreciacao Acum." value={fmt(kpis?.depreciacao_acumulada ?? 0)} tone="red" note={depreciados > 0 ? `${depreciados} totalmente depreciados` : undefined} isDark={isDark} />
          <SpotlightMetric label="Valor Aquisicao" value={fmt(kpis?.valor_total_aquisicao ?? (kpis?.valor_total_liquido ?? 0) + (kpis?.depreciacao_acumulada ?? 0))} tone="indigo" isDark={isDark} />
        </div>
      </div>

      {/* ── Info Cards Row ── */}
      <div className={`rounded-2xl border overflow-hidden p-3 ${card}`}>
        <div className="flex gap-3">
          <MiniInfoCard label="Aguardando Entrada" value={aguardandoEntrada} icon={ArrowDownUp} iconTone={isDark ? 'text-violet-400' : 'text-violet-500'} isDark={isDark} />
          <MiniInfoCard label="Em Manutencao" value={emManutencao} icon={Wrench} iconTone={isDark ? 'text-amber-400' : 'text-amber-500'} isDark={isDark} />
          <MiniInfoCard label="Termos Pendentes" value={kpis?.termos_pendentes ?? 0} icon={FileText} iconTone={isDark ? 'text-red-400' : 'text-red-500'} isDark={isDark} />
          <MiniInfoCard label="Baixados" value={baixados} icon={Archive} iconTone={isDark ? 'text-slate-400' : 'text-slate-400'} isDark={isDark} />
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className={`rounded-2xl border p-4 ${card}`}>
        <HorizontalStatusBar
          title="Distribuicao por Status"
          isDark={isDark}
          emptyLabel="Nenhum ativo cadastrado"
          segments={[
            { key: 'aguardando', label: 'Aguardando',    value: aguardandoEntrada, barClass: 'bg-violet-500' },
            { key: 'ativo',      label: 'Ativos',        value: ativos,            barClass: 'bg-emerald-500' },
            { key: 'manutencao', label: 'Manutencao',    value: emManutencao,      barClass: 'bg-amber-500' },
            { key: 'depreciado', label: 'Depreciados',   value: depreciados,       barClass: 'bg-red-500' },
            { key: 'baixado',    label: 'Baixados',      value: baixados,          barClass: 'bg-slate-400' },
          ]}
        />
      </div>

      {/* ── Movimentacoes Recentes ── */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <div className={`px-4 py-3 border-b flex items-center justify-between ${borderSub}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <ArrowLeftRight size={14} className="text-amber-500" />
            Movimentacoes Recentes
          </h2>
          <button onClick={() => nav('/patrimonial/movimentacoes')} className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 hover:underline">
            Ver todas <ArrowRight size={10} />
          </button>
        </div>
        {recentes.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ArrowLeftRight size={32} className={isDark ? 'text-slate-700 mx-auto mb-2' : 'text-slate-200 mx-auto mb-2'} />
            <p className={`${isDark ? 'text-slate-500' : 'text-slate-400'} text-sm`}>Nenhuma movimentacao registrada</p>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {recentes.map(mov => (
              <div key={mov.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'} transition-colors`}>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {mov.imobilizado?.numero_patrimonio ?? '--'} — {mov.imobilizado?.descricao ?? 'Sem descricao'}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {mov.tipo} {mov.responsavel_destino ? `— ${mov.responsavel_destino}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold ${mov.confirmado ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {mov.confirmado ? 'Confirmado' : 'Pendente'}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
