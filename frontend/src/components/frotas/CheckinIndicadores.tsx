// ─────────────────────────────────────────────────────────────────────────────
// CheckinIndicadores — leitura visual do último check-in diário.
//
// A escala (ícone + cor) é a MESMA que o motorista vê no Portal TEG ao lançar o
// check-in: Crítico › Ruim › Moderado › Bom › Excelente. Se divergirem, o campo
// e o escritório passam a falar línguas diferentes sobre o mesmo ativo.
// ─────────────────────────────────────────────────────────────────────────────
import { Angry, Frown, Meh, Smile, Laugh, ShieldCheck, TriangleAlert, Minus } from 'lucide-react'

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
function SemDado({ size }: { size: number }) {
  return (
    <span title="Sem check-in" className="inline-flex">
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
  return (
    <span title={`${titulo ? titulo + ': ' : ''}${e.label}`} className="inline-flex">
      <Icon size={size} className={e.cor} strokeWidth={2.2} aria-label={e.label} />
    </span>
  )
}

/** Avaria: escudo tranquilo quando não há; triângulo âmbar quando há. */
export function AvariaIcone({ temAvaria, descricao, size = 17 }: {
  temAvaria: boolean | null | undefined
  descricao?: string | null
  size?: number
}) {
  if (temAvaria == null) {
    return <SemDado size={size} />
  }
  return temAvaria ? (
    <span title={descricao ? `Avaria: ${descricao}` : 'Avaria registrada'} className="inline-flex">
      <TriangleAlert size={size} className="text-amber-600" strokeWidth={2.2} aria-label="com avaria" />
    </span>
  ) : (
    <span title="Sem avarias" className="inline-flex">
      <ShieldCheck size={size} className="text-emerald-600" strokeWidth={2.2} aria-label="sem avarias" />
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
