import type { StatusRequisicao } from '../types'

const config: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  // ── Etapa 1: Requisição ────────────────────────────────────────────────────
  rascunho:          { dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-600',    label: 'Rascunho'          },
  pendente:          { dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Aguard. Aprovação' },
  // ── Etapa 2: Aprovação RC ──────────────────────────────────────────────────
  em_aprovacao:      { dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700',    label: 'Em Aprovação'      },
  aprovada:          { dot: 'bg-emerald-400', bg: 'bg-emerald-50',  text: 'text-emerald-700', label: 'RC Aprovada'       },
  rejeitada:         { dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-700',     label: 'Reprovada'         },
  // ── Etapa 3: Cotação ───────────────────────────────────────────────────────
  em_cotacao:        { dot: 'bg-violet-500',  bg: 'bg-violet-50',   text: 'text-violet-700',  label: 'Em Cotação'        },
  cotacao_enviada:   { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',   text: 'text-indigo-700',  label: 'Cotação Enviada'   },
  // ── Etapa 4: Aprovação Técnica/Financeira ─────────────────────────────────
  cotacao_aprovada:  { dot: 'bg-teal-500',    bg: 'bg-teal-50',     text: 'text-teal-700',    label: 'Cotação Aprovada'  },
  cotacao_rejeitada: { dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-600',     label: 'Cotação Reprovada' },
  // ── Etapa 5: Pedido ────────────────────────────────────────────────────────
  pedido_emitido:    { dot: 'bg-cyan-500',    bg: 'bg-cyan-50',     text: 'text-cyan-700',    label: 'Pedido Emitido'    },
  // ── Etapa 6: Entrega ───────────────────────────────────────────────────────
  em_entrega:        { dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700',  label: 'Em Entrega'        },
  entregue:          { dot: 'bg-green-400',   bg: 'bg-green-50',    text: 'text-green-700',   label: 'Entregue'          },
  // ── Etapa 7: Pagamento ─────────────────────────────────────────────────────
  aguardando_pgto:   { dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Aguard. Pagamento' },
  pago:              { dot: 'bg-emerald-600', bg: 'bg-emerald-50',  text: 'text-emerald-800', label: 'Pago ✓'            },
  // ── Outros ────────────────────────────────────────────────────────────────
  comprada:          { dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700',   label: 'Comprada'          },
  cancelada:         { dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Cancelada'         },
}

interface Props {
  status: StatusRequisicao | string
  size?: 'sm' | 'md'
  /** Override do label padrão (ex: "Aguard. Valid. Técnica") */
  customLabel?: string
}

export default function StatusBadge({ status, size = 'md', customLabel }: Props) {
  const c = config[status] ?? { dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  const sizeClass = size === 'sm'
    ? 'text-[10px] px-1.5 py-px gap-1'
    : 'text-[11px] px-2 py-0.5 gap-1.5'
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {customLabel ?? c.label}
    </span>
  )
}
