import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Clock,
  RefreshCw, Settings, TrendingUp, AlertTriangle,
  Package, ChevronRight, ShoppingCart, Timer,
  ArrowRight, CalendarClock, XCircle, Zap,
  CalendarDays, MapPin, Truck, ChevronDown,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useRequisicoes } from '../hooks/useRequisicoes'
import { usePedidos } from '../hooks/usePedidos'
import { useCotacoes } from '../hooks/useCotacoes'
import { useLookupObras } from '../hooks/useLookups'
import { useTheme } from '../contexts/ThemeContext'
import StatusBadge from '../components/StatusBadge'
import LeadTimePainel from '../components/dashboard/LeadTimePainel'
import { isPlaceholder } from '../services/supabase'
import type { StatusRequisicao, DashboardData, Aprovacao, Requisicao, Pedido, Cotacao } from '../types'

// ── Formatadores ─────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

// ── Constantes ───────────────────────────────────────────────────────────────
const EMPTY_KPIS: DashboardData['kpis'] = {
  total_mes: 0, aguardando_aprovacao: 0, aprovadas_mes: 0,
  rejeitadas_mes: 0, valor_total_mes: 0, tempo_medio_aprovacao_horas: 0,
}

const PIPELINE_ETAPAS = [
  { key: 'pendentes',  label: 'Pendentes',   statuses: ['rascunho', 'pendente'] as StatusRequisicao[],                         color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   barClass: 'bg-amber-400'   },
  { key: 'triagem_cd', label: 'Triagem CD',  statuses: ['em_triagem_cd'] as StatusRequisicao[],                                color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200',     barClass: 'bg-sky-500'     },
  { key: 'valid_tec',  label: 'Valid. Téc.', statuses: ['em_aprovacao'] as StatusRequisicao[],                                 color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    barClass: 'bg-blue-500'    },
  { key: 'cotacao',    label: 'Cotação',     statuses: ['aprovada', 'em_cotacao', 'cotacao_enviada'] as StatusRequisicao[],    color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  barClass: 'bg-violet-500'  },
  { key: 'aprov_fin',  label: 'Aprov. Fin.', statuses: ['cotacao_aprovada'] as StatusRequisicao[],                             color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  barClass: 'bg-indigo-500'  },
  { key: 'pedido',     label: 'Pedido',      statuses: ['pedido_emitido'] as StatusRequisicao[],                               color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200',    barClass: 'bg-cyan-500'    },
  { key: 'entrega',    label: 'Entrega',     statuses: ['em_entrega', 'entregue'] as StatusRequisicao[],                      color: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-200',    barClass: 'bg-teal-500'    },
  { key: 'pagamento',  label: 'Pagamento',   statuses: ['aguardando_pgto', 'pago'] as StatusRequisicao[],                     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', barClass: 'bg-emerald-500' },
]

const STATUS_ATIVO: StatusRequisicao[] = [
  'rascunho', 'em_triagem_cd', 'pendente', 'em_aprovacao', 'aprovada', 'em_esclarecimento',
  'em_cotacao', 'cotacao_enviada', 'cotacao_aprovada', 'pedido_emitido',
  'em_entrega', 'entregue', 'aguardando_pgto',
]

const PEDIDO_ATIVO = ['emitido', 'confirmado', 'em_entrega', 'parcialmente_recebido']
const COTACAO_ATIVA = ['pendente', 'em_andamento']

// RCs "em aberto": aguardando aprovação técnica + em cotação (exclui rascunho,
// já aprovadas em compra, pedido emitido, entrega, pagamento, rejeitada, cancelada)
const RC_ABERTAS_STATUS: StatusRequisicao[] = [
  'pendente', 'em_aprovacao', 'em_esclarecimento', // aguardando aprovação técnica
  'aprovada', 'em_cotacao', 'cotacao_enviada',      // cotação
]

const NIVEL_LABEL: Record<number, string> = { 1: 'Coordenador', 2: 'Gerente', 3: 'Diretor', 4: 'CEO' }

// ── Item unificado para urgentes/vencidas ────────────────────────────────────
type DashItemTipo = 'rc' | 'cotacao' | 'pedido'
interface DashItem {
  id: string
  tipo: DashItemTipo
  numero: string
  descricao: string
  obra_nome?: string
  urgencia?: string
  status: string
  prazo?: string        // data do prazo (necessidade / limite / prevista entrega)
  prazoLabel?: string   // "Necessidade" / "Limite Cotação" / "Entrega"
  valor?: number
  created_at: string
  navTo: string
}

const TIPO_LABEL: Record<DashItemTipo, string> = { rc: 'RC', cotacao: 'Cotação', pedido: 'Pedido' }
const TIPO_COLOR: Record<DashItemTipo, string> = {
  rc: 'bg-sky-100 text-sky-700',
  cotacao: 'bg-violet-100 text-violet-700',
  pedido: 'bg-cyan-100 text-cyan-700',
}

// ── toneClasses helper ────────────────────────────────────────────────────────
function toneClasses(
  tone: 'sky' | 'emerald' | 'cyan' | 'amber' | 'teal' | 'orange' | 'blue' | 'violet' | 'red' | 'slate' | 'indigo'
) {
  const map = {
    sky:     { text: 'text-sky-600',     soft: 'bg-sky-50 text-sky-700 border-sky-100',             icon: 'bg-sky-50 text-sky-500'     },
    emerald: { text: 'text-emerald-600', soft: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'bg-emerald-50 text-emerald-500' },
    cyan:    { text: 'text-cyan-600',    soft: 'bg-cyan-50 text-cyan-700 border-cyan-100',           icon: 'bg-cyan-50 text-cyan-500'   },
    amber:   { text: 'text-amber-600',   soft: 'bg-amber-50 text-amber-700 border-amber-100',       icon: 'bg-amber-50 text-amber-500' },
    teal:    { text: 'text-teal-600',    soft: 'bg-teal-50 text-teal-700 border-teal-100',           icon: 'bg-teal-50 text-teal-500'   },
    orange:  { text: 'text-orange-600',  soft: 'bg-orange-50 text-orange-700 border-orange-100',    icon: 'bg-orange-50 text-orange-500' },
    blue:    { text: 'text-blue-600',    soft: 'bg-blue-50 text-blue-700 border-blue-100',           icon: 'bg-blue-50 text-blue-500'   },
    violet:  { text: 'text-violet-600',  soft: 'bg-violet-50 text-violet-700 border-violet-100',    icon: 'bg-violet-50 text-violet-500' },
    red:     { text: 'text-red-600',     soft: 'bg-red-50 text-red-700 border-red-100',             icon: 'bg-red-50 text-red-500'     },
    slate:   { text: 'text-slate-500',   soft: 'bg-slate-50 text-slate-600 border-slate-100',       icon: 'bg-slate-50 text-slate-400' },
    indigo:  { text: 'text-indigo-600',  soft: 'bg-indigo-50 text-indigo-700 border-indigo-100',    icon: 'bg-indigo-50 text-indigo-500' },
  } as const
  return map[tone]
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function SpotlightMetric({
  label, value, note, tone,
}: {
  label: string
  value: number | string
  note: string
  tone: 'sky' | 'emerald' | 'cyan' | 'amber' | 'teal' | 'slate' | 'indigo' | 'orange' | 'blue' | 'violet' | 'red'
}) {
  const { isDark } = useTheme()
  const palette = toneClasses(tone)
  return (
    <div className={`rounded-2xl border px-3.5 py-2.5 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : `${palette.soft} border`}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1.5 text-[1.85rem] leading-none font-black ${palette.text}`}>{value}</p>
      <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{note}</p>
    </div>
  )
}

function PrazoBar({
  label, noPrazo, aVencer, vencido, isDark,
}: {
  label: string; noPrazo: number; aVencer: number; vencido: number; isDark: boolean
}) {
  const total = noPrazo + aVencer + vencido
  if (total === 0) return null
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} total</p>
      </div>
      <div className={`flex h-8 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
        {noPrazo > 0 && (
          <div className="bg-emerald-500 relative flex items-center justify-center transition-all"
            style={{ width: `${Math.max((noPrazo / total) * 100, 6)}%` }}
            title={`No prazo: ${noPrazo}`}>
            {(noPrazo / total) >= 0.15 && <span className="text-[10px] font-bold text-white px-1">No prazo {noPrazo}</span>}
          </div>
        )}
        {aVencer > 0 && (
          <div className="bg-amber-400 relative flex items-center justify-center transition-all"
            style={{ width: `${Math.max((aVencer / total) * 100, 6)}%` }}
            title={`À vencer: ${aVencer}`}>
            {(aVencer / total) >= 0.15 && <span className="text-[10px] font-bold text-white px-1">À vencer {aVencer}</span>}
          </div>
        )}
        {vencido > 0 && (
          <div className="bg-red-500 relative flex items-center justify-center transition-all"
            style={{ width: `${Math.max((vencido / total) * 100, 6)}%` }}
            title={`Vencido: ${vencido}`}>
            {(vencido / total) >= 0.15 && <span className="text-[10px] font-bold text-white px-1">Vencido {vencido}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniInfoCard({
  label, value, note, icon: Icon, iconTone, isDark,
}: {
  label: string; value: number; note: string
  icon: typeof FileText; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-slate-50/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
          <p className={`mt-1.5 text-[1.85rem] leading-none font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
          <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{note}</p>
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-white'}`}>
          <Icon size={14} className={iconTone} />
        </div>
      </div>
    </div>
  )
}

function EmptyPanel({ isDark, title, description }: { isDark: boolean; title: string; description: string }) {
  return (
    <div className={`px-4 py-6 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
      <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{title}</p>
      <p className="text-[10px] mt-1">{description}</p>
    </div>
  )
}

// ── ItemRow unificado (RC / Cotação / Pedido) ────────────────────────────────
function ItemRow({ item, isDark, nav, variant }: {
  item: DashItem; isDark: boolean; nav: ReturnType<typeof useNavigate>
  variant: 'urgente' | 'vencida'
}) {
  const hoje = Date.now()
  const prazoTs = item.prazo ? new Date(item.prazo).getTime() : 0
  const vencida = prazoTs > 0 && prazoTs < hoje

  return (
    <button
      type="button"
      onClick={() => nav(item.navTo)}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${
        variant === 'urgente'
          ? (isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-red-50/50')
          : (isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-amber-50/50')
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        variant === 'urgente'
          ? (item.urgencia === 'critica' ? (isDark ? 'bg-red-500/20' : 'bg-red-100') : (isDark ? 'bg-amber-500/10' : 'bg-amber-50'))
          : (vencida ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : (isDark ? 'bg-amber-500/10' : 'bg-amber-50'))
      }`}>
        {variant === 'urgente'
          ? <AlertTriangle size={14} className={item.urgencia === 'critica' ? 'text-red-500' : 'text-amber-500'} />
          : (vencida ? <XCircle size={14} className="text-red-500" /> : <Timer size={14} className="text-amber-500" />)
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.numero}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${TIPO_COLOR[item.tipo]}`}>
            {TIPO_LABEL[item.tipo]}
          </span>
          {variant === 'urgente' && item.urgencia && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {item.urgencia === 'critica' ? 'CRITICA' : 'URGENTE'}
            </span>
          )}
          {variant === 'vencida' && (
            vencida
              ? <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">VENCIDA</span>
              : <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">A VENCER</span>
          )}
        </div>
        <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.descricao}</p>
      </div>
      <div className="text-right shrink-0">
        {item.obra_nome && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.obra_nome}</p>}
        {item.prazo && variant === 'vencida' && (
          <p className={`text-[9px] mt-0.5 font-semibold ${vencida ? 'text-red-500' : 'text-amber-600'}`}>
            {item.prazoLabel}: {fmtData(item.prazo)}
          </p>
        )}
        {item.valor != null && item.valor > 0 && (
          <p className="text-[10px] font-bold text-teal-600">{fmt(item.valor)}</p>
        )}
      </div>
    </button>
  )
}

// ── UrgentesCard ──────────────────────────────────────────────────────────────
function UrgentesCard({ items, isDark, nav }: { items: DashItem[]; isDark: boolean; nav: ReturnType<typeof useNavigate> }) {
  return (
    <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-red-500/30' : 'bg-white border border-red-200'}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-red-500/20' : 'border-b border-red-100'}`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-red-400' : 'text-red-800'}`}>
          <Zap size={14} className="text-red-500" /> Urgentes
        </h2>
        <button
          onClick={() => nav('/requisicoes')}
          className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5"
        >
          Ver todas <ArrowRight size={10} />
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyPanel
          isDark={isDark}
          title="Nenhum item urgente"
          description="Requisições, cotações e pedidos urgentes ou críticos aparecem aqui."
        />
      ) : (
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-red-50'}`}>
          {items.slice(0, 6).map(item => (
            <ItemRow key={`${item.tipo}-${item.id}`} item={item} isDark={isDark} nav={nav} variant="urgente" />
          ))}
        </div>
      )}
    </section>
  )
}

// ── VencidasCard ──────────────────────────────────────────────────────────────
function VencidasCard({ items, isDark, nav }: { items: DashItem[]; isDark: boolean; nav: ReturnType<typeof useNavigate> }) {
  return (
    <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-amber-500/30' : 'bg-white border border-amber-200'}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-amber-500/20' : 'border-b border-amber-100'}`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
          <CalendarClock size={14} className="text-amber-500" /> Vencidas / A vencer
        </h2>
        <button
          onClick={() => nav('/requisicoes')}
          className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5"
        >
          Ver todas <ArrowRight size={10} />
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyPanel
          isDark={isDark}
          title="Nenhum item vencido ou proximo do prazo"
          description="RCs, cotacoes e pedidos com prazo vencido ou nos proximos 3 dias aparecem aqui."
        />
      ) : (
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-amber-50'}`}>
          {items.slice(0, 6).map(item => (
            <ItemRow key={`${item.tipo}-${item.id}`} item={item} isDark={isDark} nav={nav} variant="vencida" />
          ))}
        </div>
      )}
    </section>
  )
}

