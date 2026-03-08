import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PrivateRoute, AdminRoute } from './components/PrivateRoute'
import ModuleLayout from './components/ModuleLayout'
import ModuleRoute from './components/ModuleRoute'
import ErrorBoundary from './components/ErrorBoundary'
import {
  COMPRAS_CONFIG, FINANCEIRO_CONFIG, ESTOQUE_CONFIG,
  LOGISTICA_CONFIG, FROTAS_CONFIG, CONTRATOS_CONFIG, RH_CONFIG,
} from './config/modules'

// ── Loading spinner ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin" />
    </div>
  )
}

// ── Lazy pages ──────────────────────────────────────────────────────────────

// Públicas
const Login = lazy(() => import('./pages/Login'))
const Aprovacao = lazy(() => import('./pages/Aprovacao'))
const AprovAi = lazy(() => import('./pages/AprovAi'))

// Privadas – raiz
const ModuloSelector = lazy(() => import('./pages/ModuloSelector'))
const Perfil = lazy(() => import('./pages/Perfil'))
const AdminUsuarios = lazy(() => import('./pages/AdminUsuarios'))
const SSMA = lazy(() => import('./pages/SSMA'))

// Compras
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NovaRequisicao = lazy(() => import('./pages/NovaRequisicao'))
const ListaRequisicoes = lazy(() => import('./pages/ListaRequisicoes'))
const RequisicaoDetalhe = lazy(() => import('./pages/RequisicaoDetalhe'))
const FilaCotacoes = lazy(() => import('./pages/FilaCotacoes'))
const CotacaoForm = lazy(() => import('./pages/CotacaoForm'))
const Pedidos = lazy(() => import('./pages/Pedidos'))

// Contratos
const DashboardContratos = lazy(() => import('./pages/contratos/DashboardContratos'))
const ListaContratos = lazy(() => import('./pages/contratos/ListaContratos'))
const NovoContrato = lazy(() => import('./pages/contratos/NovoContrato'))
const ParcelasContratos = lazy(() => import('./pages/contratos/Parcelas'))

// RH
const RHHome = lazy(() => import('./pages/rh/RHHome'))
const MuralAdmin = lazy(() => import('./pages/rh/MuralAdmin'))

// Financeiro
const DashboardFinanceiro = lazy(() => import('./pages/financeiro/DashboardFinanceiro'))
const ContasPagar = lazy(() => import('./pages/financeiro/ContasPagar'))
const ContasReceber = lazy(() => import('./pages/financeiro/ContasReceber'))
const AprovacoesPagamento = lazy(() => import('./pages/financeiro/AprovacoesPagamento'))
const Conciliacao = lazy(() => import('./pages/financeiro/Conciliacao'))
const Relatorios = lazy(() => import('./pages/financeiro/Relatorios'))
const Fornecedores = lazy(() => import('./pages/financeiro/Fornecedores'))
const Configuracoes = lazy(() => import('./pages/financeiro/Configuracoes'))

// Estoque
const EstoqueHome = lazy(() => import('./pages/estoque/EstoqueHome'))
const Itens = lazy(() => import('./pages/estoque/Itens'))
const Movimentacoes = lazy(() => import('./pages/estoque/Movimentacoes'))
const Inventario = lazy(() => import('./pages/estoque/Inventario'))
const Patrimonial = lazy(() => import('./pages/estoque/Patrimonial'))

// Logística
const LogisticaHome = lazy(() => import('./pages/logistica/LogisticaHome'))
const Solicitacoes = lazy(() => import('./pages/logistica/Solicitacoes'))
const Expedicao = lazy(() => import('./pages/logistica/Expedicao'))
const TransportesLog = lazy(() => import('./pages/logistica/Transportes'))
const Recebimentos = lazy(() => import('./pages/logistica/Recebimentos'))
const TransportadorasLog = lazy(() => import('./pages/logistica/Transportadoras'))

// Frotas
const FrotasHome = lazy(() => import('./pages/frotas/FrotasHome'))
const Veiculos = lazy(() => import('./pages/frotas/Veiculos'))
const Ordens = lazy(() => import('./pages/frotas/Ordens'))
const Checklists = lazy(() => import('./pages/frotas/Checklists'))
const Abastecimentos = lazy(() => import('./pages/frotas/Abastecimentos'))
const Telemetria = lazy(() => import('./pages/frotas/Telemetria'))

// ── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <ErrorBoundary moduleName="Aplicação">
    <Suspense fallback={<PageLoader />}>
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
              <Route path="/compras"     element={<ErrorBoundary moduleName="Compras"><Dashboard /></ErrorBoundary>} />
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
              <Route path="/financeiro"              element={<ErrorBoundary moduleName="Financeiro"><DashboardFinanceiro /></ErrorBoundary>} />
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
              <Route path="/estoque"               element={<ErrorBoundary moduleName="Estoque"><EstoqueHome /></ErrorBoundary>} />
              <Route path="/estoque/itens"         element={<Itens />} />
              <Route path="/estoque/movimentacoes" element={<Movimentacoes />} />
              <Route path="/estoque/inventario"    element={<Inventario />} />
              <Route path="/estoque/patrimonial"   element={<Patrimonial />} />
            </Route>
          </Route>

          {/* Módulo Logística */}
          <Route element={<ModuleRoute module="logistica" />}>
            <Route element={<ModuleLayout config={LOGISTICA_CONFIG} />}>
              <Route path="/logistica"                   element={<ErrorBoundary moduleName="Logística"><LogisticaHome /></ErrorBoundary>} />
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
              <Route path="/frotas"                      element={<ErrorBoundary moduleName="Frotas"><FrotasHome /></ErrorBoundary>} />
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
              <Route path="/rh"        element={<ErrorBoundary moduleName="RH"><RHHome /></ErrorBoundary>} />
              <Route path="/rh/mural"  element={<MuralAdmin />} />
            </Route>
          </Route>

          {/* Módulo Contratos */}
          <Route element={<ModuleRoute module="contratos" />}>
            <Route element={<ModuleLayout config={CONTRATOS_CONFIG} />}>
              <Route path="/contratos"            element={<ErrorBoundary moduleName="Contratos"><DashboardContratos /></ErrorBoundary>} />
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
    </Suspense>
    </ErrorBoundary>
    </AuthProvider>
    </ThemeProvider>
  )
}
