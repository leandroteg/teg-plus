// ─────────────────────────────────────────────────────────────────────────────
// components/rh/ponto/PontoReportModal.tsx — visualizador do espelho de ponto.
// Monta o relatório HTML (utils/ponto-report-html), mostra num iframe
// (bottom-sheet no mobile) e o "Baixar" imprime o próprio iframe → PDF.
// Serve o espelho de 1 colaborador e o consolidado do mês.
// Mesmo padrão do RdoPdfModal (módulo Obras).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { X, Download, Loader2, Fingerprint } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import {
  buildPontoReportHtml, buildPontoConsolidadoHtml,
  type PontoReportRow, type PontoConsolidadoSpec,
} from '../../../utils/ponto-report-html'

export type PontoReportAlvo =
  | { tipo: 'colaborador'; row: PontoReportRow }
  | { tipo: 'consolidado'; spec: PontoConsolidadoSpec }

export default function PontoReportModal({ alvo, onClose }: { alvo: PontoReportAlvo; onClose: () => void }) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [html, setHtml] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const titulo = alvo.tipo === 'colaborador'
    ? `Espelho de ponto — ${alvo.row.colaborador_nome}`
    : `Consolidado — ${alvo.spec.colaboradores.length} colaboradores`

  useEffect(() => {
    let cancel = false
    setHtml(null); setErro(null)
    ;(async () => {
      try {
        const h = alvo.tipo === 'colaborador'
          ? await buildPontoReportHtml(alvo.row)
          : await buildPontoConsolidadoHtml(alvo.spec)
        if (!cancel) setHtml(h)
      } catch (e) { if (!cancel) setErro(String((e as Error).message)) }
    })()
    return () => { cancel = true }
  }, [alvo])

  // "Baixar": imprime o iframe (o navegador oferece Salvar como PDF)
  const baixar = () => {
    const win = iframeRef.current?.contentWindow
    if (win) { win.focus(); win.print() }
  }

  const pesado = alvo.tipo === 'consolidado' && alvo.spec.colaboradores.length > 60

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-3xl h-[92vh] lg:h-[88vh] flex flex-col rounded-t-2xl lg:rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between gap-2 p-3 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          <span className={`flex items-center gap-2 font-bold text-sm min-w-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Fingerprint size={16} className="text-teal-500 shrink-0" />
            <span className="truncate">{titulo}</span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={baixar} disabled={!html}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40">
              <Download size={14} /> Baixar PDF
            </button>
            <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 bg-slate-200 dark:bg-black/40">
          {erro ? (
            <div className="h-full flex items-center justify-center text-sm text-rose-500 p-4 text-center">Falha ao gerar o espelho: {erro}</div>
          ) : !html ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-slate-400">
              <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> montando espelho…</span>
              {pesado && <span className="text-xs">{alvo.tipo === 'consolidado' ? alvo.spec.colaboradores.length : 0} colaboradores — pode levar alguns segundos.</span>}
            </div>
          ) : (
            <iframe ref={iframeRef} title="Espelho de ponto" srcDoc={html} className="w-full h-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  )
}
