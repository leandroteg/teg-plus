import type { StatusRequisicao } from '../types'

const config: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  rascunho:     { dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-600',   label: 'Rascunho'    },
  pendente:     { dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',  label: 'Pendente'    },
  em_aprovacao: { dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700',   label: 'Em Aprovação'},
  aprovada:     { dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700',label: 'Aprovada'    },
  rejeitada:    { dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-700',    label: 'Rejeitada'   },
  em_cotacao:   { dot: 'bg-violet-500',  bg: 'bg-violet-50',   text: 'text-violet-700', label: 'Em Cotação'  },
  comprada:     { dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700',  label: 'Comprada'    },
  cancelada:    { dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500',   label: 'Cancelada'   },
}

export default function StatusBadge({ status }: { status: StatusRequisicao }) {
  const c = config[status] ?? config.pendente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  )
}
