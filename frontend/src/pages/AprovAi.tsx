import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  Clock, Building, Sparkles, Shield, AlertTriangle,
  MessageSquare, ExternalLink, ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAprovacoesPendentes, useDecisaoRequisicao } from '../hooks/useAprovacoes'
import FluxoTimeline from '../components/FluxoTimeline'
import type { AprovacaoPendente } from '../types'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const urgenciaConfig: Record<string, { bg: string; text: string; label: string }> = {
  normal:  { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Normal'  },
  urgente: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Urgente' },
  critica: { bg: 'bg-red-100',    text: 'text-red-700',    label: '⚡ Crítica' },
}

function timeLeft(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Expirado'
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h restantes`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

// Determina nível e aprovador com base no valor
function getAlcada(valor: number, nivel: number) {
  if (valor <= 2000) return { label: `Alçada 1`, sublabel: `Welton ou Claudinor ≤ R$2.000` }
  if (nivel <= 2)    return { label: 'Alçada 2', sublabel: 'Laucídio > R$2.000' }
  return { label: 'Aprovação de Pagamento', sublabel: 'Laucídio — etapa final' }
}

function AprovacaoCard({ aprovacao, aprovadorNome, aprovadorEmail }: {
  aprovacao: AprovacaoPendente
  aprovadorNome: string
  aprovadorEmail: string
}) {
  const mutation = useDecisaoRequisicao()
  const [expanded, setExpanded] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [action, setAction] = useState<'aprovada' | 'rejeitada' | 'esclarecimento' | null>(null)

  const req  = aprovacao.requisicao
  const cot  = aprovacao.cotacao_resumo

  // Guard: requisição pode ser null se entidade_id não tem match
  if (!req) return null

  const urg  = urgenciaConfig[req.urgencia] || urgenciaConfig.normal
  const alc  = getAlcada(req.valor_estimado, aprovacao.nivel)

  const handleDecision = async (decisao: 'aprovada' | 'rejeitada') => {
    setAction(decisao)
    try {
      await mutation.mutateAsync({
        requisicaoId: aprovacao.requisicao_id,
        decisao,
        observacao: observacao || undefined,
        requisicaoNumero: req.numero,
        alcadaNivel: aprovacao.nivel,
        aprovadorNome,
        aprovadorEmail,
        categoria: req.categoria,
        currentStatus: req.status,
      })
    } catch { /* error handled by mutation state */ }
  }

  const handleEsclarecimento = async () => {
    if (!observacao.trim()) {
      setExpanded(true)
      setAction('esclarecimento')
      return
    }
    setAction('esclarecimento')
    try {
      await mutation.mutateAsync({
        requisicaoId: aprovacao.requisicao_id,
        decisao: 'esclarecimento',
        observacao,
        requisicaoNumero: req.numero,
        alcadaNivel: aprovacao.nivel,
        aprovadorNome,
        aprovadorEmail,
        categoria: req.categoria,
        currentStatus: req.status,
      })
    } catch { /* error handled by mutation state */ }
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  if (mutation.isSuccess) {
    const colors = action === 'aprovada'
      ? { bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-500', text: 'text-emerald-700', msg: 'Aprovada ✓' }
      : action === 'esclarecimento'
      ? { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', text: 'text-amber-700', msg: 'Esclarecimento solicitado' }
      : { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', text: 'text-red-700', msg: 'Rejeitada' }

    return (
      <div className={`rounded-2xl p-6 text-center border-2 ${colors.bg}`}>
        {action === 'aprovada' && <CheckCircle size={44} className={`${colors.icon} mx-auto mb-3`} />}
        {action === 'rejeitada' && <XCircle size={44} className={`${colors.icon} mx-auto mb-3`} />}
        {action === 'esclarecimento' && <MessageSquare size={44} className={`${colors.icon} mx-auto mb-3`} />}
        <p className={`font-bold text-base ${colors.text}`}>
          {req.numero} — {colors.msg}
        </p>
        <p className="text-xs text-slate-500 mt-1">Aprovador notificado automaticamente</p>
      </div>
    )
  }

  // ── Card principal ────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
      {/* Badge de nível / tipo */}
      <div className="bg-indigo-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-indigo-200" />
          <span className="text-xs font-bold text-white">{alc.label}</span>
          <span className="text-indigo-300 text-[10px]">· {alc.sublabel}</span>
        </div>
        {aprovacao.data_limite && (
          <span className="text-[10px] text-indigo-200 font-semibold flex items-center gap-1">
            <Clock size={10} /> {timeLeft(aprovacao.data_limite)}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-sm font-bold text-slate-800">{req.numero}</p>
            <p className="text-xs text-slate-500">{req.solicitante_nome}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${urg.bg} ${urg.text}`}>
            {urg.label}
          </span>
        </div>

        <p className="text-sm text-slate-700 mb-2">{req.descricao}</p>

        {/* Ver detalhes link */}
        <a
          href={`/requisicoes/${req.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-400 font-semibold hover:text-indigo-600 transition mb-3"
        >
          <ExternalLink size={11} /> Ver detalhes completos
        </a>

        {/* Obra */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          <Building size={12} /> {req.obra_nome}
          {req.categoria && (
            <>
              <span className="text-slate-300">·</span>
              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                {req.categoria.replace(/_/g, ' ')}
              </span>
            </>
          )}
        </div>

        {/* FluxoTimeline compact */}
        <FluxoTimeline status={req.status} compact className="mb-3" />

        {/* Valor + Cotação */}
        <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Valor estimado</span>
            <span className="text-lg font-extrabold text-indigo-600">{fmt(req.valor_estimado)}</span>
          </div>

          {cot && (
            <div className="border-t border-slate-200 pt-2 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Menor cotação</span>
                <span className="text-lg font-extrabold text-emerald-600">{fmt(cot.valor)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{cot.fornecedor_nome}</span>
                <span>{cot.prazo_dias}d · {cot.total_cotados} cotado{cot.total_cotados !== 1 ? 's' : ''}</span>
              </div>
              {cot.valor < req.valor_estimado && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                  <Sparkles size={11} />
                  Economia de {fmt(req.valor_estimado - cot.valor)}{' '}
                  ({Math.round((1 - cot.valor / req.valor_estimado) * 100)}%)
                </div>
              )}
            </div>
          )}

          {!cot && req.valor_estimado > 2000 && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
              <AlertTriangle size={11} /> Valor acima de R$2.000 — alçada Laucídio
            </div>
          )}
        </div>

        {/* Expandir para observação */}
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-indigo-500 mt-3 mx-auto font-semibold">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Menos detalhes' : 'Adicionar observação'}
        </button>

        {expanded && (
          <div className="mt-3">
            <label className="text-xs text-slate-400">
              {action === 'esclarecimento' ? 'Descreva o esclarecimento necessário (obrigatório)' : 'Observação (opcional)'}
            </label>
            <textarea
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-indigo-300 outline-none"
              placeholder={action === 'esclarecimento' ? 'O que precisa ser esclarecido...' : 'Motivo da decisão...'}
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Botões de ação — 3 colunas para mobile */}
      <div className="grid grid-cols-3 border-t border-slate-100">
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => handleDecision('rejeitada')}
          className="flex flex-col items-center justify-center gap-1 py-4 text-xs font-bold text-red-500 hover:bg-red-50 active:bg-red-100 transition border-r border-slate-100 disabled:opacity-50"
        >
          {mutation.isPending && action === 'rejeitada'
            ? <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            : <XCircle size={20} />}
          <span>Rejeitar</span>
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={handleEsclarecimento}
          className="flex flex-col items-center justify-center gap-1 py-4 text-xs font-bold text-amber-600 hover:bg-amber-50 active:bg-amber-100 transition border-r border-slate-100 disabled:opacity-50"
        >
          {mutation.isPending && action === 'esclarecimento'
            ? <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            : <MessageSquare size={20} />}
          <span>Esclarecer</span>
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => handleDecision('aprovada')}
          className="flex flex-col items-center justify-center gap-1 py-4 text-xs font-bold text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition disabled:opacity-50"
        >
          {mutation.isPending && action === 'aprovada'
            ? <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            : <CheckCircle size={20} />}
          <span>Aprovar</span>
        </button>
      </div>

      {mutation.isError && (
        <p className="text-red-500 text-xs text-center py-2 border-t border-red-100">
          Erro ao processar: {mutation.error?.message || 'Tente novamente.'}
        </p>
      )}
    </div>
  )
}

export default function AprovAi() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { data: aprovacoes, isLoading, isError, refetch } = useAprovacoesPendentes()

  const aprovadorNome = perfil?.nome ?? 'Aprovador'
  const aprovadorEmail = perfil?.email ?? ''

  return (
    <div className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #312e81 0%, #4f46e5 40%, #6d28d9 100%)' }}>

      {/* Header */}
      <header className="px-4 pt-6 pb-5">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-indigo-300 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={18} />
          <span className="text-xs font-semibold">Voltar</span>
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles size={22} className="text-indigo-200" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Aprov<span className="text-indigo-200">Ai</span>
            </h1>
          </div>
          <p className="text-indigo-300 text-xs font-medium">Aprovações inteligentes com 1 toque</p>
          {aprovacoes && !isError && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5">
              <span className="text-white text-lg font-extrabold">{aprovacoes.length}</span>
              <span className="text-indigo-200 text-xs">pendente{aprovacoes.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="px-4 pb-12 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {!isLoading && isError && (
          <div className="text-center py-14">
            <AlertTriangle size={44} className="text-amber-300 mx-auto mb-3" />
            <p className="text-white text-base font-bold">Erro ao carregar</p>
            <p className="text-indigo-300 text-sm mt-1 mb-4">Não foi possível buscar as aprovações</p>
            <button
              onClick={() => refetch()}
              className="bg-white/20 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-white/30 transition"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!isLoading && !isError && (!aprovacoes || aprovacoes.length === 0) && (
          <div className="text-center py-14">
            <CheckCircle size={52} className="text-indigo-300 mx-auto mb-3 opacity-80" />
            <p className="text-white text-base font-bold">Tudo em dia!</p>
            <p className="text-indigo-300 text-sm mt-1">Nenhuma aprovação pendente</p>
          </div>
        )}

        {aprovacoes?.map(apr => (
          <AprovacaoCard
            key={apr.id}
            aprovacao={apr}
            aprovadorNome={aprovadorNome}
            aprovadorEmail={aprovadorEmail}
          />
        ))}
      </div>

      <footer className="text-center pb-8">
        <p className="text-indigo-400 text-[10px]">TEG+ · TEG União Energia</p>
      </footer>
    </div>
  )
}
