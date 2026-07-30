// ─────────────────────────────────────────────────────────────────────────────
// CheckinIndicadores — leitura visual do último check-in diário.
//
// A nota é a MESMA que o motorista lança no Portal TEG:
// 1 Crítico › 2 Ruim › 3 Moderado › 4 Bom › 5 Excelente.
// Ao ESCOLHER (Portal e check-in manual) ela aparece como carinhas; ao LER
// (tabelas e cards) aparece como estrelas. O que não pode divergir é o
// significado da nota — senão campo e escritório falam línguas diferentes.
// ─────────────────────────────────────────────────────────────────────────────
import { Angry, Frown, Meh, Smile, Laugh, Star, TriangleAlert, Minus } from 'lucide-react'

export const ESCALA: Record<number, { label: string; icon: React.ElementType; cor: string; bg: string }> = {
  1: { label: 'Crítico',   icon: Angry, cor: 'text-red-600',     bg: 'bg-red-50' },
  2: { label: 'Ruim',      icon: Frown, cor: 'text-orange-600',  bg: 'bg-orange-50' },
  3: { label: 'Moderado',  icon: Meh,   cor: 'text-amber-600',   bg: 'bg-amber-50' },
  4: { label: 'Bom',       icon: Smile, cor: 'text-lime-600',    bg: 'bg-lime-50' },
  5: { label: 'Excelente', icon: Laugh, cor: 'text-emerald-600', bg: 'bg-emerald-50' },
}

const VAZIO = 'text-slate-300'

/** Traço de "sem check-in". Embrulhado porque svg puro é display:block e
 *  escaparia do text-center da célula. */
function SemDado({ size, titulo = 'Sem check-in' }: { size: number; titulo?: string }) {
  return (
    <span title={titulo} className="inline-flex">
      <Minus size={size} className={VAZIO} strokeWidth={2.5} aria-label="sem check-in" />
    </span>
  )
}

/** Nota 1..5 como barra de 5 estrelas: as N primeiras cheias, o resto apagado.
 *  Sem check-in ainda → traço, nunca uma barra zerada (que se leria como
 *  "avaliado com nota mínima"). */
export function NotaIcone({ nota, size = 17, titulo }: {
  nota: number | null | undefined
  size?: number
  /** Prefixo do tooltip, ex.: "Condição". */
  titulo?: string
}) {
  if (nota == null || !ESCALA[nota]) {
    return <SemDado size={size} />
  }
  // Estrela no mesmo tamanho do ícone que ela substitui: encolher para caber as
  // cinco tornava a nota ilegível, que era justamente o problema a resolver.
  const estrela = Math.max(13, size)
  return (
    <span
      title={`${titulo ? titulo + ': ' : ''}${nota} de 5 — ${ESCALA[nota].label}`}
      className="inline-flex items-center gap-[2px] whitespace-nowrap"
      aria-label={`${nota} de 5`}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={estrela}
          className={i <= nota ? 'text-amber-400' : 'text-slate-200'}
          fill="currentColor"
          strokeWidth={0}
        />
      ))}
    </span>
  )
}

/** Avaria: escudo tranquilo quando não há; triângulo âmbar quando há. */
/** Avaria só é marcada quando existe. Sem avaria (ou sem check-in) fica o
 *  traço: a coluna passa a ser uma lista de exceções, não um mar de escudos
 *  verdes onde o que importa se perde. O tooltip mantém a distinção. */
export function AvariaIcone({ temAvaria, descricao, size = 17 }: {
  temAvaria: boolean | null | undefined
  descricao?: string | null
  size?: number
}) {
  if (!temAvaria) {
    return <SemDado size={size} titulo={temAvaria === false ? 'Sem avarias' : 'Sem check-in'} />
  }
  return (
    <span title={descricao ? `Avaria: ${descricao}` : 'Avaria registrada'} className="inline-flex">
      <TriangleAlert size={size} className="text-amber-500" fill="currentColor" strokeWidth={0} aria-label="com avaria" />
    </span>
  )
}

/** Trio Condição · Limpeza · Avarias em linha — usado nos cards e no modal. */
export function TrioCheckin({ funcional, limpeza, temAvaria, avaria, size = 16 }: {
  funcional: number | null | undefined
  limpeza: number | null | undefined
  temAvaria: boolean | null | undefined
  avaria?: string | null
  size?: number
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <NotaIcone nota={funcional} size={size} titulo="Condição" />
      <NotaIcone nota={limpeza} size={size} titulo="Limpeza" />
      <AvariaIcone temAvaria={temAvaria} descricao={avaria} size={size} />
    </span>
  )
}
