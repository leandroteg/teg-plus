import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { useRequisicoes } from '../hooks/useRequisicoes'
import { useAprovacoesPendentes, useDecisaoRequisicao } from '../hooks/useAprovacoes'
import { useAuth } from '../contexts/AuthContext'
import StatusBadge from '../components/StatusBadge'
import FluxoTimeline from '../components/FluxoTimeline'
import type { StatusRequisicao, Aprovacao } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// Pipeline tabs (etapas do fluxo)
const PIPELINE_TABS = [
  { value: '',                    label: 'Todos' },
  { value: 'pendente',            label: 'Pendentes' },
  { value: 'em_aprovacao',        label: 'Em Aprov.' },
  { value: 'em_esclarecimento',   label: 'Esclarec.' },
  { value: 'em_cotacao',          label: 'Em Cotação' },
  { value: 'cotacao_enviada',     label: 'Cot. Enviada' },
  { value: 'cotacao_aprovada',    label: 'Aprov. Fin.' },
  { value: 'pedido_emitido',      label: 'Pedido' },
  { value: 'em_entrega',          label: 'Entrega' },
  { value: 'pago',                label: 'Pago' },
  { value: 'rejeitada',           label: 'Reprovadas' },
  { value: 'cancelada',           label: 'Canceladas' },
]

const AVATAR_COLORS: Record<string, string> = {
  Lauany:   'bg-violet-500',
  Fernando: 'bg-amber-500',
  Aline:    'bg-emerald-500',
}

const NIVEL_LABEL: Record<number, string> = {
  1: 'Coordenador',
  2: 'Gerente',
  3: 'Diretor',
  4: 'CEO',
}

/** Label específico da etapa de aprovação */
function getApprovalStatusLabel(status: string): string | undefined {
  if (status === 'pendente')            return 'Aguard. Valid. Técnica'
  if (status === 'em_aprovacao')        return 'Em Validação Técnica'
  if (status === 'cotacao_enviada')     return 'Aguard. Aprov. Financeira'
  if (status === 'cotacao_aprovada')    return 'Cotação Aprovada'
  if (status === 'em_esclarecimento')   return 'Em Esclarecimento'
  return undefined
}

function CompradorBadge({ nome }: { nome: string }) {
  const bg = AVATAR_COLORS[nome.split(' ')[0]] ?? 'bg-slate-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-[9px] font-extrabold">{nome.slice(0, 2).toUpperCase()}</span>
      </div>
      <span className="text-xs font-semibold text-slate-700">{nome.split(' ')[0]}</span>
    </div>
  )
}

