import { useState } from 'react'
import type { RefObject } from 'react'
import { Download, Share2, Mail, MessageCircle, Loader2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { gerarPainelPdf, exportarPainel, shareNativoPainel, abrirCanalPainel } from '../../utils/painel-share'

// Barra de ações padrão de TODO painel do hub: Exportar (PDF) + Compartilhar.
// "Compartilhar" abre a folha nativa do SO no mobile (e-mail, WhatsApp, etc.);
// no desktop (sem share de arquivo) cai num mini-menu Email/WhatsApp.
export default function PainelActions({ target, label, painelKey }: {
  target: RefObject<HTMLDivElement | null>
  label: string
  painelKey: string
}) {
  const { isDark } = useTheme()
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null)
  const [erro, setErro] = useState(false)
  const [menu, setMenu] = useState<{ blob: Blob; filename: string } | null>(null)

  const meta = { label, key: painelKey }
  const fail = (e: unknown) => { console.error('Painel export/share falhou:', e); setErro(true); setTimeout(() => setErro(false), 4000) }

  const exportar = async () => {
    const node = target.current
    if (!node || busy) return
    setBusy('pdf'); setErro(false)
    try { await exportarPainel(node, meta, isDark) } catch (e) { fail(e) } finally { setBusy(null) }
  }

  const compartilhar = async () => {
    const node = target.current
    if (!node || busy) return
    setBusy('share'); setErro(false); setMenu(null)
    try {
      const { blob, filename } = await gerarPainelPdf(node, meta, isDark)
      const nativo = await shareNativoPainel(blob, filename, meta)
      if (!nativo) setMenu({ blob, filename }) // desktop → mini-menu Email/WhatsApp
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  const btn = isDark
    ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border-white/[0.08]'
    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
  const cls = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${btn}`

  return (
    <div className="relative flex items-center gap-1.5" data-no-export="true">
      <button type="button" onClick={exportar} disabled={!!busy} title="Exportar PDF" className={cls}>
        {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        <span className="hidden md:inline">Exportar</span>
      </button>
      <button type="button" onClick={compartilhar} disabled={!!busy} title="Compartilhar" className={cls}>
        {busy === 'share' ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
        <span className="hidden md:inline">Compartilhar</span>
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div className={`absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border p-1 shadow-xl ${isDark ? 'bg-[#0B1523] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
            <button type="button" onClick={() => { abrirCanalPainel(menu.blob, menu.filename, meta, 'email'); setMenu(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium ${isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Mail size={15} /> E-mail
            </button>
            <button type="button" onClick={() => { abrirCanalPainel(menu.blob, menu.filename, meta, 'whatsapp'); setMenu(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium ${isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-600 hover:bg-slate-50'}`}>
              <MessageCircle size={15} className="text-emerald-500" /> WhatsApp
            </button>
          </div>
        </>
      )}

      {erro && <span className="text-[11px] text-red-500 font-medium whitespace-nowrap">falhou</span>}
    </div>
  )
}
