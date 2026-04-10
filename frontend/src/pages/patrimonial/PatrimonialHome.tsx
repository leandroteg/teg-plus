import { useNavigate } from 'react-router-dom'
import {
  Landmark, TrendingDown, Wrench, FileText,
  ArrowLeftRight, ArrowRight, Zap,
  Archive, ArrowDownUp, Clock, ChevronRight,
} from 'lucide-react'
import { usePatrimonialKPIs, useImobilizados, useMovimentacoesPatrimonial } from '../../hooks/usePatrimonial'
import { useTheme } from '../../contexts/ThemeContext'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// ── SpotlightMetric ──────────────────────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
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
  const recentes = movimentacoes.slice(0, 8)

  const cardClass = isDark
    ? 'bg-[#111827] border border-white/[0.06]'
    : 'bg-white border border-slate-200'

  // Status distribution for bar
  const statusSegments = [
    { key: 'aguardando', label: 'Aguardando',  value: aguardandoEntrada, barClass: 'bg-violet-500' },
    { key: 'ativo',      label: 'Ativos',      value: ativos,            barClass: 'bg-emerald-500' },
    { key: 'manutencao', label: 'Manutencao',  value: emManutencao,      barClass: 'bg-amber-500' },
    { key: 'depreciado', label: 'Depreciados', value: depreciados,       barClass: 'bg-red-500' },
    { key: 'baixado',    label: 'Baixados',    value: baixados,          barClass: 'bg-slate-400' },
  ]
  const totalAtivos = statusSegments.reduce((s, seg) => s + seg.value, 0)

  // Categorias para chart
  const catMap = new Map<string, { nome: string; valor: number; qtd: number }>()
  imobilizados.filter(i => i.status !== 'baixado').forEach(i => {
    const nome = i.categoria || 'Sem categoria'
    const cur = catMap.get(nome) || { nome, valor: 0, qtd: 0 }
    cur.valor += i.valor_liquido ?? i.valor_aquisicao ?? 0
    cur.qtd += 1
    catMap.set(nome, cur)
  })
  const categorias = Array.from(catMap.values()).sort((a, b) => b.valor - a.valor)
  const maxCatVal = categorias[0]?.valor || 1

  return (
    <div className="space-y-3">

      {/* ── Titulo do Painel ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel Patrimonial</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Visao geral dos ativos, depreciacao e movimentacoes</p>
        </div>
        <button
          onClick={() => nav('/patrimonial/movimentacoes?nova=1')}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeftRight size={15} /> Nova Movimentacao
        </button>
      </div>

      {/* ── Hero: Indicadores + Janela Critica ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">

        {/* Indicadores */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Gestao Patrimonial
                </p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Indicadores do portfolio
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <Landmark size={18} className="text-amber-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Total Ativos" value={kpis?.total_imobilizados ?? 0} tone="amber" isDark={isDark} note={`${ativos} em uso`} />
              <SpotlightMetric label="Valor Liquido" value={fmt(kpis?.valor_total_liquido ?? 0)} tone="emerald" isDark={isDark} note="valor contabil atual" />
              <SpotlightMetric label="Depreciacao Acum." value={fmt(kpis?.depreciacao_acumulada ?? 0)} tone="red" isDark={isDark} note={depreciados > 0 ? `${depreciados} totalmente depreciados` : 'nenhum 100% depreciado'} />
            </div>
          </div>
        </section>

        {/* Janela Critica — somente 2 cards */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Janela Critica
                </p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
              <MiniInfoCard label="Aguardando Entrada" value={aguardandoEntrada} icon={ArrowDownUp}
                iconTone={aguardandoEntrada > 0 ? (isDark ? 'text-violet-400' : 'text-violet-500') : 'text-slate-400'}
                note={aguardandoEntrada > 0 ? 'pendentes de registro' : 'tudo ok'} isDark={isDark} />
              <MiniInfoCard label="Termos Pendentes" value={kpis?.termos_pendentes ?? 0} icon={FileText}
                iconTone={(kpis?.termos_pendentes ?? 0) > 0 ? (isDark ? 'text-red-400' : 'text-red-500') : 'text-slate-400'}
                note="responsabilidade" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* ── Pulso por Status (barra) ── */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Landmark size={14} className="text-amber-500" /> Pulso por Status
          </h2>
          <div className="flex items-center gap-3">
            {statusSegments.filter(s => s.value > 0).map(s => (
              <span key={s.key} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${s.barClass}`} />
                <span className="text-[10px] text-slate-500">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          {totalAtivos === 0 ? (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              Nenhum ativo cadastrado
            </div>
          ) : (
            <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
              {statusSegments.filter(s => s.value > 0).map(seg => {
                const pct = (seg.value / totalAtivos) * 100
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
        </div>
      </section>

      {/* ── Row: Movimentacoes Recentes + Por Categoria ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">

        {/* Movimentacoes Recentes */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Clock size={14} className="text-slate-500" /> Movimentacoes Recentes
            </h2>
            <button onClick={() => nav('/patrimonial/movimentacoes')} className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">
              Ver todas <ChevronRight size={11} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {recentes.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <ArrowLeftRight size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-200'}`} />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma movimentacao</p>
                <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Movimentacoes aparecem aqui</p>
              </div>
            ) : recentes.map(mov => (
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
        </section>

        {/* Valor por Categoria */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Landmark size={14} className="text-amber-500" /> Valor por Categoria
            </h2>
          </div>
          <div className="p-4 space-y-2.5">
            {categorias.length === 0 ? (
              <div className="py-8 text-center">
                <Archive size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-200'}`} />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum ativo</p>
                <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Categorias aparecem aqui</p>
              </div>
            ) : categorias.slice(0, 8).map(c => (
              <div key={c.nome} className="flex items-center gap-3">
                <p className={`text-[11px] font-semibold text-right shrink-0 w-[120px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {c.nome}
                </p>
                <div className="flex-1 relative">
                  <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                      style={{ width: `${Math.max((c.valor / maxCatVal) * 100, 4)}%` }}
                    />
                  </div>
                </div>
                <p className={`text-[11px] font-extrabold shrink-0 w-[70px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {fmt(c.valor)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

    </div>
  )
}
