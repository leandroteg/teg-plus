// ─────────────────────────────────────────────────────────────────────────────
// LeadTimePainel — secao do Painel de Compras com lead time por categoria/fase.
// Antes era a pagina /compras/lead-time; consolidada aqui pra evitar duplicacao
// de visao agregada (o Painel ja era a porta de entrada natural).
// ─────────────────────────────────────────────────────────────────────────────

import { Clock, CheckCircle2, Timer, AlertTriangle, Users } from 'lucide-react'
import { useLeadTimeCompras } from '../../hooks/useLeadTimeCompras'

// Fases do pipeline (ordem cronologica) + cor
const PHASES = [
  { key: 'validacaoTecnica', label: 'Validação Técnica', color: '#f59e0b' }, // amber
  { key: 'cotacao',          label: 'Cotação',           color: '#3b82f6' }, // blue
  { key: 'aprovacao',        label: 'Aprovação',         color: '#8b5cf6' }, // violet
  { key: 'pedido',           label: 'Pedido',            color: '#14b8a6' }, // teal
  { key: 'entrega',          label: 'Entrega',           color: '#ec4899' }, // pink
] as const

const fmtD = (v: number | null) => {
  if (v == null) return '—'
  if (v <= 0) return '0'
  if (v < 1) { const h = v * 24; return `${h < 10 ? h.toFixed(1).replace('.', ',') : Math.round(h)}h` } // < 1 dia → horas
  const d = Math.round(v * 10) / 10
  return `${Number.isInteger(d) ? d : d.toFixed(1).replace('.', ',')}d`
}

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

// Lista de barras horizontais (label · barra · valor)
function Bars({ items, isDark, cor }: { items: Array<{ label: string; value: number | null; color?: string }>; isDark: boolean; cor: string }) {
  const max = Math.max(...items.map(i => i.value ?? 0), 0.0001)
  if (!items.length) return <div className={`text-[11px] py-3 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados no período</div>
  return (
    <div className="space-y-1.5">
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-2">
          <span className={`text-[11px] font-medium text-right shrink-0 w-[116px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={it.label}>{it.label}</span>
          <div className={`flex-1 h-4 rounded ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
            <div className="h-full rounded" style={{ width: `${Math.max(((it.value ?? 0) / max) * 100, 3)}%`, background: it.color ?? cor }} />
          </div>
          <span className={`text-[11px] font-bold shrink-0 w-[54px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmtD(it.value)}</span>
        </div>
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

  // Maior gargalo: a fase com a maior média (no modo selecionado)
  const FASE_LABEL: Record<string, string> = { validacaoTecnica: 'Validação Técnica', cotacao: 'Cotação', aprovacao: 'Aprovação', pedido: 'Pedido', entrega: 'Entrega' }
  const fasesAtual = leadMode === 'entregues' ? geral?.fases : geral?.fasesGeral
  let gargalo: { fase: string; dias: number } | null = null
  if (fasesAtual) {
    for (const [k, v] of Object.entries(fasesAtual)) {
      if (v != null && (!gargalo || v > gargalo.dias)) gargalo = { fase: FASE_LABEL[k] ?? k, dias: v }
    }
  }
  const kpis = [
    { label: 'Maior gargalo', value: gargalo ? fmtD(gargalo.dias) : '—', icon: Timer, hint: gargalo ? gargalo.fase : 'sem dados' },
    { label: 'Compras concluídas', value: String(geral?.concluidas ?? 0), icon: CheckCircle2, hint: 'com entrega registrada' },
    { label: 'Entregas no prazo', value: geral?.noPrazoPct == null ? '—' : `${geral.noPrazoPct}%`, icon: Clock, hint: 'vs. data prevista' },
    { label: 'Parada há mais tempo', value: geral?.maisAntigaAberto == null ? '—' : fmtD(geral.maisAntigaAberto), icon: AlertTriangle, hint: 'RC em aberto mais antiga' },
  ]

  // Datasets dos painéis extras (respeitam o modo)
  const PHASE_COLOR: Record<string, string> = { 'Validação Técnica': '#f59e0b', 'Cotação': '#3b82f6', 'Aprovação': '#8b5cf6', 'Pedido': '#14b8a6', 'Entrega': '#ec4899' }
  const fd = leadMode === 'entregues' ? geral?.fases : geral?.fasesGeral
  const fasesBars = fd ? [
    { label: 'Validação Técnica', value: fd.validacaoTecnica },
    { label: 'Cotação', value: fd.cotacao },
    { label: 'Aprovação', value: fd.aprovacao },
    { label: 'Pedido', value: fd.pedido },
    { label: 'Entrega', value: fd.entrega },
  ].filter(x => x.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map(x => ({ ...x, color: PHASE_COLOR[x.label] })) : []
  const compradoresBars = (data?.compradores ?? [])
    .map(c => ({ label: c.nome, value: leadMode === 'entregues' ? c.entregues : c.geral }))
    .filter(x => x.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 8)
  const paradas = data?.paradas ?? []
  const obrasMenor = (data?.obras ?? [])
    .map(o => ({ label: o.nome, value: leadMode === 'entregues' ? o.entregues : o.geral }))
    .filter(x => x.value != null).sort((a, b) => (a.value ?? 0) - (b.value ?? 0)).slice(0, 5)

  return (
    <div className="space-y-3">
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

    {/* Linha 1: Fases por tempo + Lead time por comprador */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <section className={`${cardCls} p-4`}>
        <h3 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txtMain}`}>
          <Timer size={14} className="text-teal-500" /> Fases por tempo
        </h3>
        <Bars items={fasesBars} isDark={isDark} cor="#14b8a6" />
      </section>
      <section className={`${cardCls} p-4`}>
        <h3 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txtMain}`}>
          <Users size={14} className="text-sky-500" /> Lead time por comprador
        </h3>
        <Bars items={compradoresBars} isDark={isDark} cor="#0ea5e9" />
      </section>
    </div>

    {/* Linha 2: RCs paradas + Obras com menor lead time */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <section className={`${cardCls} p-4`}>
        <h3 className={`text-sm font-extrabold flex items-center gap-1.5 mb-2 ${txtMain}`}>
          <AlertTriangle size={14} className="text-amber-500" /> Top 5 — paradas há mais tempo
        </h3>
        {paradas.length === 0 ? (
          <div className={`text-[11px] py-3 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma requisição em aberto</div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
            {paradas.map((p, i) => (
              <div key={p.numero + i} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0 flex items-center gap-2">
                  <span className={`text-[10px] font-bold w-4 text-center shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${txtMain}`}>{p.numero}</p>
                    <p className={`text-[10px] truncate ${txtMuted}`}>{p.obra}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{fmtD(p.dias)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className={`${cardCls} p-4`}>
        <h3 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txtMain}`}>
          <CheckCircle2 size={14} className="text-emerald-500" /> Top 5 obras — menor lead time
        </h3>
        <Bars items={obrasMenor} isDark={isDark} cor="#10b981" />
      </section>
    </div>
    </div>
  )
}
