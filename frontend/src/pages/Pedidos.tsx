import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Package, Truck, CheckCircle, Clock, AlertTriangle,
  FileText, Share2, Download, MessageCircle, Mail, Upload, X, Paperclip,
  Banknote, ExternalLink, Loader2,
  Search, LayoutList, LayoutGrid, ArrowUp, ArrowDown,
  ClipboardList, ShieldCheck, BoxIcon, ArchiveIcon,
  Building2, Link2, RefreshCw, UserPlus,
  Tag, Briefcase, Hash, Calendar, Receipt, CheckCircle2, ChevronDown, ChevronUp,
  ShoppingCart,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import jsPDF from 'jspdf'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import AuditoriaCard from '../components/AuditoriaCard'
import { useBases } from '../hooks/useEstoque'
import {
  usePedidos,
  useAtualizarPedido,
  useLiberarPagamento,
  useEmitirPedido,
  type ImpostoPayload,
} from '../hooks/usePedidos'
import { useCadFornecedores } from '../hooks/useCadastros'
import { useCotacoes } from '../hooks/useCotacoes'
import {
  buildFornecedorPrefillFromCotacao,
  formatCNPJ,
  getFornecedorPaymentMissingFields,
  hasFornecedorPaymentData,
  useFornecedorCotacaoResolver,
} from '../hooks/useFornecedorVinculo'
import { api } from '../services/api'
import { supabase } from '../services/supabase'
import { useAnexosPedido, useUploadAnexo, useCotacaoDocs, TIPO_LABEL } from '../hooks/useAnexos'
import type { PedidoAnexo } from '../hooks/useAnexos'
import FluxoTimeline from '../components/FluxoTimeline'
import RecebimentoModal from '../components/RecebimentoModal'
import EmitirPedidoModal from '../components/EmitirPedidoModal'
import FornecedorCadastroModal from '../components/FornecedorCadastroModal'
import PedidoImpostosSection from '../components/PedidoImpostosSection'
import { AnexoReferencia } from '../components/AnexoReferencia'
import type { Cotacao, Pedido } from '../types'
import type { Fornecedor } from '../types/financeiro'

// ─── Types ────────────────────────────────────────────────────────────────────

type PipelineTab = 'pendente' | 'emitido' | 'entregue' | 'encerrado'
type SortField = 'data' | 'valor' | 'fornecedor'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'
type PedidoListItem = Pedido & {
  pending_emissao?: boolean
  source_cotacao?: Pick<Cotacao, 'id' | 'comprador_id'>
}

