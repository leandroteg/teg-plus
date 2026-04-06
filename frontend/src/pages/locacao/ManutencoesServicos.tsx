import { useState } from 'react'
import { Wrench, Search, AlertTriangle, Plus } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useSolicitacoesLocacao } from '../../hooks/useLocacao'
import { STATUS_SOLICITACAO_LABEL, TIPO_SOLICITACAO_LABEL, URGENCIA_LABEL } from '../../types/locacao'
import type { StatusSolicitacao } from '../../types/locacao'
import NovaSolicitacaoModal from '../../components/locacao/NovaSolicitacaoModal'

const URGENCIA_COLOR: Record<string, string> = {
  baixa:   'bg-slate-100 text-slate-600',
  normal:  'bg-blue-100 text-blue-700',
  alta:    'bg-amber-100 text-amber-700',
  urgente: 'bg-red-100 text-red-700',
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

export default function ManutencoesServicos() {
  const { isDark } = useTheme()
  const { data: solicitacoes = [], isLoading } = useSolicitacoesLocacao()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusSolicitacao | ''>('')
  const [showModal, setShowModal] = useState(false)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const tdBorder = isDark ? 'border-white/[0.06]' : 'border-slate-100'
  const cardHover = isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'

  const filtered = solicitacoes.filter(sol => {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${txt}`}>Manutencoes e Servicos</h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>{solicitacoes.length} solicitacoes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> Nova Solicitacao
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[180px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input
            type="text"
            placeholder="Buscar solicitacao..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusSolicitacao | '')}
          className={`text-sm rounded-xl border px-3 py-2 outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
        >
          <option value="">Todos status</option>
          {Object.entries(STATUS_SOLICITACAO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Wrench size={36} className={txtMuted} />
            <p className={`text-sm ${txtMuted}`}>Nenhuma solicitacao encontrada</p>
          </div>
        ) : (
          filtered.map(sol => {
            const st = STATUS_SOLICITACAO_LABEL[sol.status]
            return (
              <div key={sol.id} className={`rounded-xl border p-4 flex items-start gap-3 transition-all ${bg} ${cardHover}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  {sol.urgencia === 'urgente' || sol.urgencia === 'alta' ? (
                    <AlertTriangle size={18} className={sol.urgencia === 'urgente' ? 'text-red-500' : 'text-amber-500'} />
                  ) : (
                    <Wrench size={18} className="text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${txt}`}>{sol.titulo}</p>
                      <p className={`text-xs ${txtMuted}`}>
                        {sol.imovel?.descricao ?? '—'} · {TIPO_SOLICITACAO_LABEL[sol.tipo]}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${URGENCIA_COLOR[sol.urgencia]}`}>
                        {URGENCIA_LABEL[sol.urgencia]}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>
                  </div>
                  {sol.descricao && (
                    <p className={`text-xs mt-1 line-clamp-2 ${txtMuted}`}>{sol.descricao}</p>
                  )}
                  <p className={`text-[10px] mt-1 ${txtMuted}`}>{fmtDate(sol.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {showModal && <NovaSolicitacaoModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
