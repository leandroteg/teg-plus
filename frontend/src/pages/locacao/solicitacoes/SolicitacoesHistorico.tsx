// ─────────────────────────────────────────────────────────────────────────────
// SolicitacoesHistorico — acervo das solicitações encerradas (liberadas,
// rejeitadas, canceladas), agrupável por alojamento. Reusa o mesmo cartão/linha
// do pipeline para a solicitação não ter duas caras no sistema.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, X, LayoutList, LayoutGrid, CheckCircle2, XCircle, Ban, Building2,
} from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useSolicitacoesLocacao } from '../../../hooks/useLocacao'
import SolicitacaoModal from './SolicitacaoModal'
import { SolicitacaoCard, SolicitacaoRow, BRL, imovelLabel } from './SolicitacaoCards'
import type { LocSolicitacao } from '../../../types/locacao'

type ViewMode = 'list' | 'cards'

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  concluida: { label: 'Liberadas',  cls: 'text-emerald-500', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitadas', cls: 'text-red-500',     icon: XCircle },
  cancelada: { label: 'Canceladas', cls: 'text-slate-400',   icon: Ban },
}

export default function SolicitacoesHistorico() {
  const { isDark } = useTheme()
  const { data: todas = [], isLoading } = useSolicitacoesLocacao()

  const [searchParams] = useSearchParams()
  const imovelLink = searchParams.get('imovel')

  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string>('')
  const [imovelFiltro, setImovelFiltro] = useState(imovelLink ?? '')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [agrupar, setAgrupar] = useState(true)
  const [detail, setDetail] = useState<LocSolicitacao | null>(null)

  const encerradas = useMemo(
    () => todas.filter(s => ['concluida', 'rejeitada', 'cancelada'].includes(s.status)),
    [todas],
  )

  // Alojamentos que aparecem no histórico — a lista do filtro sai daqui.
  const imoveis = useMemo(() => {
    const m = new Map<string, string>()
    encerradas.forEach(s => { if (s.imovel_id) m.set(s.imovel_id, imovelLabel(s)) })
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [encerradas])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return encerradas.filter(s => {
      if (imovelFiltro && s.imovel_id !== imovelFiltro) return false
      if (statusFiltro && s.status !== statusFiltro) return false
      if (q) {
        const alvo = [s.titulo, s.descricao, imovelLabel(s), s.imovel?.cidade, s.criado_por_nome]
          .filter(Boolean).join(' ').toLowerCase()
        if (!alvo.includes(q)) return false
      }
      return true
    })
  }, [encerradas, busca, statusFiltro, imovelFiltro])

  // Histórico POR ALOJAMENTO: o agrupamento é o padrão da tela.
  const porImovel = useMemo(() => {
    const m = new Map<string, { nome: string; itens: LocSolicitacao[] }>()
    filtradas.forEach(s => {
      const k = s.imovel_id ?? 'sem'
      const g = m.get(k) ?? { nome: imovelLabel(s), itens: [] }
      g.itens.push(s)
      m.set(k, g)
    })
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [filtradas])

  const gasto = filtradas
    .filter(s => s.status === 'concluida')
    .reduce((t, s) => t + (s.valor_final ?? s.valor_estimado ?? 0), 0)

  const temFiltro = !!(busca.trim() || statusFiltro || imovelFiltro)
  const inp = `px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200 text-slate-700'
  }`
  const card = isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200 shadow-sm'
  const txtMuted = isDark ? 'text-slate-500' : 'text-slate-400'

  const lista = (itens: LocSolicitacao[]) =>
    viewMode === 'cards'
      ? <div className="space-y-2 p-3">
          {itens.map(s => <SolicitacaoCard key={s.id} sol={s} isDark={isDark} onClick={() => setDetail(s)} />)}
        </div>
      : <div>{itens.map(s => <SolicitacaoRow key={s.id} sol={s} isDark={isDark} onClick={() => setDetail(s)} />)}</div>

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${txtMuted}`} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Imóvel, problema, solicitante..." className={`${inp} pl-8 w-[230px]`} />
        </div>

        <select value={imovelFiltro} onChange={e => setImovelFiltro(e.target.value)} className={`${inp} w-[210px] truncate`}>
          <option value="">Todos os alojamentos</option>
          {imoveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>

        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} className={`${inp} w-[140px] truncate`}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CFG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>

        <label className={`flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer ${txtMuted}`}>
          <input type="checkbox" checked={agrupar} className="accent-indigo-500"
            onChange={e => setAgrupar(e.target.checked)} />
          Agrupar por alojamento
        </label>

        {temFiltro && (
          <button onClick={() => { setBusca(''); setStatusFiltro(''); setImovelFiltro('') }}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold ${
              isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'
            }`}>
            <X size={12} /> Limpar
          </button>
        )}

        <div className={`flex items-center rounded-lg border overflow-hidden ml-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('list')} title="Lista"
            className={`p-1.5 ${viewMode === 'list' ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700') : txtMuted}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} title="Cards"
            className={`p-1.5 ${viewMode === 'cards' ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700') : txtMuted}`}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {/* Resumo */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_CFG).map(([k, c]) => {
          const n = filtradas.filter(s => s.status === k).length
          const Icon = c.icon
          return (
            <span key={k} className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <Icon size={13} className={c.cls} /> {n} {c.label.toLowerCase()}
            </span>
          )
        })}
        <span className={`ml-auto text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
          {BRL(gasto)} <span className={`font-normal ${txtMuted}`}>em serviços liberados</span>
        </span>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className={`rounded-2xl overflow-hidden ${card}`}>
          <p className={`text-sm text-center py-14 ${txtMuted}`}>Nenhuma solicitação encerrada para os filtros selecionados.</p>
        </div>
      ) : agrupar ? (
        <div className="space-y-3">
          {porImovel.map(g => (
            <div key={g.nome} className={`rounded-2xl overflow-hidden ${card}`}>
              <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <Building2 size={14} className={txtMuted} />
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{g.nome}</span>
                <span className={`ml-auto text-[11px] font-semibold ${txtMuted}`}>
                  {g.itens.length} · {BRL(g.itens.filter(s => s.status === 'concluida')
                    .reduce((t, s) => t + (s.valor_final ?? s.valor_estimado ?? 0), 0))}
                </span>
              </div>
              {lista(g.itens)}
            </div>
          ))}
        </div>
      ) : (
        <div className={`rounded-2xl overflow-hidden ${card}`}>{lista(filtradas)}</div>
      )}

      {detail && <SolicitacaoModal sol={detail} isDark={isDark} onClose={() => setDetail(null)} />}
    </div>
  )
}
