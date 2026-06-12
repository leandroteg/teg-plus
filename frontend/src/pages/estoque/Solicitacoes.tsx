import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileBox, Info, ChevronDown, ChevronRight, ExternalLink,
  PackageCheck, ShoppingCart, Hourglass, CheckCircle2,
} from 'lucide-react'
import { useAcompanhamentoCD, type AcompCD, type AcompCDStatus } from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'

// Pagina convertida em ACOMPANHAMENTO apenas: lista as RCs de cmp_requisicoes
// que estao em triagem do CD ou ja tiveram pelo menos 1 item atendido pelo
// estoque (qtd_atendida_cd > 0). Sem acoes — quem opera triagem usa o modulo
// Compras. Aqui o almoxarife so observa.

const STATUS_CONFIG: Record<AcompCDStatus, { label: string; bg: string; text: string; dot: string; icon: typeof CheckCircle2 }> = {
  em_triagem:       { label: 'Em Triagem',         bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   icon: Hourglass },
  parcial_cd:       { label: 'Parcial pelo CD',    bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  icon: PackageCheck },
  total_cd:         { label: 'Atendida pelo CD',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2 },
  liberada_compras: { label: 'Liberada p/ Compras', bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    icon: ShoppingCart },
}

const URGENCIA_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  normal:     { label: 'Normal',     bg: 'bg-slate-100', text: 'text-slate-600' },
  urgente:    { label: 'Urgente',    bg: 'bg-amber-50',  text: 'text-amber-700' },
  emergencia: { label: 'Emergência', bg: 'bg-red-50',    text: 'text-red-700'   },
  critica:    { label: 'Crítica',    bg: 'bg-red-50',    text: 'text-red-700'   },
}

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const FILTROS: { key: AcompCDStatus | ''; label: string }[] = [
  { key: '',                 label: 'Todas' },
  { key: 'em_triagem',       label: 'Em Triagem' },
  { key: 'parcial_cd',       label: 'Parcial CD' },
  { key: 'total_cd',         label: 'Atendida CD' },
  { key: 'liberada_compras', label: 'Liberada Compras' },
]

export default function Solicitacoes() {
  const { isLightSidebar: isLight } = useTheme()
  const navigate = useNavigate()
  const { data: rcs = [], isLoading } = useAcompanhamentoCD()
  const [filtro, setFiltro] = useState<AcompCDStatus | ''>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  const filtradas = useMemo(
    () => (filtro ? rcs.filter(r => r.status_acomp === filtro) : rcs),
    [rcs, filtro]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Solicitações de Material</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {rcs.length} {rcs.length === 1 ? 'solicitação' : 'solicitações'} sob acompanhamento do CD
          </p>
        </div>
      </div>

      <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${isLight ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-blue-500/10 border-blue-500/30 text-blue-200'}`}>
        <Info size={14} className="shrink-0 mt-0.5" />
        <p className="text-[11px] leading-snug">
          <span className="font-bold">Apenas acompanhamento.</span>{' '}
          Mostra solicitações de compra que <span className="font-semibold">passam pela triagem do CD</span> — em triagem agora, ou com pelo menos 1 item já baixado do estoque (atendimento direto sem virar pedido). Quem opera a triagem usa o módulo <span className="font-semibold">Compras → Triagem CD</span>.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              filtro === f.key
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : isLight
                  ? 'bg-white text-slate-500 border-slate-200'
                  : 'bg-white/[0.03] text-slate-400 border-white/[0.08]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <FileBox size={40} className={isLight ? 'text-slate-200' : 'text-slate-600'} />
          <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma solicitação no momento</p>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Solicitações com atendimento do CD aparecem aqui assim que entram em triagem
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(rc => <AcompCard key={rc.id} rc={rc} isLight={isLight} card={card}
            expanded={expandedId === rc.id}
            onToggle={() => setExpandedId(expandedId === rc.id ? null : rc.id)}
            onAbrirNoCompras={() => navigate(`/compras/requisicoes/${rc.id}`)}
          />)}
        </div>
      )}
    </div>
  )
}

function AcompCard({ rc, isLight, card, expanded, onToggle, onAbrirNoCompras }: {
  rc: AcompCD
  isLight: boolean
  card: string
  expanded: boolean
  onToggle: () => void
  onAbrirNoCompras: () => void
}) {
  const cfg = STATUS_CONFIG[rc.status_acomp]
  const StatusIcon = cfg.icon
  const urgCfg = URGENCIA_CONFIG[rc.urgencia ?? 'normal'] ?? URGENCIA_CONFIG.normal
  const pctCd = rc.total_itens > 0 ? Math.round((rc.itens_atendidos_cd / rc.total_itens) * 100) : 0

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <FileBox size={16} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{rc.numero || 'RC'}</p>
            <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
              <StatusIcon size={10} /> {cfg.label}
            </span>
            {rc.urgencia && rc.urgencia !== 'normal' && (
              <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${urgCfg.bg} ${urgCfg.text}`}>
                {urgCfg.label}
              </span>
            )}
          </div>
          <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {rc.solicitante_nome ?? '—'}{rc.obra_nome ? ` · ${rc.obra_nome}` : ''}{rc.base_destino_nome ? ` · ${rc.base_destino_nome}` : ''} · {fmtData(rc.criado_em)}
          </p>
        </div>
        <div className="text-right shrink-0 hidden sm:block mr-1">
          <p className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            CD: {rc.itens_atendidos_cd}/{rc.total_itens}
          </p>
          {rc.itens_compras > 0 && (
            <p className="text-[10px] text-cyan-600 font-medium">
              {rc.itens_compras} pra Compras
            </p>
          )}
        </div>
        {expanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
      </div>

      {expanded && (
        <div className={`border-t px-4 py-3 space-y-3 ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Itens — {pctCd}% atendido pelo CD
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); onAbrirNoCompras() }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
            >
              <ExternalLink size={11} /> Ver no Compras
            </button>
          </div>

          {rc.itens.length === 0 ? (
            <p className={`text-xs italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Sem itens cadastrados.</p>
          ) : (
            <div className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
              {rc.itens.map(it => (
                <div key={it.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      {it.codigo ? <span className="font-mono text-[10px] mr-1.5 text-slate-400">{it.codigo}</span> : null}
                      {it.descricao || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      {it.quantidade}{it.unidade ? ` ${it.unidade}` : ''}
                    </p>
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      {it.qtd_atendida_cd > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
                          <PackageCheck size={9} /> CD {it.qtd_atendida_cd}
                        </span>
                      )}
                      {it.qtd_pra_compras > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-cyan-700 bg-cyan-50 rounded px-1.5 py-0.5">
                          <ShoppingCart size={9} /> Compras {it.qtd_pra_compras}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
