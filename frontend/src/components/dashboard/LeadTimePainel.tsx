// ─────────────────────────────────────────────────────────────────────────────
// LeadTimePainel — secao do Painel de Compras com lead time por categoria/fase.
// Antes era a pagina /compras/lead-time; consolidada aqui pra evitar duplicacao
// de visao agregada (o Painel ja era a porta de entrada natural).
// ─────────────────────────────────────────────────────────────────────────────

import { Clock, CheckCircle2, Timer, FileText } from 'lucide-react'
import { useLeadTimeCompras } from '../../hooks/useLeadTimeCompras'

// Fases do pipeline (ordem cronologica) + cor
const PHASES = [
  { key: 'validacaoTecnica', label: 'Validação Técnica', color: '#f59e0b' }, // amber
  { key: 'cotacao',          label: 'Cotação',           color: '#3b82f6' }, // blue
  { key: 'aprovacao',        label: 'Aprovação',         color: '#8b5cf6' }, // violet
  { key: 'pedido',           label: 'Pedido',            color: '#14b8a6' }, // teal
  { key: 'entrega',          label: 'Entrega',           color: '#ec4899' }, // pink
] as const

const fmtD = (v: number | null) => (v == null ? '—' : `${Number.isInteger(v) ? v : v.toFixed(1).replace('.', ',')}d`)

function StackedBar({ vals }: { vals: Record<string, number | null> }) {
  const segs = PHASES
    .map(p => ({ key: p.key, label: p.label, color: p.color, val: vals[p.key] ?? 0 }))
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

interface Props {
  isDark: boolean
  leadMode?: 'entregues' | 'geral'
  de?: string
  ate?: string
  obraId?: string
}

export default function LeadTimePainel({ isDark, leadMode = 'geral', de, ate, obraId }: Props) {
  const { data, isLoading } = useLeadTimeCompras({ de, ate, obraId })

  const txtMain = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardCls = `rounded-2xl border ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`

  if (isLoading) {
    return (
      <section className={`${cardCls} p-6 flex justify-center`}>
        <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </section>
    )
  }

  const geral = data?.geral
  const categorias = data?.categorias ?? []

  const leadMedioVal = leadMode === 'entregues' ? (geral?.leadMedio ?? null) : (geral?.leadMedioGeral ?? null)
  const kpis = [
    { label: 'Lead time médio', value: fmtD(leadMedioVal), icon: Timer, hint: leadMode === 'entregues' ? 'entregues · entrega − RC' : 'inclui abertos · hoje − RC' },
    { label: 'Compras concluídas', value: String(geral?.concluidas ?? 0), icon: CheckCircle2, hint: 'com entrega registrada' },
    { label: 'Entregas no prazo', value: geral?.noPrazoPct == null ? '—' : `${geral.noPrazoPct}%`, icon: Clock, hint: 'vs. data prevista' },
    { label: 'Requisições', value: String(geral?.totalReq ?? 0), icon: FileText, hint: 'total no período' },
  ]

  return (
    <section className={`${cardCls} overflow-hidden`}>
      {/* Header da secao */}
      <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
        <div>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txtMain}`}>
            <Timer size={14} className="text-teal-500" /> Lead Time de Compras
          </h2>
          <p className={`text-[11px] mt-0.5 ${txtMuted}`}>
            Tempo do ciclo por categoria e por fase do pipeline
          </p>
        </div>
        {/* Legenda das fases */}
        <div className="hidden md:flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {PHASES.map(p => (
            <span key={p.key} className={`flex items-center gap-1 text-[10px] ${txtMuted}`}>
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
              {p.label}
            </span>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className={`rounded-xl border p-3 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50/60 border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={13} className="text-teal-500" />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${txtMuted}`}>{k.label}</span>
                </div>
                <p className={`text-xl font-extrabold ${txtMain}`}>{k.value}</p>
                <p className={`text-[10px] mt-0.5 ${txtMuted}`}>{k.hint}</p>
              </div>
            )
          })}
        </div>

        {/* Tabela por categoria */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-[10px] uppercase tracking-wider ${txtMuted} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/60'}`}>
                <th className="text-left font-semibold px-3 py-2">Categoria</th>
                <th className="text-right font-semibold px-2 py-2">Req</th>
                <th className="text-right font-semibold px-2 py-2">Ped</th>
                <th className="text-right font-semibold px-2 py-2">Entr</th>
                <th className="text-right font-semibold px-2 py-2">Validação Técnica</th>
                <th className="text-right font-semibold px-2 py-2">Cotação</th>
                <th className="text-right font-semibold px-2 py-2">Aprovação</th>
                <th className="text-right font-semibold px-2 py-2">Pedido</th>
                <th className="text-right font-semibold px-2 py-2">Entrega</th>
                <th className="text-right font-semibold px-2 py-2">Lead Time</th>
                <th className="text-left font-semibold px-3 py-2 w-36">Composição</th>
              </tr>
            </thead>
            <tbody>
              {categorias.length === 0 ? (
                <tr>
                  <td colSpan={11} className={`text-center py-10 text-xs ${txtMuted}`}>
                    Sem requisições de compra registradas no período.
                  </td>
                </tr>
              ) : (
                categorias.map(cat => {
                  const fase = leadMode === 'entregues'
                    ? { validacaoTecnica: cat.validacaoTecnica, cotacao: cat.cotacao, aprovacao: cat.aprovacao, pedido: cat.pedido, entrega: cat.entrega }
                    : { validacaoTecnica: cat.validacaoTecnicaGeral, cotacao: cat.cotacaoGeral, aprovacao: cat.aprovacaoGeral, pedido: cat.pedidoGeral, entrega: cat.entregaGeral }
                  return (
                  <tr key={cat.categoria} className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    <td className={`px-3 py-2 font-semibold text-xs ${txtMain}`}>{cat.nome}</td>
                    <td className={`px-2 py-2 text-right text-xs ${txtMuted}`}>{cat.total}</td>
                    <td className={`px-2 py-2 text-right text-xs ${txtMuted}`}>{cat.comPedido}</td>
                    <td className={`px-2 py-2 text-right text-xs ${txtMuted}`}>{cat.comEntrega}</td>
                    <td className={`px-2 py-2 text-right text-xs ${txtMain}`}>{fmtD(fase.validacaoTecnica)}</td>
                    <td className={`px-2 py-2 text-right text-xs ${txtMain}`}>{fmtD(fase.cotacao)}</td>
                    <td className={`px-2 py-2 text-right text-xs ${txtMain}`}>{fmtD(fase.aprovacao)}</td>
                    <td className={`px-2 py-2 text-right text-xs ${txtMain}`}>{fmtD(fase.pedido)}</td>
                    <td className={`px-2 py-2 text-right text-xs ${txtMain}`}>{fmtD(fase.entrega)}</td>
                    <td className={`px-2 py-2 text-right text-xs font-bold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{fmtD(leadMode === 'entregues' ? cat.leadTotal : cat.leadGeral)}</td>
                    <td className="px-3 py-2"><StackedBar vals={fase} /></td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <p className={`text-[10px] ${txtMuted}`}>
          Médias em dias corridos, pelos marcos de cada requisição (criação → aprovação técnica → conclusão da cotação →
          aprovação da cotação → emissão do pedido → entrega). No modo "+ Em aberto", cada fase também conta a idade do que
          está parado nela. Células com "—" ainda não têm amostra.
        </p>
      </div>
    </section>
  )
}
