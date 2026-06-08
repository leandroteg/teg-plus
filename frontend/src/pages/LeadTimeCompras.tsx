import { useTheme } from '../contexts/ThemeContext'
import { useLeadTimeCompras, type LeadTimeCategoria } from '../hooks/useLeadTimeCompras'
import { Clock, CheckCircle2, Timer, FileText } from 'lucide-react'

// Fases do pipeline (ordem cronológica) + cor
const PHASES = [
  { key: 'reqAprov',      label: 'Req → Aprovação',     color: '#f59e0b' }, // amber
  { key: 'aprovCotacao',  label: 'Aprovação → Cotação', color: '#3b82f6' }, // blue
  { key: 'cotacaoPedido', label: 'Cotação → Pedido',    color: '#8b5cf6' }, // violet
  { key: 'pedidoEntrega', label: 'Pedido → Entrega',    color: '#14b8a6' }, // teal
] as const

const fmtD = (v: number | null) => (v == null ? '—' : `${v}d`)

function StackedBar({ cat }: { cat: LeadTimeCategoria }) {
  const segs = PHASES
    .map(p => ({ key: p.key, label: p.label, color: p.color, val: cat[p.key] ?? 0 }))
    .filter(s => s.val > 0)
  const soma = segs.reduce((s, x) => s + x.val, 0)
  if (!soma) {
    return <div className="text-[11px] text-slate-400">sem dados de fase</div>
  }
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/40">
      {segs.map(s => (
        <div
          key={s.key}
          style={{ width: `${(s.val / soma) * 100}%`, backgroundColor: s.color }}
          title={`${s.label}: ${s.val}d`}
        />
      ))}
    </div>
  )
}

export default function LeadTimeCompras() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data, isLoading } = useLeadTimeCompras()

  const txtMain = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardCls = `rounded-2xl border ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const geral = data?.geral
  const categorias = data?.categorias ?? []

  const kpis = [
    { label: 'Lead time médio', value: fmtD(geral?.leadMedio ?? null), icon: Timer, hint: 'requisição → entrega' },
    { label: 'Compras concluídas', value: String(geral?.concluidas ?? 0), icon: CheckCircle2, hint: 'com entrega registrada' },
    { label: 'Entregas no prazo', value: geral?.noPrazoPct == null ? '—' : `${geral.noPrazoPct}%`, icon: Clock, hint: 'vs. data prevista' },
    { label: 'Requisições', value: String(geral?.totalReq ?? 0), icon: FileText, hint: 'total no período' },
  ]

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className={`text-lg font-extrabold ${txtMain}`}>Lead Time de Compras</h1>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>Tempo do ciclo de compra por categoria e por fase do pipeline</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`${cardCls} p-4`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={15} className="text-teal-500" />
                <span className={`text-xs font-semibold ${txtMuted}`}>{k.label}</span>
              </div>
              <p className={`text-2xl font-extrabold ${txtMain}`}>{k.value}</p>
              <p className={`text-[11px] mt-0.5 ${txtMuted}`}>{k.hint}</p>
            </div>
          )
        })}
      </div>

      {/* Legenda das fases */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {PHASES.map(p => (
          <span key={p.key} className={`flex items-center gap-1.5 text-[11px] ${txtMuted}`}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.label}
          </span>
        ))}
      </div>

      {/* Tabela por categoria */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-[11px] uppercase tracking-wider ${txtMuted} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                <th className="text-left font-semibold px-4 py-2.5">Categoria</th>
                <th className="text-right font-semibold px-2 py-2.5">Req</th>
                <th className="text-right font-semibold px-2 py-2.5">Pedidos</th>
                <th className="text-right font-semibold px-2 py-2.5">Entregas</th>
                <th className="text-right font-semibold px-2 py-2.5">Req→Aprov</th>
                <th className="text-right font-semibold px-2 py-2.5">Aprov→Cot</th>
                <th className="text-right font-semibold px-2 py-2.5">Cot→Ped</th>
                <th className="text-right font-semibold px-2 py-2.5">Ped→Entr</th>
                <th className="text-right font-semibold px-2 py-2.5">Lead total</th>
                <th className="text-left font-semibold px-4 py-2.5 w-44">Composição</th>
              </tr>
            </thead>
            <tbody>
              {categorias.length === 0 ? (
                <tr>
                  <td colSpan={10} className={`text-center py-12 ${txtMuted}`}>Sem requisições de compra registradas.</td>
                </tr>
              ) : (
                categorias.map(cat => (
                  <tr key={cat.categoria} className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    <td className={`px-4 py-2.5 font-semibold ${txtMain}`}>{cat.nome}</td>
                    <td className={`px-2 py-2.5 text-right ${txtMuted}`}>{cat.total}</td>
                    <td className={`px-2 py-2.5 text-right ${txtMuted}`}>{cat.comPedido}</td>
                    <td className={`px-2 py-2.5 text-right ${txtMuted}`}>{cat.comEntrega}</td>
                    <td className={`px-2 py-2.5 text-right ${txtMain}`}>{fmtD(cat.reqAprov)}</td>
                    <td className={`px-2 py-2.5 text-right ${txtMain}`}>{fmtD(cat.aprovCotacao)}</td>
                    <td className={`px-2 py-2.5 text-right ${txtMain}`}>{fmtD(cat.cotacaoPedido)}</td>
                    <td className={`px-2 py-2.5 text-right ${txtMain}`}>{fmtD(cat.pedidoEntrega)}</td>
                    <td className={`px-2 py-2.5 text-right font-bold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{fmtD(cat.leadTotal)}</td>
                    <td className="px-4 py-2.5"><StackedBar cat={cat} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className={`text-[11px] ${txtMuted}`}>
        Médias em dias corridos, calculadas a partir dos marcos de cada requisição (criação, aprovação, conclusão da cotação,
        emissão do pedido e entrega real). Células com "—" ainda não têm amostra suficiente.
      </p>
    </div>
  )
}
