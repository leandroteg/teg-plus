// ─────────────────────────────────────────────────────────────────────────────
// CheckinIndicadores — leitura visual do último check-in diário.
//
// A escala (ícone + cor) é a MESMA que o motorista vê no Portal TEG ao lançar o
// check-in: Crítico › Ruim › Moderado › Bom › Excelente. Se divergirem, o campo
// e o escritório passam a falar línguas diferentes sobre o mesmo ativo.
// ─────────────────────────────────────────────────────────────────────────────
import { Angry, Frown, Meh, Smile, Laugh, TriangleAlert, Minus } from 'lucide-react'

export const ESCALA: Record<number, {
  label: string; icon: React.ElementType; cor: string; bg: string; solido: string
}> = {
  1: { label: 'Crítico',   icon: Angry, cor: 'text-red-600',     bg: 'bg-red-50',     solido: 'bg-red-500' },
  2: { label: 'Ruim',      icon: Frown, cor: 'text-orange-600',  bg: 'bg-orange-50',  solido: 'bg-orange-500' },
  3: { label: 'Moderado',  icon: Meh,   cor: 'text-amber-600',   bg: 'bg-amber-50',   solido: 'bg-amber-500' },
  4: { label: 'Bom',       icon: Smile, cor: 'text-lime-600',    bg: 'bg-lime-50',    solido: 'bg-lime-600' },
  5: { label: 'Excelente', icon: Laugh, cor: 'text-emerald-600', bg: 'bg-emerald-50', solido: 'bg-emerald-500' },
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

/** Nota 1..5 como ícone. Sem check-in ainda → traço discreto, nunca um zero falso. */
export function NotaIcone({ nota, size = 17, titulo }: {
  nota: number | null | undefined
  size?: number
  /** Prefixo do tooltip, ex.: "Condição". */
  titulo?: string
}) {
  if (nota == null) {
    return <SemDado size={size} />
  }
  const e = ESCALA[nota]
  if (!e) return <SemDado size={size} />
  const Icon = e.icon
  // Ficha preenchida: o disco carrega a cor e o rosto vem em branco. Fica
  // legível de longe numa coluna de tabela, que é onde ela mais é lida.
  return (
    <span
      title={`${titulo ? titulo + ': ' : ''}${e.label}`}
      className={`inline-flex items-center justify-center rounded-full ${e.solido}`}
      style={{ width: size + 7, height: size + 7 }}
    >
      <Icon size={size - 1} className="text-white" strokeWidth={2.4} aria-label={e.label} />
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
    <span
      title={descricao ? `Avaria: ${descricao}` : 'Avaria registrada'}
      className="inline-flex items-center justify-center rounded-full bg-amber-500"
      style={{ width: size + 7, height: size + 7 }}
    >
      <TriangleAlert size={size - 1} className="text-white" strokeWidth={2.4} aria-label="com avaria" />
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
