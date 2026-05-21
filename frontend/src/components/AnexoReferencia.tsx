import { FileText } from 'lucide-react'

function nomeArquivo(url: string): string {
  return decodeURIComponent(url.split('/').pop()?.replace(/^\d+[-_]/, '') ?? 'Abrir anexo')
}

/**
 * Link para a "Referência de cotação" anexada na RC (cmp_requisicoes.arquivo_url).
 * Usado em todas as etapas do processo (validação técnica, cotação, pedido,
 * autorização de pagamento, contas a pagar) para que o arquivo acompanhe o fluxo.
 */
export function AnexoReferencia({
  url,
  label = 'Anexo / Referência de cotação',
  showLabel = true,
  className = '',
}: {
  url?: string | null
  label?: string
  showLabel?: boolean
  className?: string
}) {
  if (!url) return null
  return (
    <div className={className}>
      {showLabel && <p className="text-xs font-semibold text-slate-400 mb-2">{label}</p>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors max-w-full"
      >
        <FileText size={15} className="shrink-0" />
        <span className="truncate">{nomeArquivo(url)}</span>
      </a>
    </div>
  )
}