function SolicitarContratoForm({ valorMensal, pedido, onSuccess }: {
  valorMensal: number
  pedido: PedidoListItem
  onSuccess: () => void
}) {
  const [prazoMeses, setPrazoMeses] = useState(12)
  const [enviando, setEnviando] = useState(false)
  const valorTotal = valorMensal * prazoMeses

  const handleSolicitar = async () => {
    if (prazoMeses < 1) return
    setEnviando(true)
    try {
      const { data: result, error: solErr } = await supabase.rpc('con_criar_solicitacao', {
        p_payload: {
          objeto: pedido.requisicao?.descricao || 'Contrato recorrente',
          solicitante_nome: (pedido.requisicao as any)?.solicitante_nome || 'Solicitante',
          tipo_contraparte: 'fornecedor',
          contraparte_nome: pedido.fornecedor_nome || 'A definir',
          tipo_contrato: 'despesa',
          categoria_contrato: 'prestacao_servico',
          grupo_contrato: 'prestacao_servicos',
          obra_id: (pedido.requisicao as any)?.obra_id || null,
          valor_estimado: valorTotal,
          valor_mensal: valorMensal,
          prazo_meses: prazoMeses,
          recorrente: true,
          etapa_atual: 'solicitacao',
          status: 'em_andamento',
          requisicao_origem_id: pedido.requisicao_id,
        },
      })
      if (solErr) throw solErr
      if (!(result as any)?.ok) throw new Error((result as any)?.erro || 'falha ao criar solicitação')
      // Captura erro de RLS / outro — se a RC nao for atualizada, o usuario
      // precisa saber para corrigir manualmente (antes ficava silencioso)
      const { error: updErr, data: updData } = await supabase
        .from('cmp_requisicoes')
        .update({ status: 'aguardando_contrato' })
        .eq('id', pedido.requisicao_id)
        .select('id')
      if (updErr) throw new Error(`Solicitacao criada, mas falhou ao atualizar a RC: ${updErr.message}`)
      if (!updData || updData.length === 0) {
        throw new Error('Solicitacao criada, mas a RC nao foi atualizada (sem permissao ou RC nao encontrada). Avise o administrador.')
      }
      onSuccess()
    } catch (err: any) {
      alert(`Erro: ${err?.message || 'falha ao criar solicitação'}`)
      setEnviando(false)
    }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-3">
      <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 space-y-2.5">
        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Contrato Recorrente</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-indigo-500 font-semibold">Valor Mensal</label>
            <p className="text-sm font-extrabold text-indigo-700">{fmt(valorMensal)}</p>
          </div>
          <div>
            <label className="text-[10px] text-indigo-500 font-semibold block mb-1">Prazo (meses)</label>
            <input
              type="number" min={1} max={120}
              value={prazoMeses}
              onChange={e => setPrazoMeses(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-indigo-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-indigo-800 bg-white focus:ring-2 focus:ring-indigo-300 outline-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-indigo-200">
          <span className="text-[10px] text-indigo-500 font-semibold">Valor Total do Contrato</span>
          <span className="text-sm font-extrabold text-indigo-800">{fmt(valorTotal)}</span>
        </div>
        <p className="text-[10px] text-indigo-400">{fmt(valorMensal)}/mês × {prazoMeses} meses</p>
      </div>
      <button
        onClick={handleSolicitar}
        disabled={enviando || prazoMeses < 1}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition-all bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 disabled:opacity-50"
      >
        {enviando
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <FileText size={16} />}
        {enviando ? 'Criando...' : 'Solicitar Contrato'}
      </button>
    </div>
  )
}

function FornecedorSelectorModal({
  open,
  dark,
  fornecedores,
  selectedId,
  onClose,
  onSelect,
}: {
  open: boolean
  dark: boolean
  fornecedores: Fornecedor[]
  selectedId?: string | null
  onClose: () => void
  onSelect: (fornecedor: Fornecedor) => void
}) {
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (!open) setBusca('')
  }, [open])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return fornecedores
    const termoCnpj = termo.replace(/\D/g, '')
    return fornecedores.filter((fornecedor) => {
      const cnpj = fornecedor.cnpj?.replace(/\D/g, '') ?? ''
      return fornecedor.razao_social.toLowerCase().includes(termo)
        || fornecedor.nome_fantasia?.toLowerCase().includes(termo)
        || (termoCnpj.length > 0 && cnpj.includes(termoCnpj))
    })
  }, [fornecedores, busca])

  if (!open) return null

  const bg = dark ? 'bg-[#0f172a]' : 'bg-white'
  const border = dark ? 'border-white/10' : 'border-slate-200'
  const text = dark ? 'text-white' : 'text-slate-800'
  const subtext = dark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className={`${bg} w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl border ${border}`}>
        <div className={`sticky top-0 z-10 ${bg} px-6 py-4 border-b ${border} flex items-center justify-between gap-3`}>
          <div>
            <p className={`text-base font-bold ${text}`}>Selecionar outro fornecedor</p>
            <p className={`text-xs mt-0.5 ${subtext}`}>Escolha o cadastro mestre que deve ficar vinculado ao pedido.</p>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por razão social ou CNPJ"
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm ${dark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
            />
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {filtrados.map((fornecedor) => {
              const selected = selectedId === fornecedor.id
              const paymentReady = hasFornecedorPaymentData(fornecedor)
              return (
                <button
                  key={fornecedor.id}
                  type="button"
                  onClick={() => onSelect(fornecedor)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    selected
                      ? 'border-teal-400 bg-teal-50'
                      : dark
                        ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                        : 'border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${dark && !selected ? 'text-white' : 'text-slate-800'}`}>{fornecedor.razao_social}</p>
                      <p className={`text-[11px] mt-0.5 ${dark && !selected ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formatCNPJ(fornecedor.cnpj) || 'CNPJ não informado'}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${paymentReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {paymentReady ? 'Pagamento OK' : 'Dados pendentes'}
                    </span>
                  </div>
                </button>
              )
            })}

            {filtrados.length === 0 && (
              <div className={`rounded-2xl border p-6 text-center ${dark ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                Nenhum fornecedor encontrado com esse filtro.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v?: number) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const fmtDataISO = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

function diasRestantes(data?: string): number | null {
  if (!data) return null
  return Math.round((new Date(data + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
}

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const PIPELINE_STAGES: {
  key: PipelineTab
  label: string
  icon: typeof Package
  matchFn: (p: PedidoListItem) => boolean
}[] = [
  {
    key: 'pendente',
    label: 'Pedidos Aprovados',
    icon: ClipboardList,
    matchFn: p => isPendingEmission(p),
  },
  {
    key: 'emitido',
    label: 'Emitido',
    icon: Truck,
    matchFn: p => !isPendingEmission(p) && ['emitido', 'confirmado', 'em_entrega'].includes(p.status) && (p as any).status_pagamento !== 'liberado' && (p as any).status_pagamento !== 'pago',
  },
  {
    key: 'entregue',
    label: 'Entregue',
    icon: BoxIcon,
    matchFn: p => !isPendingEmission(p) && (p.status === 'entregue' || p.status === 'parcialmente_recebido') && (p as any).status_pagamento !== 'liberado' && (p as any).status_pagamento !== 'pago',
  },
  {
    key: 'encerrado',
    label: 'Encerrado',
    icon: ArchiveIcon,
    matchFn: p => !isPendingEmission(p) && ['liberado', 'pago'].includes((p as any).status_pagamento),
  },
]

const STATUS_ACCENT: Record<PipelineTab, { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }> = {
  pendente:  { bg: 'hover:bg-cyan-50',    bgActive: 'bg-cyan-50',    text: 'text-cyan-600',    textActive: 'text-cyan-800',    badge: 'bg-cyan-100 text-cyan-700',       border: 'border-cyan-400' },
  emitido:   { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    badge: 'bg-blue-100 text-blue-700',       border: 'border-blue-500' },
  entregue:  { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-500' },
  encerrado: { bg: 'hover:bg-slate-50',   bgActive: 'bg-slate-100',  text: 'text-slate-500',   textActive: 'text-slate-700',   badge: 'bg-slate-200 text-slate-600',     border: 'border-slate-400' },
}

const STATUS_ACCENT_DARK: Record<PipelineTab, { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }> = {
  pendente:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-cyan-500/10',    text: 'text-cyan-400',    textActive: 'text-cyan-300',    badge: 'bg-cyan-500/20 text-cyan-300',       border: 'border-cyan-500/40' },
  emitido:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300',    badge: 'bg-blue-500/20 text-blue-300',       border: 'border-blue-500/40' },
  entregue:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/40' },
  encerrado: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-white/[0.06]',   text: 'text-slate-400',   textActive: 'text-slate-300',   badge: 'bg-white/[0.08] text-slate-300',     border: 'border-white/[0.08]' },
}

const statusConfig: Record<string, { bg: string; text: string; label: string; bgDark: string; textDark: string }> = {
  emitido:               { bg: 'bg-cyan-100',    text: 'text-cyan-700',    label: 'Emitido',    bgDark: 'bg-cyan-900/40',    textDark: 'text-cyan-300' },
  confirmado:            { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Confirmado', bgDark: 'bg-blue-900/40',    textDark: 'text-blue-300' },
  em_entrega:            { bg: 'bg-teal-100',    text: 'text-teal-700',    label: 'Em Entrega', bgDark: 'bg-teal-900/40',    textDark: 'text-teal-300' },
  parcialmente_recebido: { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Parcial',    bgDark: 'bg-amber-900/40',   textDark: 'text-amber-300' },
  entregue:              { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Entregue',   bgDark: 'bg-emerald-900/40', textDark: 'text-emerald-300' },
  cancelado:             { bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Cancelado',  bgDark: 'bg-gray-800',       textDark: 'text-gray-400' },
}

const pendingEmissionStatus = {
  bg: 'bg-amber-100',
  text: 'text-amber-700',
  label: 'Pedido Aprovado',
  bgDark: 'bg-amber-900/40',
  textDark: 'text-amber-300',
}

const aguardandoContratoStatus = {
  bg: 'bg-indigo-100',
  text: 'text-indigo-700',
  label: 'Aguard. Contrato',
  bgDark: 'bg-indigo-900/40',
  textDark: 'text-indigo-300',
}

function isPendingEmission(pedido: PedidoListItem) {
  return pedido.pending_emissao === true
}

function isAguardandoContrato(pedido: PedidoListItem) {
  return (pedido as any).aguardando_contrato === true
}

const contratoAtivoStatus = {
  bg: 'bg-violet-100',
  text: 'text-violet-700',
  label: 'Contrato Ativo',
  bgDark: 'bg-violet-900/40',
  textDark: 'text-violet-300',
}

function getStatusMeta(pedido: PedidoListItem) {
  if ((pedido as any).contrato_ativo) return contratoAtivoStatus
  if (isAguardandoContrato(pedido)) return aguardandoContratoStatus
  if (isPendingEmission(pedido)) {
    // Recorrente em emissão vai para Contrato (Solicitar Contrato), não vira Pedido.
    // Rotular como "Pedido Aprovado" engana — usa o badge de contrato.
    if ((pedido.requisicao as any)?.compra_recorrente) return aguardandoContratoStatus
    return pendingEmissionStatus
  }
  return statusConfig[pedido.status] || statusConfig.emitido
}

function getDisplayNumber(pedido: PedidoListItem) {
  if (pedido.numero_pedido) return `#${pedido.numero_pedido}`
  if (pedido.requisicao?.numero) return pedido.requisicao.numero
  return `#${pedido.id.slice(0, 8).toUpperCase()}`
}

// ─── PDF / Share helpers ──────────────────────────────────────────────────────

import { getEmpresa, EMPRESA_FALLBACK } from '../services/empresa'
import type { EmpresaData } from '../services/empresa'

const fmtBRL = (v?: number) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtDate = (d?: string) => d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

// Rateia o valor_total negociado do pedido proporcionalmente ao valor_unitario_estimado
// original de cada item, devolvendo o preco unitario efetivo por item. Quando a cotacao
// negocia so o total (sem precos por item), evita que a tabela de itens exiba o preco
// inicial enquanto o cabecalho mostra o negociado.
function calcUnitariosEfetivos<T extends { quantidade: number; valor_unitario_estimado: number }>(
  itens: T[],
  valorTotalNegociado?: number | null,
): number[] {
  const somaEstimados = itens.reduce((s, i) => s + (i.quantidade ?? 0) * (i.valor_unitario_estimado ?? 0), 0)
  if (!valorTotalNegociado || somaEstimados <= 0 || Math.abs(somaEstimados - valorTotalNegociado) < 0.01) {
    return itens.map(i => i.valor_unitario_estimado ?? 0)
  }
  return itens.map(i => {
    const subtotalEstimado = (i.quantidade ?? 0) * (i.valor_unitario_estimado ?? 0)
    const peso = subtotalEstimado / somaEstimados
    const subtotalNegociado = peso * valorTotalNegociado
    return (i.quantidade ?? 0) > 0 ? subtotalNegociado / i.quantidade : 0
  })
}

function buildPdfHtml(pedido: Pedido, EMPRESA: EmpresaData = EMPRESA_FALLBACK): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c))
  const numero = esc(pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase())
  const rcItens = pedido.requisicao?.itens ?? []
  // Pedido Direto (sem RC) guarda itens em cmp_pedidos.itens_direto. Mapeia
  // para o mesmo shape de RequisicaoItem para reaproveitar o render abaixo.
  const itens = rcItens.length > 0
    ? rcItens
    : (pedido.itens_direto ?? []).map(it => ({
        descricao: it.descricao,
        quantidade: it.quantidade,
        unidade: it.unidade,
        valor_unitario_estimado: it.valor_unitario,
      }))
  const parcelas = pedido.parcelas_preview ?? []

  const unitariosHtml = calcUnitariosEfetivos(itens, pedido.valor_total)
  const itensHtml = itens.length > 0 ? `
    <div class="section">
      <div class="section-title">Itens do Pedido</div>
      <table>
        <thead>
          <tr><th style="width:5%">#</th><th style="width:50%">Descricao</th><th style="width:10%">Qtd</th><th style="width:10%">Un</th><th style="width:12%">Vl. Unit.</th><th style="width:13%">Subtotal</th></tr>
        </thead>
        <tbody>
          ${itens.map((item, i) => `
            <tr>
              <td style="text-align:center">${i + 1}</td>
              <td>${esc(item.descricao)}${(item as any).descricao_complementar ? `<br><span style="font-size:10px;color:#475569;font-style:italic">${esc((item as any).descricao_complementar)}</span>` : ''}</td>
              <td style="text-align:center">${item.quantidade}</td>
              <td style="text-align:center">${esc(item.unidade)}</td>
              <td style="text-align:right">${fmtBRL(unitariosHtml[i])}</td>
              <td style="text-align:right;font-weight:600">${fmtBRL(item.quantidade * unitariosHtml[i])}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="5" style="text-align:right;font-weight:700">TOTAL</td>
            <td style="text-align:right;font-weight:900;color:#0d9488">${fmtBRL(pedido.valor_total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  ` : ''

  const labelParcela = (p: typeof parcelas[number]) => {
    const desc = (p.descricao || '').trim()
    if (!desc || desc.toLowerCase() === 'revisar manualmente') {
      return parcelas.length === 1 ? 'Parcela única' : `Parcela ${p.numero}/${parcelas.length}`
    }
    return desc
  }
  const parcelasHtml = parcelas.length > 0 ? `
    <div class="section">
      <div class="section-title">Condicao de Pagamento${pedido.condicao_pagamento ? `: ${esc(pedido.condicao_pagamento)}` : ''}</div>
      <table>
        <thead>
          <tr><th style="width:10%">Parcela</th><th style="width:45%">Descricao</th><th style="width:25%">Vencimento</th><th style="width:20%">Valor</th></tr>
        </thead>
        <tbody>
          ${parcelas.map(p => `
            <tr>
              <td style="text-align:center">${p.numero}</td>
              <td>${esc(labelParcela(p))}</td>
              <td style="text-align:center">${fmtDate(p.data_vencimento)}</td>
              <td style="text-align:right;font-weight:600">${fmtBRL(p.valor)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>PC_${numero}_${esc(pedido.fornecedor_nome).replace(/[^a-zA-Z0-9À-ÿ _-]/g, '').trim().replace(/\s+/g, '_').slice(0, 40)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 12px; }
  .page { max-width: 800px; margin: 0 auto; padding: 30px 40px; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #1e293b; border-radius: 12px; margin-bottom: 20px; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .header-left img { height: 50px; }
  .company-name { font-size: 11px; font-weight: 700; color: #e2e8f0; }
  .company-cnpj { font-size: 9px; color: #94a3b8; margin-top: 2px; }
  .header-right { text-align: right; }
  .doc-title { font-size: 18px; font-weight: 900; color: #2dd4bf; }
  .doc-number { font-size: 13px; font-weight: 700; color: #e2e8f0; margin-top: 2px; }
  .doc-date { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 11px; font-weight: 700; color: #0d9488; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 12px; }
  .field .label { font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .field .value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 1px; }
  .field .value.big { font-size: 18px; font-weight: 900; color: #0d9488; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 6px 8px; border-bottom: 2px solid #e2e8f0; font-size: 9px; text-transform: uppercase; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  .total-row td { border-top: 2px solid #e2e8f0; padding-top: 8px; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #e2e8f0; text-align: center; }
  .footer p { font-size: 9px; color: #94a3b8; line-height: 1.5; }
  .footer .disclaimer { font-size: 8px; color: #cbd5e1; margin-top: 4px; }
  @media print {
    body { padding: 0; }
    .page { padding: 20px; }
    button { display: none !important; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head>
<body><div class="page">
  <div class="header">
    <div class="header-left">
      <img src="${EMPRESA.logoUrl}" alt="TEG+" />
      <div>
        <div class="company-name">${esc(EMPRESA.fantasia)}</div>
        <div class="company-cnpj">CNPJ: ${EMPRESA.cnpj}</div>
        ${EMPRESA.endereco ? `<div class="company-cnpj">${esc(EMPRESA.endereco)}${EMPRESA.cidade ? ` - ${esc(EMPRESA.cidade)}/${EMPRESA.uf ?? ''}` : ''}</div>` : ''}
        ${EMPRESA.telefone ? `<div class="company-cnpj">${esc(EMPRESA.telefone)}${EMPRESA.email ? ` | ${esc(EMPRESA.email)}` : ''}</div>` : ''}
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">PEDIDO DE COMPRA</div>
      <div class="doc-number">#${numero}</div>
      <div class="doc-date">Emitido em ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Dados do Pedido</div>
    <div class="fields">
      <div class="field"><div class="label">Fornecedor</div><div class="value">${esc(pedido.fornecedor_nome)}</div></div>
      <div class="field"><div class="label">Valor Total</div><div class="value big">${fmtBRL(pedido.valor_total)}</div></div>
      ${pedido.requisicao ? `
      <div class="field"><div class="label">Requisicao</div><div class="value">${esc(pedido.requisicao.numero)} — ${esc(pedido.requisicao.descricao)}</div></div>
      <div class="field"><div class="label">Obra / Projeto</div><div class="value">${esc(pedido.requisicao.obra_nome ?? '—')}</div></div>` : ''}
      <div class="field"><div class="label">Data do Pedido</div><div class="value">${fmtDate(pedido.data_pedido)}</div></div>
      <div class="field"><div class="label">Previsao de Entrega</div><div class="value">${fmtDate(pedido.data_prevista_entrega)}</div></div>
      ${pedido.nf_numero ? `<div class="field"><div class="label">NF</div><div class="value">${esc(pedido.nf_numero)}</div></div>` : ''}
      ${pedido.centro_custo ? `<div class="field"><div class="label">Centro de Custo</div><div class="value">${esc(pedido.centro_custo)}</div></div>` : ''}
      ${pedido.classe_financeira ? `<div class="field"><div class="label">Classe Financeira</div><div class="value">${esc(pedido.classe_financeira)}</div></div>` : ''}
    </div>
    ${pedido.observacoes ? `<div class="field" style="margin-top:4px"><div class="label">Observacoes</div><div class="value" style="font-size:11px;font-weight:400">${esc(pedido.observacoes)}</div></div>` : ''}
  </div>
  ${itensHtml}
  ${parcelasHtml}
  <div class="footer">
    <p>TEG+ ERP &middot; Pedido de Compra &middot; ${esc(EMPRESA.fantasia)} &middot; CNPJ ${EMPRESA.cnpj}</p>
    <p class="disclaimer">Documento gerado automaticamente pelo sistema TEG+ ERP em ${new Date().toLocaleString('pt-BR')}.<br>
    Valido apenas com a assinatura do responsavel pelo setor de compras.</p>
  </div>
</div></body></html>`
}

async function gerarPdfPedido(pedido: Pedido) {
  const empresa = await getEmpresa()
  const logoB64 = await loadLogoBase64(empresa.logoUrl)
  let html = buildPdfHtml(pedido, empresa)
  if (logoB64) {
    html = html.replace(`src="${empresa.logoUrl}"`, `src="${logoB64}"`)
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const printWin = window.open(url, '_blank', 'width=900,height=700')
  if (!printWin) return
  printWin.addEventListener('load', () => {
    printWin.focus()
    setTimeout(() => { printWin.print(); URL.revokeObjectURL(url) }, 400)
  })
}

async function loadLogoBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function gerarPdfBlob(pedido: Pedido): Promise<Blob> {
  const EMPRESA = await getEmpresa()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15
  const CW = W - 2 * M
  let y = M

  const TEAL = [13, 148, 136] as const
  const DARK = [30, 41, 59] as const
  const MID  = [100, 116, 139] as const
  const LIGHT = [226, 232, 240] as const

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 34, 'F')

  // Logo
  const logo = await loadLogoBase64(EMPRESA.logoUrl)
  if (logo) {
    try { doc.addImage(logo, 'PNG', M, 3, 18, 28) } catch { /* ignore */ }
  }

  // Company info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(EMPRESA.fantasia, M + 22, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${EMPRESA.cnpj}`, M + 22, 16)
  if (EMPRESA.endereco) doc.text(`${EMPRESA.endereco}${EMPRESA.cidade ? ` - ${EMPRESA.cidade}/${EMPRESA.uf ?? ''}` : ''}`, M + 22, 21)
  if (EMPRESA.telefone) doc.text(`${EMPRESA.telefone}${EMPRESA.email ? ` | ${EMPRESA.email}` : ''}`, M + 22, 26)

  // Document title
  const numero = pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('PEDIDO DE COMPRA', W - M, 13, { align: 'right' })
  doc.setFontSize(10)
  doc.text(`#${numero}`, W - M, 20, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(new Date().toLocaleDateString('pt-BR'), W - M, 26, { align: 'right' })
  y = 40

  // ── Section: Dados do Pedido ────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEAL)
    doc.text(title, M, y)
    y += 1
    doc.setDrawColor(...TEAL)
    doc.setLineWidth(0.5)
    doc.line(M, y, W - M, y)
    y += 5
  }

  const addField = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text(label, M, y)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    const truncated = value?.length > 70 ? value.slice(0, 67) + '...' : (value || '—')
    doc.text(truncated, M + 42, y)
    y += 6.5
  }

  sectionTitle('DADOS DO PEDIDO')
  addField('Fornecedor', pedido.fornecedor_nome, true)
  addField('Valor Total', fmtBRL(pedido.valor_total), true)
  if (pedido.requisicao) {
    addField('Requisicao', `${pedido.requisicao.numero} — ${pedido.requisicao.descricao}`)
    if (pedido.requisicao.obra_nome) addField('Obra', pedido.requisicao.obra_nome)
  }
  addField('Data Pedido', fmtDate(pedido.data_pedido))
  addField('Prev. Entrega', fmtDate(pedido.data_prevista_entrega))
  if (pedido.nf_numero) addField('NF', pedido.nf_numero)
  if (pedido.centro_custo) addField('Centro Custo', pedido.centro_custo)
  if (pedido.classe_financeira) addField('Classe Financ.', pedido.classe_financeira)
  if (pedido.observacoes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text('Observacoes', M, y)
    y += 4
    doc.setTextColor(...DARK)
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(pedido.observacoes, CW)
    doc.text(lines.slice(0, 4), M, y)
    y += Math.min(lines.length, 4) * 4
  }
  y += 4

  // ── Section: Itens ──────────────────────────────────────────────────────────
  const rcItensJs = pedido.requisicao?.itens ?? []
  const itens = rcItensJs.length > 0
    ? rcItensJs
    : (pedido.itens_direto ?? []).map(it => ({
        descricao: it.descricao,
        quantidade: it.quantidade,
        unidade: it.unidade,
        valor_unitario_estimado: it.valor_unitario,
      }))
  if (itens.length > 0) {
    sectionTitle('ITENS DO PEDIDO')
    const cols = [M, M + 8, M + 90, M + 105, M + 120, M + 145]
    doc.setFillColor(241, 245, 249)
    doc.rect(M, y - 3.5, CW, 5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(71, 85, 105)
    doc.text('#', cols[0], y)
    doc.text('DESCRICAO', cols[1], y)
    doc.text('QTD', cols[2], y)
    doc.text('UN', cols[3], y)
    doc.text('VL. UNIT.', cols[4], y)
    doc.text('SUBTOTAL', cols[5], y)
    y += 4

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    const unitariosPdf = calcUnitariosEfetivos(itens, pedido.valor_total)
    itens.forEach((item, i) => {
      if (y > 265) { doc.addPage(); y = M }
      const unit = unitariosPdf[i]
      const subtotal = item.quantidade * unit
      doc.text(String(i + 1), cols[0], y)
      const desc = item.descricao.length > 45 ? item.descricao.slice(0, 42) + '...' : item.descricao
      doc.text(desc, cols[1], y)
      doc.text(String(item.quantidade), cols[2], y)
      doc.text(item.unidade, cols[3], y)
      doc.text(fmtBRL(unit), cols[4], y)
      doc.setFont('helvetica', 'bold')
      doc.text(fmtBRL(subtotal), cols[5], y)
      doc.setFont('helvetica', 'normal')
      y += 5
      const dc = (item as any).descricao_complementar as string | undefined
      if (dc && dc.trim()) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        const dcText = dc.length > 70 ? dc.slice(0, 67) + '...' : dc
        doc.text(dcText, cols[1], y)
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        y += 4
      }
      doc.setDrawColor(241, 245, 249)
      doc.line(M, y - 2, W - M, y - 2)
    })

    doc.setDrawColor(...TEAL)
    doc.setLineWidth(0.5)
    doc.line(cols[4], y - 1, W - M, y - 1)
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('TOTAL', cols[4], y)
    doc.setTextColor(...TEAL)
    doc.text(fmtBRL(pedido.valor_total), cols[5], y)
    y += 8
  }

  // ── Section: Parcelas ───────────────────────────────────────────────────────
  const parcelas = pedido.parcelas_preview ?? []
  if (parcelas.length > 0) {
    if (y > 240) { doc.addPage(); y = M }
    sectionTitle(`CONDICAO DE PAGAMENTO${pedido.condicao_pagamento ? `: ${pedido.condicao_pagamento}` : ''}`)
    const pCols = [M, M + 18, M + 90, M + 140]
    doc.setFillColor(241, 245, 249)
    doc.rect(M, y - 3.5, CW, 5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(71, 85, 105)
    doc.text('PARCELA', pCols[0], y)
    doc.text('DESCRICAO', pCols[1], y)
    doc.text('VENCIMENTO', pCols[2], y)
    doc.text('VALOR', pCols[3], y)
    y += 4

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    parcelas.forEach(p => {
      if (y > 270) { doc.addPage(); y = M }
      const desc = (p.descricao || '').trim()
      const descSafe = (!desc || desc.toLowerCase() === 'revisar manualmente')
        ? (parcelas.length === 1 ? 'Parcela única' : `Parcela ${p.numero}/${parcelas.length}`)
        : desc
      doc.text(String(p.numero), pCols[0] + 6, y)
      doc.text(descSafe, pCols[1], y)
      doc.text(fmtDate(p.data_vencimento), pCols[2], y)
      doc.setFont('helvetica', 'bold')
      doc.text(fmtBRL(p.valor), pCols[3], y)
      doc.setFont('helvetica', 'normal')
      y += 5
      doc.setDrawColor(241, 245, 249)
      doc.line(M, y - 2, W - M, y - 2)
    })
    y += 4
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footerY = Math.max(y + 10, 278)
  if (footerY > 290) doc.addPage()
  const fy = footerY > 290 ? 280 : footerY
  doc.setDrawColor(...LIGHT)
  doc.line(M, fy - 4, W - M, fy - 4)
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text(`TEG+ ERP · ${EMPRESA.fantasia} · CNPJ ${EMPRESA.cnpj} · Emitido em ${new Date().toLocaleString('pt-BR')}`, W / 2, fy, { align: 'center' })
  doc.setFontSize(6)
  doc.text('Valido apenas com a assinatura do responsavel pelo setor de compras.', W / 2, fy + 4, { align: 'center' })

  return doc.output('blob')
}

async function compartilharWhatsApp(pedido: Pedido): Promise<boolean> {
  const numero = pedido.numero_pedido ?? pedido.id.slice(0, 8)
  const text =
    `*Pedido de Compra TEG+*\n` +
    `Número: #${numero}\n` +
    `Fornecedor: ${pedido.fornecedor_nome}\n` +
    `Valor: ${pedido.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` +
    `Previsão: ${pedido.data_prevista_entrega ? new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}\n` +
    `\n_Gerado pelo sistema TEG+ ERP_`

  if (navigator.share && navigator.canShare) {
    try {
      const blob = await gerarPdfBlob(pedido)
      const file = new File([blob], `Pedido_${numero}.pdf`, { type: 'application/pdf' })
      const shareData = { text, files: [file] }
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData)
        return true
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false
    }
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  return true
}

async function compartilharEmail(pedido: Pedido, email?: string) {
  const subject = `Pedido de Compra #${pedido.numero_pedido} — TEG+`
  const body =
    `Prezado(a),\n\nSegue pedido de compra conforme detalhes abaixo:\n\n` +
    `Número: ${pedido.numero_pedido}\nFornecedor: ${pedido.fornecedor_nome}\n` +
    `Valor: ${pedido.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` +
    `Previsão de Entrega: ${pedido.data_prevista_entrega ? new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}\n\n` +
    `Para visualizar o pedido completo com anexos, acesse o sistema TEG+.\n\n` +
    `Atenciosamente,\nEquipe de Compras TEG+`

  let anexosUrls: { url: string; nome: string; tipo: string }[] = []
  try {
    const { data: anexos } = await supabase
      .from('cmp_pedidos_anexos')
      .select('url, nome_arquivo, tipo, mime_type')
      .eq('pedido_id', pedido.id)
    if (anexos && anexos.length > 0) {
      anexosUrls = anexos.map(a => ({
        url: a.url,
        nome: a.nome_arquivo ?? `anexo-${a.tipo}`,
        tipo: a.mime_type ?? 'application/octet-stream',
      }))
    }
  } catch {
    // Se falhar ao buscar anexos, envia sem eles
  }

  const pdfHtml = buildPdfHtml(pedido)

  try {
    const res = await api.enviarEmailPedido({
      pedido_id: pedido.id,
      email_destinatario: email ?? '',
      subject,
      body,
      anexos_urls: anexosUrls,
      pdf_html: pdfHtml,
    })
    if (res?.ok) return
  } catch {
    // n8n indisponivel -- fallback mailto
  }

  window.open(`mailto:${email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
}

// ─── Anexo icon helper ────────────────────────────────────────────────────────

function AnexoIcon({ mime }: { mime: string | null }) {
  if (!mime) return <Paperclip size={14} className="text-slate-400" />
  if (mime === 'application/pdf') return <FileText size={14} className="text-red-500" />
  if (mime.startsWith('image/')) return <FileText size={14} className="text-blue-500" />
  if (mime.includes('sheet') || mime.includes('excel'))
    return <FileText size={14} className="text-green-600" />
  return <Paperclip size={14} className="text-slate-400" />
}

// ─── CompartilharModal ────────────────────────────────────────────────────────

function CompartilharModal({ pedido, onClose, dark }: { pedido: Pedido; onClose: () => void; dark: boolean }) {
  const [sharing, setSharing] = useState(false)

  const handleWhatsApp = async () => {
    setSharing(true)
    try { await compartilharWhatsApp(pedido) } finally { setSharing(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-200 ${dark ? 'bg-[#1e293b]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
          <div>
            <p className={`text-xs font-medium ${dark ? 'text-slate-400' : 'text-slate-400'}`}>Pedido de Compra</p>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
              #{pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        <div className={`px-5 py-4 border-b space-y-2 ${dark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Fornecedor</span>
            <span className={`font-semibold truncate ml-4 text-right ${dark ? 'text-white' : 'text-slate-700'}`}>{pedido.fornecedor_nome}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Valor Total</span>
            <span className="font-bold text-teal-500">{fmt(pedido.valor_total)}</span>
          </div>
          {pedido.data_prevista_entrega && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Prev. Entrega</span>
              <span className={`font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>{fmtDataISO(pedido.data_prevista_entrega)}</span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-2.5">
          <button onClick={() => gerarPdfPedido(pedido)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors">
            <Download size={16} className="flex-shrink-0" />
            <span>Baixar / Imprimir PDF</span>
          </button>
          <button onClick={handleWhatsApp} disabled={sharing} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors disabled:opacity-60">
            {sharing ? <Loader2 size={16} className="flex-shrink-0 animate-spin" /> : <MessageCircle size={16} className="flex-shrink-0" />}
            <span>{sharing ? 'Gerando PDF...' : 'Compartilhar no WhatsApp'}</span>
          </button>
          <button onClick={() => compartilharEmail(pedido)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors">
            <Mail size={16} className="flex-shrink-0" />
            <span>Enviar por E-mail</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── LiberarPagamentoModal ────────────────────────────────────────────────────

const TIPO_OPTIONS: { value: PedidoAnexo['tipo']; label: string }[] = [
  { value: 'nota_fiscal',         label: 'Nota Fiscal'           },
  { value: 'comprovante_entrega', label: 'Comprovante de Entrega'},
  { value: 'boleto',              label: 'Boleto'                },
  { value: 'doc_financeiro',      label: 'Doc Financeiro'        },
  { value: 'medicao',             label: 'Planilha de Medição'   },
  { value: 'outro',               label: 'Outro'                 },
]

const IMPOSTO_TIPOS = ['IPI', 'ISS', 'INSS', 'IRRF', 'PIS+COFINS+CSLL', 'Outro']

type ItemTaxState = {
  hasImposto:       boolean
  imposto_tipo:     string
  imposto_aliquota: string
  imposto_valor:    string   // manual override
  deduzir:          boolean
}

function LiberarPagamentoModal({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  const uploadAnexo   = useUploadAnexo()
  const liberarPgto   = useLiberarPagamento()
  const fileRef       = useRef<HTMLInputElement>(null)
  const { data: anexosExistentes } = useAnexosPedido(pedido.id)

  const [file, setFile]       = useState<File | null>(null)
  const [tipo, setTipo]       = useState<PedidoAnexo['tipo']>('nota_fiscal')
  const [obs, setObs]         = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const [showImposto, setShowImposto] = useState(false)

  const rcItens = pedido.requisicao?.itens ?? []

  // Per-item tax state — one entry per RC item
  const [itemTaxes, setItemTaxes] = useState<ItemTaxState[]>(() =>
    rcItens.map(() => ({ hasImposto: false, imposto_tipo: 'IPI', imposto_aliquota: '', imposto_valor: '', deduzir: false }))
  )

  const setItemTax = (i: number, patch: Partial<ItemTaxState>) =>
    setItemTaxes(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))

  // Total-level tax (ISS, INSS, etc. sobre o total da NF)
  const [totalTax, setTotalTax] = useState<ItemTaxState>({
    hasImposto: false, imposto_tipo: 'ISS', imposto_aliquota: '', imposto_valor: '', deduzir: true,
  })

  const valorBase       = pedido.valor_total ?? 0
  const ttAliq          = parseFloat(totalTax.imposto_aliquota) || 0
  const ttCalc          = ttAliq > 0 ? +(valorBase * ttAliq / 100).toFixed(2) : 0
  const ttRet           = parseFloat(totalTax.imposto_valor) || ttCalc

  // Totals — per-item + total-level
  const itemsImposto = rcItens.reduce((sum, item, i) => {
    if (!itemTaxes[i]?.hasImposto) return sum
    const valorItem = item.quantidade * item.valor_unitario_estimado
    const aliq = parseFloat(itemTaxes[i].imposto_aliquota) || 0
    const calc = aliq > 0 ? +(valorItem * aliq / 100).toFixed(2) : 0
    return sum + (parseFloat(itemTaxes[i].imposto_valor) || calc)
  }, 0)
  const totalImposto = itemsImposto + (totalTax.hasImposto ? ttRet : 0)
  const anyDeduzir   = itemTaxes.some((it, i) => itemTaxes[i].hasImposto && it.deduzir) || (totalTax.hasImposto && totalTax.deduzir)
  const valorLiq     = anyDeduzir && totalImposto > 0 ? valorBase - totalImposto : valorBase

  const docsExistentes = anexosExistentes?.filter(a => ['nota_fiscal', 'boleto', 'doc_financeiro'].includes(a.tipo)) ?? []
  const temNF = docsExistentes.length > 0

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setErro('') }
  }

  const handleSubmit = async () => {
    if (!file && !temNF) { setErro('Anexe a Nota Fiscal, Boleto ou Doc Financeiro para continuar.'); return }
    setLoading(true)
    setErro('')
    try {
      if (file) {
        await uploadAnexo.mutateAsync({ pedidoId: pedido.id, file, tipo, observacao: obs || undefined, origem: 'compras' })
      }

      // Build per-item payload
      const impostoItens: ImpostoPayload['itens'] = rcItens
        .map((item, i) => {
          const tax = itemTaxes[i]
          if (!tax?.hasImposto) return null
          const valorItem = item.quantidade * item.valor_unitario_estimado
          const aliqNum   = parseFloat(tax.imposto_aliquota) || 0
          const valorCalc = aliqNum > 0 ? +(valorItem * aliqNum / 100).toFixed(2) : 0
          const valorRet  = parseFloat(tax.imposto_valor) || valorCalc
          if (valorRet <= 0) return null
          return {
            descricao:        item.descricao,
            valor_item:       valorItem,
            imposto_tipo:     tax.imposto_tipo || null,
            imposto_aliquota: aliqNum || null,
            imposto_valor:    valorRet,
            deduzir:          tax.deduzir,
          }
        })
        .filter(Boolean) as ImpostoPayload['itens']

      // Total-level tax (ISS etc.)
      if (totalTax.hasImposto && ttRet > 0) {
        impostoItens.push({
          descricao:        `Total NF`,
          valor_item:       valorBase,
          imposto_tipo:     totalTax.imposto_tipo || null,
          imposto_aliquota: ttAliq || null,
          imposto_valor:    ttRet,
          deduzir:          totalTax.deduzir,
        })
      }

      const imposto: ImpostoPayload | null =
        showImposto && impostoItens.length > 0 && totalImposto > 0
          ? { itens: impostoItens, valor_total: totalImposto, deduzir: anyDeduzir }
          : null

      await liberarPgto.mutateAsync({ pedidoId: pedido.id, imposto })
      onClose()
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao liberar pagamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Banknote size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Liberar para Pagamento</p>
              <p className="text-[11px] text-slate-400">#{pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {temNF && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 space-y-1.5">
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle size={13} className="shrink-0" />
                Documentos já anexados
              </p>
              {docsExistentes.map(a => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-emerald-600 hover:underline truncate">
                  <FileText size={11} className="shrink-0" />
                  <span className="font-semibold">{TIPO_LABEL[a.tipo]}</span>
                  <span className="text-emerald-400">·</span>
                  {a.nome_arquivo}
                </a>
              ))}
              <p className="text-[10px] text-emerald-500 pt-0.5">Anexe outro arquivo abaixo somente se quiser substituir ou complementar.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              {temNF ? 'Adicionar outro documento' : 'Anexar Documento'}{' '}
              {!temNF && <span className="text-red-500">*</span>}
              {temNF && <span className="text-slate-400 font-normal">(opcional)</span>}
            </label>
            <div onClick={() => fileRef.current?.click()} className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer transition-colors ${file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50'}`}>
              <Upload size={18} className={file ? 'text-emerald-500' : 'text-slate-400'} />
              <div className="min-w-0">
                {file ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700 truncate">{file.name}</p>
                    <p className="text-[11px] text-emerald-500">{(file.size / 1024).toFixed(0)} KB</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">Clique para selecionar</p>
                    <p className="text-[11px] text-slate-400">PDF, JPG, PNG, XLS, XLSX</p>
                  </>
                )}
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx" onChange={handleFile} className="hidden" />
          </div>
          {file && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo do Documento</label>
              <div className="grid grid-cols-2 gap-2">
                {TIPO_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setTipo(opt.value)} className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-colors ${tipo === opt.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Observação <span className="text-slate-400 font-normal">(opcional)</span></label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Ex: NF entregue junto com o material..." className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300" />
          </div>
          {/* ── Imposto / Retenção por item ───────────────────── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowImposto(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Receipt size={13} className="text-violet-500" />
                Imposto / Retenção
              </span>
              <span className="flex items-center gap-2">
                {totalImposto > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                    − {totalImposto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
                {showImposto ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
              </span>
            </button>

            {showImposto && (
              <div className="border-t border-slate-100 bg-violet-50/30">
                {rcItens.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-400 italic">Sem itens de RC vinculados.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {rcItens.map((item, i) => {
                      const tax      = itemTaxes[i] ?? { hasImposto: false, imposto_tipo: 'IPI', imposto_aliquota: '', imposto_valor: '', deduzir: false }
                      const valorItem = item.quantidade * item.valor_unitario_estimado
                      const aliqNum  = parseFloat(tax.imposto_aliquota) || 0
                      const valorCalcItem = aliqNum > 0 ? +(valorItem * aliqNum / 100).toFixed(2) : 0
                      const valorRetItem  = parseFloat(tax.imposto_valor) || valorCalcItem
                      return (
                        <div key={i} className="px-3 py-2.5 space-y-2">
                          {/* Item header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{item.descricao}</p>
                              {(item as any).descricao_complementar && (
                                <p className="text-[10px] italic text-slate-500 truncate">{(item as any).descricao_complementar}</p>
                              )}
                              <p className="text-[10px] text-slate-400">{item.quantidade} {item.unidade} · {valorItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setItemTax(i, { hasImposto: !tax.hasImposto })}
                              className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${tax.hasImposto ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'}`}
                            >
                              {tax.hasImposto ? 'Com imposto' : '+ Imposto'}
                            </button>
                          </div>

                          {/* Tax inputs */}
                          {tax.hasImposto && (
                            <div className="bg-white rounded-xl border border-violet-200 p-2.5 space-y-2">
                              {/* Tipo */}
                              <div className="flex flex-wrap gap-1">
                                {IMPOSTO_TIPOS.map(t => (
                                  <button key={t} type="button" onClick={() => setItemTax(i, { imposto_tipo: t })}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${tax.imposto_tipo === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                                    {t}
                                  </button>
                                ))}
                              </div>
                              {/* Alíquota + Valor */}
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alíquota %</label>
                                  <input type="number" min="0" max="100" step="0.01"
                                    value={tax.imposto_aliquota}
                                    onChange={e => setItemTax(i, { imposto_aliquota: e.target.value, imposto_valor: '' })}
                                    placeholder="ex: 5"
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-slate-300" />
                                  {valorCalcItem > 0 && <p className="text-[10px] text-violet-600 mt-0.5">= {valorCalcItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Valor R$</label>
                                  <input type="number" min="0" step="0.01"
                                    value={tax.imposto_valor || (valorCalcItem > 0 ? valorCalcItem : '')}
                                    onChange={e => setItemTax(i, { imposto_valor: e.target.value })}
                                    placeholder="manual"
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-slate-300" />
                                </div>
                              </div>
                              {/* Deduzir */}
                              {valorRetItem > 0 && (
                                <button type="button" onClick={() => setItemTax(i, { deduzir: !tax.deduzir })}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${tax.deduzir ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                                  <span>Deduzir do pagamento</span>
                                  <span className={`w-7 h-3.5 rounded-full transition-colors flex items-center px-0.5 ${tax.deduzir ? 'bg-violet-600' : 'bg-slate-300'}`}>
                                    <span className={`w-2.5 h-2.5 rounded-full bg-white shadow transition-transform ${tax.deduzir ? 'translate-x-3.5' : ''}`} />
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── Imposto sobre o total da NF (ISS, INSS, etc.) ── */}
                <div className="border-t border-slate-200 px-3 pt-2.5 pb-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-600">Imposto sobre o total da NF</p>
                      <p className="text-[10px] text-slate-400">ISS, INSS, IRRF — sobre o valor total</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTotalTax(v => ({ ...v, hasImposto: !v.hasImposto }))}
                      className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${totalTax.hasImposto ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'}`}
                    >
                      {totalTax.hasImposto ? 'Com imposto' : '+ Imposto'}
                    </button>
                  </div>

                  {totalTax.hasImposto && (
                    <div className="bg-white rounded-xl border border-violet-200 p-2.5 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {IMPOSTO_TIPOS.filter(t => t !== 'IPI').map(t => (
                          <button key={t} type="button" onClick={() => setTotalTax(v => ({ ...v, imposto_tipo: t }))}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${totalTax.imposto_tipo === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alíquota %</label>
                          <input type="number" min="0" max="100" step="0.01"
                            value={totalTax.imposto_aliquota}
                            onChange={e => setTotalTax(v => ({ ...v, imposto_aliquota: e.target.value, imposto_valor: '' }))}
                            placeholder="ex: 5"
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-slate-300" />
                          {ttCalc > 0 && <p className="text-[10px] text-violet-600 mt-0.5">= {ttCalc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Valor R$</label>
                          <input type="number" min="0" step="0.01"
                            value={totalTax.imposto_valor || (ttCalc > 0 ? ttCalc : '')}
                            onChange={e => setTotalTax(v => ({ ...v, imposto_valor: e.target.value }))}
                            placeholder="manual"
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-slate-300" />
                        </div>
                      </div>
                      {ttRet > 0 && (
                        <button type="button" onClick={() => setTotalTax(v => ({ ...v, deduzir: !v.deduzir }))}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${totalTax.deduzir ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                          <span>Deduzir do pagamento</span>
                          <span className={`w-7 h-3.5 rounded-full transition-colors flex items-center px-0.5 ${totalTax.deduzir ? 'bg-violet-600' : 'bg-slate-300'}`}>
                            <span className={`w-2.5 h-2.5 rounded-full bg-white shadow transition-transform ${totalTax.deduzir ? 'translate-x-3.5' : ''}`} />
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Totals summary */}
                {totalImposto > 0 && (
                  <div className="mx-3 mb-3 rounded-xl bg-white border border-violet-200 px-3 py-2 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Valor bruto</span>
                      <span className="font-semibold">{valorBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between text-violet-600">
                      <span>(−) Total impostos retidos</span>
                      <span className="font-semibold">− {totalImposto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-violet-100 pt-1 text-slate-700">
                      <span>{anyDeduzir ? 'Valor a pagar ao fornecedor' : 'Valor a pagar (sem dedução)'}</span>
                      <span className="text-emerald-700">{valorLiq.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
          <button onClick={handleSubmit} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Banknote size={16} />}
            {loading ? 'Enviando...' : 'Liberar para Pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AnexosOrganizados — documentos agrupados por categoria ─────────────────

const SECTION_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-600' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-600' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-600' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-600' },
}

function DocSection({ title, icon, color, count, children }: { title: string; icon: React.ReactNode; color: string; count: number; children: React.ReactNode }) {
  const c = SECTION_COLORS[color] ?? SECTION_COLORS.cyan
  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <div className={`${c.bg} px-3 py-2 flex items-center gap-2 border-b ${c.border}`}>
        {icon}
        <span className={`text-[11px] font-bold ${c.text}`}>{title}</span>
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>{count}</span>
      </div>
      <div className="divide-y divide-slate-100 bg-white">{children}</div>
    </div>
  )
}

function DocItem({ name, url, mime, tipo, date, origem }: { name: string; url: string; mime?: string | null; tipo?: string; date?: string; origem?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors group">
      <AnexoIcon mime={mime ?? null} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-700 truncate">{name}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {tipo && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{tipo}</span>}
          {origem && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${origem === 'financeiro' ? 'bg-purple-100 text-purple-600' : 'bg-teal-100 text-teal-600'}`}>{origem === 'financeiro' ? 'Financeiro' : 'Compras'}</span>}
          {date && <span className="text-[10px] text-slate-400">{new Date(date).toLocaleDateString('pt-BR')}</span>}
        </div>
      </div>
      <ExternalLink size={11} className="flex-shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors" />
    </a>
  )
}

function UploadAnexoInline({ pedidoId }: { pedidoId: string }) {
  const uploadAnexo = useUploadAnexo()
  const fileRef     = useRef<HTMLInputElement>(null)
  const [tipo, setTipo]       = useState<PedidoAnexo['tipo']>('nota_fiscal')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      await uploadAnexo.mutateAsync({ pedidoId, file, tipo, origem: 'compras' })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } catch {
      // error handled by mutation
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2 pt-2">
      <select value={tipo} onChange={e => setTipo(e.target.value as PedidoAnexo['tipo'])} className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-300">
        {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button onClick={() => fileRef.current?.click()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors disabled:opacity-50">
        {loading ? <div className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /> : success ? <CheckCircle size={12} className="text-emerald-500" /> : <Upload size={12} />}
        {loading ? 'Enviando...' : success ? 'Anexado!' : 'Anexar'}
      </button>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx" onChange={handleFile} className="hidden" />
    </div>
  )
}

function AnexosOrganizados({ pedidoId, cotacaoId, canUpload = true }: { pedidoId: string; cotacaoId?: string; canUpload?: boolean }) {
  const { data: anexos, isLoading: loadingAnexos }  = useAnexosPedido(pedidoId)
  const { data: cotDocs, isLoading: loadingCot }     = useCotacaoDocs(cotacaoId)
  const isLoading = loadingAnexos || (cotacaoId ? loadingCot : false)

  if (isLoading) return <div className="flex items-center gap-2 py-2 text-xs text-slate-400"><div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />Carregando documentos...</div>

  const cotacaoDocs   = cotDocs ?? []
  const nfDocs        = anexos?.filter(a => a.tipo === 'nota_fiscal') ?? []
  const pedidoAnexos  = anexos?.filter(a => a.tipo !== 'nota_fiscal' && a.tipo !== 'comprovante_pagamento') ?? []
  const pagamentoDocs = anexos?.filter(a => a.tipo === 'comprovante_pagamento') ?? []
  const totalDocs     = cotacaoDocs.length + nfDocs.length + pedidoAnexos.length + pagamentoDocs.length

  if (totalDocs === 0) return <div><p className="text-xs text-slate-400 italic py-1">Nenhum documento encontrado.</p>{canUpload && <UploadAnexoInline pedidoId={pedidoId} />}</div>

  return (
    <div className="space-y-3">
      {cotacaoDocs.length > 0 && (
        <DocSection title="Cotação Aprovada" icon={<FileText size={13} className="text-violet-500" />} color="violet" count={cotacaoDocs.length}>
          {cotacaoDocs.map((doc, i) => <DocItem key={i} name={doc.name} url={doc.url} mime={doc.mime} date={doc.created} />)}
        </DocSection>
      )}
      {nfDocs.length > 0 && (
        <DocSection title="Nota Fiscal" icon={<FileText size={13} className="text-amber-500" />} color="amber" count={nfDocs.length}>
          {nfDocs.map(a => <DocItem key={a.id} name={a.nome_arquivo} url={a.url} mime={a.mime_type} date={a.uploaded_at} origem={a.origem} />)}
        </DocSection>
      )}
      {pedidoAnexos.length > 0 && (
        <DocSection title="Pedido" icon={<Package size={13} className="text-cyan-500" />} color="cyan" count={pedidoAnexos.length}>
          {pedidoAnexos.map(a => <DocItem key={a.id} name={a.nome_arquivo} url={a.url} mime={a.mime_type} tipo={TIPO_LABEL[a.tipo]} date={a.uploaded_at} origem={a.origem} />)}
        </DocSection>
      )}
      {pagamentoDocs.length > 0 && (
        <DocSection title="Pagamento" icon={<Banknote size={13} className="text-emerald-500" />} color="emerald" count={pagamentoDocs.length}>
          {pagamentoDocs.map(a => <DocItem key={a.id} name={a.nome_arquivo} url={a.url} mime={a.mime_type} date={a.uploaded_at} origem={a.origem} />)}
        </DocSection>
      )}
      {canUpload && <UploadAnexoInline pedidoId={pedidoId} />}
    </div>
  )
}

// ─── PedidoCard (compact pipeline card) ──────────────────────────────────────

function PedCard({ pedido, dark, onClick }: { pedido: PedidoListItem; dark: boolean; onClick: () => void }) {
  const dias     = diasRestantes(pedido.data_prevista_entrega)
  const st       = getStatusMeta(pedido)
  const pending  = isPendingEmission(pedido)
  const entregue = pedido.status === 'entregue'
  const parcial  = pedido.status === 'parcialmente_recebido'
  const atrasado = dias !== null && dias < 0 && !entregue && !parcial
  const statusPgto = (pedido as any).status_pagamento as string | undefined
  const isPago     = statusPgto === 'pago'
  const isLiberado = statusPgto === 'liberado'
  const isEncerrado = isPago || isLiberado
  const { data: anexosCard } = useAnexosPedido(isEncerrado ? pedido.id : undefined)
  const hasNFDocCard = (anexosCard ?? []).some(a => ['nota_fiscal', 'boleto', 'doc_financeiro'].includes(a.tipo))
  const nfPendente = isEncerrado && !((pedido as any).nf_numero) && !hasNFDocCard
  const dataVenc   = (pedido as any).data_vencimento as string | undefined
  const diasVenc   = dataVenc ? Math.floor((new Date(dataVenc + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86_400_000) : null
  const vencUrgency = !isPago && dataVenc ? (diasVenc! < 0 ? 'overdue' : diasVenc! === 0 ? 'today' : diasVenc! <= 7 ? 'week' : 'normal') : 'normal'
  const qtdTotal     = pedido.qtd_itens_total ?? 0
  const qtdRecebidos = pedido.qtd_itens_recebidos ?? 0
  const rcItensCard  = pedido.requisicao?.itens ?? []
  const temProduto   = rcItensCard.some(i => (i.natureza ?? 'produto') === 'produto')
  const temServico   = rcItensCard.some(i => i.natureza === 'servico')
  const naturezaTipo: 'misto' | 'servico' | 'produto' | null =
    temProduto && temServico ? 'misto' : temServico ? 'servico' : temProduto ? 'produto' : null
  const categoria    = pedido.requisicao?.categoria
  const obraNome     = pedido.requisicao?.obra_nome
  const centroCusto  = pedido.centro_custo
  const classeFinanceira = pedido.classe_financeira

  // Avatar icon + color based on priority state
  const avatarBg = atrasado
    ? dark ? 'bg-red-500/15' : 'bg-red-50'
    : isPago
      ? dark ? 'bg-emerald-500/15' : 'bg-emerald-50'
      : isLiberado
        ? dark ? 'bg-orange-500/15' : 'bg-orange-50'
        : entregue || parcial
          ? dark ? 'bg-teal-500/15' : 'bg-teal-50'
          : dark ? 'bg-slate-700/50' : 'bg-slate-50'
  const AvatarIcon = atrasado ? AlertTriangle : isPago ? CheckCircle2 : isLiberado ? ShieldCheck : entregue ? CheckCircle : Receipt
  const avatarIconCls = atrasado ? 'text-red-500' : isPago ? 'text-emerald-600' : isLiberado ? 'text-orange-500' : entregue ? 'text-teal-600' : dark ? 'text-slate-400' : 'text-slate-400'

  const borderClass = dark
    ? 'border-white/[0.07] hover:border-white/20'
    : atrasado ? 'border-red-200' : isPago ? 'border-emerald-200' : isLiberado ? 'border-orange-200' : entregue ? 'border-teal-200' : 'border-slate-200'

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border cursor-pointer transition-all hover:shadow-md ${dark ? 'bg-[#1e293b]' : 'bg-white shadow-sm'} ${borderClass}`}
    >
      <div className="p-4">
        {/* ── Header: avatar + info + value ── */}
        <div className="flex items-start gap-3">
          {/* Status avatar */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${avatarBg}`}>
            <AvatarIcon size={16} className={avatarIconCls} />
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            {/* Supplier + value */}
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-slate-800'}`}>
                {pedido.fornecedor_nome}
              </p>
              <p className={`text-sm font-extrabold shrink-0 ${atrasado ? 'text-red-600' : 'text-teal-500'}`}>
                {fmt(pedido.valor_total)}
              </p>
            </div>

            {/* Number + RC + Obra badges */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className={`text-[10px] font-mono ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {getDisplayNumber(pedido)}
              </span>
              {pedido.sem_cotacao && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${dark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                  <ShoppingCart size={8} />SEM COTAÇÃO
                </span>
              )}
              {pedido.requisicao?.numero && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${dark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Hash size={8} />{pedido.requisicao.numero}
                </span>
              )}
              {obraNome && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${dark ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                  <Building2 size={8} />{obraNome}
                </span>
              )}
            </div>

            {/* Description */}
            {pedido.requisicao?.descricao && (
              <p className={`text-[11px] truncate mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                {pedido.requisicao.justificativa || pedido.requisicao.descricao}
              </p>
            )}

            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 text-[10px] ${dark ? st.bgDark + ' ' + st.textDark : st.bg + ' ' + st.text}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {st.label}
              </span>
              {pending && (
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                  RC aprovada
                </span>
              )}
              {isPago && (
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                  <CheckCircle2 size={9} /> Pago
                </span>
              )}
              {isLiberado && !isPago && (
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
                  <Clock size={9} /> Aguard. Pgto
                </span>
              )}
              {nfPendente && (
                <span title="Pedido encerrado sem nota fiscal anexada" className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-red-500/15 text-red-400' : 'bg-red-100 text-red-700'}`}>
                  <AlertTriangle size={9} /> NF pendente
                </span>
              )}
              {atrasado && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-red-600 font-bold">
                  <AlertTriangle size={9} /> {Math.abs(dias!)}d atr.
                </span>
              )}
              {parcial && qtdTotal > 0 && (
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                  <Package size={9} /> {qtdRecebidos}/{qtdTotal} receb.
                </span>
              )}
              {!entregue && !parcial && pedido.requisicao?.urgencia && pedido.requisicao.urgencia !== 'normal' && (
                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  pedido.requisicao.urgencia === 'critica'
                    ? dark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                    : dark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                }`}>
                  ⚡ {pedido.requisicao.urgencia === 'critica' ? 'Crítica' : 'Urgente'}
                </span>
              )}
              {(pedido as any).contrato_ativo && (
                <a href="/contratos/gestao" onClick={e => e.stopPropagation()}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${dark ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 hover:bg-violet-500/25' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'}`}>
                  <ExternalLink size={9} /> Ver Contrato
                </a>
              )}
              {naturezaTipo === 'servico' && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${dark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-50 text-violet-700'}`}>
                  Servico
                </span>
              )}
              {naturezaTipo === 'misto' && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${dark ? 'bg-fuchsia-500/15 text-fuchsia-400' : 'bg-fuchsia-50 text-fuchsia-700'}`} title="Pedido com produtos e servicos — 2 notas">
                  Produto + Servico
                </span>
              )}
            </div>

            {/* Metadata: dates + categoria + CC + classe */}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {pedido.data_pedido && (
                <span className="flex items-center gap-1">
                  <Calendar size={9} />{fmtData(pedido.data_pedido)}
                </span>
              )}
              {pedido.data_prevista_entrega && !entregue && (
                <span className={`flex items-center gap-1 ${atrasado ? 'text-red-500 font-semibold' : ''}`}>
                  <Truck size={9} />
                  Prev: {fmtDataISO(pedido.data_prevista_entrega)}
                  {dias !== null && !pending && <span className="ml-0.5">({dias}d)</span>}
                </span>
              )}
              {pedido.data_entrega_real && (
                <span className={`flex items-center gap-1 font-medium ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <CheckCircle size={9} />
                  {fmtData(pedido.data_entrega_real)}
                  {pedido.data_pedido && (() => {
                    const d0 = new Date(pedido.data_pedido)
                    const d1 = new Date(pedido.data_entrega_real!)
                    const delta = Math.round((d1.getTime() - d0.getTime()) / 86400000)
                    return <span className="ml-0.5 font-semibold">({delta}d)</span>
                  })()}
                </span>
              )}
              {(entregue || isLiberado) && dataVenc && (
                <span className={`flex items-center gap-1 font-semibold ${
                  vencUrgency === 'overdue' ? 'text-red-500' :
                  vencUrgency === 'today'   ? 'text-amber-600' :
                  vencUrgency === 'week'    ? 'text-yellow-600' :
                  dark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <Banknote size={9} />
                  Venc: {fmtDataISO(dataVenc)}
                  {diasVenc !== null && !isPago && (
                    <span className="ml-0.5">
                      {vencUrgency === 'overdue' ? `(${Math.abs(diasVenc)}d atr.)` :
                       vencUrgency === 'today'   ? '(hoje)' :
                       `(${diasVenc}d)`}
                    </span>
                  )}
                </span>
              )}
              {categoria && (
                <span className="flex items-center gap-1">
                  <Tag size={9} />{categoria.replace(/_/g, ' ')}
                </span>
              )}
              {centroCusto && (
                <span className={`flex items-center gap-1 font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Briefcase size={9} />CC: {centroCusto}
                </span>
              )}
              {classeFinanceira && (
                <span className={`font-medium ${dark ? 'text-violet-400' : 'text-violet-500'}`}>
                  {classeFinanceira}
                </span>
              )}
              {(pedido as any).condicao_pagamento && (
                <span className={`flex items-center gap-1 font-semibold ${dark ? 'text-teal-300' : 'text-teal-700'}`} title="Condição de pagamento">
                  <Banknote size={9} />{(pedido as any).condicao_pagamento}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DetailModal ─────────────────────────────────────────────────────────────

function DetailModal({
  pedido,
  dark,
  onClose,
  onCompartilhar,
  onLiberarPagamento,
  onReceber,
  onEmitted,
}: {
  pedido: PedidoListItem
  dark: boolean
  onClose: () => void
  onCompartilhar: (p: PedidoListItem) => void
  onLiberarPagamento: (id: string) => void
  onReceber: (p: Pedido) => void
  onEmitted?: () => void
}) {
  const mutation = useAtualizarPedido()
  const emitirPedido = useEmitirPedido()
  const { perfil, isAdmin } = useAuth()
  const { data: basesLotacao = [] } = useBases()
  const { data: fornecedoresAtivos = [] } = useCadFornecedores({ ativo: true })
  const [confirmando, setConfirmando] = useState(false)
  const [showEmitirModal, setShowEmitirModal] = useState(false)
  const [showFornecedorCadastroModal, setShowFornecedorCadastroModal] = useState(false)
  const [showFornecedorAtualizarModal, setShowFornecedorAtualizarModal] = useState(false)
  const [showFornecedorSelectorModal, setShowFornecedorSelectorModal] = useState(false)
  const [fornecedorVinculado, setFornecedorVinculado] = useState<Fornecedor | null>(null)
  const [emitError, setEmitError] = useState<string | null>(null)

  const dias     = diasRestantes(pedido.data_prevista_entrega)
  const st       = getStatusMeta(pedido)
  const pending  = isPendingEmission(pedido)
  const entregue = pedido.status === 'entregue'
  const parcial  = pedido.status === 'parcialmente_recebido'
  const atrasado = dias !== null && dias < 0 && !entregue && !parcial
  // Recebimento (segregacao de funcoes): so quem esta no destino, ou CD Araxa (faz_triagem), ou admin — nunca o comprador.
  const baseDestinoId = (pedido.requisicao as any)?.base_destino_id as string | undefined
  const minhaBase = basesLotacao.find(b => b.id === perfil?.base_id)
  // Quando o pedido nao tem base_destino (compra direta do escritorio), libera p/ qualquer perfil com pode_receber=true.
  const podeConfirmarReceb = isAdmin
    || (!!perfil?.base_id && perfil.base_id === baseDestinoId && perfil.pode_receber !== false)
    || (!baseDestinoId && perfil?.pode_receber !== false)
    || !!(minhaBase as any)?.faz_triagem
  const podeReceber = !pending
    && ['emitido', 'confirmado', 'em_entrega', 'parcialmente_recebido'].includes(pedido.status)
    && podeConfirmarReceb
  const qtdTotal     = pedido.qtd_itens_total ?? 0
  const qtdRecebidos = pedido.qtd_itens_recebidos ?? 0
  const statusPgto     = (pedido as any).status_pagamento as string | undefined
  const liberadoEm     = (pedido as any).liberado_pagamento_em as string | undefined
  const pagoEm         = (pedido as any).pago_em as string | undefined
  const isLiberado     = statusPgto === 'liberado'
  const isPago         = statusPgto === 'pago'
  // Liberar pagamento apos recebimento confirmado. NF/Boleto/Doc fica como pendencia (badge) se nao anexado.
  const podeLiberar    = entregue && !statusPgto
  const { data: fornecedorResolvido, isLoading: isLoadingFornecedorResolvido, refetch: refetchFornecedorResolvido } = useFornecedorCotacaoResolver(
    pending ? pedido.source_cotacao?.id : undefined,
  )

  useEffect(() => {
    if (!pending) {
      setFornecedorVinculado(null)
      return
    }

    setFornecedorVinculado(null)
  }, [pending, pedido.id])

  const fornecedorDetectado = fornecedorResolvido?.fornecedorCorrespondente ?? null
  const fornecedorAtivo = fornecedorVinculado ?? fornecedorDetectado
  const fornecedorAtivoComplete = hasFornecedorPaymentData(fornecedorAtivo)
  const camposPagamentoPendentes = getFornecedorPaymentMissingFields(fornecedorAtivo)
  const podeEmitirPedidoPendente = !pending || Boolean(fornecedorAtivo)
  const motivoBloqueioEmissao = !pending
    ? null
    : !fornecedorAtivo
      ? 'Vincule ou cadastre o fornecedor mestre antes de emitir o pedido.'
      : null

  const confirmarEntrega = async () => {
    setConfirmando(true)
    try {
      await mutation.mutateAsync({ id: pedido.id, status: 'entregue', data_entrega_real: new Date().toISOString().split('T')[0] })
    } finally {
      setConfirmando(false)
    }
  }

  const bg  = dark ? 'bg-[#0f172a]' : 'bg-white'
  const txt = dark ? 'text-white' : 'text-slate-800'
  const sub = dark ? 'text-slate-400' : 'text-slate-500'
  const brd = dark ? 'border-white/10' : 'border-slate-200'
  const prefillCadastro = buildFornecedorPrefillFromCotacao(fornecedorResolvido)

  const handleFornecedorVinculado = async (fornecedor: Fornecedor) => {
    setFornecedorVinculado(fornecedor)
    setEmitError(null)
    setShowFornecedorCadastroModal(false)
    setShowFornecedorAtualizarModal(false)
    setShowFornecedorSelectorModal(false)
    await refetchFornecedorResolvido()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`${bg} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 ${bg} px-5 py-4 border-b ${brd} flex items-center justify-between`}>
          <div>
            <p className={`text-xs ${sub}`}>{pending ? 'Pedido Pendente' : 'Pedido de Compra'}</p>
            <p className={`text-base font-bold ${txt}`}>{getDisplayNumber(pedido)}</p>
          </div>
          <div className="flex items-center gap-2">
            {!pending && (
              <button onClick={() => onCompartilhar(pedido)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors">
                <Share2 size={12} /> Pedido
              </button>
            )}
            <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${dark ? st.bgDark + ' ' + st.textDark : st.bg + ' ' + st.text}`}>{st.label}</span>
            {pending && <span className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200"><FileText size={11} /> Cotacao aprovada</span>}
            {isPago && <span className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700"><CheckCircle size={11} /> Pago {pagoEm && `· ${fmtData(pagoEm)}`}</span>}
            {isLiberado && !isPago && <span className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700"><Clock size={11} /> Aguard. Pgto</span>}
            {atrasado && <span className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><AlertTriangle size={11} /> {Math.abs(dias!)}d atrasado</span>}
          </div>

          {/* Info grid */}
          <div className={`grid grid-cols-2 gap-3 text-xs border rounded-xl p-4 ${brd}`}>
            <div>
              <span className={sub}>Fornecedor</span>
              <p className={`font-semibold ${txt}`}>{pedido.fornecedor_nome}</p>
            </div>
            <div>
              <span className={sub}>Valor Total</span>
              <p className="font-extrabold text-teal-500 text-sm">{fmt(pedido.valor_total)}</p>
            </div>
            {pedido.requisicao && (
              <>
                <div>
                  <span className={sub}>Requisição</span>
                  <p className={`font-semibold ${txt}`}>{pedido.requisicao.numero}</p>
                </div>
                <div>
                  <span className={sub}>Obra</span>
                  <p className={`font-semibold ${txt}`}>{pedido.requisicao.obra_nome ?? '—'}</p>
                </div>
              </>
            )}
            <div>
              <span className={sub}>Data Pedido</span>
              <p className={`font-semibold ${txt}`}>{pending ? 'Nao emitido' : fmtData(pedido.data_pedido)}</p>
            </div>
            <div>
              <span className={sub}>{pending ? 'Status da RC' : 'Prev. Entrega'}</span>
              <p className={`font-semibold ${atrasado ? 'text-red-500' : txt}`}>
                {pending ? 'Cotacao aprovada' : fmtDataISO(pedido.data_prevista_entrega)}
                {dias !== null && !entregue && !pending && <span className="text-[10px] ml-1">({dias}d)</span>}
              </p>
            </div>
            {pedido.data_entrega_real && (
              <div>
                <span className={sub}>Entregue em</span>
                <p className="font-semibold text-emerald-500">{fmtData(pedido.data_entrega_real)}</p>
              </div>
            )}
            {(pedido as any).data_vencimento && (
              <div>
                <span className={sub}>Vencimento</span>
                <p className={`font-semibold ${
                  !isPago && diasVenc !== null
                    ? diasVenc < 0 ? 'text-red-500'
                    : diasVenc === 0 ? 'text-amber-600'
                    : diasVenc <= 7 ? 'text-yellow-600'
                    : txt
                  : txt
                }`}>
                  {fmtDataISO((pedido as any).data_vencimento)}
                  {!isPago && diasVenc !== null && (
                    <span className="text-[10px] font-normal ml-1">
                      {diasVenc < 0 ? `(${Math.abs(diasVenc)}d atr.)` : diasVenc === 0 ? '(hoje)' : `(${diasVenc}d)`}
                    </span>
                  )}
                </p>
              </div>
            )}
            {pedido.nf_numero && (
              <div>
                <span className={sub}>NF</span>
                <p className={`font-semibold font-mono ${txt}`}>{pedido.nf_numero}</p>
              </div>
            )}
            {(pedido as any).condicao_pagamento && (
              <div>
                <span className={sub}>Condição de Pagamento</span>
                <p className={`font-semibold ${txt}`}>{(pedido as any).condicao_pagamento}</p>
              </div>
            )}
            {liberadoEm && (
              <div>
                <span className={sub}>Liberado em</span>
                <p className="font-semibold text-orange-500">{fmtData(liberadoEm)}</p>
              </div>
            )}
            {pagoEm && (
              <div>
                <span className={sub}>Pago em</span>
                <p className="font-semibold text-emerald-500">{fmtData(pagoEm)}</p>
              </div>
            )}
          </div>

          {/* Anexo / Referência de cotação */}
          <AnexoReferencia url={pedido.requisicao?.arquivo_url} />

          {/* Auditoria */}
          <AuditoriaCard
            createdAt={pedido.created_at}
            updatedAt={pedido.updated_at}
            criadoPor={pedido.criado_por_nome}
            atualizadoPor={pedido.atualizado_por_nome}
            extra={[
              { label: 'Solicitante', value: (pedido.requisicao as any)?.solicitante_nome },
              { label: 'Comprador designado', value: pedido.comprador?.nome },
              { label: 'Cotou', value: pedido.cotacao?.concluido_por_nome },
              { label: 'Liberado por', value: pedido.liberado_pagamento_por },
            ]}
          />

          {/* Observacoes */}
          {pedido.observacoes && (
            <div className={`rounded-xl p-3 border ${dark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${sub}`}>Observações</p>
              <p className={`text-xs leading-relaxed ${sub}`}>{pedido.observacoes}</p>
            </div>
          )}

          {/* Recebimento progress */}
          {parcial && qtdTotal > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-600 font-bold">Recebido parcialmente</span>
                <span className={`font-semibold ${sub}`}>{qtdRecebidos}/{qtdTotal} itens</span>
              </div>
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-slate-100'}`}>
                <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, (qtdRecebidos / qtdTotal) * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Timeline */}
          {!pending && <FluxoTimeline status="pedido_emitido" compact />}

          {/* Requisição description */}
          {pending && (
            <div className={`rounded-2xl border p-4 space-y-4 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-bold ${txt}`}>Cadastro do fornecedor</p>
                  <p className={`text-xs mt-1 ${sub}`}>A emissão fica bloqueada até existir um fornecedor mestre vinculado com dados completos de pagamento.</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${fornecedorAtivo && fornecedorAtivoComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {fornecedorAtivo && fornecedorAtivoComplete ? 'Pronto para emitir' : 'Ação necessária'}
                </span>
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border rounded-xl p-4 ${brd}`}>
                <div>
                  <span className={sub}>Fornecedor da cotação</span>
                  <p className={`font-semibold ${txt}`}>{fornecedorResolvido?.nomeCotacao ?? pedido.fornecedor_nome}</p>
                </div>
                <div>
                  <span className={sub}>CNPJ da cotação</span>
                  <p className={`font-semibold ${txt}`}>{formatCNPJ(fornecedorResolvido?.cnpjCotacao) || 'Não informado'}</p>
                </div>
              </div>

              {isLoadingFornecedorResolvido ? (
                <div className={`rounded-xl border p-4 flex items-center gap-3 text-sm ${dark ? 'border-white/10 bg-white/[0.02] text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <Loader2 size={16} className="animate-spin text-teal-500" />
                  Verificando cadastro mestre do fornecedor...
                </div>
              ) : fornecedorDetectado ? (
                <div className={`rounded-xl border p-4 space-y-3 ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-xs font-bold uppercase tracking-wide ${sub}`}>Fornecedor já cadastrado</p>
                      <p className={`text-sm font-bold ${txt}`}>{fornecedorDetectado.razao_social}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${hasFornecedorPaymentData(fornecedorDetectado) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {hasFornecedorPaymentData(fornecedorDetectado) ? 'Dados OK' : 'Atualizar dados'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className={sub}>Nome</span>
                      <p className={`font-semibold ${txt}`}>{fornecedorDetectado.razao_social}</p>
                    </div>
                    <div>
                      <span className={sub}>CNPJ</span>
                      <p className={`font-semibold ${txt}`}>{formatCNPJ(fornecedorDetectado.cnpj) || 'Não informado'}</p>
                    </div>
                  </div>

                  {!hasFornecedorPaymentData(fornecedorDetectado) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                      Dados de pagamento pendentes: {fornecedorResolvido?.camposPagamentoFaltantes.join(', ')}.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFornecedorVinculado(fornecedorDetectado)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        fornecedorAtivo?.id === fornecedorDetectado.id
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      <Link2 size={14} />
                      {fornecedorAtivo?.id === fornecedorDetectado.id ? 'Fornecedor vinculado' : 'Vincular'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFornecedorSelectorModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Search size={14} />
                      Selecionar outro
                    </button>
                    {!hasFornecedorPaymentData(fornecedorDetectado) && (
                      <button
                        type="button"
                        onClick={() => setShowFornecedorAtualizarModal(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <RefreshCw size={14} />
                        Atualizar dados
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`rounded-xl border p-4 space-y-3 ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                      <Building2 size={18} className={dark ? 'text-amber-300' : 'text-amber-600'} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${txt}`}>Fornecedor ainda não cadastrado</p>
                      <p className={`text-xs mt-1 ${sub}`}>Nenhum cadastro mestre foi localizado para este CNPJ. O pedido fica bloqueado até concluir o cadastro.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFornecedorCadastroModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                    >
                      <UserPlus size={14} />
                      Cadastrar fornecedor
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFornecedorSelectorModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Search size={14} />
                      Selecionar outro
                    </button>
                  </div>
                </div>
              )}

              {fornecedorAtivo && (
                <div className={`rounded-xl border p-4 space-y-3 ${fornecedorAtivoComplete ? 'border-emerald-200 bg-emerald-50/80' : 'border-amber-200 bg-amber-50/80'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cadastro vinculado ao pedido</p>
                      <p className="text-sm font-bold text-slate-800">{fornecedorAtivo.razao_social}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${fornecedorAtivoComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {fornecedorAtivoComplete ? 'Completo' : 'Pendente'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">CNPJ</span>
                      <p className="font-semibold text-slate-800">{formatCNPJ(fornecedorAtivo.cnpj) || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Forma disponível</span>
                      <p className="font-semibold text-slate-800">
                        {fornecedorAtivo.pix_chave?.trim()
                          ? `PIX${fornecedorAtivo.pix_tipo ? ` • ${fornecedorAtivo.pix_tipo}` : ''}`
                          : fornecedorAtivo.banco_nome?.trim()
                            ? `${fornecedorAtivo.banco_nome} • Ag ${fornecedorAtivo.agencia ?? '—'}`
                            : 'Dados pendentes'}
                      </p>
                    </div>
                  </div>
                  {!fornecedorAtivoComplete && (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] text-amber-700">Pendências: {camposPagamentoPendentes.join(', ')}.</p>
                      <button
                        type="button"
                        onClick={() => setShowFornecedorAtualizarModal(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-amber-200 bg-white text-amber-700 hover:bg-amber-50 transition-colors"
                      >
                        <RefreshCw size={14} />
                        Atualizar dados
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(pedido.requisicao?.justificativa || pedido.requisicao?.descricao) && (
            <div className={`rounded-xl p-3 border ${dark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${sub}`}>Descrição da RC</p>
              <p className={`text-xs leading-relaxed ${sub}`}>{pedido.requisicao.justificativa || pedido.requisicao.descricao}</p>
              {pedido.requisicao.descricao && pedido.requisicao.descricao !== pedido.requisicao.justificativa && (
                <div className={`mt-2 pt-2 border-t ${dark ? 'border-white/10' : 'border-slate-200'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${dark ? 'text-teal-400' : 'text-teal-600'}`}>Detalhes adicionais</p>
                  <p className={`text-xs leading-relaxed ${dark ? 'text-teal-200' : 'text-teal-800'}`}>{pedido.requisicao.descricao}</p>
                </div>
              )}
            </div>
          )}

          {/* Itens da requisição — agrupados por natureza (produto/servico).
              Pedido Direto (sem RC) tem itens em pedido.itens_direto. */}
          {!pending && (() => {
            const rcItensList = pedido.requisicao?.itens ?? []
            const todos: any[] = rcItensList.length > 0
              ? rcItensList
              : (pedido.itens_direto ?? []).map(it => ({
                  descricao: it.descricao,
                  quantidade: it.quantidade,
                  unidade: it.unidade,
                  valor_unitario_estimado: it.valor_unitario,
                  natureza: 'produto',
                }))
            if (todos.length === 0) return null
            const unitariosEf = calcUnitariosEfetivos(todos, pedido.valor_total)
            const todosEf = todos.map((it, i) => ({ ...it, valor_unitario_efetivo: unitariosEf[i] }))
            const produtos = todosEf.filter(i => (i.natureza ?? 'produto') === 'produto')
            const servicos = todosEf.filter(i => i.natureza === 'servico')
            const subtotal = (arr: typeof todosEf) => arr.reduce((s, i) => s + (i.quantidade * i.valor_unitario_efetivo), 0)
            const grupos: { label: string; chip: string; itens: typeof todosEf; total: number }[] = []
            if (produtos.length) grupos.push({ label: `Produtos (${produtos.length})`, chip: 'bg-sky-100 text-sky-700', itens: produtos, total: subtotal(produtos) })
            if (servicos.length) grupos.push({ label: `Servicos (${servicos.length})`, chip: 'bg-violet-100 text-violet-700', itens: servicos, total: subtotal(servicos) })

            return (
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1 ${sub}`}>
                  <Receipt size={11} /> Itens do Pedido
                  {grupos.length > 1 && (
                    <span className={`ml-2 text-[10px] font-normal normal-case ${sub}`}>
                      Produto {fmt(subtotal(produtos))} · Servico {fmt(subtotal(servicos))}
                    </span>
                  )}
                </p>
                <div className="space-y-3">
                  {grupos.map((g, gi) => (
                    <div key={gi} className={`rounded-xl border overflow-hidden ${brd}`}>
                      <div className={`flex items-center justify-between px-3 py-2 ${dark ? 'bg-white/5' : 'bg-slate-50'}`}>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${g.chip}`}>{g.label}</span>
                        <span className={`text-xs font-bold ${txt}`}>{fmt(g.total)}</span>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className={`${dark ? 'bg-white/[0.02] text-slate-400' : 'bg-white text-slate-500'}`}>
                            <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                            <th className="text-center px-2 py-2 font-semibold w-12">Qtd</th>
                            <th className="text-center px-2 py-2 font-semibold w-10">Un</th>
                            <th className="text-right px-3 py-2 font-semibold w-20">Vl. Unit.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.itens.map((item, i) => (
                            <tr key={i} className={`border-t ${dark ? 'border-white/5' : 'border-slate-100'}`}>
                              <td className={`px-3 py-2 ${txt}`}>
                                {item.descricao}
                                {(item as any).descricao_complementar && (
                                  <div className={`text-[10px] italic ${sub} mt-0.5`}>{(item as any).descricao_complementar}</div>
                                )}
                              </td>
                              <td className={`px-2 py-2 text-center ${sub}`}>{item.quantidade}</td>
                              <td className={`px-2 py-2 text-center ${sub}`}>{item.unidade}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${txt}`}>{fmt(item.valor_unitario_efetivo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Impostos (NF de Produto + NFS-e conforme natureza dos itens) */}
          {!pending && (pedido.requisicao?.itens ?? []).length > 0 && (() => {
            const todos = pedido.requisicao!.itens!
            const temP = todos.some(i => (i.natureza ?? 'produto') === 'produto')
            const temS = todos.some(i => i.natureza === 'servico')
            return <PedidoImpostosSection pedidoId={pedido.id} temProduto={temP} temServico={temS} dark={dark} />
          })()}

          {/* Documentos */}
          {!pending && (
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1 ${sub}`}>
                <Paperclip size={11} /> Documentos
              </p>
              <AnexosOrganizados pedidoId={pedido.id} cotacaoId={pedido.cotacao_id} canUpload={!isLiberado && !isPago} />
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            {pending && (
              <>
                {(pedido.requisicao as any)?.compra_recorrente ? (
                  <SolicitarContratoForm
                    valorMensal={pedido.valor_total || 0}
                    pedido={pedido}
                    onSuccess={() => { onClose(); window.location.href = '/contratos/solicitacoes' }}
                  />
                ) : (
                    <button
                      onClick={() => {
                        if (!podeEmitirPedidoPendente) return
                        setEmitError(null)
                        setShowEmitirModal(true)
                      }}
                    disabled={emitirPedido.isPending || !podeEmitirPedidoPendente}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition-all disabled:cursor-not-allowed ${
                      podeEmitirPedidoPendente
                        ? 'bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-500 hover:text-white'
                        : dark
                          ? 'bg-white/[0.04] text-slate-500 border-white/10'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}
                  >
                    {emitirPedido.isPending
                      ? <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                      : <FileText size={16} />}
                    {emitirPedido.isPending ? 'Emitindo...' : 'Emitir Pedido'}
                  </button>
                )}
                {motivoBloqueioEmissao && (
                  <div className={`rounded-xl border px-3 py-2 text-[11px] ${dark ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    {motivoBloqueioEmissao}
                  </div>
                )}
                {emitError && (
                  <div className={`rounded-xl border px-3 py-2 text-[11px] ${dark ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-600'}`}>
                    {emitError}
                  </div>
                )}
              </>
            )}
            {podeReceber && (
              <button onClick={() => onReceber(pedido)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-600 text-white border border-teal-700 hover:bg-teal-700 transition-all shadow-sm">
                <Package size={16} /> {parcial ? 'Receber Restante' : 'Confirmar Recebimento'}
              </button>
            )}
            {!pending && !podeConfirmarReceb && ['emitido', 'confirmado', 'em_entrega', 'parcialmente_recebido'].includes(pedido.status) && (
              <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] ${dark ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <Truck size={14} className="flex-shrink-0 mt-0.5" />
                <span>O recebimento é confirmado por quem está no <b>local de destino</b>{(pedido.requisicao as any)?.base_destino?.nome ? ` (${(pedido.requisicao as any).base_destino.nome})` : ''} ou no <b>CD Araxá</b>.</span>
              </div>
            )}
            {podeLiberar && (
              <button onClick={() => onLiberarPagamento(pedido.id)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-600 hover:text-white transition-all">
                <Banknote size={16} /> Liberar para Pagamento
              </button>
            )}
            {entregue && !podeLiberar && !isLiberado && !isPago && (
              <div className="flex items-center gap-2 text-emerald-500 text-xs font-semibold"><CheckCircle size={14} /> Entrega confirmada {pedido.data_entrega_real ? `em ${fmtData(pedido.data_entrega_real)}` : ''}</div>
            )}
            {entregue && isLiberado && !isPago && (
              <div className="flex items-center gap-2 text-orange-500 text-xs font-semibold"><Clock size={14} /> Aguardando pagamento · liberado em {fmtData(liberadoEm)}</div>
            )}
            {isPago && (
              <div className="flex items-center gap-2 text-emerald-500 text-xs font-semibold"><CheckCircle size={14} /> Pagamento confirmado {pagoEm ? `em ${fmtData(pagoEm)}` : ''}</div>
            )}
          </div>
        </div>

        {pending && pedido.requisicao_id && (
          <EmitirPedidoModal
            open={showEmitirModal}
            onClose={() => setShowEmitirModal(false)}
            requisicaoId={pedido.requisicao_id}
            cotacao={{
              id: pedido.source_cotacao?.id,
              fornecedorNome: fornecedorAtivo?.razao_social || pedido.fornecedor_nome,
              valorTotal: pedido.valor_total ?? 0,
              compradorId: pedido.source_cotacao?.comprador_id ?? undefined,
              condicaoPagamento: fornecedorResolvido?.condicaoPagamento,
            }}
            onConfirm={(payload) => {
              emitirPedido.mutate({
                ...payload,
                requisicaoId: pedido.requisicao_id!,
                fornecedorId: fornecedorAtivo?.id,
                fornecedorNome: fornecedorAtivo?.razao_social || payload.fornecedorNome,
              }, {
                onSuccess: () => {
                  setEmitError(null)
                  setShowEmitirModal(false)
                  onClose()
                  onEmitted?.()
                },
                onError: (err: any) => {
                  setEmitError(`Erro ao emitir pedido: ${err?.message || 'erro desconhecido'}`)
                },
              })
            }}
            isSubmitting={emitirPedido.isPending}
          />
        )}

        <FornecedorCadastroModal
          open={showFornecedorCadastroModal}
          dark={dark}
          title="Cadastrar fornecedor"
          description="O cadastro já abre pré-preenchido com os dados do processo de compras."
          initialData={prefillCadastro}
          requirePaymentData
          onClose={() => setShowFornecedorCadastroModal(false)}
          onSaved={handleFornecedorVinculado}
        />

        <FornecedorCadastroModal
          open={showFornecedorAtualizarModal}
          dark={dark}
          title="Atualizar dados do fornecedor"
          description="Complete os dados de pagamento para liberar a emissão do pedido."
          initialData={fornecedorAtivo ?? fornecedorDetectado ?? prefillCadastro}
          requirePaymentData
          onClose={() => setShowFornecedorAtualizarModal(false)}
          onSaved={handleFornecedorVinculado}
        />

        <FornecedorSelectorModal
          open={showFornecedorSelectorModal}
          dark={dark}
          fornecedores={fornecedoresAtivos}
          selectedId={fornecedorAtivo?.id}
          onClose={() => setShowFornecedorSelectorModal(false)}
          onSelect={handleFornecedorVinculado}
        />
      </div>
    </div>
  )
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportCSV(rows: PedidoListItem[]) {
  const header = 'Numero,Fornecedor,Valor,Status,Obra,Data Pedido,Prev Entrega,Entregue Em,NF'
  const lines = rows.map(p =>
    [
      p.numero_pedido ?? p.requisicao?.numero ?? '',
      `"${p.fornecedor_nome}"`,
      p.valor_total ?? '',
      isPendingEmission(p) ? 'pendente_emissao' : p.status,
      `"${p.requisicao?.obra_nome ?? ''}"`,
      p.data_pedido ?? '',
      p.data_prevista_entrega ?? '',
      p.data_entrega_real ?? '',
      p.nf_numero ?? '',
    ].join(',')
  )
  const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Pedidos() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const [searchParams, setSearchParams] = useSearchParams()
  const highlightPedidoId = searchParams.get('pedido')

  const [activeTab, setActiveTab]                   = useState<PipelineTab>('pendente')
  const [search, setSearch]                         = useState('')
  const [sortField, setSortField]                   = useState<SortField>('data')
  const [sortDir, setSortDir]                       = useState<SortDir>('desc')
  const [viewMode, setViewMode]                     = useState<ViewMode>('cards')
  const [selectedPedido, setSelectedPedido]         = useState<PedidoListItem | null>(null)
  const [compartilharPedido, setCompartilhar]       = useState<PedidoListItem | null>(null)
  const [showLiberarModal, setShowLiberarModal]     = useState<string | null>(null)
  const [receberPedido, setReceberPedido]           = useState<Pedido | null>(null)
  const [toast, setToast]                           = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const showToast = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000) }

  // Clear highlight param after 2s
  useEffect(() => {
    if (highlightPedidoId) {
      const timeout = setTimeout(() => setSearchParams({}, { replace: true }), 2000)
      return () => clearTimeout(timeout)
    }
  }, [highlightPedidoId, setSearchParams])

  const { data: pedidos, isLoading: isLoadingPedidos } = usePedidos()
  const { data: cotacoes = [], isLoading: isLoadingCotacoes } = useCotacoes()

  // Exclude cancelado
  const allPedidos = useMemo(() => (pedidos ?? []).filter(p => p.status !== 'cancelado'), [pedidos])
  const pedidosByReq = useMemo(() => new Set(allPedidos.map(p => p.requisicao_id).filter(Boolean)), [allPedidos])
  const pendingApprovalPedidos = useMemo<PedidoListItem[]>(() => {
    const pendingEmission = cotacoes
      .filter(c => c.status === 'concluida' && c.requisicao?.status === 'cotacao_aprovada')
      .filter(c => !pedidosByReq.has(c.requisicao_id))
      .map(c => ({
        id: `cotacao-aprovada-${c.id}`,
        requisicao_id: c.requisicao_id,
        cotacao_id: c.id,
        comprador_id: c.comprador_id,
        fornecedor_nome: c.fornecedor_selecionado_nome ?? 'Fornecedor nao definido',
        valor_total: c.valor_selecionado ?? c.requisicao?.valor_estimado,
        status: 'emitido' as const,
        created_at: c.data_conclusao ?? c.created_at,
        observacoes: c.observacao,
        requisicao: c.requisicao
          ? {
              numero: c.requisicao.numero,
              descricao: c.requisicao.descricao,
              obra_nome: c.requisicao.obra_nome,
              obra_id: (c.requisicao as any).obra_id,
              categoria: c.requisicao.categoria,
              compra_recorrente: (c.requisicao as any).compra_recorrente,
            }
          : undefined,
        pending_emissao: true,
        source_cotacao: { id: c.id, comprador_id: c.comprador_id },
      }))

    // Requisições aguardando contrato (compra recorrente)
    const aguardandoContrato = cotacoes
      .filter(c => c.status === 'concluida' && c.requisicao?.status === 'aguardando_contrato')
      .filter(c => !pedidosByReq.has(c.requisicao_id))
      .map(c => ({
        id: `aguardando-contrato-${c.id}`,
        requisicao_id: c.requisicao_id,
        cotacao_id: c.id,
        comprador_id: c.comprador_id,
        fornecedor_nome: c.fornecedor_selecionado_nome ?? 'Fornecedor nao definido',
        valor_total: c.valor_selecionado ?? c.requisicao?.valor_estimado,
        status: 'emitido' as const,
        created_at: c.data_conclusao ?? c.created_at,
        observacoes: c.observacao,
        requisicao: c.requisicao
          ? {
              numero: c.requisicao.numero,
              descricao: c.requisicao.descricao,
              obra_nome: c.requisicao.obra_nome,
              obra_id: (c.requisicao as any).obra_id,
              categoria: c.requisicao.categoria,
              compra_recorrente: (c.requisicao as any).compra_recorrente,
            }
          : undefined,
        pending_emissao: true,
        aguardando_contrato: true,
        source_cotacao: { id: c.id, comprador_id: c.comprador_id },
      }))

    // Recorrentes com contrato formalizado → aba Encerrado com link
    const contratoFormalizado = cotacoes
      .filter(c => c.status === 'concluida' && c.requisicao?.status === 'pedido_emitido' && (c.requisicao as any)?.compra_recorrente)
      .filter(c => !pedidosByReq.has(c.requisicao_id))
      .map(c => ({
        id: `contrato-${c.id}`,
        requisicao_id: c.requisicao_id,
        cotacao_id: c.id,
        comprador_id: c.comprador_id,
        fornecedor_nome: c.fornecedor_selecionado_nome ?? '',
        valor_total: c.valor_selecionado ?? c.requisicao?.valor_estimado,
        status: 'entregue' as const,
        status_pagamento: 'pago' as const,
        created_at: c.data_conclusao ?? c.created_at,
        observacoes: 'Contrato formalizado',
        requisicao: c.requisicao
          ? {
              numero: c.requisicao.numero,
              descricao: c.requisicao.descricao,
              obra_nome: c.requisicao.obra_nome,
              categoria: c.requisicao.categoria,
              compra_recorrente: true,
            }
          : undefined,
        pending_emissao: false,
        contrato_ativo: true,
      }))

    return [...pendingEmission, ...aguardandoContrato, ...contratoFormalizado]
  }, [cotacoes, pedidosByReq])
  const allPedidoItems = useMemo<PedidoListItem[]>(
    () => [...pendingApprovalPedidos, ...allPedidos],
    [pendingApprovalPedidos, allPedidos],
  )
  const isLoading = isLoadingPedidos || isLoadingCotacoes

  // Count per tab
  const counts = useMemo(() => {
    const c: Record<PipelineTab, number> = { pendente: 0, emitido: 0, entregue: 0, encerrado: 0 }
    for (const p of allPedidoItems) {
      for (const stage of PIPELINE_STAGES) {
        if (stage.matchFn(p)) { c[stage.key]++; break }
      }
    }
    return c
  }, [allPedidoItems])

  // Filter by active tab
  const stage = PIPELINE_STAGES.find(s => s.key === activeTab)!
  const tabFiltered = useMemo(() => allPedidoItems.filter(stage.matchFn), [allPedidoItems, stage])

  // Search
  const searched = useMemo(() => {
    if (!search.trim()) return tabFiltered
    const q = search.toLowerCase()
    return tabFiltered.filter(p =>
      (p.numero_pedido ?? '').toLowerCase().includes(q) ||
      p.fornecedor_nome.toLowerCase().includes(q) ||
      (p.requisicao?.descricao ?? '').toLowerCase().includes(q) ||
      (p.requisicao?.obra_nome ?? '').toLowerCase().includes(q) ||
      (p.nf_numero ?? '').toLowerCase().includes(q)
    )
  }, [tabFiltered, search])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...searched]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      if (sortField === 'data') {
        return dir * ((a.data_pedido ?? '').localeCompare(b.data_pedido ?? ''))
      }
      if (sortField === 'valor') {
        return dir * ((a.valor_total ?? 0) - (b.valor_total ?? 0))
      }
      return dir * ((a.fornecedor_nome ?? '').localeCompare(b.fornecedor_nome ?? ''))
    })
    return arr
  }, [searched, sortField, sortDir])

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

  const liberarPedido = sorted.find(p => p.id === showLiberarModal && !isPendingEmission(p)) ?? allPedidos.find(p => p.id === showLiberarModal)

  // Auto-open detail if highlight param
  useEffect(() => {
    if (highlightPedidoId && allPedidoItems.length > 0) {
      const found = allPedidoItems.find(p => p.id === highlightPedidoId)
      if (found) setSelectedPedido(found)
    }
  }, [highlightPedidoId, allPedidoItems])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.msg}
        </div>
      )}
      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-extrabold tracking-tight flex items-center gap-2 ${dark ? 'text-white' : 'text-slate-800'}`}>
          <Truck size={18} className="text-teal-500" />
          Pedidos
        </h2>
      </div>

      {/* Pipeline tabs */}
      <div className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar ${dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {PIPELINE_STAGES.map(st => {
          const active = activeTab === st.key
          const acc = dark ? STATUS_ACCENT_DARK[st.key] : STATUS_ACCENT[st.key]
          const Icon = st.icon
          return (
            <button
              key={st.key}
              onClick={() => setActiveTab(st.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                active
                  ? `${acc.bgActive} ${acc.textActive} ${acc.border} shadow-sm`
                  : dark
                    ? `${acc.text} ${acc.bg} border-transparent`
                    : `${acc.text} ${acc.bg} border-transparent hover:bg-white hover:shadow-sm`
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <span>{st.label}</span>
              <span className={`ml-1 min-w-[22px] px-1.5 py-0.5 rounded-full text-[10px] font-bold text-center ${
                active
                  ? acc.badge
                  : dark
                    ? 'bg-white/[0.06] text-slate-500'
                    : 'bg-slate-100 text-slate-500'
              }`}>
                {counts[st.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pedido, fornecedor, NF..."
            className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-teal-400 ${
              dark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
            }`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort buttons */}
        {(['data', 'valor', 'fornecedor'] as SortField[]).map(f => {
          const labels: Record<SortField, string> = { data: 'Data', valor: 'Valor', fornecedor: 'Fornecedor' }
          const active = sortField === f
          return (
            <button
              key={f}
              onClick={() => toggleSort(f)}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                active
                  ? dark ? 'bg-white/10 border-white/20 text-white' : 'bg-teal-50 border-teal-200 text-teal-700'
                  : dark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
            >
              {labels[f]}
              {active && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </button>
          )
        })}

        {/* View toggle */}
        <div className={`flex rounded-xl border overflow-hidden ${dark ? 'border-white/10' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('cards')} className={`p-2 ${viewMode === 'cards' ? (dark ? 'bg-white/10 text-white' : 'bg-teal-50 text-teal-600') : (dark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600')}`}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? (dark ? 'bg-white/10 text-white' : 'bg-teal-50 text-teal-600') : (dark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600')}`}>
            <LayoutList size={14} />
          </button>
        </div>

        {/* CSV export */}
        <button onClick={() => exportCSV(sorted)} className={`p-2 rounded-xl border transition-colors ${dark ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/10' : 'border-slate-200 text-slate-400 hover:text-teal-600 hover:bg-teal-50'}`} title="Exportar CSV">
          <Download size={14} />
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <Package size={32} className={`mx-auto mb-2 ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {search ? 'Nenhum pedido encontrado para essa busca' : 'Nenhum pedido nesta etapa'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-2 p-4 stagger-children">
          {sorted.map(p => (
            <PedCard key={p.id} pedido={p} dark={dark} onClick={() => setSelectedPedido(p)} />
          ))}
        </div>
      ) : (
        /* Table view */
        <div className={`rounded-xl border overflow-x-auto ${dark ? 'border-white/10' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={dark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'}>
                <th className="text-left px-3 py-2.5 font-semibold">Número</th>
                <th className="text-left px-3 py-2.5 font-semibold">Fornecedor</th>
                <th className="text-left px-3 py-2.5 font-semibold">Obra</th>
                <th className="text-right px-3 py-2.5 font-semibold">Valor</th>
                <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                <th className="text-left px-3 py-2.5 font-semibold">Prev. Entrega</th>
                <th className="text-left px-3 py-2.5 font-semibold">Data Pedido</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${dark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {sorted.map(p => {
                const st2 = getStatusMeta(p)
                const pending = isPendingEmission(p)
                const d = diasRestantes(p.data_prevista_entrega)
                const atr = !pending && d !== null && d < 0 && p.status !== 'entregue' && p.status !== 'parcialmente_recebido'
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPedido(p)}
                    className={`cursor-pointer transition-colors ${dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                  >
                    <td className={`px-3 py-2.5 font-mono ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {getDisplayNumber(p)}
                    </td>
                    <td className={`px-3 py-2.5 font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                      {p.fornecedor_nome}
                    </td>
                    <td className={`px-3 py-2.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {p.requisicao?.obra_nome ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-teal-500">
                      {fmt(p.valor_total)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${dark ? st2.bgDark + ' ' + st2.textDark : st2.bg + ' ' + st2.text}`}>
                          {st2.label}
                        </span>
                        {p.sem_cotacao && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${dark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                            S/ COT.
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-2.5 ${atr ? 'text-red-500 font-semibold' : dark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {pending ? 'Cotacao aprovada' : fmtDataISO(p.data_prevista_entrega)}
                      {d !== null && p.status !== 'entregue' && !pending && <span className="ml-1 text-[10px]">({d}d)</span>}
                    </td>
                    <td className={`px-3 py-2.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {pending ? 'Nao emitido' : fmtData(p.data_pedido)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={`text-center text-xs py-2 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
        {sorted.length} item{sorted.length !== 1 ? 's' : ''}
      </p>

      {/* Detail modal */}
      {selectedPedido && (
        <DetailModal
          pedido={selectedPedido}
          dark={dark}
          onClose={() => setSelectedPedido(null)}
          onCompartilhar={p => { setSelectedPedido(null); setCompartilhar(p) }}
          onLiberarPagamento={id => { setSelectedPedido(null); setShowLiberarModal(id) }}
          onReceber={p => { setSelectedPedido(null); setReceberPedido(p) }}
          onEmitted={() => { setActiveTab('emitido'); showToast('success', 'Pedido emitido com sucesso!') }}
        />
      )}

      {/* Compartilhar modal */}
      {compartilharPedido && (
        <CompartilharModal pedido={compartilharPedido} onClose={() => setCompartilhar(null)} dark={dark} />
      )}

      {/* Liberar pagamento modal */}
      {showLiberarModal && liberarPedido && (
        <LiberarPagamentoModal pedido={liberarPedido} onClose={() => setShowLiberarModal(null)} />
      )}

      {/* Recebimento modal */}
      {receberPedido && (
        <RecebimentoModal pedido={receberPedido} onClose={() => setReceberPedido(null)} />
      )}
    </div>
  )
}
