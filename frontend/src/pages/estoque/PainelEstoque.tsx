import { useMemo } from 'react'
import { Package2, DollarSign, AlertTriangle, ArrowLeftRight, FileBox, Target } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useEstoqueKPIs, useEstoqueItens, useSaldos, useSaldosAbaixoMinimo,
} from '../../hooks/useEstoque'

const fmtMoeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0)

const ABC_COR: Record<string, string> = { A: '#14b8a6', B: '#3b82f6', C: '#94a3b8' }

export default function PainelEstoque() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight

  const { data: kpis, isLoading } = useEstoqueKPIs()
  const { data: itens = [] } = useEstoqueItens()
  const { data: saldos = [] } = useSaldos()
  const { data: abaixoMinimo = [] } = useSaldosAbaixoMinimo()

  // valor_medio por item (do catálogo) para cruzar com saldos
  const valorMedioPorItem = useMemo(() => {
    const m = new Map<string, number>()
    itens.forEach(i => m.set(i.id, i.valor_medio ?? 0))
    return m
  }, [itens])

  // Distribuição Curva ABC (catálogo)
  const abc = useMemo(() => {
    const c: Record<string, number> = { A: 0, B: 0, C: 0 }
    itens.forEach(i => { const k = (i.curva_abc ?? 'C'); c[k] = (c[k] ?? 0) + 1 })
    const total = c.A + c.B + c.C || 1
    return (['A', 'B', 'C'] as const).map(k => ({ curva: k, qtd: c[k], pct: (c[k] / total) * 100 }))
  }, [itens])

  // Top categorias do catálogo (por nº de itens)
  const categorias = useMemo(() => {
    const m = new Map<string, number>()
    itens.forEach(i => {
      const cat = (i.categoria?.trim() || '(sem categoria)')
      m.set(cat, (m.get(cat) ?? 0) + 1)
    })
    const arr = [...m.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 8)
    const max = arr[0]?.qtd || 1
    return arr.map(x => ({ ...x, pct: (x.qtd / max) * 100 }))
  }, [itens])

  // Valor em estoque por base (saldos × valor_medio)
  const valorPorBase = useMemo(() => {
    const m = new Map<string, number>()
    saldos.forEach(s => {
      const nome = s.base?.nome || '—'
      const valor = (s.saldo ?? 0) * (valorMedioPorItem.get(s.item_id) ?? 0)
      m.set(nome, (m.get(nome) ?? 0) + valor)
    })
    const arr = [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
    const max = arr[0]?.valor || 1
    return arr.map(x => ({ ...x, pct: (x.valor / max) * 100 }))
  }, [saldos, valorMedioPorItem])

  // Top itens por valor em estoque
  const topItens = useMemo(() => {
    return saldos
      .map(s => ({
        codigo: s.item?.codigo ?? '—',
        descricao: s.item?.descricao ?? '—',
        base: s.base?.nome ?? '—',
        saldo: s.saldo ?? 0,
        unidade: s.item?.unidade ?? '',
        valor: (s.saldo ?? 0) * (valorMedioPorItem.get(s.item_id) ?? 0),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
  }, [saldos, valorMedioPorItem])

  const txtMain = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardCls = `rounded-2xl border ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const kpiCards = [
    { label: 'Itens no catálogo', value: fmtNum(kpis?.total_itens ?? 0), icon: Package2 },
    { label: 'Valor em estoque', value: fmtMoeda(kpis?.valor_estoque_total ?? 0), icon: DollarSign },
    { label: 'Abaixo do mínimo', value: fmtNum(kpis?.itens_abaixo_minimo ?? 0), icon: AlertTriangle },
    { label: 'Movimentações/30d', value: fmtNum(kpis?.movimentacoes_mes ?? 0), icon: ArrowLeftRight },
    { label: 'Solicitações abertas', value: fmtNum(kpis?.solicitacoes_abertas ?? 0), icon: FileBox },
    { label: 'Acurácia inventário', value: kpis?.acuracia_ultimo_inventario == null ? '—' : `${kpis.acuracia_ultimo_inventario}%`, icon: Target },
  ]

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className={`text-lg font-extrabold ${txtMain}`}>Painel Detalhado do Estoque</h1>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>Indicadores de catálogo, saldos e curva ABC</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {kpiCards.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`${cardCls} p-3`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={14} className="text-teal-500" />
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${txtMuted}`}>{k.label}</span>
              </div>
              <p className={`text-xl font-extrabold ${txtMain}`}>{k.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Curva ABC */}
        <div className={`${cardCls} p-4`}>
          <h2 className={`text-sm font-bold mb-3 ${txtMain}`}>Curva ABC do catálogo</h2>
          <div className="space-y-2.5">
            {abc.map(a => (
              <div key={a.curva} className="flex items-center gap-3">
                <span className="w-6 text-xs font-bold" style={{ color: ABC_COR[a.curva] }}>{a.curva}</span>
                <div className="flex-1 h-3 rounded-full bg-slate-200/40 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${a.pct}%`, backgroundColor: ABC_COR[a.curva] }} />
                </div>
                <span className={`w-16 text-right text-xs font-semibold ${txtMuted}`}>{fmtNum(a.qtd)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Valor por base */}
        <div className={`${cardCls} p-4`}>
          <h2 className={`text-sm font-bold mb-3 ${txtMain}`}>Valor em estoque por base</h2>
          {valorPorBase.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Sem saldos registrados.</p>
          ) : (
            <div className="space-y-2.5">
              {valorPorBase.map(b => (
                <div key={b.nome} className="flex items-center gap-3">
                  <span className={`w-28 truncate text-xs ${txtMuted}`} title={b.nome}>{b.nome}</span>
                  <div className="flex-1 h-3 rounded-full bg-slate-200/40 overflow-hidden">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${b.pct}%` }} />
                  </div>
                  <span className={`w-24 text-right text-xs font-semibold ${txtMain}`}>{fmtMoeda(b.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top categorias */}
        <div className={`${cardCls} p-4`}>
          <h2 className={`text-sm font-bold mb-3 ${txtMain}`}>Top categorias (catálogo)</h2>
          <div className="space-y-2">
            {categorias.map(c => (
              <div key={c.nome} className="flex items-center gap-3">
                <span className={`w-36 truncate text-xs ${txtMuted}`} title={c.nome}>{c.nome.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-200/40 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.pct}%` }} />
                </div>
                <span className={`w-12 text-right text-xs font-semibold ${txtMuted}`}>{fmtNum(c.qtd)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top itens por valor */}
        <div className={`${cardCls} p-4`}>
          <h2 className={`text-sm font-bold mb-3 ${txtMain}`}>Top itens por valor em estoque</h2>
          {topItens.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Sem saldos registrados.</p>
          ) : (
            <div className="space-y-1.5">
              {topItens.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${txtMain}`}>{it.descricao}</p>
                    <p className={`text-[10px] ${txtMuted}`}>{it.codigo} · {it.base} · {fmtNum(it.saldo)} {it.unidade}</p>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{fmtMoeda(it.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Itens abaixo do mínimo */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-500" />
          <h2 className={`text-sm font-bold ${txtMain}`}>Itens abaixo do ponto de reposição</h2>
          <span className={`ml-auto text-xs ${txtMuted}`}>{abaixoMinimo.length}</span>
        </div>
        {abaixoMinimo.length === 0 ? (
          <p className={`px-4 pb-4 text-xs ${txtMuted}`}>Nenhum item abaixo do ponto de reposição.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-[11px] uppercase tracking-wider ${txtMuted} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                  <th className="text-left font-semibold px-4 py-2">Item</th>
                  <th className="text-left font-semibold px-2 py-2">Base</th>
                  <th className="text-right font-semibold px-2 py-2">Saldo</th>
                  <th className="text-right font-semibold px-4 py-2">Ponto rep.</th>
                </tr>
              </thead>
              <tbody>
                {abaixoMinimo.slice(0, 30).map(s => (
                  <tr key={s.id} className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    <td className={`px-4 py-2 ${txtMain}`}>
                      <span className={`text-[10px] font-mono mr-2 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{s.item?.codigo}</span>
                      {s.item?.descricao}
                    </td>
                    <td className={`px-2 py-2 ${txtMuted}`}>{s.base?.nome ?? '—'}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${isDark ? 'text-red-300' : 'text-red-600'}`}>{fmtNum(s.saldo)} {s.item?.unidade}</td>
                    <td className={`px-4 py-2 text-right ${txtMuted}`}>{fmtNum(s.item?.ponto_reposicao ?? s.item?.estoque_minimo ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
