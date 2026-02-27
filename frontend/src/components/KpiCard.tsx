import type { LucideIcon } from 'lucide-react'

interface Props {
  titulo: string
  valor: string | number
  icon: LucideIcon
  cor?: string
  subtitulo?: string
}

export default function KpiCard({ titulo, valor, icon: Icon, cor = 'text-primary', subtitulo }: Props) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{titulo}</span>
        <Icon className={`w-5 h-5 ${cor}`} />
      </div>
      <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
      {subtitulo && <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>}
    </div>
  )
}
