import { useState } from 'react'
import type { RefObject } from 'react'
import { Download, Mail, MessageCircle, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { exportarPainel, compartilharPainel } from '../../utils/painel-share'

type Acao = 'pdf' | 'email' | 'whatsapp'

// Barra de ações padrão de TODO painel do hub: exportar (PDF), e-mail e WhatsApp.
// Captura o nó referenciado por `target` (o wrapper do painel real).
export default function PainelActions({ target, label, painelKey }: {
  target: RefObject<HTMLDivElement | null>
  label: string
  painelKey: string
}) {
  const { isDark } = useTheme()
  const [busy, setBusy] = useState<Acao | null>(null)
  const [erro, setErro] = useState(false)

  const run = async (acao: Acao) => {
    const node = target.current
    if (!node || busy) return
    setBusy(acao)
    setErro(false)
    try {
      const meta = { label, key: painelKey }
      if (acao === 'pdf') await exportarPainel(node, meta, isDark)
      else await compartilharPainel(node, meta, isDark, acao)
    } catch (e) {
      console.error('Painel export/share falhou:', e)
      setErro(true)
      setTimeout(() => setErro(false), 4000)
    } finally {
      setBusy(null)
    }
  }

  const btn = isDark
    ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border-white/[0.08]'
    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'

  const Item = ({ acao, Icon, texto, cor }: { acao: Acao; Icon: LucideIcon; texto: string; cor?: string }) => (
    <button
      type="button"
      onClick={() => run(acao)}
      disabled={!!busy}
      title={texto}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${btn}`}
    >
      {busy === acao ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} className={cor} />}
      <span className="hidden md:inline">{texto}</span>
    </button>
  )

  return (
    <div className="flex items-center gap-1.5" data-no-export="true">
      <Item acao="pdf" Icon={Download} texto="Exportar" />
      <Item acao="email" Icon={Mail} texto="Email" />
      <Item acao="whatsapp" Icon={MessageCircle} texto="WhatsApp" cor="text-emerald-500" />
      {erro && <span className="text-[11px] text-red-500 font-medium whitespace-nowrap">falhou — tente de novo</span>}
    </div>
  )
}
