import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2, X, Search, ArrowUp, ArrowDown, LayoutList, LayoutGrid,
  MapPin, Calendar, User, ClipboardCheck, FileText, CheckCircle2, Landmark,
  Download, Share2, Loader2,
} from 'lucide-react'
import { useEntradas, useAtualizarStatusEntrada, useVistorias, useVistoriaFotos } from '../../hooks/useLocacao'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import type { LocEntrada, StatusEntrada } from '../../types/locacao'
import { ENTRADA_PIPELINE_STAGES } from '../../types/locacao'
import VistoriaModal from '../../components/locacao/VistoriaModal'
import { UpperInput } from '../../components/UpperInput'
import { downloadVistoriaPdf, compartilharVistoriaWhatsApp, type VistoriaPdfData } from '../../utils/vistoria-pdf'
import FichaVistoriaModal from '../../components/locacao/FichaVistoriaModal'

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
  const responsavelNome = useResponsavelNome(entrada.responsavel_id)
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
              {entrada.responsavel_id && <div><p className={txtMuted}>Responsável</p><p className={`font-semibold ${txtMain}`}>{responsavelNome ?? 'Atribuído'}</p></div>}
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
            <button onClick={onClose} className={`shrink-0 px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Fechar</button>
            {entrada.status === 'pendente' && (
              <>
                <button onClick={() => onAction('gerar_pdf', entrada)} className={`flex-1 py-3 px-3 rounded-xl border text-[13px] font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap ${isDark ? 'border-white/[0.06] text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}>
                  <FileText size={14} /> Ficha de Vistoria
                </button>
                <button onClick={() => onAction('solicitar_vistoria', entrada)} className="flex-1 py-3 px-3 rounded-xl bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 whitespace-nowrap">
                  <ClipboardCheck size={15} /> Solicitar Vistoria
                </button>
              </>
            )}
            {entrada.status === 'aguardando_vistoria' && (
              <button onClick={() => onOpenVistoria(entrada)} className="flex-1 py-3 px-3 rounded-xl bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 whitespace-nowrap">
                <ClipboardCheck size={15} />
                {itensPreenchidos > 0 ? `Continuar Vistoria (${itensPreenchidos}/64)` : 'Iniciar Vistoria'}
              </button>
            )}
            {entrada.status === 'aguardando_assinatura' && (
              <button onClick={() => onAction('confirmar_assinatura', entrada)} className="flex-1 py-3 px-3 rounded-xl bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 whitespace-nowrap">
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
// ── Modal: assinatura do contrato (etapa "Aguardando Assinatura") ───────────
// É aqui que o contrato de locação nasce quando o imóvel entrou pelo fluxo —
// no modal "Novo Imóvel" ele nem é pedido. A RPC cria o ALG, amarra em imóvel
// e entrada e libera, tudo junto: liberar sem contrato deixaria o imóvel ativo
// fora do módulo Contratos e sem parcela (logo, fora do Provisionado).
/** Nome de quem esta com a entrada — responsavel_id guarda o auth_id. */
function useResponsavelNome(authId?: string | null) {
  const { data } = useQuery({
    queryKey: ['sys_perfil_nome', authId],
    enabled: !!authId,
    queryFn: async () => {
      const { data } = await supabase.from('sys_perfis').select('nome').eq('auth_id', authId!).maybeSingle()
      return (data?.nome as string | undefined) ?? null
    },
  })
  return data ?? null
}

// ── Modal: solicitar vistoria ───────────────────────────────────────────────
// Antes este botão só trocava o status. "Solicitar" sem dizer a quem não
// solicita nada: loc_entradas.responsavel_id é o campo que faz a entrada
// aparecer em "Minhas Tarefas" (useMinhasTarefas casa contra o auth.uid), e ele
// nunca era preenchido. Agora escolhe-se o responsável, o prazo, e ele recebe
// a notificação in-app.
function SolicitarVistoriaModal({ entrada, isDark, onClose, onDone }: {
  entrada: LocEntrada; isDark: boolean; onClose: () => void; onDone: () => void
}) {
  const { perfil } = useAuth()
  const [responsavel, setResponsavel] = useState('')
  const [previsto, setPrevisto] = useState(entrada.data_prevista_inicio ?? '')
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Só quem tem login no TEG+ pode ser responsável — a tarefa é casada pelo auth_id.
  const { data: usuarios = [] } = useQuery({
    queryKey: ['loc-vistoriadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_perfis')
        .select('auth_id, nome, cargo')
        .eq('ativo', true)
        .not('auth_id', 'is', null)
        .order('nome')
      if (error) throw error
      return (data ?? []) as { auth_id: string; nome: string; cargo: string | null }[]
    },
  })

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const labelCls = `block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const inputCls = isDark
    ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500 [&>option]:bg-slate-900'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
  const fieldCls = `w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-indigo-500/25 ${inputCls}`

  // Mesma regra da tela: a vistoria é cobrada 7 dias antes do início previsto.
  const limite = previsto
    ? new Date(new Date(previsto + 'T12:00:00').getTime() - 7 * 86_400_000).toLocaleDateString('pt-BR')
    : null

  async function confirmar() {
    setErro('')
    if (!responsavel) { setErro('Escolha quem vai fazer a vistoria.'); return }
    setEnviando(true)
    try {
      const texto = obs.trim()
      const patch: Record<string, unknown> = {
        responsavel_id: responsavel,
        status: 'aguardando_vistoria',
        atualizado_por_nome: perfil?.nome ?? null,
        updated_at: new Date().toISOString(),
      }
      if (previsto) patch.data_prevista_inicio = previsto
      if (texto) {
        patch.observacoes = `${entrada.observacoes ? entrada.observacoes + '\n\n' : ''}[Solicitação de vistoria] ${texto}`
      }
      const { error } = await supabase.from('loc_entradas').update(patch).eq('id', entrada.id)
      if (error) throw error

      if (entrada.imovel_id) {
        await supabase.from('loc_imoveis').update({ status: 'em_entrada' }).eq('id', entrada.imovel_id)
      }

      // Notificação in-app; se a fila falhar, a atribuição já valeu — não desfaz.
      const local = [entrada.endereco, entrada.numero].filter(Boolean).join(', ')
      await supabase.from('sys_notif_queue').insert({
        user_id: responsavel,
        titulo: 'Vistoria de entrada solicitada',
        corpo: `${local || 'Imóvel'}${entrada.cidade ? ` — ${entrada.cidade}` : ''}`
          + (limite ? ` · vistoriar até ${limite}` : ''),
        url: '/locacoes/entradas',
        origem: 'loc_entrada',
        origem_id: entrada.id,
        dedupe_key: `loc_entrada_vistoria:${entrada.id}`,
      }).then(({ error: e }) => { if (e) console.warn('notificação não enfileirada:', e.message) })

      onDone()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao solicitar a vistoria.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <h3 className={`text-base font-bold ${txtMain}`}>Solicitar vistoria</h3>
            <p className={`text-xs truncate ${txtMuted}`}>{entrada.endereco || entrada.imovel?.descricao || 'Entrada'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className={labelCls}>Quem vai vistoriar *</label>
            <select value={responsavel} onChange={e => setResponsavel(e.target.value)} className={fieldCls}>
              <option value="">Selecionar...</option>
              {usuarios.map(u => (
                <option key={u.auth_id} value={u.auth_id}>
                  {u.nome}{u.cargo ? ` — ${u.cargo}` : ''}
                </option>
              ))}
            </select>
            <p className={`text-[11px] mt-1 ${txtMuted}`}>
              A entrada passa a aparecer em <b>Minhas Tarefas</b> dessa pessoa.
            </p>
          </div>

          <div>
            <label className={labelCls}>Início previsto da locação</label>
            <input type="date" value={previsto} onChange={e => setPrevisto(e.target.value)} className={fieldCls} />
            <p className={`text-[11px] mt-1 ${limite ? txtMuted : (isDark ? 'text-amber-300' : 'text-amber-600')}`}>
              {limite
                ? `Prazo da vistoria: até ${limite} (7 dias antes).`
                : 'Sem esta data o sistema não consegue cobrar prazo da vistoria.'}
            </p>
          </div>

          <div>
            <label className={labelCls}>Recado para quem vai vistoriar</label>
            <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ex.: combinar a chave com o locador antes de ir" className={fieldCls} />
          </div>

          {erro && <p className="text-xs text-rose-500">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Cancelar
            </button>
            <button onClick={confirmar} disabled={enviando || !responsavel}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {enviando && <Loader2 size={14} className="animate-spin" />}
              Solicitar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AssinaturaContratoModal({ entrada, isDark, onClose, onDone }: {
  entrada: LocEntrada; isDark: boolean; onClose: () => void; onDone: () => void
}) {
  const { perfil } = useAuth()
  const isHtl = entrada.imovel?.tipo === 'HTL'
  const [numero, setNumero] = useState('')
  const [inicio, setInicio] = useState(entrada.data_prevista_inicio ?? '')
  // O prazo já foi negociado e anotado na vistoria — aqui é só conferir.
  const [fim, setFim] = useState(entrada.prazo_fim ?? '')
  const [pdf, setPdf] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const labelCls = `block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const inputCls = isDark
    ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
  const fieldCls = `w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-indigo-500/25 ${inputCls}`

  async function confirmar() {
    setErro('')
    if (!isHtl && (!inicio || !fim)) { setErro('Informe o início e o fim do contrato.'); return }
    setEnviando(true)
    try {
      let arquivoUrl: string | null = null
      if (pdf) {
        const path = `contratos/${Date.now()}_${pdf.name.replace(/[^A-Za-z0-9._-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('contratos-anexos').upload(path, pdf)
        if (!upErr) arquivoUrl = path
      }
      const { data, error } = await supabase.rpc('loc_entrada_assinar', {
        p_entrada_id: entrada.id,
        p_contrato_numero: numero || null,
        p_contrato_inicio: isHtl ? null : inicio,
        p_contrato_fim: isHtl ? null : fim,
        p_arquivo_url: arquivoUrl,
        p_usuario: perfil?.nome ?? null,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string }
      if (!r.ok) { setErro(r.erro || 'Não foi possível concluir a assinatura.'); return }
      onDone()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao concluir a assinatura.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <h3 className={`text-base font-bold ${txtMain}`}>Assinatura do contrato</h3>
            <p className={`text-xs truncate ${txtMuted}`}>{entrada.endereco || entrada.imovel?.descricao || 'Entrada'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          {isHtl ? (
            <p className={`text-xs ${txtMuted}`}>
              Hotel é hospedagem temporária: não gera contrato. Confirmar aqui apenas libera o imóvel.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Nº do contrato</label>
                  <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Auto (ALG-…)" className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Início *</label>
                  <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Fim *</label>
                  <input type="date" value={fim} onChange={e => setFim(e.target.value)} className={fieldCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Contrato assinado (PDF)</label>
                <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm ${inputCls}`}>
                  <FileText size={14} className="shrink-0 opacity-60" />
                  <span className={pdf ? '' : 'opacity-50'}>{pdf ? pdf.name : 'Anexar contrato...'}</span>
                  <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setPdf(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <p className={`text-[11px] leading-snug ${txtMuted}`}>
                Ao confirmar, o contrato entra no módulo Contratos e o imóvel passa a ativo.
              </p>
            </>
          )}

          {erro && <p className="text-xs text-rose-500">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Cancelar
            </button>
            <button onClick={confirmar} disabled={enviando}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {enviando && <Loader2 size={14} className="animate-spin" />}
              {isHtl ? 'Liberar imóvel' : 'Confirmar e liberar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EntradasPipeline() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: entradas = [], isLoading } = useEntradas()
  const atualizarStatus = useAtualizarStatusEntrada()

  const [activeTab, setActiveTab] = useState<StatusEntrada>(() => (searchParams.get('tab') as StatusEntrada) || 'pendente')
  const [detail, setDetail] = useState<LocEntrada | null>(null)
  const [vistoriaEntrada, setVistoriaEntrada] = useState<LocEntrada | null>(null)
  // A assinatura nao e so trocar o status: e onde o contrato passa a existir.
  const [assinar, setAssinar] = useState<LocEntrada | null>(null)
  // Solicitar vistoria virou atribuicao: precisa dizer a quem.
  const [solicitar, setSolicitar] = useState<LocEntrada | null>(null)
  const [ficha, setFicha] = useState<LocEntrada | null>(null)
  const qc = useQueryClient()
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
    if (action === 'confirmar_assinatura') { setAssinar(e); return }
    if (action === 'solicitar_vistoria') { setSolicitar(e); return }
    const map: Record<string, StatusEntrada> = { vistoria_concluida: 'aguardando_assinatura' }
    if (map[action]) atualizarStatus.mutate({ id: e.id, status: map[action] })
    if (action === 'gerar_pdf') setFicha(e)
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
          <UpperInput type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar endereço, locador, cidade..."
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
      {ficha && (
        <FichaVistoriaModal
          dados={{ entrada: ficha, imovel: ficha.imovel, tipo: 'entrada' }}
          onClose={() => setFicha(null)}
        />
      )}
      {solicitar && (
        <SolicitarVistoriaModal
          entrada={solicitar} isDark={isDark}
          onClose={() => setSolicitar(null)}
          onDone={() => {
            setSolicitar(null)
            ;['loc_entradas', 'loc_imoveis', 'minhas-tarefas'].forEach(k =>
              qc.invalidateQueries({ queryKey: [k] }))
          }}
        />
      )}
      {assinar && (
        <AssinaturaContratoModal
          entrada={assinar} isDark={isDark}
          onClose={() => setAssinar(null)}
          onDone={() => {
            setAssinar(null)
            ;['loc_entradas', 'loc_imoveis', 'loc_alojamentos', 'con_contratos'].forEach(k =>
              qc.invalidateQueries({ queryKey: [k] }))
          }}
        />
      )}
    </div>
  )
}
