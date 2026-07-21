import { initials } from '../lib/format'

const SIZES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
}

export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-sky-100 font-semibold text-sky-700 ${SIZES[size]}`}
      title={name}
    >
      {initials(name)}
    </div>
  )
}
