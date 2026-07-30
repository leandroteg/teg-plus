// ─────────────────────────────────────────────────────────────────────────────
// FichaVistoriaModal — visualiza a ficha de vistoria e imprime.
// Mesmo desenho do PontoReportModal: HTML num <iframe srcDoc>, e "Baixar PDF"
// chama print() — o navegador salva em PDF com a paginação certa.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { X, Download, Loader2, ClipboardList } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { buildFichaVistoriaHtml, type FichaVistoriaData } from '../../utils/ficha-vistoria-html'

export default function FichaVistoriaModal({ dados, onClose }: {
  dados: FichaVistoriaData
  onClose: () => void
}) {
  const { isDark } = useTheme()
  const [html, setHtml] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancel = false
    setHtml(null); setErro(null)
    buildFichaVistoriaHtml(dados)
      .then(h => { if (!cancel) setHtml(h) })
      .catch(e => { if (!cancel) setErro(String((e as Error).message)) })
    return () => { cancel = true }
  }, [dados])

  const baixar = () => {
    const win = iframeRef.current?.contentWindow
    if (win) { win.focus(); win.print() }
  }

  const titulo = dados.entrada.endereco || dados.entrada.imovel?.descricao || 'Ficha de vistoria'

  return (
    <div className="fixed inset-0 z-[70] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-3xl h-[92vh] lg:h-[88vh] flex flex-col rounded-t-2xl lg:rounded-2xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between gap-2 p-3 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          <span className={`flex items-center gap-2 font-bold text-sm min-w-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <ClipboardList size={16} className="text-teal-500 shrink-0" />
            <span className="truncate">Ficha de vistoria — {titulo}</span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={baixar} disabled={!html}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40">
              <Download size={14} /> Baixar PDF
            </button>
            <button onClick={onClose}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-200 dark:bg-black/40">
          {erro ? (
            <div className="h-full flex items-center justify-center text-sm text-rose-500 p-4 text-center">
              Falha ao montar a ficha: {erro}
            </div>
          ) : !html ? (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> montando ficha…
            </div>
          ) : (
            <iframe ref={iframeRef} title="Ficha de vistoria" srcDoc={html} className="w-full h-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  )
}