// ── RecentCard ────────────────────────────────────────────────────────────────
function formatUserHandle(nome: string): string {
  const parts = nome?.trim().split(/\s+/) ?? []
  if (parts.length === 0) return ''
  const first = parts[0].toLowerCase()
  const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
  return last ? `${first}.${last}` : first
}

function RecentCard({ r, aprovacao, isDark, nav }: { r: any; aprovacao?: Aprovacao; isDark: boolean; nav: ReturnType<typeof useNavigate> }) {
  const approvalLabel = r.status === 'pendente' ? 'Aguard. Valid. Tecnica'
    : r.status === 'em_aprovacao' ? 'Em Validacao Tecnica'
    : r.status === 'cotacao_aprovada' ? 'Aguard. Aprov. Financeira'
    : undefined

  const userHandle = r.solicitante_nome ? formatUserHandle(r.solicitante_nome) : null

  return (
    <button
      type="button"
      onClick={() => nav(`/requisicoes/${r.id}`)}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.numero}</span>
          {userHandle && (
            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{userHandle}</span>
          )}
          <StatusBadge status={r.status as StatusRequisicao} size="sm" customLabel={approvalLabel} />
          {(r.urgencia === 'urgente' || r.urgencia === 'critica') && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {r.urgencia === 'critica' ? 'CRITICA' : 'URGENTE'}
            </span>
          )}
        </div>
        <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{(r as any).justificativa || r.descricao}</p>
        {aprovacao && (
          <div className="flex items-center gap-1 mt-1">
            <Clock size={9} className="text-amber-500" />
            <span className="text-[10px] text-amber-600 font-medium truncate">
              Aguardando {aprovacao.aprovador_nome}
              {aprovacao.nivel ? ` (${NIVEL_LABEL[aprovacao.nivel] ?? `Nivel ${aprovacao.nivel}`})` : ''}
            </span>
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs truncate max-w-[80px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.obra_nome}</p>
        <p className="text-sm font-extrabold text-teal-600">
          {r.valor_estimado?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) ?? '—'}
        </p>
      </div>
    </button>
  )
}

