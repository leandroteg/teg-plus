import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Receipt, Search, Calendar, AlertTriangle,
  CheckCircle2, Clock, FileText, RefreshCw, Zap, XCircle,
  ChevronDown, ChevronUp, Upload, Paperclip, ExternalLink, Banknote, X,
  ShieldCheck, Building2, Tag, Briefcase, Hash, Truck, Package,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useContasPagar, useMarcarCPPago, useAprovarPagamento, useFornecedorById } from '../../hooks/useFinanceiro'
import { useLastSync, useTriggerSync, useOmieConfig } from '../../hooks/useOmie'
import { useAnexosPedido, useUploadAnexo, TIPO_LABEL } from '../../hooks/useAnexos'
import { useRegistrarPagamento } from '../../hooks/usePedidos'
import type { PedidoAnexo } from '../../hooks/useAnexos'
import type { ContaPagar } from '../../types/financeiro'

// ── SyncBar ───────────────────────────────────────────────────────────────────

function SyncBar({ isDark }: { isDark: boolean }) {
  const { data: config } = useOmieConfig()
  const { data: log, isLoading } = useLastSync('contas_pagar')
  const trigger = useTriggerSync('contas_pagar')

  const webhookUrl = config?.n8n_webhook_url ?? ''
  const omieEnabled = config?.omie_enabled === 'true'
  if (!omieEnabled) return null

  const status = log?.status
  const isPending = trigger.isPending || status === 'running'

  const lastSyncText = log?.executado_em
    ? new Date(log.executado_em).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : 'Nunca sincronizado'

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
      {isLoading || isPending ? (
        <RefreshCw size={13} className="text-emerald-500 animate-spin shrink-0" />
      ) : status === 'success' ? (
        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
      ) : status === 'error' ? (
        <XCircle size={13} className="text-red-500 shrink-0" />
      ) : (
        <Zap size={13} className="text-emerald-400 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-emerald-700 leading-none">
          {isPending ? 'Sincronizando com Omie...' : 'Omie'}
        </p>
        <p className="text-[10px] text-emerald-600/70 mt-0.5">
          {isPending ? 'Aguarde a conclusão' : lastSyncText}
        </p>
      </div>
      <button
        onClick={() => webhookUrl && trigger.mutate({ webhookUrl })}
        disabled={isPending || !webhookUrl}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white
          text-[10px] font-bold hover:bg-emerald-700 transition-all shrink-0
          disabled:opacity-50 disabled:cursor-not-allowed">
        <RefreshCw size={10} className={isPending ? 'animate-spin' : ''} />
        {isPending ? 'Aguarde' : 'Sincronizar Omie'}
      </button>
    </div>
  )
}

// ── AnexoRow ──────────────────────────────────────────────────────────────────

function AnexoIcon({ mime }: { mime: string | null }) {
  if (!mime) return <Paperclip size={13} className="text-slate-400" />
  if (mime === 'application/pdf') return <FileText size={13} className="text-red-500" />
  if (mime.startsWith('image/')) return <FileText size={13} className="text-blue-500" />
  if (mime.includes('sheet') || mime.includes('excel')) return <FileText size={13} className="text-green-600" />
  return <Paperclip size={13} className="text-slate-400" />
}

function AnexosList({ pedidoId }: { pedidoId: string }) {
  const { data: anexos, isLoading } = useAnexosPedido(pedidoId)

  if (isLoading) return (
    <div className="flex justify-center py-3">
      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!anexos?.length) return (
    <p className="text-[11px] text-slate-400 italic py-2">Nenhum anexo enviado ainda.</p>
  )

  return (
    <div className="space-y-1.5">
      {anexos.map((a: PedidoAnexo) => {
        const isComprovante = a.tipo === 'comprovante_pagamento'
        return (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:shadow-sm group ${
              isComprovante
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <AnexoIcon mime={a.mime_type} />
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-semibold truncate ${isComprovante ? 'text-emerald-700' : 'text-slate-700'}`}>
                {a.nome_arquivo}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${
                  isComprovante ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {TIPO_LABEL[a.tipo]}
                </span>
                <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-semibold ${
                  a.origem === 'financeiro' ? 'bg-purple-100 text-purple-600' : 'bg-teal-100 text-teal-600'
                }`}>
                  {a.origem === 'financeiro' ? 'Financeiro' : 'Compras'}
                </span>
                <span className="text-[9px] text-slate-400">
                  {new Date(a.uploaded_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
            <ExternalLink size={11} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
          </a>
        )
      })}
    </div>
  )
}

// ── RegistrarPgtoModal ────────────────────────────────────────────────────────

interface RegistrarPgtoModalProps {
  cp: ContaPagar
  onClose: () => void
}

function RegistrarPgtoModal({ cp, onClose, isDark }: RegistrarPgtoModalProps & { isDark: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const uploadAnexo = useUploadAnexo()
  const registrarPag = useRegistrarPagamento()  // for cmp_pedidos (triggers fin_contas_pagar)
  const marcarCPPago = useMarcarCPPago()         // direct update of fin_contas_pagar

  const handleConfirm = async () => {
    setErro('')
    setLoading(true)
    try {
      // 1. Upload comprovante if a file was selected
      if (arquivo && cp.pedido_id) {
        await uploadAnexo.mutateAsync({
          pedidoId: cp.pedido_id,
          file: arquivo,
          tipo: 'comprovante_pagamento',
          observacao: observacao || undefined,
          origem: 'financeiro',
        })
      }

      // 2. Register payment
      if (cp.pedido_id) {
        // Via cmp_pedidos trigger chain
        await registrarPag.mutateAsync(cp.pedido_id)
      } else {
        // Direct CP update (Omie-imported or manual)
        await marcarCPPago.mutateAsync({ cpId: cp.id })
      }

      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar pagamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <Banknote size={18} className="text-emerald-600" />
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Registrar Pagamento</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* CP Summary */}
          <div className={`rounded-xl p-3 text-sm space-y-1 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{cp.fornecedor_nome}</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cp.descricao}</p>
            <p className="text-emerald-700 font-extrabold">
              {cp.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>

          {/* Comprovante upload */}
          {cp.pedido_id && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">
                Comprovante de Pagamento <span className="text-slate-400 font-normal">(opcional)</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className={`w-full flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed transition-all ${
                  arquivo
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50'
                }`}
              >
                <Upload size={20} className={arquivo ? 'text-emerald-500' : 'text-slate-400'} />
                <span className={`text-xs font-semibold ${arquivo ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {arquivo
                    ? `${arquivo.name} (${(arquivo.size / 1024).toFixed(0)} KB)`
                    : 'Clique para anexar comprovante'}
                </span>
              </button>

              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Observação sobre o pagamento (opcional)"
                rows={2}
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 text-xs
                  text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2
                  focus:ring-emerald-500/30 focus:border-emerald-400 resize-none"
              />
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{erro}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300 hover:bg-white/[0.03]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold
                hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <CheckCircle2 size={15} />}
              Confirmar Pagamento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; icon: typeof Clock }> = {
  previsto:       { label: 'Previsto',       dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600',    icon: Calendar },
  confirmado:     { label: 'Confirmado',     dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700',     icon: CheckCircle2 },
  em_lote:        { label: 'Em Lote',        dot: 'bg-violet-500',  bg: 'bg-violet-50',   text: 'text-violet-700',   icon: Receipt },
  aprovado_pgto:  { label: 'Pgto Aprovado',  dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700',  icon: CheckCircle2 },
  em_pagamento:   { label: 'Em Pagamento',   dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',    icon: Clock },
  pago:           { label: 'Pago',           dot: 'bg-teal-500',    bg: 'bg-teal-50',     text: 'text-teal-700',     icon: CheckCircle2 },
  conciliado:     { label: 'Conciliado',     dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700',    icon: CheckCircle2 },
  cancelado:      { label: 'Cancelado',      dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500',     icon: Clock },
}

const FILTROS_STATUS: { label: string; value: string }[] = [
  { label: 'Todos',           value: '' },
  { label: 'Previstos',       value: 'previsto' },
  { label: 'Confirmados',     value: 'confirmado' },
  { label: 'Em Lote',         value: 'em_lote' },
  { label: 'Aprovados',       value: 'aprovado_pgto' },
  { label: 'Pagos',           value: 'pago' },
  { label: 'Conciliados',     value: 'conciliado' },
]

// ── Issue #36: Dados bancarios/PIX do fornecedor ──────────────────────────────

function FornecedorPagamentoInfo({ fornecedorId, isDark }: { fornecedorId: string; isDark: boolean }) {
  const { data: forn, isLoading } = useFornecedorById(fornecedorId)

  if (isLoading) {
    return (
      <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-blue-50/60'}`}>
        <p className="text-[10px] text-slate-400 animate-pulse">Carregando dados bancarios...</p>
      </div>
    )
  }

  if (!forn) return null
  const hasBankData = forn.banco_nome || forn.agencia || forn.conta || forn.pix_chave
  if (!hasBankData) return null

  return (
    <div className={`rounded-xl p-3 space-y-1.5 ${isDark ? 'bg-white/[0.04]' : 'bg-blue-50/60'}`}>
      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
        <Banknote size={10} /> Dados de Pagamento do Fornecedor
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {forn.razao_social && (
          <div className="col-span-2">
            <span className="text-slate-400">Razao Social:</span>{' '}
            <span className="font-semibold text-slate-700">{forn.razao_social}</span>
          </div>
        )}
        {forn.cnpj && (
          <div>
            <span className="text-slate-400">CNPJ:</span>{' '}
            <span className="font-mono text-slate-600">{forn.cnpj}</span>
          </div>
        )}
        {forn.banco_nome && (
          <div>
            <span className="text-slate-400">Banco:</span>{' '}
            <span className="font-semibold text-slate-700">{forn.banco_nome}</span>
          </div>
        )}
        {forn.agencia && (
          <div>
            <span className="text-slate-400">Agencia:</span>{' '}
            <span className="font-mono text-slate-700">{forn.agencia}</span>
          </div>
        )}
        {forn.conta && (
          <div>
            <span className="text-slate-400">Conta:</span>{' '}
            <span className="font-mono text-slate-700">{forn.conta}</span>
          </div>
        )}
        {forn.pix_chave && (
          <div className="col-span-2">
            <span className="text-slate-400">PIX ({forn.pix_tipo || 'chave'}):</span>{' '}
            <span className="font-mono text-blue-700 font-semibold">{forn.pix_chave}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CPCard ────────────────────────────────────────────────────────────────────

function CPCard({ cp, onRegistrarPgto, onAprovarPgto, isDark }: {
  cp: ContaPagar
  onRegistrarPgto: (cp: ContaPagar) => void
  onAprovarPgto: (cp: ContaPagar) => void
  isDark: boolean
}) {
  const nav = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const vencido = !['pago', 'conciliado', 'cancelado'].includes(cp.status) &&
    new Date(cp.data_vencimento + 'T00:00:00') < new Date()
  const isPago = ['pago', 'conciliado'].includes(cp.status)
  const canApprove = cp.status === 'confirmado'
  const canPay = cp.status === 'aprovado_pgto'
  const cfg = STATUS_CONFIG[cp.status]

  // Dados enriquecidos via JOINs
  const pedidoNum = cp.pedido?.numero_pedido
  const reqNum = cp.requisicao?.numero
  const obraNome = cp.requisicao?.obra_nome
  const categoria = cp.requisicao?.categoria
  const classeFinanceira = cp.classe_financeira || cp.requisicao?.classe_financeira
  const centroCusto = cp.centro_custo || cp.requisicao?.centro_custo

  return (
    <div className={`rounded-2xl border shadow-sm transition-all hover:shadow-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'} ${
      vencido ? 'border-red-200' : isPago ? 'border-emerald-200' : canApprove ? 'border-orange-200' : isDark ? 'border-white/[0.06]' : 'border-slate-200'
    }`}>
      {/* Main content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            vencido ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : isPago ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : canApprove ? (isDark ? 'bg-orange-500/10' : 'bg-orange-50') : (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50')
          }`}>
            {vencido
              ? <AlertTriangle size={16} className="text-red-500" />
              : isPago
                ? <CheckCircle2 size={16} className="text-emerald-600" />
                : canApprove
                  ? <ShieldCheck size={16} className="text-orange-500" />
                  : <Receipt size={16} className="text-emerald-600" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cp.fornecedor_nome}</p>
              <p className={`text-sm font-extrabold shrink-0 ${vencido ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt(cp.valor_original)}
              </p>
            </div>

            {/* Status + badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${cfg?.bg} ${cfg?.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                {cfg?.label ?? cp.status}
              </span>
              {/* Origem badge */}
              {cp.origem === 'logistica' && (
                <span className="inline-flex items-center gap-0.5 bg-purple-50 text-purple-600 font-semibold rounded-full px-2 py-0.5">
                  <Truck size={9} /> Logística
                </span>
              )}
              {cp.origem === 'compras' && pedidoNum && (
                <span className="inline-flex items-center gap-0.5 bg-sky-50 text-sky-600 font-semibold rounded-full px-2 py-0.5">
                  <Package size={9} /> Compras
                </span>
              )}
              {pedidoNum && cp.pedido_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); nav(`/pedidos?pedido=${cp.pedido_id}`) }}
                  className="inline-flex items-center gap-0.5 bg-teal-50 text-teal-700 font-semibold rounded-full px-2 py-0.5 hover:bg-teal-100 hover:ring-1 hover:ring-teal-300 transition-all cursor-pointer"
                >
                  <FileText size={9} /> {pedidoNum}
                </button>
              )}
              {reqNum && (
                <span className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-600 font-semibold rounded-full px-2 py-0.5">
                  <Hash size={9} /> {reqNum}
                </span>
              )}
              {cp.natureza && (
                <span className="text-slate-400">{cp.natureza}</span>
              )}
            </div>

            {/* Descrição */}
            {cp.descricao && (
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1">{cp.descricao}</p>
            )}

            {/* Observações / Alerta de divergência */}
            {cp.observacoes && (
              <div className={`flex items-start gap-1.5 mt-1.5 px-2 py-1 rounded-lg text-[10px] ${
                cp.observacoes.includes('Divergência')
                  ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'
              }`}>
                {cp.observacoes.includes('Divergência') && <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />}
                <span className="font-medium">{cp.observacoes}</span>
              </div>
            )}

            {/* Detalhes: obra, categoria, classe, CC */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                Venc. {fmtData(cp.data_vencimento)}
              </span>
              {obraNome && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Building2 size={9} /> {obraNome}
                </span>
              )}
              {categoria && (
                <span className="flex items-center gap-1">
                  <Tag size={9} /> {categoria.replace(/_/g, ' ')}
                </span>
              )}
              {centroCusto && (
                <span className="flex items-center gap-1 font-medium text-slate-500">
                  <Briefcase size={9} /> CC: {centroCusto}
                </span>
              )}
              {classeFinanceira && (
                <span className="text-violet-500 font-medium">
                  {classeFinanceira}
                </span>
              )}
              {cp.data_pagamento && (
                <span className="text-emerald-600 font-medium">
                  Pago em {fmtData(cp.data_pagamento)}
                </span>
              )}
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-500
                hover:bg-slate-100 transition-all"
            >
              <Paperclip size={11} />
              Detalhes
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => onAprovarPgto(cp)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                bg-orange-500 text-white text-[11px] font-bold hover:bg-orange-600 transition-all
                shadow-sm shadow-orange-500/20"
            >
              <ShieldCheck size={12} />
              Autorizar Pagamento
            </button>
          )}
          {canPay && !isPago && (
            <button
              onClick={() => onRegistrarPgto(cp)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-all"
            >
              <Banknote size={11} />
              Registrar Pagamento
            </button>
          )}
        </div>
      </div>

      {/* Expanded: Details + Attachments */}
      {expanded && (
        <div className={`border-t px-4 pb-4 pt-3 space-y-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          {/* Detalhes do pedido/requisição ou logística */}
          {(pedidoNum || reqNum || obraNome || centroCusto || classeFinanceira || cp.origem === 'logistica') && (
            <div className={`rounded-xl p-3 space-y-1.5 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                {cp.origem === 'logistica' ? <><Truck size={10} className="text-purple-500" /> Origem: Logística</> : 'Detalhes'}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {cp.origem === 'logistica' && cp.descricao && (
                  <div className="col-span-2">
                    <span className="text-slate-400">Descrição:</span>{' '}
                    <span className="font-semibold text-slate-700">{cp.descricao}</span>
                  </div>
                )}
                {cp.natureza && cp.origem === 'logistica' && (
                  <div>
                    <span className="text-slate-400">Natureza:</span>{' '}
                    <span className="font-semibold text-purple-600">{cp.natureza}</span>
                  </div>
                )}
                {pedidoNum && cp.pedido_id && (
                  <div>
                    <span className="text-slate-400">Pedido:</span>{' '}
                    <button
                      onClick={() => nav(`/pedidos?pedido=${cp.pedido_id}`)}
                      className="font-semibold text-teal-700 underline decoration-teal-300 hover:text-teal-800 hover:decoration-teal-500 transition-colors"
                    >
                      {pedidoNum}
                    </button>
                  </div>
                )}
                {reqNum && (
                  <div><span className="text-slate-400">RC:</span> <span className="font-semibold text-indigo-600">{reqNum}</span></div>
                )}
                {obraNome && (
                  <div><span className="text-slate-400">Obra:</span> <span className="font-semibold text-slate-700">{obraNome}</span></div>
                )}
                {categoria && (
                  <div><span className="text-slate-400">Categoria:</span> <span className="font-medium text-slate-600">{categoria.replace(/_/g, ' ')}</span></div>
                )}
                {centroCusto && (
                  <div><span className="text-slate-400">Centro Custo:</span> <span className="font-semibold text-slate-700">{centroCusto}</span></div>
                )}
                {classeFinanceira && (
                  <div><span className="text-slate-400">Classe Fin.:</span> <span className="font-semibold text-violet-600">{classeFinanceira}</span></div>
                )}
                {cp.pedido?.data_prevista_entrega && (
                  <div><span className="text-slate-400">Prev. Entrega:</span> <span className="font-medium text-slate-600">{fmtData(cp.pedido.data_prevista_entrega)}</span></div>
                )}
                {cp.numero_documento && (
                  <div><span className="text-slate-400">Doc:</span> <span className="font-mono text-slate-600">{cp.numero_documento}</span></div>
                )}
                {cp.data_emissao && (
                  <div><span className="text-slate-400">Emissão:</span> <span className="font-medium text-slate-600">{fmtData(cp.data_emissao)}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Observações expandidas */}
          {cp.observacoes && (
            <div className={`rounded-xl p-3 space-y-1 ${
              cp.observacoes.includes('Divergência')
                ? 'bg-amber-50 border border-amber-200'
                : isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                cp.observacoes.includes('Divergência') ? 'text-amber-600' : 'text-slate-400'
              }`}>
                {cp.observacoes.includes('Divergência') && <AlertTriangle size={10} />}
                Observações
              </p>
              <p className={`text-[11px] font-medium ${
                cp.observacoes.includes('Divergência') ? 'text-amber-700' : isDark ? 'text-slate-300' : 'text-slate-600'
              }`}>{cp.observacoes}</p>
            </div>
          )}

          {/* Issue #36: Dados bancarios/PIX do fornecedor */}
          {cp.fornecedor_id && (
            <FornecedorPagamentoInfo fornecedorId={cp.fornecedor_id} isDark={isDark} />
          )}

          {/* Anexos */}
          {cp.pedido_id && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Paperclip size={11} />
                  Anexos
                </p>
                {canApprove && (
                  <button
                    onClick={() => onAprovarPgto(cp)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white
                      text-[10px] font-bold hover:bg-orange-600 transition-all"
                  >
                    <ShieldCheck size={10} />
                    Autorizar Pgto
                  </button>
                )}
                {canPay && !isPago && (
                  <button
                    onClick={() => onRegistrarPgto(cp)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white
                      text-[10px] font-bold hover:bg-emerald-700 transition-all"
                  >
                    <Banknote size={10} />
                    Registrar Pagamento
                  </button>
                )}
              </div>
              <AnexosList pedidoId={cp.pedido_id} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── ContasPagar (main page) ───────────────────────────────────────────────────

export default function ContasPagar() {
  const { isDark } = useTheme()
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [pgtoModal, setPgtoModal] = useState<ContaPagar | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const { data: contas = [], isLoading, error: cpError } = useContasPagar(
    statusFilter ? { status: statusFilter } : undefined
  )
  const aprovarMutation = useAprovarPagamento()

  const handleAprovarPgto = (cp: ContaPagar) => {
    if (!confirm(`Autorizar pagamento de ${fmt(cp.valor_original)} para ${cp.fornecedor_nome}?`)) return
    aprovarMutation.mutate({ cpId: cp.id }, {
      onSuccess: () => {
        setToast({ type: 'success', msg: `Pagamento autorizado ✓ — ${cp.fornecedor_nome}` })
        setTimeout(() => setToast(null), 4000)
      },
      onError: () => {
        setToast({ type: 'error', msg: 'Erro ao autorizar pagamento' })
        setTimeout(() => setToast(null), 5000)
      },
    })
  }

  const filtered = contas.filter(cp => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return cp.fornecedor_nome.toLowerCase().includes(b)
      || cp.descricao?.toLowerCase().includes(b)
      || cp.numero_documento?.toLowerCase().includes(b)
      || cp.observacoes?.toLowerCase().includes(b)
      || cp.origem?.toLowerCase().includes(b)
  })

  const totalAberto = filtered
    .filter(cp => !['pago', 'conciliado', 'cancelado'].includes(cp.status))
    .reduce((s, cp) => s + cp.valor_original, 0)
  const totalPago = filtered
    .filter(cp => ['pago', 'conciliado'].includes(cp.status))
    .reduce((s, cp) => s + cp.valor_pago, 0)

  return (
    <div className="space-y-5">

      {/* Toast feedback */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────── */}
      {cpError && (
        <div className={`border rounded-2xl p-4 text-center ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <p className="text-red-600 text-sm font-semibold">Erro ao carregar pagamentos</p>
          <p className="text-red-400 text-xs mt-1">{cpError instanceof Error ? cpError.message : 'Erro desconhecido'}</p>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <Receipt size={20} className="text-emerald-600" />
          Contas a Pagar
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Gestão de pagamentos e obrigações</p>
      </div>

      {/* ── Omie Sync Status ─────────────────────────────────── */}
      <SyncBar isDark={isDark} />

      {/* ── Resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</p>
          <p className={`text-lg font-extrabold mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{filtered.length}</p>
          <p className="text-[10px] text-slate-400">títulos</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-widest">Em Aberto</p>
          <p className="text-lg font-extrabold text-amber-600 mt-1">{fmt(totalAberto)}</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Pago</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-1">{fmt(totalPago)}</p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, documento..."
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
              ${isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {FILTROS_STATUS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
                ${statusFilter === f.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark ? 'bg-[#1e293b] text-slate-400 border border-white/[0.06]' : 'bg-white text-slate-500 border border-slate-200'
                }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <Receipt size={28} className="text-emerald-300" />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma conta encontrada</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>As contas a pagar aparecerão aqui quando criadas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cp => (
            <CPCard key={cp.id} cp={cp} onRegistrarPgto={setPgtoModal} onAprovarPgto={handleAprovarPgto} isDark={isDark} />
          ))}
        </div>
      )}

      {/* ── Modal: Registrar Pagamento ───────────────────────── */}
      {pgtoModal && (
        <RegistrarPgtoModal
          cp={pgtoModal}
          onClose={() => setPgtoModal(null)}
          isDark={isDark}
        />
      )}
    </div>
  )
}
