import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PrivateRoute, AdminRoute } from './components/PrivateRoute'
import Layout from './components/Layout'

// Páginas públicas
import Login from './pages/Login'

// Páginas privadas
import ModuloSelector from './pages/ModuloSelector'
import Dashboard from './pages/Dashboard'
import NovaRequisicao from './pages/NovaRequisicao'
import ListaRequisicoes from './pages/ListaRequisicoes'
import FilaCotacoes from './pages/FilaCotacoes'
import CotacaoForm from './pages/CotacaoForm'
import Aprovacao from './pages/Aprovacao'
import AprovAi from './pages/AprovAi'
import Perfil from './pages/Perfil'
import Pedidos from './pages/Pedidos'

// Módulos stub
import RH from './pages/RH'
import SSMA from './pages/SSMA'
import Estoque from './pages/Estoque'
import Contratos from './pages/Contratos'

// Módulo Financeiro
import FinanceiroLayout from './components/FinanceiroLayout'
import DashboardFinanceiro from './pages/financeiro/DashboardFinanceiro'
import ContasPagar from './pages/financeiro/ContasPagar'
import ContasReceber from './pages/financeiro/ContasReceber'
import AprovacoesPagamento from './pages/financeiro/AprovacoesPagamento'
import Conciliacao from './pages/financeiro/Conciliacao'
import Relatorios from './pages/financeiro/Relatorios'
import Fornecedores from './pages/financeiro/Fornecedores'
import Configuracoes from './pages/financeiro/Configuracoes'

// Admin
import AdminUsuarios from './pages/AdminUsuarios'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Públicas ──────────────────────────────────────── */}
        <Route path="/login"      element={<Login />} />
        <Route path="/nova-senha" element={<Login />} />

        {/* Aprovação por token: pública (aprovador externo) */}
        <Route path="/aprovacao/:token" element={<Aprovacao />} />
        <Route path="/aprovaai"         element={<AprovAi />} />

        {/* ── Privadas ──────────────────────────────────────── */}
        <Route element={<PrivateRoute />}>

          {/* Seletor de módulos: tela inicial (sem Layout) */}
          <Route path="/" element={<ModuloSelector />} />

          {/* Módulo Financeiro: usa FinanceiroLayout */}
          <Route element={<FinanceiroLayout />}>
            <Route path="/financeiro"              element={<DashboardFinanceiro />} />
            <Route path="/financeiro/cp"           element={<ContasPagar />} />
            <Route path="/financeiro/cr"           element={<ContasReceber />} />
            <Route path="/financeiro/aprovacoes"   element={<AprovacoesPagamento />} />
            <Route path="/financeiro/conciliacao"  element={<Conciliacao />} />
            <Route path="/financeiro/relatorios"   element={<Relatorios />} />
            <Route path="/financeiro/fornecedores"   element={<Fornecedores />} />
            <Route path="/financeiro/configuracoes" element={<Configuracoes />} />
          </Route>

          {/* Módulos stub */}
          <Route path="/rh"         element={<RH />} />
          <Route path="/ssma"       element={<SSMA />} />
          <Route path="/estoque"    element={<Estoque />} />
          <Route path="/contratos"  element={<Contratos />} />

          {/* Módulo Compras: usa sidebar/Layout */}
          <Route element={<Layout />}>
            <Route path="/compras"     element={<Dashboard />} />
            <Route path="/nova"        element={<NovaRequisicao />} />
            <Route path="/requisicoes" element={<ListaRequisicoes />} />
            <Route path="/cotacoes"    element={<FilaCotacoes />} />
            <Route path="/cotacoes/:id" element={<CotacaoForm />} />
            <Route path="/pedidos"     element={<Pedidos />} />
            <Route path="/perfil"      element={<Perfil />} />
          </Route>
        </Route>

        {/* ── Admin ─────────────────────────────────────────── */}
        <Route element={<AdminRoute />}>
          <Route element={<Layout />}>
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
