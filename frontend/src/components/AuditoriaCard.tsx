import { useTheme } from '../contexts/ThemeContext'

type Props = {
  createdAt?: string | null
  updatedAt?: string | null
  criadoPor?: string | null
  atualizadoPor?: string | null
  extra?: Array<{ label: string; value: string | null | undefined }>
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AuditoriaCard({
  createdAt,
  updatedAt,
  criadoPor,
  atualizadoPor,
  extra,
}: Props) {
  const { isDark } = useTheme()
  const sub = isDark ? 'text-slate-400' : 'text-slate-500'
  const txt = isDark ? 'text-slate-200' : 'text-slate-700'

  if (!createdAt && !updatedAt && !extra?.length) return null

  return (
    <div
      className={`rounded-xl px-3 py-2.5 border text-[11px] space-y-1 ${
        isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
      }`}
    >
      {extra?.map((row) =>
        row.value ? (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className={sub}>{row.label}</span>
            <span className={`font-semibold ${txt}`}>{row.value}</span>
          </div>
        ) : null,
      )}
      {createdAt && (
        <div className="flex items-center justify-between gap-2">
          <span className={sub}>Criado em</span>
          <span className={`font-mono ${txt}`}>
            {fmt(createdAt)}
            <span className="ml-1 not-italic font-semibold">· {criadoPor || '—'}</span>
          </span>
        </div>
      )}
      {updatedAt && (
        <div className="flex items-center justify-between gap-2">
          <span className={sub}>Última alteração</span>
          <span className={`font-mono ${txt}`}>
            {fmt(updatedAt)}
            <span className="ml-1 not-italic font-semibold">· {atualizadoPor || '—'}</span>
          </span>
        </div>
      )}
    </div>
  )
}
