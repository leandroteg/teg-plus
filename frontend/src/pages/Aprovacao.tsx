// Aprovacao.tsx — Página pública de aprovação externa via token
// Rota: /aprovacao/:token (pública, sem autenticação)

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Building2,
  Package,
  DollarSign,
  FileText,
  ShieldCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  Flame,
} from 'lucide-react'
import { supabase } from '../services/supabase'
import FluxoTimeline from '../components/FluxoTimeline'
import StatusBadge from '../components/StatusBadge'
import LogoTeg from '../components/LogoTeg'
import type { Urgencia } from '../types'

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface RequisicaoItem {
  id?: string
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario_estimado: number
}

interface RequisicaoCompleta {
  id: string
  numero: string
  solicitante_nome: string
  obra_nome: string
  descricao: string
  justificativa?: string
  valor_estimado: number
  urgencia: Urgencia
  status: string
  alcada_nivel: number
  categoria?: string
  created_at: string
  cmp_requisicao_itens?: RequisicaoItem[]
}

interface AprovacaoRow {
  id: string
  modulo: string
  entidade_id: string
  entidade_numero?: string
  aprovador_nome: string
  aprovador_email: string
  nivel: number
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'expirada'
  observacao?: string
  token: string
  data_limite?: string
  created_at: string
}

type PageState = 'loading' | 'pendente' | 'confirmando' | 'processando' | 'sucesso' | 'erro'
type DecisaoTipo = 'aprovada' | 'rejeitada'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoeda(valor?: number): string {
  if (valor == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatData(iso?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function calcTotalItens(itens?: RequisicaoItem[]): number {
  if (!itens?.length) return 0
  return itens.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario_estimado), 0)
}

// ─── Badge de urgência ────────────────────────────────────────────────────────

function UrgenciaBadge({ urgencia }: { urgencia: Urgencia }) {
  const map: Record<Urgencia, { label: string; classes: string; Icon: React.ElementType | null }> = {
    normal:  { label: 'Normal',   classes: 'bg-slate-100 text-slate-600',    Icon: null  },
    urgente: { label: 'Urgente',  classes: 'bg-amber-100 text-amber-700',    Icon: Zap   },
    critica: { label: 'Crítica',  classes: 'bg-red-100 text-red-700',        Icon: Flame },
  }
  const { label, classes, Icon } = map[urgencia] ?? map.normal
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${classes}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  )
}

// ─── Tela de Loading ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 text-teal-500 animate-spin mx-auto" />
        <p className="text-slate-500 text-sm">Carregando aprovação...</p>
      </div>
    </div>
  )
}

// ─── Tela de Erro ─────────────────────────────────────────────────────────────

function ErrorScreen({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 mb-1">Link inválido</h2>
          <p className="text-slate-500 text-sm leading-relaxed">{mensagem}</p>
        </div>
        <p className="text-xs text-slate-400">Se acredita que houve um erro, contate o solicitante.</p>
      </div>
    </div>
  )
}

// ─── Tela de Sucesso ──────────────────────────────────────────────────────────

