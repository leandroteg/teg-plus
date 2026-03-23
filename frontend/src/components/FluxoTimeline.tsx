// FluxoTimeline.tsx — Stepper horizontal das 7 etapas do fluxo de compras
// Props:
//   status   — status atual da requisição
//   compact  — modo compacto (apenas bolinhas, sem labels) para cards de lista
//   className — classes adicionais

import { Check } from 'lucide-react'

interface Etapa {
  label: string
  shortLabel: string
  statuses: string[]   // quais status "ativam" esta etapa
}

const ETAPAS: Etapa[] = [
  {
    label:      'Requisição',
    shortLabel: 'RC',
    statuses:   ['rascunho', 'pendente', 'em_esclarecimento'],
  },
  {
    label:      'Valid. Técnica',
    shortLabel: 'Val.T',
    statuses:   ['em_aprovacao', 'aprovada'],
  },
  {
    label:      'Cotação',
    shortLabel: 'Cot',
    statuses:   ['em_cotacao', 'cotacao_enviada'],
  },
  {
    label:      'Aprov. Fin.',
    shortLabel: 'Fin',
    statuses:   ['cotacao_aprovada'],
  },
  {
    label:      'Pedido',
    shortLabel: 'Ped',
    statuses:   ['pedido_emitido', 'aguardando_contrato'],
  },
  {
    label:      'Entrega',
    shortLabel: 'Entr',
    statuses:   ['em_entrega', 'entregue'],
  },
  {
    label:      'Pagamento',
    shortLabel: 'Pgto',
    statuses:   ['aguardando_pgto', 'pago'],
  },
]

// Mapeia status para o índice da etapa atual (0-based)
function getEtapaIndex(status: string): number {
  // Statuses de conclusão completa
  if (status === 'pago') return 7           // todas concluídas
  if (status === 'em_esclarecimento') return 0 // volta para etapa RC
  if (status === 'cancelada') return -1      // cancelada: sem etapa válida
  if (status === 'rejeitada') return -2      // rejeitada na aprovação RC
  if (status === 'cotacao_rejeitada') return -3 // rejeitada na aprov. financeira

  for (let i = 0; i < ETAPAS.length; i++) {
    if (ETAPAS[i].statuses.includes(status)) return i
  }
  return 0
}

interface Props {
  status: string
  compact?: boolean
  className?: string
}

export default function FluxoTimeline({ status, compact = false, className = '' }: Props) {
  const etapaIdx = getEtapaIndex(status)
  const isCancelada = status === 'cancelada'
  const isRejeitada = status === 'rejeitada' || status === 'cotacao_rejeitada'
  const isCompleto = status === 'pago'

  // Para cada etapa: 'done' | 'active' | 'future' | 'rejected'
  function getState(i: number): 'done' | 'active' | 'future' | 'rejected' {
    if (isCancelada) return 'future'
    if (isCompleto) return 'done'
    if (isRejeitada) {
      const rejIdx = status === 'rejeitada' ? 1 : 3
      if (i < rejIdx) return 'done'
      if (i === rejIdx) return 'rejected'
      return 'future'
    }
    if (i < etapaIdx) return 'done'
    if (i === etapaIdx) return 'active'
    return 'future'
  }

  // ── Compact mode (para cards de lista) ──────────────────────────────────────
  if (compact) {
    return (
      <div className={`flex items-center gap-0.5 ${className}`}>
        {ETAPAS.map((etapa, i) => {
          const state = getState(i)
          const isLast = i === ETAPAS.length - 1

          return (
            <div key={etapa.shortLabel} className="flex items-center">
              {/* Bolinha */}
              <div
                title={etapa.label}
                className={`
                  w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all
                  ${state === 'done'     ? 'bg-teal-500' : ''}
                  ${state === 'active'   ? 'bg-teal-400 ring-2 ring-teal-400/40' : ''}
                  ${state === 'future'   ? 'bg-slate-200' : ''}
                  ${state === 'rejected' ? 'bg-red-400' : ''}
                `}
              />
              {/* Linha conectora */}
              {!isLast && (
                <div className={`w-3 h-px flex-shrink-0 ${state === 'done' ? 'bg-teal-400' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Full mode (para páginas de detalhe e header) ─────────────────────────────
  return (
    <div className={`flex items-start w-full ${className}`}>
      {ETAPAS.map((etapa, i) => {
        const state = getState(i)
        const isLast = i === ETAPAS.length - 1

        return (
          <div key={etapa.label} className="flex items-start flex-1 min-w-0">
            {/* Etapa */}
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Círculo */}
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                  transition-all duration-300
                  ${state === 'done'     ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/40' : ''}
                  ${state === 'active'   ? 'bg-teal-400 text-white ring-4 ring-teal-400/20 animate-pulse-glow' : ''}
                  ${state === 'future'   ? 'bg-slate-100 text-slate-400 border-2 border-slate-200' : ''}
                  ${state === 'rejected' ? 'bg-red-100 text-red-500 border-2 border-red-300' : ''}
                `}
              >
                {state === 'done' ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  <span className={`text-[10px] font-bold ${state === 'active' ? 'text-white' : ''}`}>
                    {i + 1}
                  </span>
                )}
              </div>
              {/* Label */}
              <span
                className={`
                  mt-1.5 text-[10px] font-semibold text-center leading-tight max-w-[52px]
                  ${state === 'active'   ? 'text-teal-600' : ''}
                  ${state === 'done'     ? 'text-teal-500' : ''}
                  ${state === 'future'   ? 'text-slate-400' : ''}
                  ${state === 'rejected' ? 'text-red-500' : ''}
                `}
              >
                {etapa.label}
              </span>
            </div>

            {/* Linha conectora (exceto última) */}
            {!isLast && (
              <div
                className={`
                  flex-1 h-px mt-3.5 mx-1
                  ${state === 'done' ? 'bg-teal-400' : 'bg-slate-200'}
                `}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
