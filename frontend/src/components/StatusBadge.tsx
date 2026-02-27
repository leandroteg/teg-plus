import type { StatusRequisicao } from '../types'

const config: Record<string, { bg: string; text: string; label: string }> = {
  rascunho:     { bg: 'bg-gray-100',    text: 'text-gray-700',   label: 'Rascunho' },
  pendente:     { bg: 'bg-yellow-100',  text: 'text-yellow-800', label: 'Pendente' },
  em_aprovacao: { bg: 'bg-blue-100',    text: 'text-blue-800',   label: 'Em Aprovacao' },
  aprovada:     { bg: 'bg-green-100',   text: 'text-green-800',  label: 'Aprovada' },
  rejeitada:    { bg: 'bg-red-100',     text: 'text-red-800',    label: 'Rejeitada' },
  em_cotacao:   { bg: 'bg-purple-100',  text: 'text-purple-800', label: 'Em Cotacao' },
  comprada:     { bg: 'bg-emerald-100', text: 'text-emerald-800',label: 'Comprada' },
  cancelada:    { bg: 'bg-gray-200',    text: 'text-gray-600',   label: 'Cancelada' },
}

export default function StatusBadge({ status }: { status: StatusRequisicao }) {
  const c = config[status] ?? config.pendente
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
