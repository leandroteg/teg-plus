import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Package, Truck, CheckCircle, Clock, AlertTriangle,
  FileText, Share2, Download, MessageCircle, Mail, Upload, X, Paperclip,
  Banknote, ExternalLink, Loader2,
  Search, LayoutList, LayoutGrid, ArrowUp, ArrowDown,
  ClipboardList, ShieldCheck, BoxIcon, CreditCard, ArchiveIcon,
  Building2, Link2, RefreshCw, UserPlus,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import jsPDF from 'jspdf'
import { useTheme } from '../contexts/ThemeContext'
import {
  usePedidos,
  useAtualizarPedido,
  useLiberarPagamento,
  useEmitirPedido,
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
import type { Cotacao, Pedido } from '../types'
import type { Fornecedor } from '../types/financeiro'

// ─── Types ────────────────────────────────────────────────────────────────────

type PipelineTab = 'pendente' | 'emitido' | 'entregue' | 'liberado' | 'encerrado'
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
      const num = `SOL-CON-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
      const { error: solErr } = await supabase.from('con_solicitacoes').insert({
        numero: num,
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
      })
      if (solErr) throw solErr
      await supabase.from('cmp_requisicoes').update({ status: 'aguardando_contrato' }).eq('id', pedido.requisicao_id)
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
    label: 'Pendente',
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
    key: 'liberado',
    label: 'Liberado p/ Pgto',
    icon: CreditCard,
    matchFn: p => !isPendingEmission(p) && (p as any).status_pagamento === 'liberado',
  },
  {
    key: 'encerrado',
    label: 'Encerrado',
    icon: ArchiveIcon,
    matchFn: p => !isPendingEmission(p) && (p as any).status_pagamento === 'pago',
  },
]

const STATUS_ACCENT: Record<PipelineTab, { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }> = {
  pendente:  { bg: 'hover:bg-cyan-50',    bgActive: 'bg-cyan-50',    text: 'text-cyan-600',    textActive: 'text-cyan-800',    badge: 'bg-cyan-100 text-cyan-700',       border: 'border-cyan-400' },
  emitido:   { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    badge: 'bg-blue-100 text-blue-700',       border: 'border-blue-500' },
  entregue:  { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-500' },
  liberado:  { bg: 'hover:bg-orange-50',  bgActive: 'bg-orange-50',  text: 'text-orange-600',  textActive: 'text-orange-800',  badge: 'bg-orange-100 text-orange-700',   border: 'border-orange-400' },
  encerrado: { bg: 'hover:bg-slate-50',   bgActive: 'bg-slate-100',  text: 'text-slate-500',   textActive: 'text-slate-700',   badge: 'bg-slate-200 text-slate-600',     border: 'border-slate-400' },
}

const STATUS_ACCENT_DARK: Record<PipelineTab, { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }> = {
  pendente:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-cyan-500/10',    text: 'text-cyan-400',    textActive: 'text-cyan-300',    badge: 'bg-cyan-500/20 text-cyan-300',       border: 'border-cyan-500/40' },
  emitido:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300',    badge: 'bg-blue-500/20 text-blue-300',       border: 'border-blue-500/40' },
  entregue:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/40' },
  liberado:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-orange-500/10',  text: 'text-orange-400',  textActive: 'text-orange-300',  badge: 'bg-orange-500/20 text-orange-300',   border: 'border-orange-500/40' },
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
  label: 'Aguardando Emissao',
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
  return isPendingEmission(pedido)
    ? pendingEmissionStatus
    : (statusConfig[pedido.status] || statusConfig.emitido)
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

function buildPdfHtml(pedido: Pedido, EMPRESA: EmpresaData = EMPRESA_FALLBACK): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c))
  const numero = esc(pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase())
  const itens = pedido.requisicao?.itens ?? []
  const parcelas = pedido.parcelas_preview ?? []

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
              <td>${esc(item.descricao)}</td>
              <td style="text-align:center">${item.quantidade}</td>
              <td style="text-align:center">${esc(item.unidade)}</td>
              <td style="text-align:right">${fmtBRL(item.valor_unitario_estimado)}</td>
              <td style="text-align:right;font-weight:600">${fmtBRL(item.quantidade * item.valor_unitario_estimado)}</td>
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
              <td>${esc(p.descricao || `Parcela ${p.numero}/${parcelas.length}`)}</td>
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
<title>Pedido de Compra #${numero}</title>
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
    .header { background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; border: 1px solid #e2e8f0 !important; }
    .company-name { color: #1e293b !important; }
    .company-cnpj { color: #475569 !important; }
    .doc-title { color: #0d9488 !important; }
    .doc-number { color: #1e293b !important; }
    .doc-date { color: #475569 !important; }
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
  const itens = pedido.requisicao?.itens ?? []
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
    itens.forEach((item, i) => {
      if (y > 265) { doc.addPage(); y = M }
      const subtotal = item.quantidade * item.valor_unitario_estimado
      doc.text(String(i + 1), cols[0], y)
      const desc = item.descricao.length > 45 ? item.descricao.slice(0, 42) + '...' : item.descricao
      doc.text(desc, cols[1], y)
      doc.text(String(item.quantidade), cols[2], y)
      doc.text(item.unidade, cols[3], y)
      doc.text(fmtBRL(item.valor_unitario_estimado), cols[4], y)
      doc.setFont('helvetica', 'bold')
      doc.text(fmtBRL(subtotal), cols[5], y)
      doc.setFont('helvetica', 'normal')
      y += 5
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
      doc.text(String(p.numero), pCols[0] + 6, y)
      doc.text(p.descricao || `Parcela ${p.numero}/${parcelas.length}`, pCols[1], y)
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
  { value: 'medicao',             label: 'Planilha de Medição'   },
  { value: 'outro',               label: 'Outro'                 },
]

function LiberarPagamentoModal({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  const uploadAnexo   = useUploadAnexo()
  const liberarPgto   = useLiberarPagamento()
  const fileRef       = useRef<HTMLInputElement>(null)

  const [file, setFile]       = useState<File | null>(null)
  const [tipo, setTipo]       = useState<PedidoAnexo['tipo']>('nota_fiscal')
  const [obs, setObs]         = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setErro('') }
  }

  const handleSubmit = async () => {
    if (!file) { setErro('Selecione um arquivo para continuar.'); return }
    setLoading(true)
    setErro('')
    try {
      await uploadAnexo.mutateAsync({ pedidoId: pedido.id, file, tipo, observacao: obs || undefined, origem: 'compras' })
      await liberarPgto.mutateAsync(pedido.id)
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
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Anexar Documento <span className="text-red-500">*</span></label>
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
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Observação <span className="text-slate-400 font-normal">(opcional)</span></label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Ex: NF entregue junto com o material..." className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300" />
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

function AnexosOrganizados({ pedidoId, cotacaoId }: { pedidoId: string; cotacaoId?: string }) {
  const { data: anexos, isLoading: loadingAnexos }  = useAnexosPedido(pedidoId)
  const { data: cotDocs, isLoading: loadingCot }     = useCotacaoDocs(cotacaoId)
  const isLoading = loadingAnexos || (cotacaoId ? loadingCot : false)

  if (isLoading) return <div className="flex items-center gap-2 py-2 text-xs text-slate-400"><div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />Carregando documentos...</div>

  const cotacaoDocs   = cotDocs ?? []
  const nfDocs        = anexos?.filter(a => a.tipo === 'nota_fiscal') ?? []
  const pedidoAnexos  = anexos?.filter(a => a.tipo !== 'nota_fiscal' && a.tipo !== 'comprovante_pagamento') ?? []
  const pagamentoDocs = anexos?.filter(a => a.tipo === 'comprovante_pagamento') ?? []
  const totalDocs     = cotacaoDocs.length + nfDocs.length + pedidoAnexos.length + pagamentoDocs.length

  if (totalDocs === 0) return <div><p className="text-xs text-slate-400 italic py-1">Nenhum documento encontrado.</p><UploadAnexoInline pedidoId={pedidoId} /></div>

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
      <UploadAnexoInline pedidoId={pedidoId} />
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
  const qtdTotal     = pedido.qtd_itens_total ?? 0
  const qtdRecebidos = pedido.qtd_itens_recebidos ?? 0

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
        dark
          ? `bg-[#1e293b] border-white/10 hover:border-white/20`
          : `bg-white ${atrasado ? 'border-red-200' : isPago ? 'border-emerald-300' : isLiberado ? 'border-orange-200' : entregue ? 'border-emerald-200' : 'border-slate-200'} shadow-sm`
      }`}
    >
      <div className="p-4 space-y-2">
        {/* Header: number + status + value */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={`text-[10px] font-mono ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{getDisplayNumber(pedido)}</span>
            <p className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-slate-800'}`}>{pedido.fornecedor_nome}</p>
          </div>
          <p className="text-sm font-extrabold text-teal-500 flex-shrink-0">{fmt(pedido.valor_total)}</p>
        </div>

        {/* RC + Obra */}
        {pedido.requisicao && (
          <p className={`text-xs truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className={`font-mono ${dark ? 'text-slate-500' : 'text-slate-300'}`}>{pedido.requisicao.numero}</span>
            {' · '}{pedido.requisicao.justificativa || pedido.requisicao.descricao}
            {pedido.requisicao.obra_nome && <span className={dark ? 'text-slate-500' : 'text-slate-400'}> · {pedido.requisicao.obra_nome}</span>}
          </p>
        )}

        {/* Status badges + dates */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${dark ? st.bgDark + ' ' + st.textDark : st.bg + ' ' + st.text}`}>{st.label}</span>
          {pending && <span className="text-[10px] text-amber-600 font-bold">RC aprovada</span>}
          {isPago && <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><CheckCircle size={9} /> Pago</span>}
          {isLiberado && !isPago && <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700"><Clock size={9} /> Aguard. Pgto</span>}
          {atrasado && <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold"><AlertTriangle size={10} /> {Math.abs(dias!)}d atr.</span>}
          {parcial && qtdTotal > 0 && <span className="text-[10px] text-amber-600 font-bold">{qtdRecebidos}/{qtdTotal} receb.</span>}
          {(pedido as any).contrato_ativo && (
            <a href={`/contratos/gestao`} onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors">
              <ExternalLink size={9} /> Ver Contrato
            </a>
          )}
        </div>

        {/* Dates row */}
        <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span>Pedido: {fmtData(pedido.data_pedido)}</span>
          <span className={atrasado ? 'text-red-500 font-semibold' : ''}>
            Prev: {fmtDataISO(pedido.data_prevista_entrega)}
            {dias !== null && !entregue && !pending && <span className="ml-0.5">({dias}d)</span>}
          </span>
          {!entregue && !parcial && pedido.requisicao?.data_necessidade && (
            <span>Necess: {fmtDataISO(pedido.requisicao.data_necessidade)}</span>
          )}
          {pedido.data_entrega_real && (
            <span className="text-emerald-500">
              Recebido: {fmtData(pedido.data_entrega_real)}
              {pedido.data_pedido && (() => {
                const d0 = new Date(pedido.data_pedido)
                const d1 = new Date(pedido.data_entrega_real!)
                const delta = Math.round((d1.getTime() - d0.getTime()) / 86400000)
                return <span className="ml-0.5 font-semibold">({delta}d)</span>
              })()}
            </span>
          )}
        </div>

        {/* Urgência flag (before delivery) */}
        {!entregue && !parcial && pedido.requisicao?.urgencia && pedido.requisicao.urgencia !== 'normal' && (
          <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${
            pedido.requisicao.urgencia === 'critica'
              ? dark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
              : dark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
          }`}>{pedido.requisicao.urgencia === 'critica' ? '\u26a1 Cr\u00edtica' : '\u26a1 Urgente'}</span>
        )}
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
  const { data: fornecedoresAtivos = [] } = useCadFornecedores({ ativo: true })
  const [confirmando, setConfirmando] = useState(false)
  const [showEmitirModal, setShowEmitirModal] = useState(false)
  const [showFornecedorCadastroModal, setShowFornecedorCadastroModal] = useState(false)
  const [showFornecedorAtualizarModal, setShowFornecedorAtualizarModal] = useState(false)
  const [showFornecedorSelectorModal, setShowFornecedorSelectorModal] = useState(false)
  const [fornecedorVinculado, setFornecedorVinculado] = useState<Fornecedor | null>(null)

  const dias     = diasRestantes(pedido.data_prevista_entrega)
  const st       = getStatusMeta(pedido)
  const pending  = isPendingEmission(pedido)
  const entregue = pedido.status === 'entregue'
  const parcial  = pedido.status === 'parcialmente_recebido'
  const atrasado = dias !== null && dias < 0 && !entregue && !parcial
  const podeReceber = !pending && ['emitido', 'confirmado', 'em_entrega', 'parcialmente_recebido'].includes(pedido.status)
  const qtdTotal     = pedido.qtd_itens_total ?? 0
  const qtdRecebidos = pedido.qtd_itens_recebidos ?? 0
  const statusPgto     = (pedido as any).status_pagamento as string | undefined
  const liberadoEm     = (pedido as any).liberado_pagamento_em as string | undefined
  const pagoEm         = (pedido as any).pago_em as string | undefined
  const isLiberado     = statusPgto === 'liberado'
  const isPago         = statusPgto === 'pago'
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
  const fornecedorAtivo = fornecedorVinculado
  const fornecedorAtivoComplete = hasFornecedorPaymentData(fornecedorAtivo)
  const camposPagamentoPendentes = getFornecedorPaymentMissingFields(fornecedorAtivo)
  const podeEmitirPedidoPendente = !pending || Boolean(fornecedorAtivo && fornecedorAtivoComplete)
  const motivoBloqueioEmissao = !pending
    ? null
    : !fornecedorAtivo
      ? 'Vincule ou cadastre o fornecedor mestre antes de emitir o pedido.'
      : !fornecedorAtivoComplete
        ? `Atualize os dados de pagamento do fornecedor: ${camposPagamentoPendentes.join(', ')}.`
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
            {pedido.nf_numero && (
              <div>
                <span className={sub}>NF</span>
                <p className={`font-semibold font-mono ${txt}`}>{pedido.nf_numero}</p>
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

          {/* Documentos */}
          {!pending && (
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1 ${sub}`}>
                <Paperclip size={11} /> Documentos
              </p>
              <AnexosOrganizados pedidoId={pedido.id} cotacaoId={pedido.cotacao_id} />
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
              </>
            )}
            {podeReceber && (
              <button onClick={() => onReceber(pedido)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-600 text-white border border-teal-700 hover:bg-teal-700 transition-all shadow-sm">
                <Package size={16} /> {parcial ? 'Receber Restante' : 'Confirmar Recebimento'}
              </button>
            )}
            {!pending && pedido.status === 'emitido' && !podeReceber && (
              <button onClick={confirmarEntrega} disabled={confirmando || mutation.isPending} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${dark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                {confirmando ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={14} />}
                Confirmar Entrega Direta
              </button>
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
                  setShowEmitirModal(false)
                  onClose()
                  onEmitted?.()
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
    const c: Record<PipelineTab, number> = { pendente: 0, emitido: 0, entregue: 0, liberado: 0, encerrado: 0 }
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${dark ? st2.bgDark + ' ' + st2.textDark : st2.bg + ' ' + st2.text}`}>
                        {st2.label}
                      </span>
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
