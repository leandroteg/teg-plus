import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Wrench, Search, List, LayoutGrid, ExternalLink, Plus, X, Loader2,
  CheckCircle2, PlayCircle, Ban, Image as ImageIcon, MapPin, User, Clock,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'
import { useSolicitacoesLocacao, useAtualizarSolicitacaoLocacao } from '../../hooks/useLocacao'
import {
  STATUS_SOLICITACAO_LABEL,
  TIPO_SOLICITACAO_LABEL,
  URGENCIA_LABEL,
} from '../../types/locacao'
import type { StatusSolicitacao, LocSolicitacao } from '../../types/locacao'
import NovaSolicitacaoModal from '../../components/locacao/NovaSolicitacaoModal'

// ── Urgência config ───────────────────────────────────────────────────────────
const URGENCIA_CFG: Record<string, { bg: string; text: string }> = {
  baixa:   { bg: 'bg-slate-100',  text: 'text-slate-600' },
  normal:  { bg: 'bg-blue-50',    text: 'text-blue-700' },
  alta:    { bg: 'bg-amber-50',   text: 'text-amber-700' },
  urgente: { bg: 'bg-red-50',     text: 'text-red-700' },
}

function UrgenciaBadge({ urgencia }: { urgencia: string }) {
  const cfg = URGENCIA_CFG[urgencia] ?? { bg: 'bg-slate-100', text: 'text-slate-600' }
  return (
    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {URGENCIA_LABEL[urgencia as keyof typeof URGENCIA_LABEL] ?? urgencia}
    </span>
  )
}

