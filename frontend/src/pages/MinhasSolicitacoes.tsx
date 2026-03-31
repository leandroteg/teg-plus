import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ClipboardList, Eye, Zap, X, AlertTriangle,
  CheckCircle2, Package, ShoppingCart, Truck, DollarSign,
  Clock, Filter,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// ── Tipos ──────────────────────────────────────────────────────────────────────
type Modulo = 'compras' | 'logistica' | 'financeiro'

interface SolicitacaoItem {
  id: string
  modulo: Modulo
  numero: string | null
  titulo: string
  status: string
  created_at: string
  updated_at: string | null
  solicitante_id: string | null
  urgencia_flag: string | null
  justificativa_urgencia: string | null
}

// ── Helpers de status ──────────────────────────────────────────────────────────
const STATUS_ENCERRADOS: Record<Modulo, string[]> = {
  compras:    ['cancelada', 'pago', 'entregue', 'rejeitada'],
  logistica:  ['concluido', 'cancelado', 'recusado', 'entregue', 'confirmado'],
  financeiro: ['pago', 'cancelado'],
}

function isEncerrada(item: SolicitacaoItem) {
  return (STATUS_ENCERRADOS[item.modulo] ?? []).includes(item.status)
}

// ── Módulo configs ─────────────────────────────────────────────────────────────
const MODULO_CONFIG: Record<Modulo, {
  label: string
  icon: React.ElementType
  bg: string
  text: string
  dot: string
  detalhePath: (id: string) => string
}> = {
  compras: {
    label: 'Compras',
    icon: ShoppingCart,
    bg: 'bg-violet-100',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    detalhePath: (id) => `/requisicoes/${id}`,
  },
  logistica: {
    label: 'Logística',
    icon: Truck,
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
    detalhePath: (id) => `/logistica/solicitacoes?id=${id}`,
  },
  financeiro: {
    label: 'Financeiro',
    icon: DollarSign,
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    detalhePath: (id) => `/financeiro/contas-a-pagar`,
  },
}

// ── Status badge ───────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  rascunho:            { label: 'Rascunho',          cls: 'bg-slate-100 text-slate-500' },
  pendente:            { label: 'Pendente',           cls: 'bg-yellow-100 text-yellow-700' },
  em_aprovacao:        { label: 'Em aprovação',       cls: 'bg-blue-100 text-blue-700' },
  aguardando_aprovacao:{ label: 'Ag. aprovação',      cls: 'bg-blue-100 text-blue-700' },
  aprovada:            { label: 'Aprovada',           cls: 'bg-emerald-100 text-emerald-700' },
  aprovado:            { label: 'Aprovado',           cls: 'bg-emerald-100 text-emerald-700' },
  rejeitada:           { label: 'Rejeitada',          cls: 'bg-red-100 text-red-700' },
  recusado:            { label: 'Recusado',           cls: 'bg-red-100 text-red-700' },
  em_cotacao:          { label: 'Em cotação',         cls: 'bg-indigo-100 text-indigo-700' },
  comprada:            { label: 'Comprada',           cls: 'bg-emerald-100 text-emerald-700' },
  cancelada:           { label: 'Cancelada',          cls: 'bg-slate-100 text-slate-500' },
  cancelado:           { label: 'Cancelado',          cls: 'bg-slate-100 text-slate-500' },
  pedido_emitido:      { label: 'Pedido emitido',     cls: 'bg-indigo-100 text-indigo-700' },
  em_entrega:          { label: 'Em entrega',         cls: 'bg-sky-100 text-sky-700' },
  entregue:            { label: 'Entregue',           cls: 'bg-teal-100 text-teal-700' },
  confirmado:          { label: 'Confirmado',         cls: 'bg-teal-100 text-teal-700' },
  aguardando_pgto:     { label: 'Ag. pagamento',      cls: 'bg-orange-100 text-orange-700' },
  pago:                { label: 'Pago',               cls: 'bg-slate-100 text-slate-500' },
  concluido:           { label: 'Concluído',          cls: 'bg-slate-100 text-slate-500' },
  concluída:           { label: 'Concluída',          cls: 'bg-slate-100 text-slate-500' },
  solicitado:          { label: 'Solicitado',         cls: 'bg-yellow-100 text-yellow-700' },
  validando:           { label: 'Validando',          cls: 'bg-blue-100 text-blue-700' },
  planejado:           { label: 'Planejado',          cls: 'bg-indigo-100 text-indigo-700' },
  em_transito:         { label: 'Em trânsito',        cls: 'bg-sky-100 text-sky-700' },
  em_esclarecimento:   { label: 'Em esclarecimento',  cls: 'bg-orange-100 text-orange-700' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Data formatting ────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 7) return `${d}d atrás`
  if (d < 30) return `${Math.floor(d / 7)}sem atrás`
  return `${Math.floor(d / 30)}m atrás`
}