// Chip contextual por status — mostra aprovador, nível de alçada, ou esclarecimento
function StatusChip({ status, aprovacao, alcadaNivel, dataPrevista, esclarecimentoMsg }: {
  status: string; aprovacao?: Aprovacao; alcadaNivel?: number; dataPrevista?: string; esclarecimentoMsg?: string
}) {
  if (status === 'em_esclarecimento') {
    return (
      <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-semibold truncate max-w-[180px]">
        ⚠ {esclarecimentoMsg ? esclarecimentoMsg.slice(0, 40) : 'Esclarecimento'}
      </span>
    )
  }
  if (status === 'pendente' || status === 'rascunho' || status === 'em_aprovacao') {
    if (aprovacao) {
      const nivel = NIVEL_LABEL[aprovacao.nivel] ?? ''
      return (
        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-semibold truncate max-w-[200px]">
          Aguard. {aprovacao.aprovador_nome.split(' ')[0]}{nivel ? ` (${nivel})` : ''}
        </span>
      )
    }
    if (alcadaNivel && NIVEL_LABEL[alcadaNivel]) {
      return (
        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-semibold">
          Aguard. {NIVEL_LABEL[alcadaNivel]}
        </span>
      )
    }
    return null
  }
  if (status === 'em_cotacao' || status === 'aprovada') {
    return <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 rounded-full px-2 py-0.5 font-semibold">Comprador cotando</span>
  }
  if (status === 'cotacao_enviada') {
    return <span className="text-[10px] bg-teal-50 text-teal-600 border border-teal-200 rounded-full px-2 py-0.5 font-semibold">Aguard. Aprov. Financeira</span>
  }
  if (status === 'cotacao_aprovada') {
    return <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold">Cotação aprovada ✓</span>
  }
  if (status === 'pedido_emitido') {
    return <span className="text-[10px] bg-cyan-50 text-cyan-600 border border-cyan-200 rounded-full px-2 py-0.5 font-semibold">Pedido emitido</span>
  }
  if (status === 'em_entrega') {
    const data = dataPrevista ? `Prev: ${new Date(dataPrevista).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'Em entrega'
    return <span className="text-[10px] bg-teal-50 text-teal-600 border border-teal-200 rounded-full px-2 py-0.5 font-semibold">{data}</span>
  }
  return null
}

export default function ListaRequisicoes() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { data: requisicoes, isLoading } = useRequisicoes(statusFilter || undefined)
  const { data: aprovacoes } = useAprovacoesPendentes()
  const { isAdmin, perfil } = useAuth()
  const decisaoMutation = useDecisaoRequisicao()

  // Card expandido para comentário + esclarecimento
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')

  // Mapa: requisicao_id → aprovação pendente (para mostrar aprovador no card)
  const aprovacaoMap = useMemo(() => {
    const map = new Map<string, Aprovacao>()
    for (const a of aprovacoes ?? []) {
      map.set(a.requisicao_id, a)
    }
    return map
  }, [aprovacoes])

  const filtradas = (requisicoes ?? []).filter(r => {
    if (!busca) return true
    const termo = busca.toLowerCase()
    return (
      r.numero.toLowerCase().includes(termo) ||
      r.descricao.toLowerCase().includes(termo) ||
      r.solicitante_nome.toLowerCase().includes(termo) ||
      r.obra_nome.toLowerCase().includes(termo) ||
      (r.comprador_nome ?? '').toLowerCase().includes(termo) ||
      (r.categoria ?? '').toLowerCase().includes(termo)
    )
  })

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const handleDecisao = (reqId: string, numero: string, alcada: number, decisao: 'aprovada' | 'rejeitada' | 'esclarecimento', categoria?: string, currentStatus?: string) => {
    if (!perfil) {
      console.warn('[ListaRequisicoes] perfil null — ação bloqueada')
      return
    }
    if (decisao === 'esclarecimento' && !observacao.trim()) {
      setExpandedCard(reqId)
      return
    }
    decisaoMutation.mutate({
      requisicaoId: reqId,
      decisao,
      observacao: observacao.trim() || undefined,
      requisicaoNumero: numero,
      alcadaNivel: alcada,
      aprovadorNome: perfil.nome,
      aprovadorEmail: perfil.email,
      categoria,
      currentStatus,
    }, {
      onSuccess: () => {
        setExpandedCard(null)
        setObservacao('')
        const label = decisao === 'aprovada' ? 'Aprovada ✓' : decisao === 'rejeitada' ? 'Rejeitada' : 'Esclarecimento solicitado'
        setToast({ type: 'success', msg: `${numero}: ${label}` })
        setTimeout(() => setToast(null), 4000)
      },
      onError: (err) => {
        console.error('[ListaRequisicoes] Erro na decisão:', err)
        setToast({ type: 'error', msg: `Erro ao processar ${numero}. Tente novamente.` })
        setTimeout(() => setToast(null), 5000)
      },
    })
  }

  return (
    <div className="space-y-3">
      {/* Toast feedback */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Requisições</h2>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
            showFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-500'
          }`}>
          <SlidersHorizontal size={12} /> Filtros
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition"
          placeholder="Buscar número, descrição, obra, comprador..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Filtros de pipeline */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {PIPELINE_TABS.map(tab => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              statusFilter === tab.value
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-10">Nenhuma requisição encontrada</p>
      ) : (
        <div className="space-y-2">
          {filtradas.map(r => {
            const apr = aprovacaoMap.get(r.id)
            const approvalLabel = getApprovalStatusLabel(r.status)
            const isExpanded = expandedCard === r.id
            const isProcessing = decisaoMutation.isPending && decisaoMutation.variables?.requisicaoId === r.id
            const canDecide = isAdmin && ['pendente', 'em_aprovacao', 'em_esclarecimento', 'cotacao_enviada'].includes(r.status)

            return (
              <div key={r.id}
                onClick={() => navigate(`/requisicoes/${r.id}`)}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 cursor-pointer hover:border-teal-300 hover:shadow-md transition-all active:scale-[0.99]"
              >
                {/* Linha 1: número + urgência + status */}
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{r.numero}</span>
                    {r.urgencia !== 'normal' && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
                        r.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        ⚡ {r.urgencia}
                      </span>
                    )}
                    {r.categoria && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 truncate max-w-[80px]">
                        {r.categoria.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={r.status as StatusRequisicao} size="sm" customLabel={approvalLabel} />
                </div>

                {/* Descrição */}
                <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{r.descricao}</p>

                {/* FluxoTimeline compact */}
                <FluxoTimeline status={r.status} compact />

                {/* Obra + Valor */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 truncate max-w-[55%]">{r.obra_nome}</span>
                  <span className="text-sm font-extrabold text-teal-600">{fmt(r.valor_estimado)}</span>
                </div>

                {/* Comprador + data + chip contextual */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    {r.comprador_nome
                      ? <CompradorBadge nome={r.comprador_nome} />
                      : <span className="text-xs text-slate-300 italic">Sem comprador</span>
                    }
                    <StatusChip
                      status={r.status}
                      aprovacao={apr}
                      alcadaNivel={r.alcada_nivel}
                      esclarecimentoMsg={r.esclarecimento_msg}
                    />
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {r.solicitante_nome.split(' ')[0]} · {fmtData(r.created_at)}
                  </span>
                </div>

                {/* Botões de ação rápida — admins em RCs pendentes/em_esclarecimento */}
                {canDecide && (
                  <div className="pt-2 border-t border-slate-100 space-y-2" onClick={e => e.stopPropagation()}>
                    {/* Toggle observação */}
                    <button
                      onClick={() => {
                        if (isExpanded) { setExpandedCard(null); setObservacao('') }
                        else { setExpandedCard(r.id); setObservacao('') }
                      }}
                      className="flex items-center gap-1 text-xs text-indigo-500 font-semibold mx-auto"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {isExpanded ? 'Ocultar' : 'Comentário'}
                    </button>

                    {isExpanded && (
                      <textarea
                        rows={2}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                        placeholder="Observação / motivo do esclarecimento..."
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    )}

                    {r.status === 'cotacao_enviada' && (
                      <p className="text-[10px] text-teal-600 font-semibold text-center">Aprovação Financeira</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        disabled={isProcessing}
                        onClick={() => handleDecisao(r.id, r.numero, r.alcada_nivel, 'rejeitada', r.categoria, r.status)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold
                          text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-[0.98]
                          transition-all disabled:opacity-50"
                      >
                        <XCircle size={14} /> Rejeitar
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleDecisao(r.id, r.numero, r.alcada_nivel, 'esclarecimento', r.categoria, r.status)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold
                          text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 active:scale-[0.98]
                          transition-all disabled:opacity-50"
                      >
                        <MessageSquare size={14} /> Esclarecer
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleDecisao(r.id, r.numero, r.alcada_nivel, 'aprovada', r.categoria, r.status)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold
                          text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98]
                          transition-all disabled:opacity-50"
                      >
                        {isProcessing
                          ? <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          : <CheckCircle size={14} />}
                        Aprovar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-slate-300 py-2">
        {filtradas.length} requisição{filtradas.length !== 1 ? 'ões' : ''}
      </p>
    </div>
  )
}
