import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package2, DollarSign, AlertTriangle, ArrowLeftRight, FileBox, Target, ShoppingCart, X, Loader2, CheckCircle2, ExternalLink } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useEstoqueKPIs, useEstoqueItens, useSaldos, useSaldosAbaixoMinimo,
  useBases, useGerarOcMinimo, type OcMinimoResult,
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
  const { data: bases = [] } = useBases()
  const [showGerarOc, setShowGerarOc] = useState(false)

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
          <span className={`text-xs ${txtMuted}`}>{abaixoMinimo.length}</span>
          {abaixoMinimo.length > 0 && (
            <button
              onClick={() => setShowGerarOc(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
              title="Gera Requisições de Compra em rascunho pra cada base com itens abaixo do mínimo"
            >
              <ShoppingCart size={12} /> Gerar RCs de reposição
            </button>
          )}
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

      {showGerarOc && (
        <GerarOcModal
          abaixoMinimo={abaixoMinimo}
          bases={bases}
          isDark={isDark}
          onClose={() => setShowGerarOc(false)}
        />
      )}
    </div>
  )
}

// ── Modal: gerar RCs automáticas de reposição ────────────────────────────────
function GerarOcModal({ abaixoMinimo, bases, isDark, onClose }: {
  abaixoMinimo: any[]
  bases: Array<{ id: string; nome: string }>
  isDark: boolean
  onClose: () => void
}) {
  const [baseId, setBaseId] = useState<string>('')
  const [result, setResult] = useState<OcMinimoResult | null>(null)
  const gerar = useGerarOcMinimo()

  // Preview: agrupa por base, conta itens e estima valor
  const previewPorBase = useMemo(() => {
    const m = new Map<string, { base: string; baseId: string; itens: number; valor: number }>()
    for (const s of abaixoMinimo) {
      if (baseId && s.base?.id !== baseId) continue
      if (!s.base?.id) continue
      const key = s.base.id
      const cur = m.get(key) ?? { base: s.base.nome ?? '—', baseId: key, itens: 0, valor: 0 }
      const qtdSugerida = Math.max(
        0,
        (s.item?.estoque_maximo || s.item?.ponto_reposicao || (s.item?.estoque_minimo ?? 0) * 2) - s.saldo
      )
      const valorRef = s.item?.valor_medio ?? s.item?.valor_ultima_entrada ?? 0
      cur.itens += 1
      cur.valor += qtdSugerida * valorRef
      m.set(key, cur)
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor)
  }, [abaixoMinimo, baseId])

  const totalItens = previewPorBase.reduce((s, p) => s + p.itens, 0)
  const totalValor = previewPorBase.reduce((s, p) => s + p.valor, 0)
  const fmtM = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)

  async function handleConfirmar() {
    const res = await gerar.mutateAsync(baseId || undefined)
    setResult(res)
  }

  const panel = isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl border shadow-2xl max-h-[92vh] overflow-y-auto ${panel}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
            <ShoppingCart size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <h2 className={`text-sm font-extrabold truncate ${txtMain}`}>Gerar Requisições de Compra</h2>
            <p className={`text-xs ${txtMuted}`}>Reposição automática por estoque mínimo</p>
          </div>
          <button
            onClick={onClose}
            className={`ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {!result ? (
          <div className="p-4 space-y-4">
            <div className={`rounded-xl border p-3 ${isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
              <p className="text-[11px] leading-snug">
                <span className="font-bold">Como funciona:</span> uma RC <em>em rascunho</em> é criada por base com os itens cujo saldo está abaixo do mínimo. Itens já em RC aberta são pulados (idempotente). Você revisa cada RC antes de enviar pra aprovação.
              </p>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1 ${txtMuted}`}>Base</label>
              <select
                value={baseId}
                onChange={e => setBaseId(e.target.value)}
                disabled={gerar.isPending}
                className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                  isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <option value="">Todas as bases ({previewPorBase.length})</option>
                {bases.map(b => (
                  <option key={b.id} value={b.id}>{b.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Preview</p>
              {previewPorBase.length === 0 ? (
                <p className={`text-xs ${txtMuted}`}>Nenhum item abaixo do mínimo nessa seleção.</p>
              ) : (
                <div className={`rounded-xl border divide-y ${isDark ? 'border-white/[0.06] divide-white/[0.04]' : 'border-slate-200 divide-slate-100'}`}>
                  {previewPorBase.map(p => (
                    <div key={p.baseId} className="px-3 py-2 flex items-center gap-2">
                      <Package2 size={12} className="text-slate-400 shrink-0" />
                      <p className={`text-xs font-semibold flex-1 truncate ${txtMain}`}>{p.base}</p>
                      <span className={`text-[11px] ${txtMuted}`}>{p.itens} {p.itens === 1 ? 'item' : 'itens'}</span>
                      <span className={`text-xs font-bold tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtM(p.valor)}</span>
                    </div>
                  ))}
                  <div className={`px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                    <p className={`text-xs font-bold flex-1 ${txtMain}`}>Total</p>
                    <span className={`text-[11px] ${txtMuted}`}>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
                    <span className={`text-xs font-extrabold tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{fmtM(totalValor)}</span>
                  </div>
                </div>
              )}
            </div>

            {gerar.isError && (
              <div className="rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-bold px-3 py-2 flex items-center gap-2">
                <AlertTriangle size={14} /> {(gerar.error as Error)?.message ?? 'Erro ao gerar RCs.'}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={gerar.isPending}
                className={`flex-1 py-2.5 rounded-xl border font-semibold text-sm transition-colors disabled:opacity-50 ${
                  isDark ? 'border-white/[0.12] text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={gerar.isPending || previewPorBase.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition disabled:opacity-50"
              >
                {gerar.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                Gerar {previewPorBase.length} {previewPorBase.length === 1 ? 'RC' : 'RCs'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={14} />
              <p className="text-xs font-bold">
                {result.rcs_criadas} {result.rcs_criadas === 1 ? 'RC criada' : 'RCs criadas'} · {result.itens_inclusos} {result.itens_inclusos === 1 ? 'item' : 'itens'} incluso(s)
              </p>
            </div>

            {result.itens_ja_pendentes > 0 && (
              <p className={`text-[11px] italic ${txtMuted}`}>
                {result.itens_ja_pendentes} {result.itens_ja_pendentes === 1 ? 'item foi pulado' : 'itens foram pulados'} porque já estão em RC em aberto.
              </p>
            )}

            {result.resumo.length > 0 && (
              <div className={`rounded-xl border divide-y ${isDark ? 'border-white/[0.06] divide-white/[0.04]' : 'border-slate-200 divide-slate-100'}`}>
                {result.resumo.map(r => (
                  <Link
                    key={r.rc_id}
                    to={`/compras/requisicoes/${r.rc_id}`}
                    className={`flex items-center gap-2 px-3 py-2 ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'} transition-colors`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${txtMain}`}>{r.rc_numero}</p>
                      <p className={`text-[10px] ${txtMuted}`}>{r.base}</p>
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      {fmtM(Number(r.valor_estimado))}
                    </span>
                    <ExternalLink size={11} className="text-slate-400" />
                  </Link>
                ))}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
