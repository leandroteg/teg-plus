// ─────────────────────────────────────────────────────────────────────────────
// SolicitacaoCards — cartão e linha da solicitação de Locação.
// Espelha components/frotas/os/OSCards para que a mesma solicitação tenha a
// mesma aparência no pipeline, no histórico e no quadro.
// ─────────────────────────────────────────────────────────────────────────────
import { Wrench, FileText, Handshake, RefreshCw, Clock, Paperclip, Sparkles } from 'lucide-react'
import type { LocSolicitacao, TipoSolicitacao, UrgenciaSolicitacao } from '../../../types/locacao'

export const BRL = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** Dias desde a abertura (o "tempo parado" da solicitação). */
export const diasEmAberto = (s: LocSolicitacao) => {
  const ini = new Date(s.created_at).getTime()
  const fim = s.data_conclusao ? new Date(s.data_conclusao).getTime() : Date.now()
  return Math.max(0, Math.floor((fim - ini) / 86_400_000))
}

export const TIPO_CFG: Record<TipoSolicitacao, { label: string; icon: React.ElementType; cls: string }> = {
  manutencao: { label: 'Manutenção', icon: Wrench,    cls: 'text-orange-600 bg-orange-50' },
  servico:    { label: 'Serviço',    icon: FileText,  cls: 'text-sky-600 bg-sky-50' },
  limpeza:    { label: 'Limpeza',    icon: Sparkles,  cls: 'text-cyan-600 bg-cyan-50' },
  acordo:     { label: 'Acordo',     icon: Handshake, cls: 'text-emerald-600 bg-emerald-50' },
  renovacao:  { label: 'Renovação',  icon: RefreshCw, cls: 'text-violet-600 bg-violet-50' },
}

export const URGENCIA: Record<UrgenciaSolicitacao, { label: string; barra: string; cls: string }> = {
  urgente: { label: 'URGENTE', barra: 'bg-red-500',    cls: 'text-red-700 bg-red-50' },
  alta:    { label: 'ALTA',    barra: 'bg-amber-500',  cls: 'text-amber-700 bg-amber-50' },
  normal:  { label: 'NORMAL',  barra: 'bg-blue-400',   cls: 'text-blue-700 bg-blue-50' },
  baixa:   { label: 'BAIXA',   barra: 'bg-slate-300',  cls: 'text-slate-600 bg-slate-100' },
}

export const URGENCIA_ORDER: Record<UrgenciaSolicitacao, number> = {
  urgente: 0, alta: 1, normal: 2, baixa: 3,
}

/** Nome curto do imóvel para caber no cartão. */
export const imovelLabel = (s: LocSolicitacao) =>
  s.imovel?.descricao ?? s.imovel?.codigo ?? '—'

interface Props {
  sol: LocSolicitacao
  isDark: boolean
  onClick: () => void
  /** Clique no nome do imóvel (abre a ficha) — opcional. */
  onImovelClick?: () => void
}

export function SolicitacaoCard({ sol, isDark, onClick, onImovelClick }: Props) {
  const u = URGENCIA[sol.urgencia] ?? URGENCIA.normal
  const t = TIPO_CFG[sol.tipo] ?? TIPO_CFG.manutencao
  const dias = diasEmAberto(sol)
  const valor = sol.valor_final ?? sol.valor_estimado

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border p-3 pl-4 cursor-pointer transition-all ${
        isDark
          ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
          : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
      }`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${u.barra}`} />

      {/* Imóvel + urgência */}
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={e => { if (onImovelClick) { e.stopPropagation(); onImovelClick() } }}
          className={`text-left min-w-0 flex-1 ${onImovelClick ? 'hover:underline' : 'cursor-inherit'}`}
        >
          <p className={`text-[11px] font-mono font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {imovelLabel(sol)}
          </p>
          {sol.imovel?.cidade && (
            <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sol.imovel.cidade}</p>
          )}
        </button>
        <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${u.cls}`}>{u.label}</span>
      </div>

      {/* Problema */}
      <p className={`text-xs font-semibold mt-2 line-clamp-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {sol.titulo}
      </p>

      {/* Rodapé */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.cls}`}>
          <t.icon size={9} /> {t.label}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Clock size={9} /> {dias}d
        </span>
        {(sol.anexo_url || (sol.fotos ?? []).length > 0) && (
          <Paperclip size={10} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
        )}
        {valor != null && (
          <span className={`ml-auto text-[11px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
            {BRL(valor)}
          </span>
        )}
      </div>
    </div>
  )
}

export function SolicitacaoRow({ sol, isDark, onClick, onImovelClick }: Props) {
  const u = URGENCIA[sol.urgencia] ?? URGENCIA.normal
  const t = TIPO_CFG[sol.tipo] ?? TIPO_CFG.manutencao
  const valor = sol.valor_final ?? sol.valor_estimado

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer transition-colors ${
        isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'
      }`}
    >
      <span className={`w-[3px] h-8 rounded-full shrink-0 ${u.barra}`} />
      <t.icon size={13} className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.titulo}</p>
        <button
          onClick={e => { if (onImovelClick) { e.stopPropagation(); onImovelClick() } }}
          className={`text-[10px] truncate block text-left ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          } ${onImovelClick ? 'hover:underline' : ''}`}
        >
          {imovelLabel(sol)}{sol.imovel?.cidade ? ` · ${sol.imovel.cidade}` : ''}
        </button>
      </div>
      <span className={`w-[76px] text-[10px] font-semibold shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t.label}
      </span>
      <span className={`w-[62px] text-[9px] font-bold px-1.5 py-0.5 rounded text-center shrink-0 ${u.cls}`}>
        {u.label}
      </span>
      <span className={`w-[50px] text-right text-[11px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {diasEmAberto(sol)}d
      </span>
      <span className={`w-[80px] text-right text-[11px] font-bold shrink-0 ${
        valor != null ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : (isDark ? 'text-slate-600' : 'text-slate-300')
      }`}>
        {BRL(valor)}
      </span>
    </div>
  )
}