// ── Hook de dados ──────────────────────────────────────────────────────────────
function useMinhasSolicitacoes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['minhas-solicitacoes', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_minhas_solicitacoes' as any)
        .select('*')
        .eq('solicitante_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SolicitacaoItem[]
    },
  })
}

// ── Modal urgência ─────────────────────────────────────────────────────────────
function UrgenciaModal({
  item,
  onClose,
  onSuccess,
}: {
  item: SolicitacaoItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const mod = MODULO_CONFIG[item.modulo]
  const Icon = mod.icon

  async function handleConfirm() {
    if (!motivo.trim()) { setErr('Informe o motivo da urgência.'); return }
    setLoading(true); setErr(null)
    try {
      let error: unknown = null
      if (item.modulo === 'compras') {
        const res = await supabase.from('cmp_requisicoes')
          .update({ urgencia: 'urgente', justificativa_urgencia: motivo.trim() })
          .eq('id', item.id)
        error = res.error
      } else if (item.modulo === 'logistica') {
        const res = await supabase.from('log_solicitacoes')
          .update({ urgente: true, justificativa_urgencia: motivo.trim() })
          .eq('id', item.id)
        error = res.error
      }
      if (error) throw error
      onSuccess()
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao solicitar urgência.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Zap size={16} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Solicitar Urgência</p>
              <p className="text-xs text-slate-400">{item.numero ?? item.id.slice(0,8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${mod.bg} ${mod.text}`}>
              <Icon size={11} />
              {mod.label}
            </span>
            <span className="text-sm text-slate-600 truncate">{item.titulo}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Motivo da urgência <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo pelo qual esta solicitação precisa de tratamento urgente..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            {err && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle size={11} /> {err}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            Confirmar urgência
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card de solicitação ────────────────────────────────────────────────────────
function SolicitacaoCard({
  item,
  onUrgencia,
}: {
  item: SolicitacaoItem
  onUrgencia: (item: SolicitacaoItem) => void
}) {
  const navigate = useNavigate()
  const mod = MODULO_CONFIG[item.modulo]
  const Icon = mod.icon
  const encerrada = isEncerrada(item)
  const jaUrgente = item.urgencia_flag === 'urgente' || item.urgencia_flag === 'critica' || item.urgencia_flag === 'alta'
  const ago = timeAgo(item.updated_at ?? item.created_at)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-start gap-3">
        {/* Módulo icon */}
        <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${mod.bg}`}>
          <Icon size={16} className={mod.text} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${mod.bg} ${mod.text}`}>
              {mod.label}
            </span>
            {item.numero && (
              <span className="text-[11px] font-mono font-semibold text-slate-400">{item.numero}</span>
            )}
            {jaUrgente && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">
                <Zap size={9} />
                Urgente
              </span>
            )}
          </div>

          {/* Título */}
          <p className="text-sm font-medium text-slate-800 leading-snug truncate">{item.titulo}</p>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock size={10} />
              <span>Aberta {formatDate(item.created_at)}</span>
            </div>
            {ago && (
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>· Mov. {ago}</span>
              </div>
            )}
            <StatusBadge status={item.status} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
        <button
          onClick={() => navigate(mod.detalhePath(item.id))}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <Eye size={13} className="text-slate-400" />
          Consultar andamento
        </button>
        {!encerrada && item.modulo !== 'financeiro' && (
          <button
            onClick={() => onUrgencia(item)}
            disabled={jaUrgente}
            title={jaUrgente ? 'Já marcada como urgente' : 'Pedir urgência'}
            className={[
              'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors',
              jaUrgente
                ? 'text-orange-400 bg-orange-50 cursor-default opacity-60'
                : 'text-orange-600 bg-orange-50 hover:bg-orange-100',
            ].join(' ')}
          >
            <Zap size={13} />
            Pedir urgência
          </button>
        )}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function MinhasSolicitacoes({
  embedded = false,
  defaultModulo,
}: {
  embedded?: boolean
  defaultModulo?: string
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data = [], isLoading, error } = useMinhasSolicitacoes()

  const resolvedDefault: Modulo | 'todos' =
    defaultModulo && (MODULO_CONFIG as any)[defaultModulo] ? (defaultModulo as Modulo) : 'todos'

  const [tab, setTab] = useState<'abertas' | 'encerradas'>('abertas')
  const [modFilter, setModFilter] = useState<Modulo | 'todos'>(resolvedDefault)
  const [urgenciaItem, setUrgenciaItem] = useState<SolicitacaoItem | null>(null)

  const abertas = useMemo(() => data.filter(i => !isEncerrada(i)), [data])
  const encerradas = useMemo(() => data.filter(isEncerrada), [data])
  const lista = tab === 'abertas' ? abertas : encerradas
  const filtered = modFilter === 'todos' ? lista : lista.filter(i => i.modulo === modFilter)

  const modulos = useMemo(() => {
    const set = new Set(data.map(i => i.modulo))
    return Array.from(set) as Modulo[]
  }, [data])

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {/* Header — oculto no modo embedded (já tem header do ModuleLayout) */}
      {!embedded && (
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ClipboardList size={16} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">Minhas Solicitações</h1>
              <p className="text-[11px] text-slate-400">
                {isLoading ? 'Carregando…' : `${abertas.length} em aberto · ${encerradas.length} encerrada${encerradas.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs — só no header standalone */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-0">
          {(['abertas', 'encerradas'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'relative px-4 py-2.5 text-[13px] font-semibold transition-colors',
                tab === t
                  ? 'text-indigo-600'
                  : 'text-slate-400 hover:text-slate-600',
              ].join(' ')}
            >
              {t === 'abertas' ? 'Abertas' : 'Encerradas'}
              {t === 'abertas' && abertas.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold">
                  {abertas.length}
                </span>
              )}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>
      )}

      <div className={embedded ? 'py-4 space-y-3' : 'max-w-2xl mx-auto px-4 py-4 space-y-3'}>
        {/* Título no modo embedded */}
        {embedded && (
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ClipboardList size={14} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">Minhas Solicitações</h1>
              <p className="text-[11px] text-slate-400">
                {isLoading ? 'Carregando…' : `${abertas.length} em aberto · ${encerradas.length} encerrada${encerradas.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        )}

        {/* Tabs no modo embedded (acima dos filtros) */}
        {embedded && (
          <div className="flex gap-1 border-b border-slate-100 -mt-1 mb-2">
            {(['abertas', 'encerradas'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'relative px-4 py-2.5 text-[13px] font-semibold transition-colors',
                  tab === t ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {t === 'abertas' ? 'Abertas' : 'Encerradas'}
                {t === 'abertas' && abertas.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold">
                    {abertas.length}
                  </span>
                )}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />}
              </button>
            ))}
          </div>
        )}

        {/* Filtro por módulo */}
        {modulos.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-slate-400 shrink-0" />
            {(['todos', ...modulos] as const).map(m => {
              const cfg = m !== 'todos' ? MODULO_CONFIG[m] : null
              const active = modFilter === m
              return (
                <button
                  key={m}
                  onClick={() => setModFilter(m)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors border',
                    active
                      ? (cfg ? `${cfg.bg} ${cfg.text} border-transparent` : 'bg-slate-800 text-white border-transparent')
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                  ].join(' ')}
                >
                  {cfg && <cfg.icon size={11} />}
                  {m === 'todos' ? 'Todos' : cfg!.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Estados */}
        {isLoading && (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Carregando solicitações…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-red-50 rounded-2xl p-4 text-center">
            <AlertTriangle size={20} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600">Erro ao carregar solicitações.</p>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            {tab === 'abertas' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600">Tudo em dia!</p>
                  <p className="text-xs text-slate-400 mt-0.5">Nenhuma solicitação em aberto.</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Package size={28} className="text-slate-300" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-500">Nenhuma encerrada</p>
                  <p className="text-xs text-slate-400 mt-0.5">Ainda não há solicitações encerradas.</p>
                </div>
              </>
            )}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && filtered.map(item => (
          <SolicitacaoCard
            key={`${item.modulo}-${item.id}`}
            item={item}
            onUrgencia={setUrgenciaItem}
          />
        ))}
      </div>

      {/* Modal urgência */}
      {urgenciaItem && (
        <UrgenciaModal
          item={urgenciaItem}
          onClose={() => setUrgenciaItem(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['minhas-solicitacoes'] })}
        />
      )}
    </div>
  )
}
