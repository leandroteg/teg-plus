import { AlertTriangle } from 'lucide-react'

const fmtDM = (ms: number) =>
  new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/**
 * Linha do tempo do prazo da solicitação: da abertura até a data de necessidade.
 * A barra preenche conforme o tempo passa (azul → âmbar → laranja → vermelho),
 * evidenciando o atraso enquanto a RC fica parada em aprovação.
 * Não renderiza se a solicitação estiver encerrada ou sem data de necessidade.
 */
export function BarraPrazo({
  createdAt,
  dataNecessidade,
  encerrada = false,
  className = '',
}: {
  createdAt: string
  dataNecessidade?: string | null
  encerrada?: boolean
  className?: string
}) {
  if (encerrada || !dataNecessidade) return null

  const inicio = new Date(createdAt).getTime()
  const fim = new Date(dataNecessidade).getTime()
  const hoje = Date.now()
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return null

  const total = fim - inicio
  const pct = Math.min(100, Math.max(0, ((hoje - inicio) / total) * 100))
  const diasRest = Math.ceil((fim - hoje) / 86_400_000)
  const atrasado = hoje > fim

  let bar = 'bg-sky-500', track = 'bg-sky-100', txt = 'text-sky-600'
  if (atrasado) { bar = 'bg-red-500'; track = 'bg-red-100'; txt = 'text-red-600' }
  else if (pct >= 80) { bar = 'bg-orange-500'; track = 'bg-orange-100'; txt = 'text-orange-600' }
  else if (pct >= 50) { bar = 'bg-amber-500'; track = 'bg-amber-100'; txt = 'text-amber-600' }

  const label = atrasado
    ? `Atrasado ${Math.abs(diasRest)}d`
    : diasRest === 0 ? 'Entrega hoje'
    : `Faltam ${diasRest}d`

  return (
    <div className={`mt-3 ${className}`}>
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
        <span>Aberta {fmtDM(inicio)}</span>
        <span className={`font-bold inline-flex items-center gap-1 ${txt}`}>
          {atrasado && <AlertTriangle size={10} />}{label}
        </span>
        <span>Necessidade {fmtDM(fim)}</span>
      </div>
      <div className={`relative h-1.5 rounded-full ${track}`}>
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${bar} ${atrasado ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
