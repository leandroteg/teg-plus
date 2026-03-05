import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
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
import RequisicaoDetalhe from './pages/RequisicaoDetalhe'

// Módulos stub
import SSMA from './pages/SSMA'

// Módulo Contratos
import ContratosLayout from './components/ContratosLayout'
import DashboardContratos from './pages/contratos/DashboardContratos'
import ListaContratos from './pages/contratos/ListaContratos'
import NovoContrato from './pages/contratos/NovoContrato'
import ParcelasContratos from './pages/contratos/Parcelas'

// Módulo RH
import RHLayout from './components/RHLayout'
import RHHome from './pages/rh/RHHome'
import MuralAdmin from './pages/rh/MuralAdmin'

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

// Módulo Estoque
import EstoqueLayout from './components/EstoqueLayout'
import EstoqueHome from './pages/estoque/EstoqueHome'
import Itens from './pages/estoque/Itens'
import Movimentacoes from './pages/estoque/Movimentacoes'
import Inventario from './pages/estoque/Inventario'
import Patrimonial from './pages/estoque/Patrimonial'

// Módulo Logística
import LogisticaLayout from './components/LogisticaLayout'
import LogisticaHome from './pages/logistica/LogisticaHome'
import Solicitacoes from './pages/logistica/Solicitacoes'
import Expedicao from './pages/logistica/Expedicao'
import TransportesLog from './pages/logistica/Transportes'
import Recebimentos from './pages/logistica/Recebimentos'
import TransportadorasLog from './pages/logistica/Transportadoras'

// Módulo Frotas
import FrotasLayout from './components/FrotasLayout'
import FrotasHome from './pages/frotas/FrotasHome'
import Veiculos from './pages/frotas/Veiculos'
import Ordens from './pages/frotas/Ordens'
import Checklists from './pages/frotas/Checklists'
import Abastecimentos from './pages/frotas/Abastecimentos'
import Telemetria from './pages/frotas/Telemetria'

// Admin
import AdminUsuarios from './pages/AdminUsuarios'

export default function App() {
  return (
    <ThemeProvider>
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

          {/* Módulo Estoque: usa EstoqueLayout */}
          <Route element={<EstoqueLayout />}>
            <Route path="/estoque"               element={<EstoqueHome />} />
            <Route path="/estoque/itens"         element={<Itens />} />
            <Route path="/estoque/movimentacoes" element={<Movimentacoes />} />
            <Route path="/estoque/inventario"    element={<Inventario />} />
            <Route path="/estoque/patrimonial"   element={<Patrimonial />} />
          </Route>

          {/* Módulo Logística: usa LogisticaLayout */}
          <Route element={<LogisticaLayout />}>
            <Route path="/logistica"                   element={<LogisticaHome />} />
            <Route path="/logistica/solicitacoes"      element={<Solicitacoes />} />
            <Route path="/logistica/expedicao"         element={<Expedicao />} />
            <Route path="/logistica/transportes"       element={<TransportesLog />} />
            <Route path="/logistica/recebimentos"      element={<Recebimentos />} />
            <Route path="/logistica/transportadoras"   element={<TransportadorasLog />} />
          </Route>

          {/* Módulo Frotas: usa FrotasLayout */}
          <Route element={<FrotasLayout />}>
            <Route path="/frotas"                      element={<FrotasHome />} />
            <Route path="/frotas/veiculos"             element={<Veiculos />} />
            <Route path="/frotas/ordens"               element={<Ordens />} />
            <Route path="/frotas/checklists"           element={<Checklists />} />
            <Route path="/frotas/abastecimentos"       element={<Abastecimentos />} />
            <Route path="/frotas/telemetria"           element={<Telemetria />} />
          </Route>

          {/* Módulo RH: usa RHLayout */}
          <Route element={<RHLayout />}>
            <Route path="/rh"        element={<RHHome />} />
            <Route path="/rh/mural"  element={<MuralAdmin />} />
          </Route>

          {/* Módulo Contratos: usa ContratosLayout */}
          <Route element={<ContratosLayout />}>
            <Route path="/contratos"            element={<DashboardContratos />} />
            <Route path="/contratos/lista"      element={<ListaContratos />} />
            <Route path="/contratos/novo"       element={<NovoContrato />} />
            <Route path="/contratos/parcelas"   element={<ParcelasContratos />} />
          </Route>

          {/* Módulos stub */}
          <Route path="/ssma"       element={<SSMA />} />

          {/* Módulo Compras: usa sidebar/Layout */}
          <Route element={<Layout />}>
            <Route path="/compras"     element={<Dashboard />} />
            <Route path="/nova"        element={<NovaRequisicao />} />
            <Route path="/requisicoes" element={<ListaRequisicoes />} />
            <Route path="/requisicoes/:id" element={<RequisicaoDetalhe />} />
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
    </ThemeProvider>
  )
}
