import { useState } from 'react'
import {
  Download, ExternalLink, FileText, Loader2, Mail, MessageCircle, ScrollText, Share2, X,
} from 'lucide-react'
import type { LogSolicitacao } from '../../types/logistica'
import { gerarRomaneioPDF, gerarRomaneioPdfBlob, getRomaneioFileName } from '../../utils/romaneio-pdf'

function buildRomaneioShareText(sol: LogSolicitacao) {
  return (
    `*Romaneio de Carga TEG+*\n` +
    `Numero: ${sol.numero}\n` +
    `Origem: ${sol.origem}\n` +
    `Destino: ${sol.destino}\n` +
    `${sol.obra_nome ? `Obra: ${sol.obra_nome}\n` : ''}` +
    `${sol.motorista_nome || sol.viagem?.motorista_nome ? `Motorista: ${sol.viagem?.motorista_nome || sol.motorista_nome}\n` : ''}` +
    `\n_Documento operacional gerado no TEG+ ERP_`
  )
}

export function openGeneratedPdf(sol: LogSolicitacao) {
  void (async () => {
    const url = await gerarRomaneioPDF(sol)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  })()
}

export function downloadGeneratedPdf(sol: LogSolicitacao) {
  void (async () => {
    const url = await gerarRomaneioPDF(sol)
    const a = document.createElement('a')
    a.href = url
    a.download = getRomaneioFileName(sol)
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  })()
}

async function compartilharWhatsApp(sol: LogSolicitacao): Promise<boolean> {
  const text = buildRomaneioShareText(sol)

  if (navigator.share && navigator.canShare) {
    try {
      const blob = await gerarRomaneioPdfBlob(sol)
      const file = new File([blob], getRomaneioFileName(sol), { type: 'application/pdf' })
      const shareData = { text, files: [file] }
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData)
        return true
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false
    }
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  return true
}

function compartilharEmail(sol: LogSolicitacao, email?: string) {
  const subject = `Romaneio ${sol.numero} - TEG+`
  const body =
    `Prezado(a),\n\nSegue referencia do romaneio operacional abaixo:\n\n` +
    `Numero: ${sol.numero}\n` +
    `Origem: ${sol.origem}\n` +
    `Destino: ${sol.destino}\n` +
    `${sol.obra_nome ? `Obra: ${sol.obra_nome}\n` : ''}` +
    `\nO PDF pode ser baixado e compartilhado diretamente pelo TEG+.\n\n` +
    `Atenciosamente,\nEquipe Logistica TEG+`

  window.open(`mailto:${email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
}

function CompartilharRomaneioModal({ sol, onClose, dark }: { sol: LogSolicitacao; onClose: () => void; dark: boolean }) {
  const [sharing, setSharing] = useState(false)

  const handleWhatsApp = async () => {
    setSharing(true)
    try {
      await compartilharWhatsApp(sol)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ${dark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
          <div>
            <p className={`text-xs font-medium ${dark ? 'text-slate-400' : 'text-slate-400'}`}>Romaneio de Carga</p>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{sol.numero}</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        <div className={`px-5 py-4 border-b space-y-2 ${dark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex justify-between text-xs gap-3">
            <span className="text-slate-400">Arquivo</span>
            <span className={`font-semibold text-right break-all ${dark ? 'text-white' : 'text-slate-700'}`}>{getRomaneioFileName(sol)}</span>
          </div>
          <div className="flex justify-between text-xs gap-3">
            <span className="text-slate-400">Rota</span>
            <span className={`font-semibold text-right ${dark ? 'text-white' : 'text-slate-700'}`}>{sol.origem} → {sol.destino}</span>
          </div>
        </div>

        <div className="p-5 space-y-2.5">
          <button onClick={() => openGeneratedPdf(sol)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors">
            <ExternalLink size={16} className="flex-shrink-0" />
            <span>Abrir PDF</span>
          </button>
          <button onClick={() => downloadGeneratedPdf(sol)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors">
            <Download size={16} className="flex-shrink-0" />
            <span>Baixar / Imprimir PDF</span>
          </button>
          <button onClick={handleWhatsApp} disabled={sharing} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors disabled:opacity-60">
            {sharing ? <Loader2 size={16} className="flex-shrink-0 animate-spin" /> : <MessageCircle size={16} className="flex-shrink-0" />}
            <span>{sharing ? 'Gerando PDF...' : 'Compartilhar no WhatsApp'}</span>
          </button>
          <button onClick={() => compartilharEmail(sol)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors">
            <Mail size={16} className="flex-shrink-0" />
            <span>Enviar por E-mail</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function hasRomaneioDocumento(sol: LogSolicitacao) {
  return sol.status === 'romaneio_emitido' || sol.doc_fiscal_tipo === 'romaneio' || !!sol.romaneio_url
}

export function RomaneioDocumentoCard({ sol, dark }: { sol: LogSolicitacao; dark: boolean }) {
  const [openShare, setOpenShare] = useState(false)

  return (
    <>
      <div className={`rounded-xl border p-4 ${dark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50/70 border-blue-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${dark ? 'bg-blue-500/10 text-blue-300' : 'bg-white text-blue-600 border border-blue-100'}`}>
              <ScrollText size={18} />
            </div>
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-[0.24em] ${dark ? 'text-blue-300' : 'text-blue-700'}`}>Romaneio Anexo</p>
              <p className={`text-sm font-bold mt-1 ${dark ? 'text-white' : 'text-slate-800'}`}>PDF operacional disponível</p>
              <div className={`mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs max-w-full ${dark ? 'bg-white/[0.04] text-slate-300' : 'bg-white text-slate-600 border border-blue-100'}`}>
                <FileText size={14} className="shrink-0 text-red-500" />
                <span className="truncate">{getRomaneioFileName(sol)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setOpenShare(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${dark ? 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20' : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-100'}`}
          >
            <Share2 size={14} />
            Compartilhar
          </button>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => openGeneratedPdf(sol)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
          >
            <ExternalLink size={15} />
            Abrir PDF
          </button>
          <button
            onClick={() => downloadGeneratedPdf(sol)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Download size={15} />
            Baixar
          </button>
        </div>
      </div>

      {openShare && <CompartilharRomaneioModal sol={sol} onClose={() => setOpenShare(false)} dark={dark} />}
    </>
  )
}