// ── Loader / Error / Setup ────────────────────────────────────────────────────
function Loader() {
  const { isDark } = useTheme()
  return (
    <div className="flex items-center justify-center py-20">
      <div className={`w-8 h-8 border-[3px] border-t-transparent rounded-full animate-spin ${isDark ? 'border-teal-400' : 'border-teal-500'}`} />
    </div>
  )
}

function SetupRequired() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 px-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-amber-500 shrink-0" />
          <h2 className="font-bold text-slate-800">Configuracao necessaria</h2>
        </div>
        <p className="text-sm text-slate-600">Configure as variaveis de ambiente do Supabase no Vercel.</p>
        <div className="space-y-2 text-xs font-mono bg-slate-900 text-emerald-400 rounded-xl p-3">
          <p className="text-slate-400"># Vercel → Settings → Environment Variables</p>
          <p>VITE_SUPABASE_URL</p>
          <p>VITE_SUPABASE_ANON_KEY</p>
        </div>
        <a href="https://supabase.com/dashboard/project/uzfjfucrinokeuwpbeie/settings/api"
          target="_blank" rel="noopener noreferrer"
          className="block text-center text-xs bg-teal-500 text-white rounded-xl py-2.5 px-4 font-semibold">
          Copiar Anon Key no Supabase →
        </a>
      </div>
    </div>
  )
}

