import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Clock, CheckCircle2, XCircle,
  Kanban, ClipboardList, RefreshCw, ArrowRight,
  AlertTriangle, Building2, Truck, ShoppingCart, FileEdit,
} from 'lucide-react'
import { useSolicitacoesNF, useSolResumo } from '../../hooks/useSolicitacoesNF'
import { useNotasFiscais, useNfResumo } from '../../hooks/useNotasFiscais'
import { useTheme } from '../../contexts/ThemeContext'
import type { SolicitacaoNF } from '../../types/solicitacaoNF'

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const now = new Date()
const mesAtual = now.getMonth() + 1
const anoAtual = now.getFullYear()

const STATUS_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  pendente:              { label: 'Pendente',       dot: 'bg-slate-400',  bg: 'bg-slate-50',  text: 'text-slate-600'  },
  em_emissao:            { label: 'Em Emissão',     dot: 'bg-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-700'   },
  aguardando_aprovacao:  { label: 'Aguard. Aprov.', dot: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
  emitida:               { label: 'Emitida',        dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700'  },
  rejeitada:             { label: 'Rejeitada',      dot: 'bg-red-400',    bg: 'bg-red-50',    text: 'text-red-700'    },
}

function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme()
  const c = STATUS_LABEL[status] ?? { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5
      ${isDark ? 'bg-white/10 text-slate-200' : `${c.bg} ${c.text}`}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

const ORIGEM_ICON: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  logistica: { icon: Truck,         color: 'text-orange-500', label: 'Logística' },
  compras:   { icon: ShoppingCart,   color: 'text-teal-500',   label: 'Compras' },
  manual:    { icon: FileEdit,       color: 'text-violet-500', label: 'Manual' },
}

const QUICK_ACTIONS = [
  { icon: Kanban,        label: 'Emissão NF',    to: '/fiscal/pipeline',   color: 'text-amber-600',   bg: 'bg-amber-50' },
  { icon: ClipboardList, label: 'Histórico NF',  to: '/fiscal/historico',  color: 'text-violet-600',  bg: 'bg-violet-50' },
]

// ── component ────────────────────────────────────────────────────────────────
export default function PainelFiscal() {
  const nav = useNavigate()
  const { isDark } = useTheme()

  // Solicitações do mês (pipeline)
  const { data: solicitacoes = [], isLoading: loadingSol, refetch: refetchSol } = useSolicitacoesNF({
    mes: mesAtual, ano: anoAtual,
  })
  const resumoSol = useSolResumo(solicitacoes)

  // NFs emitidas do mês (repositório)
  const { data: notas = [], isLoading: loadingNF, refetch: refetchNF } = useNotasFiscais({
    mes: mesAtual, ano: anoAtual,
  })
  const resumoNF = useNfResumo(notas)

  // NFs por origem (do repositório)
  const origemData = useMemo(() => {
    const map: Record<string, { qtd: number; valor: number }> = {}
    for (const nf of notas) {
      const o = nf.origem ?? 'avulso'
      if (!map[o]) map[o] = { qtd: 0, valor: 0 }
      map[o].qtd++
      map[o].valor += nf.valor_total ?? 0
    }
    return Object.entries(map).sort((a, b) => b[1].qtd - a[1].qtd)
  }, [notas])

  // NFs por obra (top 5)
  const obraData = useMemo(() => {
    const map: Record<string, { nome: string; qtd: number; valor: number }> = {}
    for (const nf of notas) {
      const key = nf.obra_id ?? '_sem_obra'
      if (!map[key]) map[key] = { nome: nf.obra?.nome ?? 'Sem obra', qtd: 0, valor: 0 }
      map[key].qtd++
      map[key].valor += nf.valor_total ?? 0
    }
    return Object.entries(map).sort((a, b) => b[1].valor - a[1].valor).slice(0, 5)
  }, [notas])

  // Pendentes recentes (pipeline)
  const pendentes = useMemo(
    () => solicitacoes.filter(s => s.status === 'pendente' || s.status === 'em_emissao'),
    [solicitacoes],
  )

  // Rejeitadas recentes
  const rejeitadas = useMemo(
    () => solicitacoes.filter(s => s.status === 'rejeitada'),
    [solicitacoes],
  )

  const isLoading = loadingSol || loadingNF
  const refetch = () => { refetchSol(); refetchNF() }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-navy'}`}>Painel — Fiscal</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Emissão, solicitações e repositório de notas fiscais
          </p>
        </div>
        <button onClick={refetch}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-slate-500 hover:text-amber-400' : 'text-slate-400 hover:text-amber-600'}`}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard titulo="Emitidas no Mês" valor={resumoSol.emitidas}
          icon={CheckCircle2} cor="text-green-600" hexCor="#16A34A" />
        <KpiCard titulo="Pendentes" valor={resumoSol.pendentes + resumoSol.em_emissao}
          icon={Clock} cor="text-amber-600" hexCor="#D97706"
          subtitulo={resumoSol.em_emissao > 0 ? `${resumoSol.em_emissao} em emissão` : undefined} />
        <KpiCard titulo="Rejeitadas" valor={resumoSol.rejeitadas}
          icon={XCircle}
          cor={resumoSol.rejeitadas > 0 ? 'text-red-600' : 'text-slate-400'}
          hexCor={resumoSol.rejeitadas > 0 ? '#DC2626' : '#94A3B8'}
          subtitulo={resumoSol.rejeitadas > 0 ? 'Atenção!' : 'Nenhuma'} />
        <KpiCard titulo="Valor Total NFs" valor={fmt(resumoNF.total)}
          icon={FileText} cor="text-violet-600" hexCor="#7C3AED"
          subtitulo={`${resumoNF.count} notas no mês`} />
      </div>

      {/* ── NFs por Origem + Quick Actions ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Por Origem */}
        <div className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Building2 size={14} className="text-amber-500" /> NFs por Origem
            </h2>
            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Mês atual</span>
          </div>
          <div className="p-4 space-y-3">
            {origemData.length === 0 && (
              <p className={`text-xs text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma NF no mês</p>
            )}
            {origemData.map(([key, { qtd, valor }]) => {
              const o = ORIGEM_ICON[key] ?? { icon: FileText, color: 'text-slate-400', label: key }
              const Icon = o.icon
              const pct = resumoNF.count > 0 ? (qtd / resumoNF.count) * 100 : 0
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={o.color} />
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{o.label}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{qtd}</span>
                      <span className={`text-[10px] ml-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmt(valor)}</span>
                    </div>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(({ icon: Icon, label, to, color, bg }) => (
              <button key={to} onClick={() => nav(to)}
                className={`rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center group
                  ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
                <div className={`w-10 h-10 ${isDark ? 'bg-white/10' : bg} rounded-xl flex items-center justify-center mx-auto mb-2
                  group-hover:scale-110 transition-transform`}>
                  <Icon size={18} className={color} />
                </div>
                <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</p>
              </button>
            ))}
          </div>

          {/* NFs por Obra (top 5) */}
          <div className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
            <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <Building2 size={14} className="text-teal-500" /> Top Obras (valor)
              </h2>
            </div>
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
              {obraData.length === 0 && (
                <p className={`text-xs text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados</p>
              )}
              {obraData.map(([key, { nome, qtd, valor }]) => (
                <div key={key} className={`flex items-center justify-between px-4 py-2.5 ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'} transition-colors`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{nome}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{qtd} NF{qtd !== 1 ? 's' : ''}</p>
                  </div>
                  <p className={`text-xs font-bold shrink-0 ml-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{fmt(valor)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pendentes na Fila ─────────────────────────────────── */}
      {pendentes.length > 0 && (
        <SolicitacaoList
          title="Pendentes na Fila"
          icon={Clock}
          iconColor="text-amber-500"
          items={pendentes}
          linkTo="/fiscal/pipeline"
          isDark={isDark}
          onNav={nav}
        />
      )}

      {/* ── Rejeitadas ────────────────────────────────────────── */}
      {rejeitadas.length > 0 && (
        <SolicitacaoList
          title="Rejeitadas"
          icon={AlertTriangle}
          iconColor="text-red-500"
          items={rejeitadas}
          linkTo="/fiscal/pipeline"
          isDark={isDark}
          onNav={nav}
          danger
        />
      )}
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ titulo, valor, icon: Icon, cor, hexCor, subtitulo }: {
  titulo: string; valor: number | string; icon: typeof FileText;
  cor: string; hexCor: string; subtitulo?: string
}) {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-2xl shadow-sm overflow-hidden flex ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}>
          <Icon size={14} className={cor} />
        </div>
        <p className={`text-xl font-extrabold ${cor} leading-none`}>{valor}</p>
        <p className={`text-[10px] font-semibold mt-1 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{titulo}</p>
        {subtitulo && <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{subtitulo}</p>}
      </div>
    </div>
  )
}

// ── Solicitação List Section ─────────────────────────────────────────────────
function SolicitacaoList({ title, icon: Icon, iconColor, items, linkTo, isDark, onNav, danger }: {
  title: string; icon: typeof Clock; iconColor: string; items: SolicitacaoNF[];
  linkTo: string; isDark: boolean; onNav: (to: string) => void; danger?: boolean
}) {
  const borderClass = danger
    ? isDark ? 'border-red-500/30' : 'border-red-200'
    : isDark ? 'border-white/[0.06]' : 'border-slate-200'

  return (
    <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b]' : 'bg-white'} border ${borderClass}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : `border-b ${danger ? 'border-red-100' : 'border-slate-100'}`}`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${danger ? (isDark ? 'text-red-400' : 'text-red-800') : (isDark ? 'text-white' : 'text-slate-800')}`}>
          <Icon size={14} className={iconColor} /> {title}
        </h2>
        <button onClick={() => onNav(linkTo)}
          className={`text-[10px] font-semibold flex items-center gap-0.5 ${danger ? 'text-red-600' : 'text-amber-600'}`}>
          Ver todas <ArrowRight size={10} />
        </button>
      </div>
      <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : danger ? 'divide-red-50' : 'divide-slate-50'}`}>
        {items.slice(0, 5).map(s => {
          const o = ORIGEM_ICON[s.origem ?? 'manual'] ?? ORIGEM_ICON.manual
          return (
            <div key={s.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : danger ? 'hover:bg-red-50/50' : 'hover:bg-slate-50'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : danger ? 'bg-red-50' : 'bg-amber-50'}`}>
                <o.icon size={14} className={o.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {s.fornecedor_nome || 'Sem fornecedor'}
                  </p>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-300' : `${o.color.replace('text-', 'bg-').replace('500', '50')} ${o.color}`}`}>
                    {o.label}
                  </span>
                </div>
                <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {s.descricao ?? s.natureza_operacao ?? 'Sem descrição'}
                  {s.valor_total ? ` · ${fmt(s.valor_total)}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <StatusBadge status={s.status} />
                <p className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {new Date(s.solicitado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
