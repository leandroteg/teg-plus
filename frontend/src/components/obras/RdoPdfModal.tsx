// ─────────────────────────────────────────────────────────────────────────────
// components/obras/RdoPdfModal.tsx — visualizador do PDF do RDO.
// Gera o PDF (utils/rdo-pdf), mostra num iframe (bottom-sheet no mobile) e
// oferece "Baixar". Fecha revogando o blob URL.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { X, Download, Loader2, FileText } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { gerarRdoDoc, nomeArquivoRdo, type RdoPdfData } from '../../utils/rdo-pdf'

export default function RdoPdfModal({ rdo, onClose }: { rdo: RdoPdfData; onClose: () => void }) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const docRef = useRef<Awaited<ReturnType<typeof gerarRdoDoc>> | null>(null)

  useEffect(() => {
    let cancel = false
    let blobUrl: string | null = null
    ;(async () => {
      try {
        const doc = await gerarRdoDoc(rdo)
        if (cancel) return
        docRef.current = doc
        blobUrl = doc.output('bloburl') as unknown as string
        setUrl(blobUrl)
      } catch (e) {
        if (!cancel) setErro(String((e as Error).message))
      }
    })()
    return () => { cancel = true; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [rdo])

  const baixar = () => docRef.current?.save(nomeArquivoRdo(rdo))

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-3xl h-[92vh] lg:h-[88vh] flex flex-col rounded-t-2xl lg:rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between gap-2 p-3 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          <span className={`flex items-center gap-2 font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <FileText size={16} className="text-teal-500" /> RDO em PDF
          </span>
          <div className="flex items-center gap-2">
            <button onClick={baixar} disabled={!url}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40">
              <Download size={14} /> Baixar
            </button>
            <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 bg-slate-200 dark:bg-black/40">
          {erro ? (
            <div className="h-full flex items-center justify-center text-sm text-rose-500 p-4 text-center">Falha ao gerar o PDF: {erro}</div>
          ) : !url ? (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> gerando PDF…</div>
          ) : (
            <iframe title="RDO PDF" src={url} className="w-full h-full border-0" />
          )}
        </div>
      </div>
    </div>
  )
}
