import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PrivateRoute, AdminRoute } from './components/PrivateRoute'
import ModuleLayout from './components/ModuleLayout'
import ModuleRoute from './components/ModuleRoute'
import {
  COMPRAS_CONFIG, FINANCEIRO_CONFIG, ESTOQUE_CONFIG,
  LOGISTICA_CONFIG, FROTAS_CONFIG, CONTRATOS_CONFIG, RH_CONFIG,
} from './config/modules'

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
import DashboardContratos from './pages/contratos/DashboardContratos'
import ListaContratos from './pages/contratos/ListaContratos'
import NovoContrato from './pages/contratos/NovoContrato'
import ParcelasContratos from './pages/contratos/Parcelas'

// Módulo RH
import RHHome from './pages/rh/RHHome'
import MuralAdmin from './pages/rh/MuralAdmin'

// Módulo Financeiro
import DashboardFinanceiro from './pages/financeiro/DashboardFinanceiro'
import ContasPagar from './pages/financeiro/ContasPagar'
import ContasReceber from './pages/financeiro/ContasReceber'
import AprovacoesPagamento from './pages/financeiro/AprovacoesPagamento'
import Conciliacao from './pages/financeiro/Conciliacao'
import Relatorios from './pages/financeiro/Relatorios'
import Fornecedores from './pages/financeiro/Fornecedores'
import Configuracoes from './pages/financeiro/Configuracoes'

// Módulo Estoque
import EstoqueHome from './pages/estoque/EstoqueHome'
import Itens from './pages/estoque/Itens'
import Movimentacoes from './pages/estoque/Movimentacoes'
import Inventario from './pages/estoque/Inventario'
import Patrimonial from './pages/estoque/Patrimonial'

// Módulo Logística
import LogisticaHome from './pages/logistica/LogisticaHome'
import Solicitacoes from './pages/logistica/Solicitacoes'
import Expedicao from './pages/logistica/Expedicao'
import TransportesLog from './pages/logistica/Transportes'
import Recebimentos from './pages/logistica/Recebimentos'
import TransportadorasLog from './pages/logistica/Transportadoras'

// Módulo Frotas
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

          {/* Módulo Compras */}
          <Route element={<ModuleRoute module="compras" />}>
            <Route element={<ModuleLayout config={COMPRAS_CONFIG} />}>
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

          {/* Módulo Financeiro */}
          <Route element={<ModuleRoute module="financeiro" />}>
            <Route element={<ModuleLayout config={FINANCEIRO_CONFIG} />}>
              <Route path="/financeiro"              element={<DashboardFinanceiro />} />
              <Route path="/financeiro/cp"           element={<ContasPagar />} />
              <Route path="/financeiro/cr"           element={<ContasReceber />} />
              <Route path="/financeiro/aprovacoes"   element={<AprovacoesPagamento />} />
              <Route path="/financeiro/conciliacao"  element={<Conciliacao />} />
              <Route path="/financeiro/relatorios"   element={<Relatorios />} />
              <Route path="/financeiro/fornecedores" element={<Fornecedores />} />
              <Route path="/financeiro/configuracoes" element={<Configuracoes />} />
            </Route>
          </Route>

          {/* Módulo Estoque */}
          <Route element={<ModuleRoute module="estoque" />}>
            <Route element={<ModuleLayout config={ESTOQUE_CONFIG} />}>
              <Route path="/estoque"               element={<EstoqueHome />} />
              <Route path="/estoque/itens"         element={<Itens />} />
              <Route path="/estoque/movimentacoes" element={<Movimentacoes />} />
              <Route path="/estoque/inventario"    element={<Inventario />} />
              <Route path="/estoque/patrimonial"   element={<Patrimonial />} />
            </Route>
          </Route>

          {/* Módulo Logística */}
          <Route element={<ModuleRoute module="logistica" />}>
            <Route element={<ModuleLayout config={LOGISTICA_CONFIG} />}>
              <Route path="/logistica"                   element={<LogisticaHome />} />
              <Route path="/logistica/solicitacoes"      element={<Solicitacoes />} />
              <Route path="/logistica/expedicao"         element={<Expedicao />} />
              <Route path="/logistica/transportes"       element={<TransportesLog />} />
              <Route path="/logistica/recebimentos"      element={<Recebimentos />} />
              <Route path="/logistica/transportadoras"   element={<TransportadorasLog />} />
            </Route>
          </Route>

          {/* Módulo Frotas */}
          <Route element={<ModuleRoute module="frotas" />}>
            <Route element={<ModuleLayout config={FROTAS_CONFIG} />}>
              <Route path="/frotas"                      element={<FrotasHome />} />
              <Route path="/frotas/veiculos"             element={<Veiculos />} />
              <Route path="/frotas/ordens"               element={<Ordens />} />
              <Route path="/frotas/checklists"           element={<Checklists />} />
              <Route path="/frotas/abastecimentos"       element={<Abastecimentos />} />
              <Route path="/frotas/telemetria"           element={<Telemetria />} />
            </Route>
          </Route>

          {/* Módulo RH */}
          <Route element={<ModuleRoute module="rh" />}>
            <Route element={<ModuleLayout config={RH_CONFIG} />}>
              <Route path="/rh"        element={<RHHome />} />
              <Route path="/rh/mural"  element={<MuralAdmin />} />
            </Route>
          </Route>

          {/* Módulo Contratos */}
          <Route element={<ModuleRoute module="contratos" />}>
            <Route element={<ModuleLayout config={CONTRATOS_CONFIG} />}>
              <Route path="/contratos"            element={<DashboardContratos />} />
              <Route path="/contratos/lista"      element={<ListaContratos />} />
              <Route path="/contratos/novo"       element={<NovoContrato />} />
              <Route path="/contratos/parcelas"   element={<ParcelasContratos />} />
            </Route>
          </Route>

          {/* Módulos stub */}
          <Route path="/ssma" element={<SSMA />} />
        </Route>

        {/* ── Admin ─────────────────────────────────────────── */}
        <Route element={<AdminRoute />}>
          <Route element={<ModuleLayout config={COMPRAS_CONFIG} />}>
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
    </ThemeProvider>
  )
}
