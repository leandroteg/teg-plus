import { useQuery } from '@tanstack/react-query'
import {
  Landmark, TrendingDown, Wrench,
  ArrowRight, Zap,
  Archive, MapPin, Truck, Laptop, Grid3x3,
} from 'lucide-react'
import { usePatrimonialKPIs, useImobilizados } from '../../hooks/usePatrimonial'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

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
  const { isDark } = useTheme()
  const { data: kpis } = usePatrimonialKPIs()
  const { data: imobilizados = [] } = useImobilizados()

  // Equipamentos criticos: veiculos (frota) + notebooks
  const { data: veiculosCount = 0 } = useQuery({
    queryKey: ['pat-frota-count'],
    queryFn: async () => {
      const { count } = await supabase.from('fro_veiculos').select('id', { count: 'exact', head: true })
      return count ?? 0
    },
    staleTime: 5 * 60 * 1000,
  })
  const notebooks = imobilizados.filter(i => /noteb|noteo/i.test(i.descricao || '')).length

  const aguardandoEntrada = imobilizados.filter(i => i.status === 'pendente_registro').length
  const ativos = imobilizados.filter(i => ['ativo', 'cedido', 'em_transferencia'].includes(i.status)).length
  const emManutencao = kpis?.imobilizados_em_manutencao ?? 0
  const depreciados = imobilizados.filter(i => (i.percentual_depreciado ?? 0) >= 100 && i.status !== 'baixado').length
  const baixados = imobilizados.filter(i => i.status === 'baixado').length

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
    cur.valor += i.valor_aquisicao ?? 0
    cur.qtd += 1
    catMap.set(nome, cur)
  })
  const categorias = Array.from(catMap.values()).sort((a, b) => b.valor - a.valor)
  const maxCatVal = categorias[0]?.valor || 1

  // Valor por base (chart de barras horizontais)
  const baseMap = new Map<string, { nome: string; valor: number; qtd: number }>()
  imobilizados.filter(i => i.status !== 'baixado').forEach(i => {
    const nome = i.base_nome || 'Sem base'
    const cur = baseMap.get(nome) || { nome, valor: 0, qtd: 0 }
    cur.valor += i.valor_aquisicao ?? 0
    cur.qtd += 1
    baseMap.set(nome, cur)
  })
  const bases = Array.from(baseMap.values()).sort((a, b) => b.valor - a.valor)
  const maxBaseVal = bases[0]?.valor || 1

  // Matriz (heatmap): contagem de itens por categoria (linhas) x base (colunas)
  const ativosMatriz = imobilizados.filter(i => i.status !== 'baixado')
  const catTot = new Map<string, number>()
  const baseTot = new Map<string, number>()
  const cell = new Map<string, number>()
  ativosMatriz.forEach(i => {
    const cat = i.categoria || 'Sem categoria'
    const base = i.base_nome || 'Sem base'
    catTot.set(cat, (catTot.get(cat) ?? 0) + 1)
    baseTot.set(base, (baseTot.get(base) ?? 0) + 1)
    const k = `${cat}||${base}`
    cell.set(k, (cell.get(k) ?? 0) + 1)
  })
  const catRows = [...catTot.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
  const baseCols = [...baseTot.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
  const maxCell = Math.max(1, ...Array.from(cell.values()))

  // Top equipamentos mais caros (categoria Equipamentos) e onde estao
  const topEquip = imobilizados
    .filter(i => i.status !== 'baixado' && i.categoria === 'Equipamentos')
    .sort((a, b) => (b.valor_aquisicao ?? 0) - (a.valor_aquisicao ?? 0))
    .slice(0, 8)

  return (
    <div className="space-y-3">

      {/* ── Titulo do Painel ── */}
      <div>
        <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel Patrimonial</h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Visao geral dos ativos, depreciacao e movimentacoes</p>
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

        {/* Equipamentos Criticos — veiculos + notebooks */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Equipamentos Criticos
                </p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Ativos de maior atencao
                </h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <Zap size={14} className="text-amber-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Veiculos" value={veiculosCount} icon={Truck}
                iconTone={isDark ? 'text-sky-400' : 'text-sky-500'} note="frota da empresa" isDark={isDark} />
              <MiniInfoCard label="Notebooks" value={notebooks} icon={Laptop}
                iconTone={isDark ? 'text-violet-400' : 'text-violet-500'} note="equipamentos de TI" isDark={isDark} />
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

        {/* Valor por Base */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <MapPin size={14} className="text-teal-500" /> Valor por Base
            </h2>
          </div>
          <div className="p-4 space-y-2.5">
            {bases.length === 0 ? (
              <div className="py-8 text-center">
                <MapPin size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-200'}`} />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum ativo</p>
                <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Bases aparecem aqui</p>
              </div>
            ) : bases.slice(0, 8).map(b => (
              <div key={b.nome} className="flex items-center gap-3">
                <p className={`text-[11px] font-semibold text-right shrink-0 w-[120px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={`${b.nome} · ${b.qtd} ${b.qtd === 1 ? 'item' : 'itens'}`}>
                  {b.nome}
                </p>
                <div className="flex-1 relative">
                  <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-500"
                      style={{ width: `${Math.max((b.valor / maxBaseVal) * 100, 4)}%` }}
                    />
                  </div>
                </div>
                <p className={`text-[11px] font-extrabold shrink-0 w-[70px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {fmt(b.valor)}
                </p>
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

      {/* ── Matriz heatmap (2/3) + Top Equipamentos (1/3) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3 items-stretch">
      <section className={`rounded-2xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between gap-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Grid3x3 size={14} className="text-teal-500" /> Itens por Categoria x Base
          </h2>
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>quantidade de ativos</span>
        </div>
        {catRows.length === 0 ? (
          <p className={`text-xs p-5 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum ativo cadastrado.</p>
        ) : (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: '3px' }}>
              <thead>
                <tr>
                  <th className={`text-left font-bold px-2 py-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Categoria</th>
                  {baseCols.map(b => (
                    <th key={b} className={`px-2 py-1 text-center font-bold whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{b}</th>
                  ))}
                  <th className={`px-2 py-1 text-center font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {catRows.map(cat => (
                  <tr key={cat}>
                    <td className={`text-left font-semibold pr-2 whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{cat}</td>
                    {baseCols.map(b => {
                      const v = cell.get(`${cat}||${b}`) ?? 0
                      const t = v / maxCell
                      const txt = v === 0
                        ? (isDark ? 'text-slate-700' : 'text-slate-300')
                        : (t > 0.55 ? 'text-white' : (isDark ? 'text-slate-100' : 'text-slate-700'))
                      return (
                        <td key={b} className={`text-center font-bold rounded-md py-1.5 tabular-nums ${txt}`}
                          style={{ background: v === 0 ? (isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc') : `rgba(13,148,136,${0.12 + 0.82 * t})` }}>
                          {v || ''}
                        </td>
                      )
                    })}
                    <td className={`text-center font-extrabold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{catTot.get(cat)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`text-left font-bold pr-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total</td>
                  {baseCols.map(b => (
                    <td key={b} className={`text-center font-extrabold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{baseTot.get(b)}</td>
                  ))}
                  <td className={`text-center font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{ativosMatriz.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Top Equipamentos — mais caros e onde estao */}
      <section className={`rounded-2xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
        <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Wrench size={14} className="text-amber-500" /> Top Equipamentos
          </h2>
          <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>mais caros e onde estao</p>
        </div>
        <div className={`flex-1 divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
          {topEquip.length === 0 ? (
            <p className={`text-xs p-5 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum equipamento.</p>
          ) : topEquip.map((i, idx) => (
            <div key={i.id} className="px-4 py-2.5 flex items-center gap-2.5">
              <span className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[10px] font-extrabold ${idx < 3 ? 'bg-amber-100 text-amber-700' : (isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-100 text-slate-500')}`}>{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title={i.descricao}>{i.descricao}</p>
                <p className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <MapPin size={9} /> {i.base_nome || '—'}
                </p>
              </div>
              <p className="text-xs font-extrabold text-amber-600 shrink-0 tabular-nums">{fmt(i.valor_aquisicao ?? 0)}</p>
            </div>
          ))}
        </div>
      </section>
      </div>

    </div>
  )
}
