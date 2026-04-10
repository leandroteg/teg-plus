import { useNavigate } from 'react-router-dom'
import {
  Landmark, TrendingDown, Wrench, FileText,
  ArrowLeftRight, ArrowRight, Zap, CalendarClock,
  Archive, ArrowDownUp,
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
    teal: isDark ? 'text-teal-400' : 'text-teal-600',
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

// ── HorizontalStatusBar ─────────────────────────────────────────────────────
function HorizontalStatusBar({ segments, isDark }: {
  segments: { key: string; label: string; value: number; barClass: string }[]
  isDark: boolean
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Distribuicao por Status</p>
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} ativo(s)</p>
      </div>
      {total === 0 ? (
        <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
          Nenhum ativo cadastrado
        </div>
      ) : (
        <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          {segments.filter(s => s.value > 0).map(seg => {
            const pct = (seg.value / total) * 100
            return (
              <div key={seg.key} className={`${seg.barClass} relative flex items-center justify-center transition-all`}
                style={{ width: `${Math.max(pct, 4)}%` }} title={`${seg.label}: ${seg.value}`}>
                {pct >= 14 && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-2">
                    {seg.label} {pct >= 22 ? seg.value : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
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
  const ativos = imobilizados.filter(i => ['ativo', 'cedido', 'em_transferencia'].includes(i.status)).length
  const emManutencao = kpis?.imobilizados_em_manutencao ?? 0
  const depreciados = imobilizados.filter(i => (i.percentual_depreciado ?? 0) >= 100 && i.status !== 'baixado').length
  const baixados = imobilizados.filter(i => i.status === 'baixado').length
  const recentes = movimentacoes.slice(0, 6)

  const cardClass = isDark
    ? 'bg-[#111827] border border-white/[0.06]'
    : 'bg-white border border-slate-200'

  return (
    <div className="space-y-4">
      {/* ── Row 1: Indicadores + Janela Critica ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Indicadores (3/5) */}
        <section className={`lg:col-span-3 rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Gestao Patrimonial
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Indicadores do portfolio
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <Landmark size={18} className="text-amber-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Total Ativos" value={kpis?.total_imobilizados ?? 0} tone="amber" isDark={isDark} note={`${ativos} em uso`} />
              <SpotlightMetric label="Valor Liquido" value={fmt(kpis?.valor_total_liquido ?? 0)} tone="emerald" isDark={isDark} />
              <SpotlightMetric label="Depreciacao Acum." value={fmt(kpis?.depreciacao_acumulada ?? 0)} tone="red" isDark={isDark} note={depreciados > 0 ? `${depreciados} totalmente depreciados` : 'nenhum 100% depreciado'} />
            </div>
          </div>
        </section>

        {/* Janela Critica (2/5) */}
        <section className={`lg:col-span-2 rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Janela Critica
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  O que exige acao agora
                </h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                (aguardandoEntrada + (kpis?.termos_pendentes ?? 0)) > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'
              }`}>
                <Zap size={14} className={(aguardandoEntrada + (kpis?.termos_pendentes ?? 0)) > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Aguardando Entrada" value={aguardandoEntrada} icon={ArrowDownUp} iconTone={aguardandoEntrada > 0 ? (isDark ? 'text-violet-400' : 'text-violet-500') : 'text-slate-400'} note={aguardandoEntrada > 0 ? 'pendentes de registro' : 'tudo ok'} isDark={isDark} />
              <MiniInfoCard label="Termos Pendentes" value={kpis?.termos_pendentes ?? 0} icon={FileText} iconTone={(kpis?.termos_pendentes ?? 0) > 0 ? (isDark ? 'text-red-400' : 'text-red-500') : 'text-slate-400'} note="responsabilidade" isDark={isDark} />
              <MiniInfoCard label="Em Manutencao" value={emManutencao} icon={Wrench} iconTone={emManutencao > 0 ? (isDark ? 'text-amber-400' : 'text-amber-500') : 'text-slate-400'} isDark={isDark} />
              <MiniInfoCard label="Baixados" value={baixados} icon={Archive} iconTone="text-slate-400" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* ── Row 2: Status Bar ── */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className="px-4 py-3">
          <HorizontalStatusBar
            isDark={isDark}
            segments={[
              { key: 'aguardando', label: 'Aguardando',  value: aguardandoEntrada, barClass: 'bg-violet-500' },
              { key: 'ativo',      label: 'Ativos',      value: ativos,            barClass: 'bg-emerald-500' },
              { key: 'manutencao', label: 'Manutencao',  value: emManutencao,      barClass: 'bg-amber-500' },
              { key: 'depreciado', label: 'Depreciados', value: depreciados,       barClass: 'bg-red-500' },
              { key: 'baixado',    label: 'Baixados',    value: baixados,          barClass: 'bg-slate-400' },
            ]}
          />
        </div>
      </section>

      {/* ── Row 3: Movimentacoes Recentes ── */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`}>
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
            <ArrowLeftRight size={32} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-200'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma movimentacao registrada</p>
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
      </section>
    </div>
  )
}