// ── Seletor de período De/Até (mês + ano), padrão do RH ───────────────────────
function ymHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function addMeses(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const MESES_OPT: Array<[string, string]> = [
  ['01', 'Jan'], ['02', 'Fev'], ['03', 'Mar'], ['04', 'Abr'], ['05', 'Mai'], ['06', 'Jun'],
  ['07', 'Jul'], ['08', 'Ago'], ['09', 'Set'], ['10', 'Out'], ['11', 'Nov'], ['12', 'Dez'],
]
function PeriodoSelect({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) {
  const [y, m] = value.split('-')
  const anoAtual = new Date().getFullYear()
  const anos: number[] = []
  for (let a = 2021; a <= anoAtual; a++) anos.push(a)
  const cls = `appearance-none rounded-lg px-2 py-1 border text-[11px] font-semibold cursor-pointer ${
    isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
  }`
  return (
    <span className="inline-flex items-center gap-1">
      <select value={m} onChange={e => onChange(`${y}-${e.target.value}`)} className={cls} aria-label="Mês">
        {MESES_OPT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select value={y} onChange={e => onChange(`${e.target.value}-${m}`)} className={cls} aria-label="Ano">
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </span>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function Dashboard() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const [de, setDe] = useState(addMeses(ymHoje(), -2))
  const [ate, setAte] = useState(ymHoje())
  const [obraFilter, setObraFilter] = useState('')
  const [leadMode, setLeadMode] = useState<'entregues' | 'geral'>('geral')
  const [pipelineFilter, setPipelineFilter] = useState<number | null>(null)
  // Visão do painel: 'resumo' (default, compacto) | 'detalhada' (expande Lead Time).
  // Preferência persiste em localStorage.
  const [visao, setVisao] = useState<'resumo' | 'detalhada'>(() => {
    if (typeof window === 'undefined') return 'resumo'
    return (localStorage.getItem('painel-compras-visao') as 'resumo' | 'detalhada') || 'resumo'
  })
  function trocarVisao(v: 'resumo' | 'detalhada') {
    setVisao(v)
    try { localStorage.setItem('painel-compras-visao', v) } catch { /* ignore */ }
  }
  const obras = useLookupObras()
  const { data, isLoading, isError, refetch } = useDashboard('range', obraFilter || undefined, { de, ate })
  const { data: todasReqs = [] } = useRequisicoes()
  const { data: todosPedidos = [] } = usePedidos()
  const { data: todasCotacoes = [] } = useCotacoes()

  // ── Todos os hooks/useMemo ANTES de qualquer early return ───
  const kpis = data?.kpis ?? EMPTY_KPIS
  const aprovacoes_pendentes = data?.aprovacoes_pendentes ?? []
  const reqs = todasReqs.length > 0 ? todasReqs : (data?.requisicoes_recentes ?? [])
  const hoje = Date.now()
  const tresDias = 3 * 24 * 3600_000

  // Quantidade de pedidos emitidos (toda linha em cmp_pedidos já foi emitida; exclui cancelados)
  const pedidosEmitidos = useMemo(() =>
    todosPedidos.filter(p => p.status !== 'cancelado').length,
    [todosPedidos]
  )

  // RCs em aberto no período: aguardando aprovação técnica + cotação
  const rcsEmAberto = useMemo(() =>
    (data?.por_status ?? [])
      .filter(s => (RC_ABERTAS_STATUS as string[]).includes(s.status))
      .reduce((sum, s) => sum + (s.total ?? 0), 0),
    [data]
  )

  // Lead time de atendimento (em dias), no período/obra selecionados:
  //  • entregues = data_entrega_real − created_at da RC (só RCs entregues)
  //  • geral     = inclui RCs em aberto na média (hoje − created_at)
  const leadStats = useMemo(() => {
    const [dy, dm] = de.split('-').map(Number)
    const [ay, am] = ate.split('-').map(Number)
    const ini = new Date(dy, dm - 1, 1, 0, 0, 0).getTime()
    const fim = new Date(ay, am, 0, 23, 59, 59).getTime()
    const DAY = 86400_000
    // maior data de entrega por requisição (a partir dos pedidos vinculados)
    const entregaPorReq = new Map<string, number>()
    for (const p of todosPedidos as Array<Record<string, unknown>>) {
      const reqId = p.requisicao_id as string | undefined
      const dEnt = p.data_entrega_real as string | undefined
      if (!reqId || !dEnt) continue
      const t = new Date(`${String(dEnt).slice(0, 10)}T23:59:59`).getTime()
      const prev = entregaPorReq.get(reqId)
      if (prev === undefined || t > prev) entregaPorReq.set(reqId, t)
    }
    const FECHADO = new Set(['rascunho', 'cancelada', 'rejeitada'])
    let entSum = 0, entN = 0, gSum = 0, gN = 0
    for (const r of todasReqs as Array<Record<string, unknown>>) {
      const cr = r.created_at as string | undefined
      if (!cr) continue
      const crc = new Date(cr).getTime()
      if (crc < ini || crc > fim) continue
      if (obraFilter && r.obra_id !== obraFilter) continue
      const entrega = entregaPorReq.get(r.id as string)
      if (entrega !== undefined) {
        const dias = Math.max(0, (entrega - crc) / DAY)
        entSum += dias; entN++; gSum += dias; gN++
      } else if (!FECHADO.has(r.status as string)) {
        const dias = Math.max(0, (hoje - crc) / DAY) // em aberto: idade até hoje
        gSum += dias; gN++
      }
    }
    return { entregues: entN ? entSum / entN : null, geral: gN ? gSum / gN : null }
  }, [todasReqs, todosPedidos, de, ate, obraFilter, hoje])

  // ── Converter tudo para DashItem (sem duplicar fluxo) ───
  // Cada requisição aparece apenas no estágio mais avançado:
  // pedido > cotação > RC
  const allItems = useMemo(() => {
    const items: DashItem[] = []

    // IDs de requisições que já têm pedido ativo
    const reqComPedido = new Set<string>()
    todosPedidos.forEach(p => {
      if (PEDIDO_ATIVO.includes(p.status) && p.requisicao_id) reqComPedido.add(p.requisicao_id)
    })

    // IDs de requisições que já têm cotação ativa
    const reqComCotacao = new Set<string>()
    todasCotacoes.forEach(c => {
      if (COTACAO_ATIVA.includes(c.status) && c.requisicao_id) reqComCotacao.add(c.requisicao_id)
    })

    // RCs — só se NÃO tem cotação nem pedido ativo
    reqs.forEach(r => {
      if (!STATUS_ATIVO.includes(r.status)) return
      if (reqComPedido.has(r.id) || reqComCotacao.has(r.id)) return
      items.push({
        id: r.id, tipo: 'rc', numero: r.numero,
        descricao: (r as any).justificativa || r.descricao,
        obra_nome: r.obra_nome, urgencia: r.urgencia, status: r.status,
        prazo: (r as any).data_necessidade || undefined,
        prazoLabel: 'Necessidade', valor: r.valor_estimado,
        created_at: r.created_at, navTo: `/requisicoes/${r.id}`,
      })
    })

    // Cotações — só se NÃO tem pedido ativo
    todasCotacoes.forEach(c => {
      if (!COTACAO_ATIVA.includes(c.status)) return
      if (reqComPedido.has(c.requisicao_id)) return
      const req = c.requisicao as any
      items.push({
        id: c.id, tipo: 'cotacao',
        numero: req?.numero ? `${req.numero}/COT` : `COT-${c.id.slice(0, 6)}`,
        descricao: req?.justificativa || req?.descricao || 'Cotacao em andamento',
        obra_nome: req?.obra_nome, urgencia: req?.urgencia, status: c.status,
        prazo: c.data_limite || undefined,
        prazoLabel: 'Limite', valor: c.valor_selecionado ?? undefined,
        created_at: c.created_at, navTo: `/cotacoes/${c.requisicao_id}`,
      })
    })

    // Pedidos — sempre aparecem (estágio mais avançado)
    todosPedidos.forEach(p => {
      if (!PEDIDO_ATIVO.includes(p.status)) return
      const req = p.requisicao as any
      items.push({
        id: p.id, tipo: 'pedido',
        numero: p.numero_pedido || `PED-${p.id.slice(0, 6)}`,
        descricao: req?.justificativa || req?.descricao || p.fornecedor_nome,
        obra_nome: req?.obra_nome, urgencia: req?.urgencia, status: p.status,
        prazo: p.data_prevista_entrega || undefined,
        prazoLabel: 'Entrega', valor: p.valor_total ?? undefined,
        created_at: p.created_at, navTo: `/pedidos`,
      })
    })

    return items
  }, [reqs, todasCotacoes, todosPedidos])

  // ── Urgentes (RCs urgentes/criticas + pedidos em atraso) ───
  const urgentes = useMemo(() =>
    allItems
      .filter(item => {
        if (item.urgencia === 'urgente' || item.urgencia === 'critica') return true
        // Pedidos em atraso de entrega são urgentes
        if (item.tipo === 'pedido' && item.prazo) {
          return new Date(item.prazo).getTime() < hoje
        }
        return false
      })
      .sort((a, b) => {
        if (a.urgencia === 'critica' && b.urgencia !== 'critica') return -1
        if (b.urgencia === 'critica' && a.urgencia !== 'critica') return 1
        // Pedidos atrasados primeiro
        const aPrazo = a.prazo ? new Date(a.prazo).getTime() : Infinity
        const bPrazo = b.prazo ? new Date(b.prazo).getTime() : Infinity
        return aPrazo - bPrazo
      }),
    [allItems, hoje]
  )

  // ── Vencidas/À vencer (todos com prazo <= hoje + 3 dias) ───
  const vencidasAVencer = useMemo(() =>
    allItems
      .filter(item => {
        if (!item.prazo) return false
        const ts = new Date(item.prazo).getTime()
        return ts <= hoje + tresDias
      })
      .sort((a, b) => {
        const tsA = new Date(a.prazo!).getTime()
        const tsB = new Date(b.prazo!).getTime()
        return tsA - tsB
      }),
    [allItems, hoje]
  )

  // ── Contagens por prazo para o Pulso (barra única) ───
  const prazoCounts = useMemo(() => {
    let noPrazo = 0, aVencer = 0, vencido = 0
    allItems.forEach(item => {
      if (!item.prazo) { noPrazo++; return }
      const ts = new Date(item.prazo).getTime()
      if (ts < hoje) vencido++
      else if (ts <= hoje + tresDias) aVencer++
      else noPrazo++
    })
    return { noPrazo, aVencer, vencido }
  }, [allItems, hoje])

  if (isPlaceholder) return <SetupRequired />
  if (isLoading) return <Loader />

  const aprovacaoMap = new Map<string, Aprovacao>(
    aprovacoes_pendentes.map(a => [a.requisicao_id, a])
  )

  const recentes = pipelineFilter !== null
    ? reqs.filter(r => PIPELINE_ETAPAS[pipelineFilter].statuses.includes(r.status))
    : reqs.slice(0, 8)

  // Lead time exibido conforme o toggle (entregues vs inclui em aberto)
  const leadVal = leadMode === 'entregues' ? leadStats.entregues : leadStats.geral
  const leadStr = leadVal == null ? '—' : leadVal >= 1 ? `${leadVal.toFixed(1)}d` : `${Math.round(leadVal * 24)}h`

  const cardClass = isDark
    ? 'bg-[#1e293b] border border-white/[0.06]'
    : 'bg-white border border-slate-200'

  return (
    <div className="space-y-5">

      {/* Banner de erro */}
      {isError && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <span className="text-amber-700 font-medium">Falha ao carregar dados — exibindo ultima versao disponivel</span>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 whitespace-nowrap"
          >
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </div>
      )}

      {/* Header + Filtros */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Painel - Compras
            </h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Requisicoes, cotacoes e pedidos de compra
            </p>
          </div>
          {/* Seletor de visão (dropdown) — colado ao título, padrão RH */}
          <div className="relative">
            <select value={visao} onChange={e => trocarVisao(e.target.value as 'resumo' | 'detalhada')}
              className={`appearance-none text-xs font-semibold rounded-lg pl-3 pr-7 py-1.5 cursor-pointer border transition-all ${
                isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}>
              <option value="resumo">Resumo</option>
              <option value="detalhada">Detalhada</option>
            </select>
            <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle elegante: forma de cálculo do Lead Time */}
          <div className={`flex items-center gap-0.5 p-0.5 rounded-full border ${isDark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-slate-100 border-slate-200'}`}>
            {([['entregues', 'Entregues'], ['geral', '+ Em aberto']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setLeadMode(k)}
                title={k === 'entregues' ? 'Lead time só dos pedidos entregues (entrega − requisição)' : 'Inclui as requisições em aberto na média (hoje − requisição)'}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  leadMode === k ? 'bg-teal-600 text-white shadow-sm' : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {l}
              </button>
            ))}
          </div>
          {/* Filtro De/Até (mês + ano, padrão RH) */}
          <div className="flex items-center gap-1.5">
            <CalendarDays size={12} className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <PeriodoSelect value={de} onChange={v => { setDe(v); if (v > ate) setAte(v) }} isDark={isDark} />
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
            <PeriodoSelect value={ate} onChange={v => { setAte(v); if (v < de) setDe(v) }} isDark={isDark} />
          </div>
          <div className="relative flex items-center">
            <MapPin size={11} className={`absolute left-2.5 pointer-events-none z-10 ${obraFilter ? 'text-teal-600' : isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <select
              value={obraFilter}
              onChange={e => setObraFilter(e.target.value)}
              className={`text-[11px] font-semibold rounded-2xl pl-7 pr-3 py-2 border transition-all appearance-none cursor-pointer max-w-[140px] truncate ${
                obraFilter
                  ? 'bg-teal-50 border-teal-300 text-teal-700'
                  : isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
            >
              <option value="">Todas obras</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => refetch()}
            className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-slate-500 hover:text-teal-400' : 'text-slate-400 hover:text-teal-600'}`}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* Hero 2 colunas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">

        {/* Nucleo de Compras */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nucleo de Compras
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Indicadores do periodo selecionado
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                <ShoppingCart size={18} className="text-teal-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric
                label="Pedidos Emitidos"
                value={pedidosEmitidos}
                tone="teal"
                note="pedidos emitidos"
              />
              <SpotlightMetric
                label="RCs em Aberto"
                value={rcsEmAberto}
                tone="sky"
                note="aprov. tecnica + cotacao"
              />
              <SpotlightMetric
                label="Lead Time"
                value={leadStr}
                tone={leadVal != null && leadVal > 7 ? 'amber' : 'emerald'}
                note={leadMode === 'entregues' ? 'entregues · entrega − RC' : 'inclui abertos · hoje − RC'}
              />
            </div>
          </div>
        </section>

        {/* Janela Critica */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Janela Critica
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  O que exige acao agora
                </h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${urgentes.length > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={14} className={urgentes.length > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard
                label="Urgentes"
                value={urgentes.length}
                note={urgentes.length > 0 ? 'RCs + pedidos atrasados' : 'tudo ok'}
                icon={Zap}
                iconTone={urgentes.length > 0 ? 'text-red-500' : 'text-slate-400'}
                isDark={isDark}
              />
              <MiniInfoCard
                label="Vencidas/A Vencer"
                value={vencidasAVencer.length}
                note="RCs + cotacoes + pedidos"
                icon={CalendarClock}
                iconTone={vencidasAVencer.length > 0 ? 'text-amber-500' : 'text-slate-400'}
                isDark={isDark}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Lead Time de Compras (por categoria/fase) */}
      {visao === 'detalhada' && <LeadTimePainel isDark={isDark} leadMode={leadMode} de={de} ate={ate} obraId={obraFilter || undefined} />}

      {/* Pulso por Prazo */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-teal-500" /> Pulso por Prazo
          </h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> <span className="text-[10px] text-slate-500">No prazo</span></span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> <span className="text-[10px] text-slate-500">A vencer</span></span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> <span className="text-[10px] text-slate-500">Vencido</span></span>
          </div>
        </div>
        <div className="px-4 py-3 space-y-3">
          <PrazoBar label="RCs / Cotacoes / Pedidos" {...prazoCounts} isDark={isDark} />
          {prazoCounts.noPrazo + prazoCounts.aVencer + prazoCounts.vencido === 0 && (
            <p className={`text-center text-[10px] py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum item ativo no periodo</p>
          )}
        </div>
      </section>

      {/* Urgentes + Vencidas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <UrgentesCard items={urgentes} isDark={isDark} nav={nav} />
        <VencidasCard items={vencidasAVencer} isDark={isDark} nav={nav} />
      </div>

      {/* Recentes + Pedidos por Obra */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Recentes */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Clock size={14} className="text-slate-500" />
              {pipelineFilter !== null ? PIPELINE_ETAPAS[pipelineFilter].label : 'Recentes'}
            </h2>
            <button onClick={() => nav('/requisicoes')}
              className="flex items-center gap-0.5 text-[10px] text-teal-600 font-semibold">
              Ver todas <ChevronRight size={11} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {recentes.length === 0 ? (
              <EmptyPanel isDark={isDark} title="Nenhuma requisicao encontrada" description="Ajuste os filtros de periodo ou obra para ver mais resultados." />
            ) : (
              recentes.slice(0, 8).map(r => (
                <RecentCard key={r.id} r={r} aprovacao={aprovacaoMap.get(r.id)} isDark={isDark} nav={nav} />
              ))
            )}
          </div>
        </section>

        {/* Pedidos por Obra */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Package size={14} className="text-teal-500" /> Pedidos por Obra
            </h2>
          </div>
          <div className="p-4 space-y-2.5">
            {(() => {
              const obraMap = new Map<string, { nome: string; valor: number; qtd: number }>()
              todosPedidos.forEach(p => {
                if (p.status === 'cancelado') return
                const nome = (p.requisicao as any)?.obra_nome || 'Sem obra'
                const cur = obraMap.get(nome) || { nome, valor: 0, qtd: 0 }
                cur.valor += p.valor_total ?? 0
                cur.qtd += 1
                obraMap.set(nome, cur)
              })
              const sorted = Array.from(obraMap.values()).sort((a, b) => b.valor - a.valor)
              const maxVal = sorted[0]?.valor || 1
              if (sorted.length === 0) return (
                <EmptyPanel isDark={isDark} title="Nenhum pedido" description="Pedidos emitidos por obra aparecem aqui." />
              )
              return sorted.map(o => (
                <div key={o.nome} className="flex items-center gap-3">
                  <p className={`text-[11px] font-semibold text-right shrink-0 w-[120px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {o.nome}
                  </p>
                  <div className="flex-1 relative">
                    <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-500"
                        style={{ width: `${Math.max((o.valor / maxVal) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                  <p className={`text-[11px] font-extrabold shrink-0 w-[70px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {fmt(o.valor)}
                  </p>
                </div>
              ))
            })()}
          </div>
        </section>
      </div>

    </div>
  )
}
