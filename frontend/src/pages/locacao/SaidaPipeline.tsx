import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRightFromLine, X, Search, ArrowUp, ArrowDown, LayoutList, LayoutGrid,
  MapPin, Calendar, ClipboardCheck, FileText, CheckCircle2, AlertTriangle,
  ShieldAlert, DollarSign, Landmark,
} from 'lucide-react'
import { useSaidas, useAtualizarStatusSaida, useImoveis } from '../../hooks/useLocacao'
import { useTheme } from '../../contexts/ThemeContext'
import type { LocSaida, StatusSaida } from '../../types/locacao'
import { SAIDA_PIPELINE_STAGES } from '../../types/locacao'

// ── Accent maps ──────────────────────────────────────────────────────────────
type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }
const STATUS_ACCENT: Record<StatusSaida, AccentSet> = {
  pendente:                { bg:'bg-amber-50',   bgActive:'bg-amber-100',  text:'text-amber-500',  textActive:'text-amber-800',  dot:'bg-amber-500', badge:'bg-amber-200/80 text-amber-700', border:'border-amber-200' },
  aguardando_vistoria:     { bg:'bg-blue-50',    bgActive:'bg-blue-100',   text:'text-blue-500',   textActive:'text-blue-800',   dot:'bg-blue-500',  badge:'bg-blue-200/80 text-blue-700',   border:'border-blue-200' },
  solucionando_pendencias: { bg:'bg-red-50',     bgActive:'bg-red-100',    text:'text-red-500',    textActive:'text-red-800',    dot:'bg-red-500',   badge:'bg-red-200/80 text-red-700',     border:'border-red-200' },
  encerramento_contratual: { bg:'bg-violet-50',  bgActive:'bg-violet-100', text:'text-violet-500', textActive:'text-violet-800', dot:'bg-violet-500',badge:'bg-violet-200/80 text-violet-700',border:'border-violet-200' },
  encerrado:               { bg:'bg-slate-50',   bgActive:'bg-slate-100',  text:'text-slate-500',  textActive:'text-slate-800',  dot:'bg-slate-400', badge:'bg-slate-200/80 text-slate-600', border:'border-slate-200' },
}
const STATUS_ACCENT_DARK: Record<StatusSaida, AccentSet> = {
  pendente:                { bg:'bg-amber-500/5',  bgActive:'bg-amber-500/15',  text:'text-amber-400',  textActive:'text-amber-200',  dot:'bg-amber-400', badge:'bg-amber-500/15 text-amber-300', border:'border-amber-500/20' },
  aguardando_vistoria:     { bg:'bg-blue-500/5',   bgActive:'bg-blue-500/15',   text:'text-blue-400',   textActive:'text-blue-200',   dot:'bg-blue-400',  badge:'bg-blue-500/15 text-blue-300',   border:'border-blue-500/20' },
  solucionando_pendencias: { bg:'bg-red-500/5',    bgActive:'bg-red-500/15',    text:'text-red-400',    textActive:'text-red-200',    dot:'bg-red-400',   badge:'bg-red-500/15 text-red-300',     border:'border-red-500/20' },
  encerramento_contratual: { bg:'bg-violet-500/5', bgActive:'bg-violet-500/15', text:'text-violet-400', textActive:'text-violet-200', dot:'bg-violet-400',badge:'bg-violet-500/15 text-violet-300',border:'border-violet-500/20' },
  encerrado:               { bg:'bg-white/[0.02]', bgActive:'bg-white/[0.06]',  text:'text-slate-500',  textActive:'text-slate-200',  dot:'bg-slate-500', badge:'bg-white/[0.06] text-slate-400', border:'border-white/[0.08]' },
}

const STATUS_ICONS: Record<StatusSaida, typeof ArrowRightFromLine> = {
  pendente: ClipboardCheck, aguardando_vistoria: Search, solucionando_pendencias: ShieldAlert,
  encerramento_contratual: FileText, encerrado: CheckCircle2,
}

type SortField = 'data' | 'imovel' | 'cidade'
type SortDir = 'asc' | 'desc'
type ViewMode = 'cards' | 'list'
const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data', label: 'Data' }, { field: 'imovel', label: 'Imóvel' }, { field: 'cidade', label: 'Cidade' },
]
const fmtDate = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const fmtCur = (v?: number) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null

