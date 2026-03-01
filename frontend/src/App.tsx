import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PrivateRoute, AdminRoute } from './components/PrivateRoute'
import Layout from './components/Layout'

// Páginas públicas
import Login from './pages/Login'

// Páginas privadas
import Dashboard from './pages/Dashboard'
import NovaRequisicao from './pages/NovaRequisicao'
import ListaRequisicoes from './pages/ListaRequisicoes'
import FilaCotacoes from './pages/FilaCotacoes'
import CotacaoForm from './pages/CotacaoForm'
import Aprovacao from './pages/Aprovacao'
import AprovAi from './pages/AprovAi'
import Perfil from './pages/Perfil'

// Admin
import AdminUsuarios from './pages/AdminUsuarios'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Pública: login / auth ──────────────────────────── */}
        <Route path="/login"      element={<Login />} />
        <Route path="/nova-senha" element={<Login />} />

        {/* Aprovação por token: pública (aprovador externo) */}
        <Route path="/aprovacao/:token" element={<Aprovacao />} />
        <Route path="/aprovaai"         element={<AprovAi />} />

        {/* ── Privadas: requerem login ───────────────────────── */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/nova"        element={<NovaRequisicao />} />
            <Route path="/requisicoes" element={<ListaRequisicoes />} />
            <Route path="/cotacoes"    element={<FilaCotacoes />} />
            <Route path="/cotacoes/:id" element={<CotacaoForm />} />
            <Route path="/perfil"      element={<Perfil />} />
          </Route>
        </Route>

        {/* ── Admin: apenas role = 'admin' ──────────────────── */}
        <Route element={<AdminRoute />}>
          <Route element={<Layout />}>
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
