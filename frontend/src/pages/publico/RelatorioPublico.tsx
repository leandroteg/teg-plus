import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { relatorioLinkPublico } from '../../hooks/useQsma'

// Rota PÚBLICA (sem login) que renderiza o relatório de investigação QSMA.
// O storage/edge servem o HTML como text/plain (trava de segurança do Supabase),
// então buscamos o texto e renderizamos num <iframe srcdoc>, que interpreta o
// HTML independente do content-type. Assim o link é compartilhável (WhatsApp/
// e-mail) e abre a página de verdade — inclusive Imprimir/Salvar PDF.
export default function RelatorioPublico() {
  const [params] = useSearchParams()
  const p = params.get('p') ?? ''
  const [html, setHtml] = useState<string | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    const url = relatorioLinkPublico(p)
    if (!url) { setErro(true); return }
    let vivo = true
    fetch(url)
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(t => { if (vivo) setHtml(t) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [p])

  const centro: React.CSSProperties = {
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'system-ui, sans-serif', color: '#011F31', background: '#f4f6f8', fontSize: 14, padding: 24, textAlign: 'center',
  }

  if (erro) return <div style={centro}>Relatório não encontrado ou link inválido.</div>
  if (html === null) return <div style={centro}>Carregando relatório…</div>
  return (
    <iframe
      title="Relatório de Investigação"
      srcDoc={html}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', border: 0 }}
    />
  )
}