function StatusBadge({ status }: { status: StatusSolicitacao }) {
  const cfg = STATUS_SOLICITACAO_LABEL[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const STATUS_OPTS: { value: StatusSolicitacao | ''; label: string }[] = [
  { value: '',            label: 'Todos' },
  { value: 'aberta',      label: 'Aberta' },
  { value: 'em_andamento',label: 'Em Andamento' },
  { value: 'concluida',   label: 'Concluída' },
  { value: 'cancelada',   label: 'Cancelada' },
]

const dataHora = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Detail Modal ──────────────────────────────────────────────────────────────
// A solicitação só tinha lista até aqui; sem este modal não havia como encerrar
// um chamado — que é justamente o "Fechar OS" que vem do Portal.
function SolicitacaoModal({ sol, onClose, isDark }: {
  sol: LocSolicitacao; onClose: () => void; isDark: boolean
}) {
  const atualizar = useAtualizarSolicitacaoLocacao()
  const [anexo, setAnexo] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<StatusSolicitacao | null>(null)

  // Portal grava URL pública; o ERP grava caminho no bucket privado.
  useEffect(() => {
    let vivo = true
    const raw = sol.anexo_url
    if (!raw) { setAnexo(null); return }
    if (/^https?:\/\//i.test(raw)) { setAnexo(raw); return }
    supabase.storage.from('locacao-faturas').createSignedUrl(raw, 3600).then(({ data }) => {
      if (vivo) setAnexo(data?.signedUrl ?? null)
    })
    return () => { vivo = false }
  }, [sol.anexo_url])

  const mudar = async (status: StatusSolicitacao) => {
    setSalvando(status)
    try { await atualizar.mutateAsync({ id: sol.id, status }); onClose() }
    finally { setSalvando(null) }
  }

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const border = isDark ? 'border-white/[0.08]' : 'border-slate-200'
  const encerrada = sol.status === 'concluida' || sol.status === 'cancelada'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0 ${border}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <UrgenciaBadge urgencia={sol.urgencia} />
              <StatusBadge status={sol.status} />
              <span className={`text-[10px] font-semibold ${txtMuted}`}>{TIPO_SOLICITACAO_LABEL[sol.tipo]}</span>
            </div>
            <p className={`text-base font-extrabold leading-tight ${txt}`}>{sol.titulo}</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Imóvel</p>
              <p className={`text-sm font-semibold flex items-center gap-1.5 ${txt}`}>
                <MapPin size={13} className={txtMuted} /> {sol.imovel?.descricao ?? '—'}
              </p>
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Aberta em</p>
              <p className={`text-sm font-semibold flex items-center gap-1.5 ${txt}`}>
                <Clock size={13} className={txtMuted} /> {dataHora(sol.created_at)}
              </p>
            </div>
            {sol.criado_por_nome && (
              <div className="col-span-2">
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Solicitante</p>
                <p className={`text-sm font-semibold flex items-center gap-1.5 ${txt}`}>
                  <User size={13} className={txtMuted} /> {sol.criado_por_nome}
                </p>
              </div>
            )}
          </div>

          {sol.descricao && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Descrição</p>
              <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sol.descricao}</p>
            </div>
          )}

          {sol.anexo_url && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${txtMuted}`}>Anexo</p>
              {anexo ? (
                <a href={anexo} target="_blank" rel="noopener noreferrer" className="inline-block">
                  <img src={anexo} alt={sol.anexo_nome ?? 'Anexo'}
                    className={`max-h-56 rounded-xl border object-contain ${border}`}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                </a>
              ) : (
                <p className={`text-xs flex items-center gap-1.5 ${txtMuted}`}>
                  <ImageIcon size={13} /> {sol.anexo_nome ?? 'carregando anexo…'}
                </p>
              )}
            </div>
          )}

          {sol.cmp_requisicao_id && (
            <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isDark ? 'border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'
            }`}>
              <ExternalLink size={12} /> Ver no Compras
            </button>
          )}
        </div>

        {/* Ações */}
        <div className={`px-5 py-4 border-t shrink-0 ${border}`}>
          {encerrada ? (
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs ${txtMuted}`}>Solicitação encerrada.</p>
              <button onClick={() => mudar('em_andamento')} disabled={!!salvando}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Reabrir
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {sol.status === 'aberta' && (
                <button onClick={() => mudar('em_andamento')} disabled={!!salvando}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-50">
                  {salvando === 'em_andamento' ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                  Iniciar
                </button>
              )}
              <button onClick={() => mudar('concluida')} disabled={!!salvando}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">
                {salvando === 'concluida' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Concluir
              </button>
              <button onClick={() => mudar('cancelada')} disabled={!!salvando}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${isDark ? 'border-white/10 text-slate-400 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'} disabled:opacity-50`}>
                {salvando === 'cancelada' ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({ sol, isDark, onClick }: { sol: LocSolicitacao; isDark: boolean; onClick: () => void }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <tr onClick={onClick} className={`border-b transition-colors cursor-pointer
      ${isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <td className={`px-4 py-3 text-sm font-medium ${txt}`}>
        <span className="block truncate max-w-[160px]">{sol.imovel?.descricao ?? '—'}</span>
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>{TIPO_SOLICITACAO_LABEL[sol.tipo]}</td>
      <td className={`px-4 py-3 text-sm font-medium ${txt}`}>
        <span className="block truncate max-w-[200px]">{sol.titulo}</span>
      </td>
      <td className="px-4 py-3">
        <UrgenciaBadge urgencia={sol.urgencia} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={sol.status} />
      </td>
    </tr>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function SolicitacaoCard({ sol, isDark, onClick }: { sol: LocSolicitacao; isDark: boolean; onClick: () => void }) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div onClick={onClick} className={`rounded-xl border p-4 transition-all cursor-pointer
      ${isDark
        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}>
      {/* Linha 1 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`text-sm font-bold flex-1 min-w-0 truncate ${txt}`}>{sol.titulo}</p>
        <div className="flex items-center gap-1 shrink-0">
          <UrgenciaBadge urgencia={sol.urgencia} />
          <StatusBadge status={sol.status} />
        </div>
      </div>
      {/* Linha 2 */}
      <div className={`flex items-center gap-2 text-xs mb-2 ${txtMuted}`}>
        <span>{sol.imovel?.descricao ?? '—'}</span>
        <span>·</span>
        <span>{TIPO_SOLICITACAO_LABEL[sol.tipo]}</span>
      </div>
      {/* Ações */}
      {sol.cmp_requisicao_id && (
        <div className="mt-2">
          <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
            ${isDark
              ? 'border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10'
              : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'}`}>
            <ExternalLink size={12} /> Ver no Compras
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ManutencoesServicos() {
  const { isDark } = useTheme()
  const { data: solicitacoes = [], isLoading } = useSolicitacoesLocacao()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusSolicitacao | ''>('')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [showModal, setShowModal] = useState(false)
  const [detail, setDetail] = useState<LocSolicitacao | null>(null)

  // Deep link do Portal ("Fechar OS"): ?imovel=<id> recorta neste imóvel e, se
  // houver só uma solicitação em aberto, já abre o modal dela.
  const [searchParams] = useSearchParams()
  const imovelLink = searchParams.get('imovel')
  const [abriuLink, setAbriuLink] = useState(false)
  useEffect(() => {
    if (!imovelLink || abriuLink || !solicitacoes.length) return
    const abertas = solicitacoes.filter(s =>
      s.imovel_id === imovelLink && (s.status === 'aberta' || s.status === 'em_andamento'))
    setAbriuLink(true)
    if (abertas.length === 1) setDetail(abertas[0])
  }, [imovelLink, solicitacoes, abriuLink])

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const filtered = solicitacoes.filter(sol => {
    if (imovelLink && sol.imovel_id !== imovelLink) return false
    if (statusFilter && sol.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        sol.titulo.toLowerCase().includes(q) ||
        sol.imovel?.descricao?.toLowerCase().includes(q) ||
        sol.descricao?.toLowerCase().includes(q)
      )
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header com botão Nova Solicitação */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${txtMuted}`}>
          {filtered.length} de {solicitacoes.length} solicitações
          {imovelLink && filtered[0]?.imovel?.descricao ? ` · ${filtered[0].imovel.descricao}` : ''}
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> Nova Solicitação
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[180px]
          ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input
            type="text"
            placeholder="Buscar solicitação..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none
              ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>
        {/* Filtro status */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : isDark
                  ? 'border-white/10 text-slate-400 hover:border-white/20'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Toggle view */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('table')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'table'
              ? isDark ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <List size={16} />
          </button>
          <button
            onClick={() => setView('card')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'card'
              ? isDark ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Wrench size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhuma solicitação encontrada</p>
        </div>
      ) : view === 'table' ? (
        /* Table View */
        <div className={`rounded-xl border overflow-hidden
          ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {['Imóvel', 'Tipo', 'Título', 'Urgência', 'Status'].map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(sol => (
                  <TableRow key={sol.id} sol={sol} isDark={isDark} onClick={() => setDetail(sol)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="space-y-2">
          {filtered.map(sol => (
            <SolicitacaoCard key={sol.id} sol={sol} isDark={isDark} onClick={() => setDetail(sol)} />
          ))}
        </div>
      )}

      {showModal && <NovaSolicitacaoModal onClose={() => setShowModal(false)} />}
      {detail && <SolicitacaoModal sol={detail} isDark={isDark} onClose={() => setDetail(null)} />}
    </div>
  )
}