// ── Detail Modal ─────────────────────────────────────────────────────────────
function SaidaDetailModal({ saida, onClose, onAction, isDark }: {
  saida: LocSaida; onClose: () => void
  onAction: (action: string, s: LocSaida) => void; isDark: boolean
}) {
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const cardBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-400'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const accent = isDark ? STATUS_ACCENT_DARK[saida.status] : STATUS_ACCENT[saida.status]
  const stage = SAIDA_PIPELINE_STAGES.find(s => s.key === saida.status)
  const imo = saida.imovel

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div className="flex items-center gap-2 min-w-0">
            <ArrowRightFromLine size={18} className="text-indigo-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${txtMain}`}>{imo?.descricao || imo?.endereco || 'Devolução'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            {saida.data_limite_saida && saida.status !== 'encerrado' && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} /> Limite: {fmtDate(saida.data_limite_saida)}
              </span>
            )}
            <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${accent.bgActive} ${accent.textActive}`}>
              <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
              {stage?.label ?? saida.status}
            </span>
          </div>

          {/* Seção IMÓVEL */}
          {imo && (
            <div className={`rounded-xl p-4 ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-200'}`}>
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Imóvel</p>
              <div className="space-y-1">
                {imo.endereco && <p className={`text-sm font-bold ${txtMain}`}>{imo.endereco}{imo.numero ? `, ${imo.numero}` : ''}</p>}
                {imo.bairro && <p className={`text-xs ${txtMuted}`}>{imo.bairro}</p>}
                <p className={`text-xs ${txtMuted}`}>{[imo.cidade, imo.uf].filter(Boolean).join(' — ')}{imo.cep ? ` · CEP ${imo.cep}` : ''}</p>
              </div>
            </div>
          )}

          {/* Seção DADOS DA DEVOLUÇÃO */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Dados da Devolução</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {saida.data_aviso && <div><p className={txtMuted}>Data do Aviso</p><p className={`font-semibold ${txtMain}`}>{fmtDate(saida.data_aviso)}</p></div>}
              {saida.data_limite_saida && <div><p className={txtMuted}>Data Limite Saída</p><p className={`font-semibold ${txtMain}`}>{fmtDate(saida.data_limite_saida)}</p></div>}
              {saida.caucao_valor != null && (
                <div>
                  <p className={txtMuted}>Caução</p>
                  <p className={`font-semibold ${txtMain}`}>
                    {fmtCur(saida.caucao_valor)}
                    {saida.caucao_devolvido && <span className="ml-1 text-[9px] text-emerald-600 font-bold">(devolvido)</span>}
                  </p>
                </div>
              )}
              {saida.responsavel_id && <div><p className={txtMuted}>Responsável</p><p className={`font-semibold ${txtMain}`}>Atribuído</p></div>}
              {(imo as any)?.centro_custo?.descricao && <div><p className={txtMuted}>Centro de Custo</p><p className={`font-semibold ${txtMain}`}>{(imo as any).centro_custo.codigo} — {(imo as any).centro_custo.descricao}</p></div>}
              {imo?.locador_nome && <div><p className={txtMuted}>Locador</p><p className={`font-semibold ${txtMain}`}>{imo.locador_nome}</p></div>}
              {imo?.valor_aluguel_mensal != null && <div><p className={txtMuted}>Aluguel Mensal</p><p className={`font-semibold ${txtMain}`}>{fmtCur(imo.valor_aluguel_mensal)}</p></div>}
            </div>
          </div>

          {/* Pendências (se status = solucionando_pendencias) */}
          {saida.status === 'solucionando_pendencias' && (
            <div className={`rounded-xl p-4 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider mb-2">Pendências da Vistoria</p>
              {saida.valores_em_aberto?.length > 0 ? (
                <ul className={`text-xs space-y-1 ${txtMain}`}>
                  {saida.valores_em_aberto.map((v, i) => <li key={i} className="flex items-center gap-1.5"><ShieldAlert size={10} className="text-red-400 shrink-0" /> {JSON.stringify(v)}</li>)}
                </ul>
              ) : (
                <p className={`text-xs ${txtMuted}`}>Nenhuma pendência registrada ainda.</p>
              )}
            </div>
          )}

          {/* Observações */}
          {saida.observacoes && (
            <div className={`rounded-xl p-4 ${cardBg}`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Observações</p>
              <p className={`text-xs whitespace-pre-wrap ${txtMain}`}>{saida.observacoes}</p>
            </div>
          )}

          {/* Progresso */}
          <div className={`rounded-xl p-3 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {SAIDA_PIPELINE_STAGES.map((s, i) => {
                const ci = SAIDA_PIPELINE_STAGES.findIndex(st => st.key === saida.status)
                const a = isDark ? STATUS_ACCENT_DARK[s.key] : STATUS_ACCENT[s.key]
                return <div key={s.key} className="flex-1"><div className={`h-1.5 rounded-full ${i <= ci ? a.dot : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} /></div>
              })}
            </div>
            <div className="flex justify-between mt-1">
              {SAIDA_PIPELINE_STAGES.map(s => <span key={s.key} className={`text-[7px] ${s.key === saida.status ? (isDark ? 'text-white font-bold' : 'text-slate-700 font-bold') : txtMuted}`}>{s.label}</span>)}
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Fechar</button>

            {saida.status === 'pendente' && (
              <>
                <button onClick={() => onAction('gerar_pdf', saida)} className={`py-3 px-4 rounded-xl border text-sm font-semibold flex items-center gap-1.5 ${isDark ? 'border-white/[0.06] text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}>
                  <FileText size={14} /> PDF Orientações
                </button>
                <button onClick={() => onAction('solicitar_vistoria', saida)} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                  <ClipboardCheck size={15} /> Solicitar Vistoria
                </button>
              </>
            )}

            {saida.status === 'aguardando_vistoria' && (
              <>
                <button onClick={() => onAction('registrar_pendencias', saida)} className={`py-3 px-4 rounded-xl border text-sm font-semibold flex items-center gap-1.5 ${isDark ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-amber-200 text-amber-600 hover:bg-amber-50'}`}>
                  <ShieldAlert size={14} /> Registrar Pendências
                </button>
                <button onClick={() => onAction('pular_pendencias', saida)} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                  <CheckCircle2 size={15} /> OK — Ir p/ Encerramento
                </button>
              </>
            )}

            {saida.status === 'solucionando_pendencias' && (
              <button onClick={() => onAction('pendencias_resolvidas', saida)} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Pendências Resolvidas
              </button>
            )}

            {saida.status === 'encerramento_contratual' && (
              <button onClick={() => onAction('encerrar', saida)} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Encerrar Contrato
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function SaidaCard({ saida, onClick, isDark }: { saida: LocSaida; onClick: () => void; isDark: boolean }) {
  const accent = isDark ? STATUS_ACCENT_DARK[saida.status] : STATUS_ACCENT[saida.status]
  const imo = saida.imovel
  const isUrgent = saida.data_limite_saida && saida.status !== 'encerrado' && new Date(saida.data_limite_saida) <= new Date(Date.now() + 7 * 86400000)
  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{imo?.descricao || imo?.endereco || 'Sem imóvel'}</p>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${accent.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
          {SAIDA_PIPELINE_STAGES.find(s => s.key === saida.status)?.label}
        </span>
      </div>
      <p className={`text-xs flex items-center gap-1 mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><MapPin size={11} /> {[imo?.cidade, imo?.uf].filter(Boolean).join(', ') || '—'}</p>
      {(imo as any)?.centro_custo?.descricao && <p className={`text-xs flex items-center gap-1 mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Landmark size={11} /> {(imo as any).centro_custo.descricao}</p>}
      {saida.data_limite_saida && (
        <p className={`text-xs flex items-center gap-1 mb-1 ${isUrgent ? 'text-amber-600 font-semibold' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Calendar size={11} /> Limite: {fmtDate(saida.data_limite_saida)}
          {isUrgent && <AlertTriangle size={10} className="text-amber-500" />}
        </p>
      )}
      {saida.caucao_valor != null && saida.caucao_valor > 0 && (
        <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><DollarSign size={11} /> Caução: {fmtCur(saida.caucao_valor)}</p>
      )}
    </button>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────────
function SaidaRow({ saida, onClick, isDark }: { saida: LocSaida; onClick: () => void; isDark: boolean }) {
  const accent = isDark ? STATUS_ACCENT_DARK[saida.status] : STATUS_ACCENT[saida.status]
  const imo = saida.imovel
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b transition-all ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dot}`} />
      <span className={`flex-1 text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{imo?.descricao || imo?.endereco || '—'}</span>
      <span className={`w-[100px] text-xs truncate shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{(imo as any)?.centro_custo?.descricao || '—'}</span>
      <span className={`w-[80px] text-xs truncate shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{imo?.cidade || '—'}</span>
      <span className={`w-[80px] text-xs text-right shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDate(saida.data_limite_saida)}</span>
      <span className={`w-[80px] text-xs text-right shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtCur(saida.caucao_valor) || '—'}</span>
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SaidaPipeline() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: saidas = [], isLoading } = useSaidas()
  const atualizarStatus = useAtualizarStatusSaida()

  const [activeTab, setActiveTab] = useState<StatusSaida>(() => (searchParams.get('tab') as StatusSaida) || 'pendente')
  const [detail, setDetail] = useState<LocSaida | null>(null)
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const grouped = useMemo(() => {
    const map = new Map<StatusSaida, LocSaida[]>()
    SAIDA_PIPELINE_STAGES.forEach(s => map.set(s.key, []))
    saidas.forEach(s => map.get(s.status)?.push(s))
    return map
  }, [saidas])

  const switchTab = (status: StatusSaida) => {
    setActiveTab(status); setBusca('')
    setSearchParams(p => { p.set('tab', status); return p }, { replace: true })
  }
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) { const q = busca.toLowerCase(); items = items.filter(s => [s.imovel?.descricao, s.imovel?.endereco, s.imovel?.cidade, s.imovel?.locador_nome].some(v => v?.toLowerCase().includes(q))) }
    items.sort((a, b) => {
      let c = 0
      if (sortField === 'data') c = (a.created_at || '').localeCompare(b.created_at || '')
      else if (sortField === 'imovel') c = (a.imovel?.descricao || '').localeCompare(b.imovel?.descricao || '')
      else c = (a.imovel?.cidade || '').localeCompare(b.imovel?.cidade || '')
      return sortDir === 'asc' ? c : -c
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  const handleAction = useCallback((action: string, s: LocSaida) => {
    setDetail(null)
    const map: Record<string, StatusSaida> = {
      solicitar_vistoria: 'aguardando_vistoria',
      pular_pendencias: 'encerramento_contratual',
      registrar_pendencias: 'solucionando_pendencias',
      pendencias_resolvidas: 'encerramento_contratual',
      encerrar: 'encerrado',
    }
    if (map[action]) atualizarStatus.mutate({ id: s.id, status: map[action] })
    if (action === 'gerar_pdf') alert('PDF de orientações será gerado em breve')
  }, [atualizarStatus])

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`px-4 pt-4 pb-2 ${isDark ? '' : ''}`}>
        <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Devoluções</h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline de devolução de imóveis</p>
      </div>
      {/* Tabs */}
      <div className={`flex gap-1 p-1 pb-2 rounded-t-2xl border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {SAIDA_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.key)?.length || 0
          const isActive = activeTab === stage.key
          const Icon = STATUS_ICONS[stage.key]
          const a = isDark ? STATUS_ACCENT_DARK[stage.key] : STATUS_ACCENT[stage.key]
          return (
            <button key={stage.key} onClick={() => switchTab(stage.key)} className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs whitespace-nowrap transition-all border ${isActive ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm` : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`}`}>
              <Icon size={14} className="shrink-0" /> {stage.label}
              {count > 0 && <span className={`text-[10px] font-bold rounded-full min-w-[20px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar imóvel, cidade, locador..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`} />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
        </div>
        <div className="flex items-center gap-0.5">
          {SORT_OPTIONS.map(opt => { const isA = sortField === opt.field; return (
            <button key={opt.field} onClick={() => toggleSort(opt.field)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${isA ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
              {opt.label} {isA && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
            </button>
          )})}
        </div>
        <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} className={`p-1.5 ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
        </div>
        <span className={`ml-auto text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{activeItems.length} {activeItems.length === 1 ? 'item' : 'itens'}</span>
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {activeItems.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <ArrowRightFromLine size={40} className="mb-3" /><p className="text-sm font-medium">Nenhuma devolução nesta etapa</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-2 p-4">{activeItems.map(s => <SaidaCard key={s.id} saida={s} onClick={() => setDetail(s)} isDark={isDark} />)}</div>
        ) : (
          <div>
            <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <span className="w-2 shrink-0" /><span className="flex-1">Imóvel</span><span className="w-[100px] shrink-0">C. Custo</span><span className="w-[80px] shrink-0">Cidade</span><span className="w-[80px] shrink-0 text-right">Limite</span><span className="w-[80px] shrink-0 text-right">Caução</span>
            </div>
            {activeItems.map(s => <SaidaRow key={s.id} saida={s} onClick={() => setDetail(s)} isDark={isDark} />)}
          </div>
        )}
      </div>

      {detail && <SaidaDetailModal saida={detail} onClose={() => setDetail(null)} onAction={handleAction} isDark={isDark} />}
    </div>
  )
}
