import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2, X, Search, ArrowUp, ArrowDown, LayoutList, LayoutGrid,
  MapPin, Calendar, User, ClipboardCheck, FileText, CheckCircle2, Landmark,
  Download, Share2, Loader2,
} from 'lucide-react'
import { useEntradas, useAtualizarStatusEntrada, useVistorias, useVistoriaFotos } from '../../hooks/useLocacao'
import { useTheme } from '../../contexts/ThemeContext'
import type { LocEntrada, StatusEntrada } from '../../types/locacao'
import { ENTRADA_PIPELINE_STAGES } from '../../types/locacao'
import VistoriaModal from '../../components/locacao/VistoriaModal'
import { downloadVistoriaPdf, compartilharVistoriaWhatsApp, type VistoriaPdfData } from '../../utils/vistoria-pdf'

// ── Accent maps ──────────────────────────────────────────────────────────────
type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }
const STATUS_ACCENT: Record<StatusEntrada, AccentSet> = {
  pendente:              { bg:'bg-slate-50',   bgActive:'bg-slate-100',  text:'text-slate-500',  textActive:'text-slate-800',  dot:'bg-slate-400', badge:'bg-slate-200/80 text-slate-600', border:'border-slate-200' },
  aguardando_vistoria:   { bg:'bg-blue-50',    bgActive:'bg-blue-100',   text:'text-blue-500',   textActive:'text-blue-800',   dot:'bg-blue-500',  badge:'bg-blue-200/80 text-blue-700',   border:'border-blue-200' },
  aguardando_assinatura: { bg:'bg-violet-50',  bgActive:'bg-violet-100', text:'text-violet-500', textActive:'text-violet-800', dot:'bg-violet-500',badge:'bg-violet-200/80 text-violet-700',border:'border-violet-200' },
  liberado:              { bg:'bg-emerald-50', bgActive:'bg-emerald-100',text:'text-emerald-500',textActive:'text-emerald-800',dot:'bg-emerald-500',badge:'bg-emerald-200/80 text-emerald-700',border:'border-emerald-200' },
}
const STATUS_ACCENT_DARK: Record<StatusEntrada, AccentSet> = {
  pendente:              { bg:'bg-white/[0.02]', bgActive:'bg-white/[0.06]', text:'text-slate-500',   textActive:'text-slate-200',   dot:'bg-slate-500', badge:'bg-white/[0.06] text-slate-400', border:'border-white/[0.08]' },
  aguardando_vistoria:   { bg:'bg-blue-500/5',   bgActive:'bg-blue-500/15',  text:'text-blue-400',    textActive:'text-blue-200',    dot:'bg-blue-400',  badge:'bg-blue-500/15 text-blue-300',   border:'border-blue-500/20' },
  aguardando_assinatura: { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',text:'text-violet-400',  textActive:'text-violet-200',  dot:'bg-violet-400',badge:'bg-violet-500/15 text-violet-300',border:'border-violet-500/20' },
  liberado:              { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15',text:'text-emerald-400',textActive:'text-emerald-200',dot:'bg-emerald-400',badge:'bg-emerald-500/15 text-emerald-300',border:'border-emerald-500/20' },
}

const STATUS_ICONS: Record<StatusEntrada, typeof Building2> = {
  pendente: ClipboardCheck, aguardando_vistoria: Search, aguardando_assinatura: FileText, liberado: CheckCircle2,
}

type SortField = 'data' | 'imovel' | 'cidade'
type SortDir = 'asc' | 'desc'
type ViewMode = 'cards' | 'list'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data', label: 'Data' }, { field: 'imovel', label: 'Imóvel' }, { field: 'cidade', label: 'Cidade' },
]

const fmtDate = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

// ── Detail Modal ─────────────────────────────────────────────────────────────
function EntradaDetailModal({ entrada, onClose, onAction, isDark, onOpenVistoria }: {
  entrada: LocEntrada; onClose: () => void
  onAction: (action: string, e: LocEntrada) => void; isDark: boolean
  onOpenVistoria: (e: LocEntrada) => void
}) {
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const cardBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-400'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const accent = isDark ? STATUS_ACCENT_DARK[entrada.status] : STATUS_ACCENT[entrada.status]
  const stage = ENTRADA_PIPELINE_STAGES.find(s => s.key === entrada.status)

  // Data limite vistoria = data_prevista_inicio - 7 dias
  const dataLimiteVistoria = entrada.data_prevista_inicio
    ? new Date(new Date(entrada.data_prevista_inicio + 'T12:00:00').getTime() - 7 * 24 * 60 * 60 * 1000)
    : null
  const diasParaLimite = dataLimiteVistoria ? Math.ceil((dataLimiteVistoria.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null

  // Vistoria info
  const { data: vistorias = [] } = useVistorias({ imovel_id: entrada.imovel_id })
  const vistoria = vistorias.find(v => v.entrada_id === entrada.id && v.tipo === 'entrada')
  const itensPreenchidos = vistoria?.itens?.filter(it => it.estado_entrada).length || 0
  const { data: vistoriaFotos = [] } = useVistoriaFotos(vistoria?.id)
  const [geratingPdf, setGeratingPdf] = useState(false)

  const vistoriaPdfData: VistoriaPdfData | null = vistoria ? {
    vistoria,
    entrada,
    imovel: vistoria.imovel || entrada.imovel,
    itens: vistoria.itens || [],
    fotos: vistoriaFotos,
  } : null

  const handleDownloadPdf = async () => {
    if (!vistoriaPdfData) return
    setGeratingPdf(true)
    try { await downloadVistoriaPdf(vistoriaPdfData) } finally { setGeratingPdf(false) }
  }

  const handleSharePdf = async () => {
    if (!vistoriaPdfData) return
    setGeratingPdf(true)
    try { await compartilharVistoriaWhatsApp(vistoriaPdfData) } finally { setGeratingPdf(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={18} className="text-indigo-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${txtMain}`}>{entrada.endereco || entrada.imovel?.descricao || 'Entrada'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${accent.bgActive} ${accent.textActive}`}>
              <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
              {stage?.label ?? entrada.status}
            </span>
          </div>

          {/* Seção IMÓVEL */}
          <div className={`rounded-xl p-4 ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-200'}`}>
            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Imóvel</p>
            <div className="space-y-1">
              {entrada.endereco && <p className={`text-sm font-bold ${txtMain}`}>{entrada.endereco}{entrada.numero ? `, ${entrada.numero}` : ''}</p>}
              {entrada.complemento && <p className={`text-xs ${txtMuted}`}>{entrada.complemento}</p>}
              {entrada.bairro && <p className={`text-xs ${txtMuted}`}>{entrada.bairro}</p>}
              <p className={`text-xs ${txtMuted}`}>{[entrada.cidade, entrada.uf].filter(Boolean).join(' — ')}{entrada.cep ? ` · CEP ${entrada.cep}` : ''}</p>
              {entrada.area_m2 != null && <p className={`text-xs ${txtMuted}`}>{entrada.area_m2} m²</p>}
            </div>
          </div>

          {/* Seção DADOS GERAIS */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Dados Gerais</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {entrada.locador_nome && <div><p className={txtMuted}>Locador</p><p className={`font-semibold ${txtMain}`}>{entrada.locador_nome}</p></div>}
              {entrada.locador_contato && <div><p className={txtMuted}>Contato</p><p className={`font-semibold ${txtMain}`}>{entrada.locador_contato}</p></div>}
              {entrada.valor_aluguel != null && <div><p className={txtMuted}>Valor Aluguel</p><p className={`font-semibold ${txtMain}`}>{entrada.valor_aluguel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>}
              {entrada.data_prevista_inicio && <div><p className={txtMuted}>Início Previsto</p><p className={`font-semibold ${txtMain}`}>{fmtDate(entrada.data_prevista_inicio)}</p></div>}
              {entrada.dia_vencimento != null && <div><p className={txtMuted}>Dia Vencimento</p><p className={`font-semibold ${txtMain}`}>Dia {entrada.dia_vencimento}</p></div>}
              {(entrada as any).centro_custo?.descricao && <div><p className={txtMuted}>Centro de Custo</p><p className={`font-semibold ${txtMain}`}>{(entrada as any).centro_custo.codigo} — {(entrada as any).centro_custo.descricao}</p></div>}
              {entrada.responsavel_id && <div><p className={txtMuted}>Responsável</p><p className={`font-semibold ${txtMain}`}>Atribuído</p></div>}
            </div>
          </div>

          {/* Observações */}
          {entrada.observacoes && (
            <div className={`rounded-xl p-4 ${cardBg}`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Observações</p>
              <p className={`text-xs whitespace-pre-wrap ${txtMain}`}>{entrada.observacoes}</p>
            </div>
          )}

          {/* Progresso */}
          <div className={`rounded-xl p-3 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {ENTRADA_PIPELINE_STAGES.map((s, i) => {
                const ci = ENTRADA_PIPELINE_STAGES.findIndex(st => st.key === entrada.status)
                const a = isDark ? STATUS_ACCENT_DARK[s.key] : STATUS_ACCENT[s.key]
                return <div key={s.key} className="flex-1"><div className={`h-1.5 rounded-full ${i <= ci ? a.dot : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} /></div>
              })}
            </div>
            <div className="flex justify-between mt-1">
              {ENTRADA_PIPELINE_STAGES.map(s => <span key={s.key} className={`text-[8px] ${s.key === entrada.status ? (isDark ? 'text-white font-bold' : 'text-slate-700 font-bold') : txtMuted}`}>{s.label}</span>)}
            </div>
          </div>

          {/* Data limite vistoria (pendente) */}
          {entrada.status === 'pendente' && dataLimiteVistoria && (
            <div className={`rounded-xl p-3 border flex items-center gap-3 ${
              diasParaLimite != null && diasParaLimite <= 3
                ? isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                : diasParaLimite != null && diasParaLimite <= 7
                ? isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                : isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-100'
            }`}>
              <Calendar size={16} className={
                diasParaLimite != null && diasParaLimite <= 3 ? 'text-red-500'
                : diasParaLimite != null && diasParaLimite <= 7 ? 'text-amber-500'
                : txtMuted
              } />
              <div>
                <p className={`text-xs font-semibold ${txtMain}`}>Data limite para vistoria</p>
                <p className={`text-xs ${
                  diasParaLimite != null && diasParaLimite <= 3 ? 'text-red-500 font-bold'
                  : diasParaLimite != null && diasParaLimite <= 7 ? 'text-amber-600 font-semibold'
                  : txtMuted
                }`}>
                  {fmtDate(dataLimiteVistoria.toISOString().split('T')[0])}
                  {diasParaLimite != null && ` (${diasParaLimite <= 0 ? 'ATRASADO' : `${diasParaLimite}d restantes`})`}
                </p>
              </div>
            </div>
          )}

          {/* PDF da vistoria — gerado dinamicamente */}
          {vistoria && vistoria.status === 'concluida' && (
            <div className={`rounded-xl p-3 border space-y-2 ${
              isDark ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/50'
            }`}>
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Laudo de Vistoria</p>
              <div className="flex gap-2">
                <button onClick={handleDownloadPdf} disabled={geratingPdf}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-colors ${
                    isDark ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  } ${geratingPdf ? 'opacity-50' : ''}`}>
                  {geratingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Baixar PDF
                </button>
                <button onClick={handleSharePdf} disabled={geratingPdf}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-colors ${
                    isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  } ${geratingPdf ? 'opacity-50' : ''}`}>
                  <Share2 size={14} />
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Fechar</button>
            {entrada.status === 'pendente' && (
              <>
                <button onClick={() => onAction('gerar_pdf', entrada)} className={`py-3 px-4 rounded-xl border text-sm font-semibold flex items-center gap-1.5 ${isDark ? 'border-white/[0.06] text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}>
                  <FileText size={14} /> PDF Orientações
                </button>
                <button onClick={() => onAction('solicitar_vistoria', entrada)} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                  <ClipboardCheck size={15} /> Solicitar Vistoria
                </button>
              </>
            )}
            {entrada.status === 'aguardando_vistoria' && (
              <button onClick={() => onOpenVistoria(entrada)} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                <ClipboardCheck size={15} />
                {itensPreenchidos > 0 ? `Continuar Vistoria (${itensPreenchidos}/64)` : 'Iniciar Vistoria'}
              </button>
            )}
            {entrada.status === 'aguardando_assinatura' && (
              <button onClick={() => onAction('confirmar_assinatura', entrada)} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Confirmar Assinatura
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function EntradaCard({ entrada, onClick, isDark }: { entrada: LocEntrada; onClick: () => void; isDark: boolean }) {
  const accent = isDark ? STATUS_ACCENT_DARK[entrada.status] : STATUS_ACCENT[entrada.status]
  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{entrada.endereco || entrada.imovel?.descricao || 'Sem endereço'}</p>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${accent.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
          {ENTRADA_PIPELINE_STAGES.find(s => s.key === entrada.status)?.label}
        </span>
      </div>
      {entrada.locador_nome && <p className={`text-xs flex items-center gap-1 mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><User size={11} /> {entrada.locador_nome}</p>}
      <p className={`text-xs flex items-center gap-1 mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><MapPin size={11} /> {[entrada.cidade, entrada.uf].filter(Boolean).join(', ') || '—'}</p>
      {(entrada as any).centro_custo?.descricao && <p className={`text-xs flex items-center gap-1 mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Landmark size={11} /> {(entrada as any).centro_custo.descricao}</p>}
      {entrada.data_prevista_inicio && <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Calendar size={11} /> {fmtDate(entrada.data_prevista_inicio)}</p>}
    </button>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────────
function EntradaRow({ entrada, onClick, isDark }: { entrada: LocEntrada; onClick: () => void; isDark: boolean }) {
  const accent = isDark ? STATUS_ACCENT_DARK[entrada.status] : STATUS_ACCENT[entrada.status]
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b transition-all ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dot}`} />
      <span className={`flex-1 text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{entrada.endereco || entrada.imovel?.descricao || '—'}</span>
      <span className={`w-[100px] text-xs truncate shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{(entrada as any).centro_custo?.descricao || '—'}</span>
      <span className={`w-[100px] text-xs truncate shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{entrada.locador_nome || '—'}</span>
      <span className={`w-[80px] text-xs truncate shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{entrada.cidade || '—'}</span>
      <span className={`w-[70px] text-xs text-right shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDate(entrada.data_prevista_inicio)}</span>
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EntradasPipeline() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: entradas = [], isLoading } = useEntradas()
  const atualizarStatus = useAtualizarStatusEntrada()

  const [activeTab, setActiveTab] = useState<StatusEntrada>(() => (searchParams.get('tab') as StatusEntrada) || 'pendente')
  const [detail, setDetail] = useState<LocEntrada | null>(null)
  const [vistoriaEntrada, setVistoriaEntrada] = useState<LocEntrada | null>(null)
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const grouped = useMemo(() => {
    const map = new Map<StatusEntrada, LocEntrada[]>()
    ENTRADA_PIPELINE_STAGES.forEach(s => map.set(s.key, []))
    entradas.forEach(e => map.get(e.status)?.push(e))
    return map
  }, [entradas])

  const switchTab = (status: StatusEntrada) => {
    setActiveTab(status); setBusca('')
    setSearchParams(p => { p.set('tab', status); return p }, { replace: true })
  }
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) { const q = busca.toLowerCase(); items = items.filter(e => [e.endereco, e.locador_nome, e.cidade, e.imovel?.descricao].some(v => v?.toLowerCase().includes(q))) }
    items.sort((a, b) => {
      let c = 0
      if (sortField === 'data') c = (a.created_at || '').localeCompare(b.created_at || '')
      else if (sortField === 'imovel') c = (a.endereco || '').localeCompare(b.endereco || '')
      else c = (a.cidade || '').localeCompare(b.cidade || '')
      return sortDir === 'asc' ? c : -c
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  const handleAction = useCallback((action: string, e: LocEntrada) => {
    setDetail(null)
    const map: Record<string, StatusEntrada> = { solicitar_vistoria: 'aguardando_vistoria', vistoria_concluida: 'aguardando_assinatura', confirmar_assinatura: 'liberado' }
    if (map[action]) atualizarStatus.mutate({ id: e.id, status: map[action] })
    if (action === 'gerar_pdf') alert('PDF de orientações será gerado em breve')
  }, [atualizarStatus])

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`px-4 pt-4 pb-2 ${isDark ? '' : ''}`}>
        <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Entradas</h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline de entrada de imóveis</p>
      </div>
      {/* Tabs */}
      <div className={`flex gap-1 p-1 pb-2 rounded-t-2xl border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {ENTRADA_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.key)?.length || 0
          const isActive = activeTab === stage.key
          const Icon = STATUS_ICONS[stage.key]
          const a = isDark ? STATUS_ACCENT_DARK[stage.key] : STATUS_ACCENT[stage.key]
          return (
            <button key={stage.key} onClick={() => switchTab(stage.key)} className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${isActive ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm` : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`}`}>
              <Icon size={15} className="shrink-0" /> {stage.label}
              {count > 0 && <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar endereço, locador, cidade..."
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
            <Building2 size={40} className="mb-3" /><p className="text-sm font-medium">Nenhuma entrada nesta etapa</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-2 p-4">{activeItems.map(e => <EntradaCard key={e.id} entrada={e} onClick={() => setDetail(e)} isDark={isDark} />)}</div>
        ) : (
          <div>
            <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <span className="w-2 shrink-0" /><span className="flex-1">Endereço</span><span className="w-[100px] shrink-0">C. Custo</span><span className="w-[100px] shrink-0">Locador</span><span className="w-[80px] shrink-0">Cidade</span><span className="w-[70px] shrink-0 text-right">Data</span>
            </div>
            {activeItems.map(e => <EntradaRow key={e.id} entrada={e} onClick={() => setDetail(e)} isDark={isDark} />)}
          </div>
        )}
      </div>

      {detail && <EntradaDetailModal entrada={detail} onClose={() => setDetail(null)} onAction={handleAction} isDark={isDark}
        onOpenVistoria={(e) => { setDetail(null); setVistoriaEntrada(e) }} />}
      {vistoriaEntrada && <VistoriaModal entrada={vistoriaEntrada} onClose={() => setVistoriaEntrada(null)} />}
    </div>
  )
}
