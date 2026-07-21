import { Paperclip, ExternalLink } from 'lucide-react'
import { useMedicaoDoc } from '../hooks/useContratos'

// Exibe o documento anexado a uma medição de contrato, a partir do medicao_id que a
// conta a pagar/receber guarda. Usado nos detalhes de Contas a Pagar/Receber para que
// o Financeiro veja a planilha/BM/NF da medição. Não renderiza nada se não houver doc.
export function MedicaoDocLink({ medicaoId }: { medicaoId: string }) {
  const { data: doc } = useMedicaoDoc(medicaoId)
  if (!doc?.arquivo_url) return null

  return (
    <div>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
        <Paperclip size={11} />
        Documento da Medição{doc.numero_bm ? ` · ${doc.numero_bm}` : ''}
      </p>
      <a
        href={doc.arquivo_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold
          border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 transition-all"
      >
        <ExternalLink size={11} />
        {doc.arquivo_nome || 'Abrir documento'}
      </a>
    </div>
  )
}
