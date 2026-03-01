import type { LucideIcon } from 'lucide-react'

interface Props {
  titulo: string
  valor: string | number
  icon: LucideIcon
  cor?: string
  subtitulo?: string
}

const COR_TO_HEX: Record<string, string> = {
  'text-primary': '#6366F1',
  'text-warning':  '#F59E0B',
  'text-success':  '#10B981',
  'text-danger':   '#EF4444',
}

export default function KpiCard({ titulo, valor, icon: Icon, cor = 'text-primary', subtitulo }: Props) {
  const hex = COR_TO_HEX[cor] ?? '#6366F1'

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-50 overflow-hidden flex">
      <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: hex }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
          style={{ backgroundColor: hex + '18' }}>
          <Icon className={`w-4 h-4 ${cor}`} />
        </div>
        <p className={`text-2xl font-extrabold ${cor} leading-none tracking-tight`}>{valor}</p>
        <p className="text-[10px] text-gray-400 font-semibold mt-1.5 uppercase tracking-widest">{titulo}</p>
        {subtitulo && <p className="text-xs text-gray-400 mt-0.5">{subtitulo}</p>}
      </div>
    </div>
  )
}
