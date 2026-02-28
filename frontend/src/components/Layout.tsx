import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, List, ShoppingCart, User } from 'lucide-react'

const nav = [
  { to: '/',            icon: LayoutDashboard, label: 'Painel' },
  { to: '/nova',        icon: PlusCircle,      label: 'Nova RC' },
  { to: '/requisicoes', icon: List,            label: 'Lista' },
  { to: '/cotacoes',    icon: ShoppingCart,    label: 'Cotacoes' },
  { to: '/perfil',      icon: User,            label: 'Perfil' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-primary text-white px-4 py-3 shadow-md sticky top-0 z-30">
        <h1 className="text-lg font-bold tracking-tight">TEG+ Compras</h1>
      </header>

      {/* Content */}
      <main className="px-4 py-4 max-w-lg mx-auto">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around max-w-lg mx-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                  isActive ? 'text-primary font-semibold' : 'text-gray-400'
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
