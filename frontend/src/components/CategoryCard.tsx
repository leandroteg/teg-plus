// CategoryCard.tsx — Card de seleção de categoria com dados reais do comprador
import {
  Building2, ShieldCheck, Wrench, Package, ShoppingBag,
  Truck, Briefcase, Car, MapPin, Home, Utensils, Monitor,
  type LucideIcon,
} from 'lucide-react'
import { memo } from 'react'
import type { CategoriaMaterial } from '../types'

// Mapeamento nome do ícone → componente Lucide
const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  ShieldCheck,
  Wrench,
  Package,
  ShoppingBag,
  Truck,
  Briefcase,
  Car,
  MapPin,
  Home,
  Utensils,
  Monitor,
}

interface Props {
  categoria: CategoriaMaterial
  selected?: boolean
  onClick?: () => void
}

function CategoryCard({ categoria, selected = false, onClick }: Props) {
  const Icon = ICON_MAP[categoria.icone] ?? Package
  const corFundo = categoria.cor ?? '#6b7280'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left rounded-2xl border-2 p-4 transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-teal-400/50
        ${selected
          ? 'border-teal-500 bg-teal-500/8 shadow-md shadow-teal-500/15'
          : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm hover:bg-teal-50/40'
        }
      `}
    >
      {/* Ícone + nome + check */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${corFundo}18` }}
        >
          <Icon size={17} style={{ color: corFundo }} />
        </div>
        <p className={`flex-1 min-w-0 text-sm font-semibold leading-tight truncate ${selected ? 'text-teal-700' : 'text-slate-800'}`}>
          {categoria.nome}
        </p>
        {selected && (
          <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white fill-current">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Indicador de seleção */}
      {selected && (
        <div className="mt-2 h-0.5 w-full rounded-full bg-teal-400/50" />
      )}
    </button>
  )
}

export default memo(CategoryCard)
