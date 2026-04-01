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

// Avatar colorido determinístico por nome
const AVATAR_COLORS: Record<string, string> = {
  Lauany:     'bg-violet-500',
  Fernando:   'bg-amber-500',
  Aline:      'bg-emerald-500',
  Elton:      'bg-sky-500',
  Claudionor: 'bg-rose-500',
}

function getAvatarColor(nome: string) {
  return AVATAR_COLORS[nome] ?? 'bg-slate-500'
}

function getInitials(nome: string) {
  return nome.slice(0, 2).toUpperCase()
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
      {/* Ícone + nome */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${corFundo}18` }}
        >
          <Icon size={18} style={{ color: corFundo }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold leading-tight truncate ${selected ? 'text-teal-700' : 'text-slate-800'}`}>
            {categoria.nome}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{categoria.codigo}</p>
        </div>
        {selected && (
          <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white fill-current">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Comprador + Aprovador */}
      {(categoria.comprador_nome || categoria.alcada1_aprovador) && (
        <div className="space-y-1.5">
          {categoria.comprador_nome && (
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-extrabold flex-shrink-0 ${getAvatarColor(categoria.comprador_nome)}`}>
                {getInitials(categoria.comprador_nome)}
              </div>
              <span className="text-[11px] text-slate-600 font-medium">
                Comprador: <strong className="text-slate-800">{categoria.comprador_nome}</strong>
              </span>
            </div>
          )}
          {categoria.alcada1_aprovador && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 12 12" className="w-3 h-3 text-slate-500 fill-current">
                  <path d="M6 1a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM1 10.5c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke="currentColor" strokeWidth={1} fill="none" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-[11px] text-slate-500">
                Aprovação &lt;R$3k: <strong className="text-slate-700">{categoria.alcada1_aprovador}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Indicador de seleção */}
      {selected && (
        <div className="mt-2 h-0.5 w-full rounded-full bg-teal-400/50" />
      )}
    </button>
  )
}

export default memo(CategoryCard)
