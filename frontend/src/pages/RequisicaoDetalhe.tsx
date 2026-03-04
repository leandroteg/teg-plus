import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building, User, Calendar, Tag, Package,
  CheckCircle, XCircle, MessageSquare, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { useRequisicao } from '../hooks/useRequisicoes'
import { useDecisaoRequisicao } from '../hooks/useAprovacoes'
import { useAuth } from '../contexts/AuthContext'
import StatusBadge from '../components/StatusBadge'
import FluxoTimeline from '../components/FluxoTimeline'
import type { StatusRequisicao } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

const NIVEL_LABEL: Record<number, string> = {
  1: 'Coordenador', 2: 'Gerente', 3: 'Diretor', 4: 'CEO',
}

export default function RequisicaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: req, isLoading, error } = useRequisicao(id)
  const decisaoMutation = useDecisaoRequisicao()
  const { isAdmin, perfil } = useAuth()

  const [observacao, setObservacao] = useState('')
  const [showObservacao, setShowObservacao] = useState(false)
  const [showItens, setShowItens] = useState(true)
  const [pendingAction, setPendingAction] = useState<'aprovada' | 'rejeitada' | 'esclarecimento' | null>(null)

  const canDecide = isAdmin && req && ['pendente', 'em_aprovacao', 'em_esclarecimento'].includes(req.status)

  const handleDecisao = (decisao: 'aprovada' | 'rejeitada' | 'esclarecimento') => {
    if (!req || !perfil) return
    if (decisao === 'esclarecimento' && !observacao.trim()) {
      setShowObservacao(true)
      setPendingAction('esclarecimento')
      return
    }
    setPendingAction(decisao)
    decisaoMutation.mutate({
      requisicaoId: req.id,
      decisao,
      observacao: observacao.trim() || undefined,
      requisicaoNumero: req.numero,
      alcadaNivel: req.alcada_nivel,
      aprovadorNome: perfil.nome,
      aprovadorEmail: perfil.email,
    })
  }

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !req) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-slate-400 text-sm">Requisição não encontrada</p>
        <button onClick={() => navigate(-1)} className="text-teal-600 text-sm font-semibold underline">
          ← Voltar
        </button>
      </div>
    )
  }

  const totalItens = req.itens.reduce(
    (sum, i) => sum + i.quantidade * i.valor_unitario_estimado, 0
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition">
          <ArrowLeft size={16} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-slate-500">{req.numero}</span>
            {req.urgencia !== 'normal' && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                req.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                ⚡ {req.urgencia}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={req.status as StatusRequisicao} />
      </div>

      {/* Descrição */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-base font-bold text-slate-800 leading-snug">{req.descricao}</p>
      </div>

      {/* FluxoTimeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <FluxoTimeline status={req.status} />
      </div>

      {/* Alerta Esclarecimento */}
      {req.status === 'em_esclarecimento' && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <span className="text-sm font-bold text-amber-700">Esclarecimento Solicitado</span>
          </div>
          <p className="text-sm text-amber-700">{req.esclarecimento_msg}</p>
          <div className="flex items-center gap-2 text-xs text-amber-500">
            <span>Por: {req.esclarecimento_por}</span>
            {req.esclarecimento_em && <span>· {fmtData(req.esclarecimento_em)}</span>}
          </div>
        </div>
      )}

      {/* Metadados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Building size={12} /> Obra
            </div>
            <p className="text-sm font-semibold text-slate-700">{req.obra_nome}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <User size={12} /> Solicitante
            </div>
            <p className="text-sm font-semibold text-slate-700">{req.solicitante_nome}</p>
          </div>
          {req.categoria && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Tag size={12} /> Categoria
              </div>
              <p className="text-sm font-semibold text-slate-700">{req.categoria.replace(/_/g, ' ')}</p>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar size={12} /> Criação
            </div>
            <p className="text-sm font-semibold text-slate-700">{fmtData(req.created_at)}</p>
          </div>
        </div>

        {/* Valor + Alçada */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Valor estimado</p>
            <p className="text-xl font-extrabold text-teal-600">{fmt(req.valor_estimado)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Alçada</p>
            <p className="text-sm font-bold text-indigo-600">
              Nível {req.alcada_nivel} — {NIVEL_LABEL[req.alcada_nivel] ?? 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Justificativa */}
      {req.justificativa && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 mb-1">Justificativa</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{req.justificativa}</p>
        </div>
      )}

      {/* Itens */}
      {req.itens.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowItens(!showItens)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <Package size={14} className="text-slate-500" />
              <span className="text-sm font-bold text-slate-700">
                Itens ({req.itens.length})
              </span>
            </div>
            {showItens ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>

          {showItens && (
            <div className="px-4 pb-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Descrição</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase text-right">Qtd</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase text-right">Un</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase text-right">Vl. Unit.</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {req.itens.map((item, idx) => (
                    <tr key={item.id ?? idx} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-700">{item.descricao}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{item.quantidade}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{item.unidade}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-600">{fmt(item.valor_unitario_estimado)}</td>
                      <td className="px-3 py-2 text-right font-semibold font-mono text-xs text-slate-800">
                        {fmt(item.quantidade * item.valor_unitario_estimado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-3 py-2 text-xs font-bold text-slate-500">Total estimado</td>
                    <td className="px-3 py-2 text-right font-extrabold text-sm text-teal-600">{fmt(totalItens)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Comprador */}
      {req.comprador_nome && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1">Comprador designado</p>
          <p className="text-sm font-bold text-slate-700">{req.comprador_nome}</p>
        </div>
      )}

      {/* ── Decisão Admin ──────────────────────────────────────────────────────── */}
      {canDecide && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Decisão</p>

          {/* Sucesso */}
          {decisaoMutation.isSuccess && (
            <div className={`rounded-xl p-4 text-center ${
              pendingAction === 'aprovada' ? 'bg-emerald-50 border border-emerald-200' :
              pendingAction === 'rejeitada' ? 'bg-red-50 border border-red-200' :
              'bg-amber-50 border border-amber-200'
            }`}>
              {pendingAction === 'aprovada' && <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />}
              {pendingAction === 'rejeitada' && <XCircle size={32} className="text-red-500 mx-auto mb-2" />}
              {pendingAction === 'esclarecimento' && <MessageSquare size={32} className="text-amber-500 mx-auto mb-2" />}
              <p className={`font-bold text-sm ${
                pendingAction === 'aprovada' ? 'text-emerald-700' :
                pendingAction === 'rejeitada' ? 'text-red-700' :
                'text-amber-700'
              }`}>
                {pendingAction === 'aprovada' ? 'Aprovada ✓' :
                 pendingAction === 'rejeitada' ? 'Rejeitada' :
                 'Esclarecimento solicitado'}
              </p>
            </div>
          )}

          {/* Observação */}
          {!decisaoMutation.isSuccess && (
            <>
              <button
                onClick={() => setShowObservacao(!showObservacao)}
                className="flex items-center gap-1 text-xs text-indigo-500 font-semibold"
              >
                {showObservacao ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showObservacao ? 'Ocultar comentário' : 'Adicionar comentário'}
              </button>

              {showObservacao && (
                <textarea
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                  placeholder={pendingAction === 'esclarecimento'
                    ? 'Descreva o que precisa ser esclarecido... (obrigatório)'
                    : 'Observação (opcional)...'}
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                />
              )}

              {/* Botões */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled={decisaoMutation.isPending}
                  onClick={() => handleDecisao('rejeitada')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold
                    text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  {decisaoMutation.isPending && pendingAction === 'rejeitada'
                    ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    : <XCircle size={14} />}
                  Rejeitar
                </button>
                <button
                  disabled={decisaoMutation.isPending}
                  onClick={() => handleDecisao('esclarecimento')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold
                    text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  {decisaoMutation.isPending && pendingAction === 'esclarecimento'
                    ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    : <MessageSquare size={14} />}
                  Esclarecer
                </button>
                <button
                  disabled={decisaoMutation.isPending}
                  onClick={() => handleDecisao('aprovada')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold
                    text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  {decisaoMutation.isPending && pendingAction === 'aprovada'
                    ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    : <CheckCircle size={14} />}
                  Aprovar
                </button>
              </div>

              {decisaoMutation.isError && (
                <p className="text-red-500 text-xs text-center">Erro ao processar. Tente novamente.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
