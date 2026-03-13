import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Package, Truck, CheckCircle, Clock, AlertTriangle,
  FileText, Share2, Download, MessageCircle, Mail, Upload, X, Paperclip,
  Banknote, ExternalLink, Loader2,
  Search, LayoutList, LayoutGrid, ArrowUp, ArrowDown,
  ClipboardList, ShieldCheck, BoxIcon, CreditCard, ArchiveIcon,
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
import { useCotacoes } from '../hooks/useCotacoes'
import { api } from '../services/api'
import { supabase } from '../services/supabase'
import { useAnexosPedido, useUploadAnexo, useCotacaoDocs, TIPO_LABEL } from '../hooks/useAnexos'
import type { PedidoAnexo } from '../hooks/useAnexos'
import FluxoTimeline from '../components/FluxoTimeline'
import RecebimentoModal from '../components/RecebimentoModal'
import type { Cotacao, Pedido } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

type PipelineTab = 'pendente' | 'emitido' | 'entregue' | 'liberado' | 'encerrado'
type SortField = 'data' | 'valor' | 'fornecedor'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'
type PedidoListItem = Pedido & {
  pending_emissao?: boolean
  source_cotacao?: Pick<Cotacao, 'id' | 'comprador_id'>
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
    matchFn: p => isPendingEmission(p) || p.status === 'emitido',
  },
  {
    key: 'emitido',
    label: 'Emitido',
    icon: Truck,
    matchFn: p => !isPendingEmission(p) && p.status === 'confirmado',
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
    matchFn: p => !isPendingEmission(p) && (p as any).status_pagamento === 'liberado' && (p as any).status_pagamento !== 'pago',
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

function isPendingEmission(pedido: PedidoListItem) {
  return pedido.pending_emissao === true
}

function getStatusMeta(pedido: PedidoListItem) {
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

function gerarPdfHtml(pedido: Pedido): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c))
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido de Compra #${esc(pedido.numero_pedido ?? '')}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #0d9488; padding-bottom: 20px; }
        .logo { font-size: 24px; font-weight: 900; color: #0d9488; }
        .title { font-size: 18px; font-weight: 700; color: #334155; }
        .field-row { display: flex; gap: 20px; margin-bottom: 16px; }
        .field { flex: 1; }
        .label { font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .value { font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px; }
        .value.big { font-size: 20px; font-weight: 900; color: #0d9488; }
        .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
        @media print { button { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">TEG+</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px">Sistema ERP</div>
        </div>
        <div style="text-align:right">
          <div class="title">Pedido de Compra</div>
          <div style="font-size:13px;font-weight:700;color:#0d9488">#${esc(pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase())}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">${new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      <div class="section">
        <div class="field-row">
          <div class="field">
            <div class="label">Fornecedor</div>
            <div class="value">${esc(pedido.fornecedor_nome)}</div>
          </div>
          <div class="field">
            <div class="label">Valor Total</div>
            <div class="value big">${pedido.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'}</div>
          </div>
        </div>
        ${pedido.requisicao ? `
        <div class="field-row">
          <div class="field">
            <div class="label">Requisição</div>
            <div class="value">${esc(pedido.requisicao.numero)} — ${esc(pedido.requisicao.descricao)}</div>
          </div>
          <div class="field">
            <div class="label">Obra / Projeto</div>
            <div class="value">${esc(pedido.requisicao.obra_nome ?? '—')}</div>
          </div>
        </div>` : ''}
        <div class="field-row">
          <div class="field">
            <div class="label">Data do Pedido</div>
            <div class="value">${pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString('pt-BR') : '—'}</div>
          </div>
          <div class="field">
            <div class="label">Previsão de Entrega</div>
            <div class="value">${pedido.data_prevista_entrega ? new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
          </div>
          ${pedido.nf_numero ? `<div class="field"><div class="label">NF</div><div class="value">${esc(pedido.nf_numero)}</div></div>` : ''}
        </div>
        ${pedido.observacoes ? `<div class="field"><div class="label">Observações</div><div class="value">${esc(pedido.observacoes)}</div></div>` : ''}
      </div>

      <div class="footer">
        TEG+ ERP · Pedido de Compra · Emitido em ${new Date().toLocaleString('pt-BR')}<br>
        Este documento é válido apenas com a assinatura do responsável pelo setor de compras.
      </div>
    </body>
    </html>
  `
}

function gerarPdfPedido(pedido: Pedido) {
  const html = gerarPdfHtml(pedido)
  const printWin = window.open('', '_blank', 'width=900,height=700')
  if (!printWin) return
  printWin.document.open()
  printWin.document.writeln(html)
  printWin.document.close()
  printWin.focus()
  setTimeout(() => printWin.print(), 500)
}

function gerarPdfBlob(pedido: Pedido): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15
  const CW = W - 2 * M
  let y = M

  const TEAL = [13, 148, 136] as const
  const DARK = [30, 41, 59] as const
  const MID  = [100, 116, 139] as const
  const LIGHT = [226, 232, 240] as const

  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('TEG+', M, 14)
  doc.setFontSize(10)
  doc.text('Pedido de Compra', M, 22)

  const numero = pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()
  doc.setFontSize(14)
  doc.text(`#${numero}`, W - M, 14, { align: 'right' })
  doc.setFontSize(9)
  doc.text(new Date().toLocaleDateString('pt-BR'), W - M, 22, { align: 'right' })
  y = 36

  const addField = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MID)
    doc.text(label, M, y)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...DARK)
    doc.text(value || '—', M + 45, y)
    y += 7
  }

  addField('Fornecedor', pedido.fornecedor_nome, true)
  addField('Valor Total', pedido.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—', true)
  if (pedido.requisicao) {
    addField('Requisicao', `${pedido.requisicao.numero} — ${pedido.requisicao.descricao}`)
    if (pedido.requisicao.obra_nome) addField('Obra', pedido.requisicao.obra_nome)
  }
  addField('Data Pedido', pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString('pt-BR') : '—')
  addField('Prev. Entrega', pedido.data_prevista_entrega ? new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '—')
  if (pedido.nf_numero) addField('NF', pedido.nf_numero)
  if (pedido.observacoes) {
    y += 3
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MID)
    doc.text('Observacoes', M, y)
    y += 5
    doc.setTextColor(...DARK)
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(pedido.observacoes, CW)
    doc.text(lines, M, y)
    y += lines.length * 5
  }

  y = 282
  doc.setDrawColor(...LIGHT)
  doc.line(M, y - 4, W - M, y - 4)
  doc.setFontSize(8)
  doc.setTextColor(...MID)
  doc.text(`TEG+ ERP · Pedido de Compra · Emitido em ${new Date().toLocaleString('pt-BR')}`, W / 2, y, { align: 'center' })

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
      const blob = gerarPdfBlob(pedido)
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

  const pdfHtml = gerarPdfHtml(pedido)

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
            {' · '}{pedido.requisicao.descricao}
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
        </div>

        {/* Dates row */}
        <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span>Pedido: {fmtData(pedido.data_pedido)}</span>
          <span className={atrasado ? 'text-red-500 font-semibold' : ''}>
            Prev: {fmtDataISO(pedido.data_prevista_entrega)}
            {dias !== null && !entregue && !pending && <span className="ml-0.5">({dias}d)</span>}
          </span>
          {pedido.data_entrega_real && <span className="text-emerald-500">Entreg: {fmtData(pedido.data_entrega_real)}</span>}
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
}: {
  pedido: PedidoListItem
  dark: boolean
  onClose: () => void
  onCompartilhar: (p: PedidoListItem) => void
  onLiberarPagamento: (id: string) => void
  onReceber: (p: Pedido) => void
}) {
  const mutation = useAtualizarPedido()
  const emitirPedido = useEmitirPedido()
  const [confirmando, setConfirmando] = useState(false)

  const dias     = diasRestantes(pedido.data_prevista_entrega)
  const st       = getStatusMeta(pedido)
  const pending  = isPendingEmission(pedido)
  const entregue = pedido.status === 'entregue'
  const parcial  = pedido.status === 'parcialmente_recebido'
  const atrasado = dias !== null && dias < 0 && !entregue && !parcial
  const podeReceber = !pending && ['confirmado', 'em_entrega', 'parcialmente_recebido'].includes(pedido.status)
  const qtdTotal     = pedido.qtd_itens_total ?? 0
  const qtdRecebidos = pedido.qtd_itens_recebidos ?? 0
  const statusPgto     = (pedido as any).status_pagamento as string | undefined
  const liberadoEm     = (pedido as any).liberado_pagamento_em as string | undefined
  const pagoEm         = (pedido as any).pago_em as string | undefined
  const isLiberado     = statusPgto === 'liberado'
  const isPago         = statusPgto === 'pago'
  const podeLiberar    = entregue && !statusPgto

  const confirmarEntrega = async () => {
    setConfirmando(true)
    try {
      await mutation.mutateAsync({ id: pedido.id, status: 'entregue', data_entrega_real: new Date().toISOString().split('T')[0] })
    } finally {
      setConfirmando(false)
    }
  }

  const handleEmitirPedido = async () => {
    if (!pedido.requisicao_id || !pedido.source_cotacao?.id) return
    await emitirPedido.mutateAsync({
      requisicaoId: pedido.requisicao_id,
      cotacaoId: pedido.source_cotacao.id,
      fornecedorNome: pedido.fornecedor_nome,
      valorTotal: pedido.valor_total ?? 0,
      compradorId: pedido.source_cotacao.comprador_id ?? undefined,
    })
    onClose()
  }

  const bg  = dark ? 'bg-[#0f172a]' : 'bg-white'
  const txt = dark ? 'text-white' : 'text-slate-800'
  const sub = dark ? 'text-slate-400' : 'text-slate-500'
  const brd = dark ? 'border-white/10' : 'border-slate-200'

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
          {pedido.requisicao?.descricao && (
            <div className={`rounded-xl p-3 border ${dark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${sub}`}>Descrição da RC</p>
              <p className={`text-xs leading-relaxed ${sub}`}>{pedido.requisicao.descricao}</p>
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
              <button onClick={handleEmitirPedido} disabled={emitirPedido.isPending} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-50 text-teal-700 border border-teal-300 hover:bg-teal-500 hover:text-white transition-all disabled:opacity-50">
                {emitirPedido.isPending
                  ? <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                  : <FileText size={16} />}
                {emitirPedido.isPending ? 'Emitindo...' : 'Emitir Pedido'}
              </button>
            )}
            {podeReceber && (
              <button onClick={() => onReceber(pedido)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-50 text-teal-700 border border-teal-300 hover:bg-teal-500 hover:text-white transition-all">
                <Package size={16} /> {parcial ? 'Receber Restante' : 'Receber'}
              </button>
            )}
            {!pending && pedido.status === 'emitido' && (
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
  const pendingApprovalPedidos = useMemo<PedidoListItem[]>(
    () => cotacoes
      .filter(c => c.status === 'concluida' && c.requisicao?.status === 'cotacao_aprovada')
      .filter(c => !pedidosByReq.has(c.requisicao_id))
      .map(c => ({
        id: `cotacao-aprovada-${c.id}`,
        requisicao_id: c.requisicao_id,
        cotacao_id: c.id,
        comprador_id: c.comprador_id,
        fornecedor_nome: c.fornecedor_selecionado_nome ?? 'Fornecedor nao definido',
        valor_total: c.valor_selecionado ?? c.requisicao?.valor_estimado,
        status: 'emitido',
        created_at: c.data_conclusao ?? c.created_at,
        observacoes: c.observacao,
        requisicao: c.requisicao
          ? {
              numero: c.requisicao.numero,
              descricao: c.requisicao.descricao,
              obra_nome: c.requisicao.obra_nome,
              categoria: c.requisicao.categoria,
            }
          : undefined,
        pending_emissao: true,
        source_cotacao: { id: c.id, comprador_id: c.comprador_id },
      })),
    [cotacoes, pedidosByReq],
  )
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
        <div className="space-y-2 p-4">
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
