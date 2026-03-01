import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, List, ShoppingCart, User } from 'lucide-react'

const nav = [
  { to: '/',            icon: LayoutDashboard, label: 'Painel' },
  { to: '/nova',        icon: PlusCircle,      label: 'Nova RC' },
  { to: '/requisicoes', icon: List,            label: 'Lista' },
  { to: '/cotacoes',    icon: ShoppingCart,    label: 'Cotações' },
  { to: '/perfil',      icon: User,            label: 'Perfil' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      {/* Header */}
      <header className="bg-navy text-white px-5 py-3.5 sticky top-0 z-30"
        style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">TEG+ Compras</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Sistema de Requisições</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <span className="text-white text-xs font-extrabold">T+</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-5 max-w-lg mx-auto">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40"
        style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
        <div className="flex justify-around max-w-lg mx-auto px-2 py-1.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-1.5 px-3 rounded-xl text-[10px] font-semibold transition-all duration-150 ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