function SuccessScreen({
  decisao,
  aprovacaoNumero,
}: {
  decisao: DecisaoTipo
  aprovacaoNumero?: string
}) {
  const isAprovada = decisao === 'aprovada'
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm w-full text-center space-y-5">
        {/* Ícone animado */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto
            ${isAprovada ? 'bg-emerald-100' : 'bg-red-100'}
            animate-[scale-in_0.4s_ease-out]`}
          style={{ animation: 'scaleIn 0.4s ease-out' }}
        >
          {isAprovada ? (
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          ) : (
            <XCircle className="w-10 h-10 text-red-500" />
          )}
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">
            {isAprovada ? 'Aprovação registrada!' : 'Rejeição registrada!'}
          </h2>
          {aprovacaoNumero && (
            <p className="text-xs text-slate-400 font-mono mb-2">RC {aprovacaoNumero}</p>
          )}
          <p className="text-slate-500 text-sm leading-relaxed">
            {isAprovada
              ? 'Sua aprovação foi registrada com sucesso. O processo de compra continuará para as próximas etapas.'
              : 'Sua rejeição foi registrada. O solicitante será notificado para revisão.'}
          </p>
        </div>

        <div className={`rounded-xl p-3 text-xs font-medium
          ${isAprovada ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {isAprovada ? '✓ Requisição aprovada com sucesso' : '✗ Requisição rejeitada'}
        </div>

        <p className="text-xs text-slate-400">Você pode fechar esta janela.</p>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Aprovacao() {
  const { token } = useParams<{ token: string }>()

  const [pageState, setPageState]     = useState<PageState>('loading')
  const [aprov, setAprov]             = useState<AprovacaoRow | null>(null)
  const [req, setReq]                 = useState<RequisicaoCompleta | null>(null)
  const [erroMsg, setErroMsg]         = useState('')
  const [decisao, setDecisao]         = useState<DecisaoTipo | null>(null)
  const [observacao, setObservacao]   = useState('')
  const [mostrarItens, setMostrarItens] = useState(false)

  // ── Carrega dados ao montar ───────────────────────────────────────────────

  const carregar = useCallback(async () => {
    if (!token) {
      setErroMsg('Token não informado.')
      setPageState('erro')
      return
    }

    // 1) Busca aprovação pelo token
    const { data: aprovData, error: aprovErr } = await supabase
      .from('apr_aprovacoes')
      .select('*')
      .eq('token', token)
      .single()

    if (aprovErr || !aprovData) {
      setErroMsg('Token inválido ou não encontrado. Verifique o link recebido por e-mail.')
      setPageState('erro')
      return
    }

    const aprovRow = aprovData as AprovacaoRow

    // 2) Verifica se já foi processada
    if (aprovRow.status === 'aprovada' || aprovRow.status === 'rejeitada') {
      setErroMsg(
        `Esta aprovação já foi ${aprovRow.status === 'aprovada' ? 'aprovada' : 'rejeitada'} anteriormente. ` +
        'Cada link só pode ser utilizado uma vez.'
      )
      setPageState('erro')
      return
    }

    // 3) Verifica expiração
    if (aprovRow.status === 'expirada') {
      setErroMsg('Este link de aprovação expirou. Solicite um novo link ao responsável.')
      setPageState('erro')
      return
    }

    if (aprovRow.data_limite && new Date(aprovRow.data_limite) < new Date()) {
      setErroMsg('Este link de aprovação expirou. Solicite um novo link ao responsável.')
      setPageState('erro')
      return
    }

    setAprov(aprovRow)

    // 4) Busca requisição + itens
    const { data: reqData, error: reqErr } = await supabase
      .from('cmp_requisicoes')
      .select('*, cmp_requisicao_itens(*)')
      .eq('id', aprovRow.entidade_id)
      .single()

    if (reqErr || !reqData) {
      setErroMsg('Não foi possível carregar os detalhes da requisição.')
      setPageState('erro')
      return
    }

    setReq(reqData as RequisicaoCompleta)
    setPageState('pendente')
  }, [token])

  useEffect(() => {
    carregar()
  }, [carregar])

  // ── Confirmar decisão ─────────────────────────────────────────────────────

  const iniciarConfirmacao = (d: DecisaoTipo) => {
    setDecisao(d)
    setPageState('confirmando')
  }

  const cancelarConfirmacao = () => {
    setDecisao(null)
    setObservacao('')
    setPageState('pendente')
  }

  const confirmarDecisao = async () => {
    if (!decisao || !aprov) return
    setPageState('processando')

    try {
      // Atualiza aprovação
      const { error: errAprov } = await supabase
        .from('apr_aprovacoes')
        .update({
          status: decisao,
          observacao: observacao.trim() || null,
        })
        .eq('token', token)

      if (errAprov) throw errAprov

      // Atualiza status da requisição
      const novoStatus = decisao === 'aprovada' ? 'aprovada' : 'rejeitada'
      const { error: errReq } = await supabase
        .from('cmp_requisicoes')
        .update({ status: novoStatus })
        .eq('id', aprov.entidade_id)

      if (errReq) throw errReq

      setPageState('sucesso')
    } catch (err) {
      console.error('Erro ao processar aprovação:', err)
      setErroMsg('Ocorreu um erro ao registrar sua decisão. Por favor, tente novamente.')
      setPageState('pendente')
    }
  }

  // ─── Renders condicionais ─────────────────────────────────────────────────

  if (pageState === 'loading') return <LoadingScreen />

  if (pageState === 'erro') return <ErrorScreen mensagem={erroMsg} />

  if (pageState === 'sucesso' && decisao) {
    return (
      <SuccessScreen
        decisao={decisao}
        aprovacaoNumero={aprov?.entidade_numero ?? req?.numero}
      />
    )
  }

  if (!aprov || !req) return <LoadingScreen />

  const itens = req.cmp_requisicao_itens ?? []
  const totalItens = calcTotalItens(itens)
  const valorExibir = totalItens > 0 ? totalItens : req.valor_estimado
  const isConfirmando = pageState === 'confirmando'
  const isProcessando = pageState === 'processando'

  // ─── Página principal ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoTeg size={36} animated={false} />
            <div>
              <p className="text-sm font-extrabold text-slate-800 leading-none">TEG+</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">ERP de Compras</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
            <span>Link seguro</span>
          </div>
        </div>
      </header>

      {/* ── Conteúdo principal ── */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Card de cabeçalho da RC */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">

          {/* Número + badges */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
                Requisição de Compra
              </p>
              <h1 className="text-2xl font-extrabold text-slate-800">
                RC {req.numero ?? aprov.entidade_numero}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <UrgenciaBadge urgencia={req.urgencia} />
              <StatusBadge status={req.status} />
            </div>
          </div>

          {/* FluxoTimeline */}
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[480px]">
              <FluxoTimeline status={req.status} />
            </div>
          </div>

          {/* Criada em */}
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Criada em {formatData(req.created_at)}
          </p>
        </div>

        {/* Card de detalhes */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wide">
            Detalhes da Requisição
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Obra */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Obra / Projeto</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{req.obra_nome}</p>
              </div>
            </div>

            {/* Solicitante */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Solicitante</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{req.solicitante_nome}</p>
              </div>
            </div>

            {/* Valor estimado */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">
                  {totalItens > 0 ? 'Total dos Itens' : 'Valor Estimado'}
                </p>
                <p className="text-sm font-extrabold text-slate-800">{formatMoeda(valorExibir)}</p>
              </div>
            </div>

            {/* Categoria */}
            {req.categoria && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-violet-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Categoria</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{req.categoria}</p>
                </div>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1.5">
              Descrição
            </p>
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed">
              {req.descricao}
            </div>
          </div>

          {/* Justificativa */}
          {req.justificativa && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1.5">
                Justificativa
              </p>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800 leading-relaxed">
                {req.justificativa}
              </div>
            </div>
          )}
        </div>

        {/* Card de itens (colapsável) */}
        {itens.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button
              onClick={() => setMostrarItens(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-extrabold text-slate-700">
                  Itens da requisição
                </span>
                <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 font-semibold">
                  {itens.length}
                </span>
              </div>
              {mostrarItens
                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                : <ChevronDown className="w-4 h-4 text-slate-400" />
              }
            </button>

            {mostrarItens && (
              <div className="px-5 pb-5">
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Descrição
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                          Qtd
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                          Un
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                          Vl. Unit.
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item, idx) => (
                        <tr
                          key={item.id ?? idx}
                          className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-3 py-2.5 text-slate-700">{item.descricao}</td>
                          <td className="px-3 py-2.5 text-slate-600 text-right font-mono">
                            {item.quantidade}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 text-right text-xs">
                            {item.unidade}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 text-right font-mono text-xs">
                            {formatMoeda(item.valor_unitario_estimado)}
                          </td>
                          <td className="px-3 py-2.5 text-slate-800 text-right font-semibold font-mono text-xs">
                            {formatMoeda(item.quantidade * item.valor_unitario_estimado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Total estimado
                        </td>
                        <td className="px-3 py-2.5 text-right font-extrabold text-slate-800">
                          {formatMoeda(totalItens)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card do aprovador */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wide mb-3">
            Sua Alçada
          </h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{aprov.aprovador_nome}</p>
              <p className="text-xs text-slate-400">{aprov.aprovador_email}</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                Nível {aprov.nivel}
              </span>
            </div>
          </div>
          {aprov.data_limite && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Prazo para decisão: <strong>{formatData(aprov.data_limite)}</strong></span>
            </div>
          )}
        </div>

        {/* Bloco de decisão */}
        {!isConfirmando && !isProcessando && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wide">
              Sua Decisão
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Analise os detalhes acima com atenção antes de tomar sua decisão. Esta ação é irreversível.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => iniciarConfirmacao('rejeitada')}
                className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600
                  active:bg-red-700 text-white rounded-xl py-4 font-extrabold text-base
                  transition-all shadow-sm hover:shadow-md disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                <span>REJEITAR</span>
              </button>
              <button
                onClick={() => iniciarConfirmacao('aprovada')}
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600
                  active:bg-emerald-700 text-white rounded-xl py-4 font-extrabold text-base
                  transition-all shadow-sm hover:shadow-md disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                <span>APROVAR</span>
              </button>
            </div>
          </div>
        )}

        {/* Painel de confirmação */}
        {(isConfirmando || isProcessando) && decisao && (
          <div className={`bg-white rounded-2xl shadow-sm border p-5 space-y-4
            ${decisao === 'aprovada' ? 'border-emerald-200' : 'border-red-200'}`}>

            {/* Cabeçalho de confirmação */}
            <div className={`flex items-center gap-2 text-sm font-extrabold
              ${decisao === 'aprovada' ? 'text-emerald-700' : 'text-red-700'}`}>
              {decisao === 'aprovada'
                ? <CheckCircle className="w-5 h-5" />
                : <XCircle className="w-5 h-5" />
              }
              {decisao === 'aprovada' ? 'Confirmar aprovação' : 'Confirmar rejeição'}
            </div>

            <p className="text-sm text-slate-500 leading-relaxed">
              {decisao === 'aprovada'
                ? `Você está aprovando a RC ${req.numero ?? aprov.entidade_numero} no valor de ${formatMoeda(valorExibir)}. Deseja adicionar alguma observação?`
                : `Você está rejeitando a RC ${req.numero ?? aprov.entidade_numero}. Por favor, informe o motivo da rejeição (obrigatório).`
              }
            </p>

            {/* Campo de observação */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Observação {decisao === 'rejeitada' ? <span className="text-red-500">*</span> : '(opcional)'}
              </label>
              <textarea
                rows={3}
                disabled={isProcessando}
                placeholder={
                  decisao === 'aprovada'
                    ? 'Algum comentário sobre a aprovação...'
                    : 'Informe o motivo da rejeição...'
                }
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm
                  focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                  placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-400
                  resize-none transition-all"
              />
              {decisao === 'rejeitada' && observacao.trim().length === 0 && (
                <p className="text-xs text-red-500 mt-1">Motivo obrigatório para rejeição.</p>
              )}
            </div>

            {/* Botões de confirmação */}
            {isProcessando ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
                <span className="text-sm text-slate-500">Registrando decisão...</span>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={cancelarConfirmacao}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50
                    rounded-xl py-3 text-sm font-semibold transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmarDecisao}
                  disabled={decisao === 'rejeitada' && observacao.trim().length === 0}
                  className={`flex-1 text-white rounded-xl py-3 text-sm font-extrabold
                    transition-all disabled:opacity-40 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2
                    ${decisao === 'aprovada'
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-red-500 hover:bg-red-600'
                    }`}
                >
                  {decisao === 'aprovada'
                    ? <><CheckCircle className="w-4 h-4" /> Confirmar Aprovação</>
                    : <><XCircle className="w-4 h-4" /> Confirmar Rejeição</>
                  }
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rodapé */}
        <div className="text-center py-4">
          <p className="text-[10px] text-slate-300">
            TEG+ ERP &bull; Link de uso único &bull; {token?.substring(0, 8)}...
          </p>
        </div>

      </main>
    </div>
  )
}
