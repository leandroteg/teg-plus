import { useState, useRef, useEffect } from 'react'
import {
  Package, Truck, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp,
  FileText, Share2, Download, MessageCircle, Mail, Upload, X, Paperclip,
  Banknote, ExternalLink,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { usePedidos, useAtualizarPedido, useLiberarPagamento } from '../hooks/usePedidos'
import { api } from '../services/api'
import { useAnexosPedido, useUploadAnexo, useCotacaoDocs, TIPO_LABEL } from '../hooks/useAnexos'
import type { PedidoAnexo } from '../hooks/useAnexos'
import FluxoTimeline from '../components/FluxoTimeline'
import RecebimentoModal from '../components/RecebimentoModal'
import type { Pedido } from '../types'

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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: '',                         label: 'Todos'              },
  { value: 'emitido',                  label: 'Emitidos'           },
  { value: 'confirmado',               label: 'Confirmados'        },
  { value: 'em_entrega',               label: 'Em Entrega'         },
  { value: 'parcialmente_recebido',    label: 'Parcial'            },
  { value: 'entregue',                 label: 'Entregues'          },
  { value: 'liberado_pagamento',       label: 'Aguard. Pagamento'  },
  { value: 'pago',                     label: 'Pagos'              },
]

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  emitido:                 { bg: 'bg-cyan-100',    text: 'text-cyan-700',    label: 'Emitido'    },
  confirmado:              { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Confirmado' },
  em_entrega:              { bg: 'bg-teal-100',    text: 'text-teal-700',    label: 'Em Entrega' },
  parcialmente_recebido:   { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Parcial'    },
  entregue:                { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Entregue'   },
  cancelado:               { bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Cancelado'  },
}

// ─── PDF / Share helpers ──────────────────────────────────────────────────────

function gerarPdfPedido(pedido: Pedido) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido de Compra #${pedido.numero_pedido}</title>
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
          <div style="font-size:13px;font-weight:700;color:#0d9488">#${pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">${new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      <div class="section">
        <div class="field-row">
          <div class="field">
            <div class="label">Fornecedor</div>
            <div class="value">${pedido.fornecedor_nome}</div>
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
            <div class="value">${pedido.requisicao.numero} — ${pedido.requisicao.descricao}</div>
          </div>
          <div class="field">
            <div class="label">Obra / Projeto</div>
            <div class="value">${pedido.requisicao.obra_nome ?? '—'}</div>
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
          ${pedido.nf_numero ? `<div class="field"><div class="label">NF</div><div class="value">${pedido.nf_numero}</div></div>` : ''}
        </div>
        ${pedido.observacoes ? `<div class="field"><div class="label">Observações</div><div class="value">${pedido.observacoes}</div></div>` : ''}
      </div>

      <div class="footer">
        TEG+ ERP · Pedido de Compra · Emitido em ${new Date().toLocaleString('pt-BR')}<br>
        Este documento é válido apenas com a assinatura do responsável pelo setor de compras.
      </div>
    </body>
    </html>
  `
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}

function compartilharWhatsApp(pedido: Pedido) {
  const text =
    `*Pedido de Compra TEG+*\n` +
    `Número: #${pedido.numero_pedido ?? pedido.id.slice(0, 8)}\n` +
    `Fornecedor: ${pedido.fornecedor_nome}\n` +
    `Valor: ${pedido.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` +
    `Previsão: ${pedido.data_prevista_entrega ? new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}\n` +
    `\n_Gerado pelo sistema TEG+ ERP_`
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
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

  // Tenta enviar via n8n (com anexos)
  try {
    const res = await api.enviarEmailPedido({
      pedido_id: pedido.id,
      email_destinatario: email ?? '',
      subject,
      body,
    })
    if (res?.ok) return // sucesso via n8n
  } catch {
    // n8n indisponível — fallback mailto
  }

  // Fallback: abre mailto (sem anexos)
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

function CompartilharModal({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs text-slate-400 font-medium">Pedido de Compra</p>
            <p className="text-sm font-bold text-slate-800">
              #{pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview resumo */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Fornecedor</span>
            <span className="font-semibold text-slate-700 truncate ml-4 text-right">{pedido.fornecedor_nome}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Valor Total</span>
            <span className="font-bold text-teal-600">{fmt(pedido.valor_total)}</span>
          </div>
          {pedido.data_prevista_entrega && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Prev. Entrega</span>
              <span className="font-semibold text-slate-700">{fmtDataISO(pedido.data_prevista_entrega)}</span>
            </div>
          )}
          {pedido.requisicao?.obra_nome && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Obra</span>
              <span className="font-semibold text-slate-700 truncate ml-4 text-right">{pedido.requisicao.obra_nome}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-5 space-y-2.5">
          <button
            onClick={() => gerarPdfPedido(pedido)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors"
          >
            <Download size={16} className="flex-shrink-0" />
            <span>Baixar / Imprimir PDF</span>
          </button>

          <button
            onClick={() => compartilharWhatsApp(pedido)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors"
          >
            <MessageCircle size={16} className="flex-shrink-0" />
            <span>Compartilhar no WhatsApp</span>
          </button>

          <button
            onClick={() => compartilharEmail(pedido)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors"
          >
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

function LiberarPagamentoModal({
  pedido,
  onClose,
}: {
  pedido: Pedido
  onClose: () => void
}) {
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
      await uploadAnexo.mutateAsync({
        pedidoId:   pedido.id,
        file,
        tipo,
        observacao: obs || undefined,
        origem:     'compras',
      })
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Banknote size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Liberar para Pagamento</p>
              <p className="text-[11px] text-slate-400">
                #{pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* File upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Anexar Documento <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer transition-colors ${
                file
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50'
              }`}
            >
              <Upload size={18} className={file ? 'text-emerald-500' : 'text-slate-400'} />
              <div className="min-w-0">
                {file ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700 truncate">{file.name}</p>
                    <p className="text-[11px] text-emerald-500">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">Clique para selecionar</p>
                    <p className="text-[11px] text-slate-400">PDF, JPG, PNG, XLS, XLSX</p>
                  </>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          {/* Tipo selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo do Documento</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPO_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTipo(opt.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-colors ${
                    tipo === opt.value
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Observação <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={2}
              placeholder="Ex: NF entregue junto com o material..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300"
            />
          </div>

          {/* Error */}
          {erro && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Banknote size={16} />
            )}
            {loading ? 'Enviando...' : 'Liberar para Pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DocSection — seção agrupada de documentos ──────────────────────────────

const SECTION_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-600' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-600' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-600' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-600' },
}

function DocSection({
  title, icon, color, count, children,
}: {
  title: string; icon: React.ReactNode; color: string; count: number; children: React.ReactNode
}) {
  const c = SECTION_COLORS[color] ?? SECTION_COLORS.cyan
  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <div className={`${c.bg} px-3 py-2 flex items-center gap-2 border-b ${c.border}`}>
        {icon}
        <span className={`text-[11px] font-bold ${c.text}`}>{title}</span>
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>
          {count}
        </span>
      </div>
      <div className="divide-y divide-slate-100 bg-white">{children}</div>
    </div>
  )
}

function DocItem({
  name, url, mime, tipo, date, origem,
}: {
  name: string; url: string; mime?: string | null; tipo?: string; date?: string; origem?: string
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors group"
    >
      <AnexoIcon mime={mime ?? null} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-700 truncate">{name}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {tipo && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {tipo}
            </span>
          )}
          {origem && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              origem === 'financeiro' ? 'bg-purple-100 text-purple-600' : 'bg-teal-100 text-teal-600'
            }`}>
              {origem === 'financeiro' ? 'Financeiro' : 'Compras'}
            </span>
          )}
          {date && (
            <span className="text-[10px] text-slate-400">
              {new Date(date).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </div>
      <ExternalLink size={11} className="flex-shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors" />
    </a>
  )
}

// ─── UploadAnexoInline — botão rápido para anexar docs ──────────────────────

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
      <select
        value={tipo}
        onChange={e => setTipo(e.target.value as PedidoAnexo['tipo'])}
        className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-300"
      >
        {TIPO_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <div className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        ) : success ? (
          <CheckCircle size={12} className="text-emerald-500" />
        ) : (
          <Upload size={12} />
        )}
        {loading ? 'Enviando...' : success ? 'Anexado!' : 'Anexar'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}

// ─── AnexosOrganizados — documentos agrupados por categoria ─────────────────

function AnexosOrganizados({ pedidoId, cotacaoId }: { pedidoId: string; cotacaoId?: string }) {
  const { data: anexos, isLoading: loadingAnexos }  = useAnexosPedido(pedidoId)
  const { data: cotDocs, isLoading: loadingCot }     = useCotacaoDocs(cotacaoId)

  const isLoading = loadingAnexos || (cotacaoId ? loadingCot : false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
        <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
        Carregando documentos...
      </div>
    )
  }

  const cotacaoDocs   = cotDocs ?? []
  const nfDocs        = anexos?.filter(a => a.tipo === 'nota_fiscal') ?? []
  const pedidoAnexos  = anexos?.filter(a => a.tipo !== 'nota_fiscal' && a.tipo !== 'comprovante_pagamento') ?? []
  const pagamentoDocs = anexos?.filter(a => a.tipo === 'comprovante_pagamento') ?? []
  const totalDocs     = cotacaoDocs.length + nfDocs.length + pedidoAnexos.length + pagamentoDocs.length

  if (totalDocs === 0) {
    return (
      <div>
        <p className="text-xs text-slate-400 italic py-1">Nenhum documento encontrado.</p>
        <UploadAnexoInline pedidoId={pedidoId} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Cotação Aprovada */}
      {cotacaoDocs.length > 0 && (
        <DocSection
          title="Cotação Aprovada"
          icon={<FileText size={13} className="text-violet-500" />}
          color="violet"
          count={cotacaoDocs.length}
        >
          {cotacaoDocs.map((doc, i) => (
            <DocItem key={i} name={doc.name} url={doc.url} mime={doc.mime} date={doc.created} />
          ))}
        </DocSection>
      )}

      {/* Nota Fiscal */}
      {nfDocs.length > 0 && (
        <DocSection
          title="Nota Fiscal"
          icon={<FileText size={13} className="text-amber-500" />}
          color="amber"
          count={nfDocs.length}
        >
          {nfDocs.map(a => (
            <DocItem
              key={a.id}
              name={a.nome_arquivo}
              url={a.url}
              mime={a.mime_type}
              date={a.uploaded_at}
              origem={a.origem}
            />
          ))}
        </DocSection>
      )}

      {/* Pedido (comprovante entrega, medição, contrato, outro) */}
      {pedidoAnexos.length > 0 && (
        <DocSection
          title="Pedido"
          icon={<Package size={13} className="text-cyan-500" />}
          color="cyan"
          count={pedidoAnexos.length}
        >
          {pedidoAnexos.map(a => (
            <DocItem
              key={a.id}
              name={a.nome_arquivo}
              url={a.url}
              mime={a.mime_type}
              tipo={TIPO_LABEL[a.tipo]}
              date={a.uploaded_at}
              origem={a.origem}
            />
          ))}
        </DocSection>
      )}

      {/* Pagamento */}
      {pagamentoDocs.length > 0 && (
        <DocSection
          title="Pagamento"
          icon={<Banknote size={13} className="text-emerald-500" />}
          color="emerald"
          count={pagamentoDocs.length}
        >
          {pagamentoDocs.map(a => (
            <DocItem
              key={a.id}
              name={a.nome_arquivo}
              url={a.url}
              mime={a.mime_type}
              date={a.uploaded_at}
              origem={a.origem}
            />
          ))}
        </DocSection>
      )}

      {/* Upload rápido */}
      <UploadAnexoInline pedidoId={pedidoId} />
    </div>
  )
}

// ─── PedidoCard ───────────────────────────────────────────────────────────────

function PedidoCard({
  pedido,
  onCompartilhar,
  onLiberarPagamento,
  onReceber,
  initialExpanded = false,
}: {
  pedido: Pedido
  onCompartilhar: (p: Pedido) => void
  onLiberarPagamento: (id: string) => void
  onReceber: (p: Pedido) => void
  initialExpanded?: boolean
}) {
  const mutation   = useAtualizarPedido()
  const [expanded, setExpanded]     = useState(initialExpanded)
  const [confirmando, setConfirmando] = useState(false)

  const dias     = diasRestantes(pedido.data_prevista_entrega)
  const st       = statusConfig[pedido.status] || statusConfig.emitido
  const entregue = pedido.status === 'entregue'
  const parcial  = pedido.status === 'parcialmente_recebido'
  const atrasado = dias !== null && dias < 0 && !entregue && !parcial

  // Recebimento: can receive if confirmado, em_entrega, or parcialmente_recebido
  const podeReceber = ['confirmado', 'em_entrega', 'parcialmente_recebido'].includes(pedido.status)
  const qtdTotal     = pedido.qtd_itens_total ?? 0
  const qtdRecebidos = pedido.qtd_itens_recebidos ?? 0

  // Payment status helpers
  const statusPgto     = (pedido as any).status_pagamento as string | undefined
  const liberadoEm     = (pedido as any).liberado_pagamento_em as string | undefined
  const pagoEm         = (pedido as any).pago_em as string | undefined
  const isLiberado     = statusPgto === 'liberado'
  const isPago         = statusPgto === 'pago'
  const podeLiberar    = entregue && !statusPgto

  const confirmarEntrega = async () => {
    setConfirmando(true)
    try {
      await mutation.mutateAsync({
        id:                pedido.id,
        status:            'entregue',
        data_entrega_real: new Date().toISOString().split('T')[0],
      })
    } finally {
      setConfirmando(false)
    }
  }

  // Border / header color
  const borderClass = atrasado
    ? 'border-red-200'
    : isPago
    ? 'border-emerald-300'
    : isLiberado
    ? 'border-orange-200'
    : entregue
    ? 'border-emerald-200'
    : 'border-slate-200'

  const headerClass = atrasado
    ? 'bg-red-50 border-red-100'
    : isPago
    ? 'bg-emerald-50 border-emerald-100'
    : isLiberado
    ? 'bg-orange-50 border-orange-100'
    : entregue
    ? 'bg-emerald-50 border-emerald-100'
    : 'bg-slate-50 border-slate-100'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${borderClass}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${headerClass}`}>
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {pedido.numero_pedido && (
            <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
              #{pedido.numero_pedido}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${st.bg} ${st.text}`}>
            {st.label}
          </span>

          {/* Payment status badges */}
          {isPago && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex-shrink-0">
              <CheckCircle size={9} /> Pago
              {pagoEm && <span className="ml-0.5 font-normal">· {fmtData(pagoEm)}</span>}
            </span>
          )}
          {isLiberado && !isPago && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 flex-shrink-0">
              <Clock size={9} /> Aguardando Pagamento
            </span>
          )}

          {atrasado && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold flex-shrink-0">
              <AlertTriangle size={10} /> {Math.abs(dias!)}d atrasado
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Compartilhar / Pedido button */}
          <button
            onClick={() => onCompartilhar(pedido)}
            title="Ver / Compartilhar Pedido"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors"
          >
            <Share2 size={11} />
            <span className="hidden sm:inline">Pedido</span>
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Fornecedor + valor */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{pedido.fornecedor_nome}</p>
            {pedido.requisicao && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{pedido.requisicao.obra_nome}</p>
            )}
          </div>
          <p className="text-base font-extrabold text-teal-600 flex-shrink-0">{fmt(pedido.valor_total)}</p>
        </div>

        {/* RC origem */}
        {pedido.requisicao && (
          <p className="text-xs text-slate-500 line-clamp-1">
            <span className="font-mono text-slate-300">{pedido.requisicao.numero}</span>
            {' · '}
            {pedido.requisicao.descricao}
          </p>
        )}

        {/* Timeline */}
        <FluxoTimeline status="pedido_emitido" compact />

        {/* Datas */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">Pedido em</span>
            <p className="font-semibold text-slate-700">{fmtData(pedido.data_pedido)}</p>
          </div>
          <div>
            <span className="text-slate-400">Prev. entrega</span>
            <p className={`font-semibold ${atrasado ? 'text-red-600' : 'text-slate-700'}`}>
              {fmtDataISO(pedido.data_prevista_entrega)}
              {dias !== null && !entregue && (
                <span className={`ml-1 text-[10px] ${atrasado ? 'text-red-500' : dias <= 2 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {atrasado ? `(${Math.abs(dias)}d atr.)` : `(${dias}d)`}
                </span>
              )}
            </p>
          </div>
          {pedido.data_entrega_real && (
            <div>
              <span className="text-slate-400">Entregue em</span>
              <p className="font-semibold text-emerald-600">{fmtData(pedido.data_entrega_real)}</p>
            </div>
          )}
          {pedido.nf_numero && (
            <div>
              <span className="text-slate-400">NF</span>
              <p className="font-semibold text-slate-700 font-mono">{pedido.nf_numero}</p>
            </div>
          )}
          {liberadoEm && (
            <div>
              <span className="text-slate-400">Liberado em</span>
              <p className="font-semibold text-orange-600">{fmtData(liberadoEm)}</p>
            </div>
          )}
          {pagoEm && (
            <div>
              <span className="text-slate-400">Pago em</span>
              <p className="font-semibold text-emerald-600">{fmtData(pagoEm)}</p>
            </div>
          )}
        </div>

        {/* Expanded: observações + anexos */}
        {expanded && (
          <div className="space-y-3 pt-1">
            {pedido.observacoes && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Observações</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{pedido.observacoes}</p>
              </div>
            )}

            {/* Documentos organizados por categoria */}
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                <Paperclip size={11} /> Documentos
              </p>
              <AnexosOrganizados pedidoId={pedido.id} cotacaoId={pedido.cotacao_id} />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pt-1">
          {/* Receber pedido (new flow) */}
          {podeReceber && (
            <button
              onClick={() => onReceber(pedido)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-50 text-teal-700 border border-teal-300 hover:bg-teal-500 hover:text-white transition-all"
            >
              <Package size={16} />
              {parcial ? 'Receber Restante' : 'Receber'}
            </button>
          )}
          {/* Recebimento progress */}
          {parcial && qtdTotal > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-amber-600 font-bold">Recebido parcialmente</span>
                <span className="text-slate-400 font-semibold">{qtdRecebidos}/{qtdTotal} itens</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (qtdRecebidos / qtdTotal) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {/* Confirmar entrega (legacy / direct) */}
          {pedido.status === 'emitido' && (
            <button
              onClick={confirmarEntrega}
              disabled={confirmando || mutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              {confirmando
                ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                : <CheckCircle size={14} />}
              Confirmar Entrega (sem recebimento)
            </button>
          )}

          {/* Liberar para pagamento */}
          {podeLiberar && (
            <button
              onClick={() => onLiberarPagamento(pedido.id)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-600 hover:text-white transition-all"
            >
              <Banknote size={16} />
              Liberar para Pagamento
            </button>
          )}

          {/* Confirmed / paid status line */}
          {entregue && !podeLiberar && !isLiberado && !isPago && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
              <CheckCircle size={14} />
              Entrega confirmada {pedido.data_entrega_real ? `em ${fmtData(pedido.data_entrega_real)}` : ''}
            </div>
          )}
          {entregue && isLiberado && !isPago && (
            <div className="flex items-center gap-2 text-orange-500 text-xs font-semibold">
              <Clock size={14} />
              Aguardando pagamento · liberado em {fmtData(liberadoEm)}
            </div>
          )}
          {isPago && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
              <CheckCircle size={14} />
              Pagamento confirmado {pagoEm ? `em ${fmtData(pagoEm)}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pedidos page ─────────────────────────────────────────────────────────────

export default function Pedidos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightPedidoId = searchParams.get('pedido')

  const [statusFilter, setStatusFilter]         = useState('')
  const [compartilharPedido, setCompartilhar]   = useState<Pedido | null>(null)
  const [showLiberarModal, setShowLiberarModal] = useState<string | null>(null)
  const [receberPedido, setReceberPedido]       = useState<Pedido | null>(null)

  // Limpar o query param após exibir para não manter na URL
  useEffect(() => {
    if (highlightPedidoId) {
      const timeout = setTimeout(() => {
        setSearchParams({}, { replace: true })
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [highlightPedidoId, setSearchParams])

  const { data: pedidos, isLoading } = usePedidos(
    statusFilter === 'liberado_pagamento' || statusFilter === 'pago'
      ? undefined
      : statusFilter || undefined
  )

  // Client-side filter for payment status tabs
  const filtered = (pedidos ?? []).filter(p => {
    const pgto = (p as any).status_pagamento as string | undefined
    if (statusFilter === 'liberado_pagamento') return pgto === 'liberado'
    if (statusFilter === 'pago') return pgto === 'pago'
    return true
  })

  // Sort: atrasados first, then by data prevista
  const sorted = filtered.slice().sort((a, b) => {
    const diasA = diasRestantes(a.data_prevista_entrega) ?? 9999
    const diasB = diasRestantes(b.data_prevista_entrega) ?? 9999
    return diasA - diasB
  })

  const atrasados = sorted.filter(p => {
    const d = diasRestantes(p.data_prevista_entrega)
    return d !== null && d < 0 && p.status !== 'entregue'
  })

  const liberarPedido = sorted.find(p => p.id === showLiberarModal)

  return (
    <div className="space-y-4">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <Truck size={18} className="text-teal-500" />
          Pedidos
        </h2>
        {atrasados.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
            <AlertTriangle size={11} /> {atrasados.length} atrasado{atrasados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              statusFilter === tab.value
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(p => (
            <PedidoCard
              key={p.id}
              pedido={p}
              initialExpanded={p.id === highlightPedidoId}
              onCompartilhar={setCompartilhar}
              onLiberarPagamento={id => setShowLiberarModal(id)}
              onReceber={setReceberPedido}
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-300 py-2">
        {sorted.length} pedido{sorted.length !== 1 ? 's' : ''}
      </p>

      {/* Compartilhar modal */}
      {compartilharPedido && (
        <CompartilharModal
          pedido={compartilharPedido}
          onClose={() => setCompartilhar(null)}
        />
      )}

      {/* Liberar pagamento modal */}
      {showLiberarModal && liberarPedido && (
        <LiberarPagamentoModal
          pedido={liberarPedido}
          onClose={() => setShowLiberarModal(null)}
        />
      )}

      {/* Recebimento modal */}
      {receberPedido && (
        <RecebimentoModal
          pedido={receberPedido}
          onClose={() => setReceberPedido(null)}
        />
      )}
    </div>
  )
}
