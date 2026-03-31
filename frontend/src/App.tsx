import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PrivateRoute, AdminRoute } from './components/PrivateRoute'
import ModuleRoute from './components/ModuleRoute'
import Layout from './components/Layout'
import PageSkeleton from './components/skeletons/PageSkeleton'
import DashboardSkeleton from './components/skeletons/DashboardSkeleton'
import TableSkeleton from './components/skeletons/TableSkeleton'
import OfflineBanner from './components/OfflineBanner'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import UpdateAvailable from './components/UpdateAvailable'
import { useThemeColor } from './hooks/useThemeColor'

// ── Páginas públicas (eager — login precisa ser instant) ──────────────────────
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import BemVindo from './pages/BemVindo'

// ── Layouts (eager — shell precisa estar pronto) ──────────────────────────────
import ContratosLayout from './components/ContratosLayout'
import ControladoriaLayout from './components/ControladoriaLayout'
import ObrasLayout from './components/ObrasLayout'
import EGPLayout from './components/EGPLayout'
import CadastrosLayout from './components/CadastrosLayout'
import RHLayout from './components/RHLayout'
import FinanceiroLayout from './components/FinanceiroLayout'
import FiscalLayout from './components/FiscalLayout'
import EstoqueLayout from './components/EstoqueLayout'
import LogisticaLayout from './components/LogisticaLayout'
import FrotasLayout from './components/FrotasLayout'
import CulturaLayout from './components/CulturaLayout'
import HeadcountLayout from './components/HeadcountLayout'
import ApontamentosLayout from './components/ApontamentosLayout'

// ── Páginas lazy (code-split por rota) ────────────────────────────────────────
const ModuloSelector = lazy(() => import('./pages/ModuloSelector'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NovaRequisicao = lazy(() => import('./pages/NovaRequisicao'))
const ListaRequisicoes = lazy(() => import('./pages/ListaRequisicoes'))
const FilaCotacoes = lazy(() => import('./pages/FilaCotacoes'))
const CotacaoForm = lazy(() => import('./pages/CotacaoForm'))
const Aprovacao = lazy(() => import('./pages/Aprovacao'))
const AprovAi = lazy(() => import('./pages/AprovAi'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Pedidos = lazy(() => import('./pages/Pedidos'))
const RequisicaoDetalhe = lazy(() => import('./pages/RequisicaoDetalhe'))
const SSMA = lazy(() => import('./pages/SSMA'))

// Contratos
const DashboardContratos = lazy(() => import('./pages/contratos/DashboardContratos'))
const ListaContratos = lazy(() => import('./pages/contratos/ListaContratos'))
const NovoContrato = lazy(() => import('./pages/contratos/NovoContrato'))
const ParcelasContratos = lazy(() => import('./pages/contratos/Parcelas'))
const AditivosContratos = lazy(() => import('./pages/contratos/Aditivos'))
const ReajustesContratos = lazy(() => import('./pages/contratos/Reajustes'))
const SolicitacoesLista = lazy(() => import('./pages/contratos/SolicitacoesLista'))
const NovaSolicitacao = lazy(() => import('./pages/contratos/NovaSolicitacao'))
const SolicitacaoDetalhe = lazy(() => import('./pages/contratos/SolicitacaoDetalhe'))
const PreparaMinuta = lazy(() => import('./pages/contratos/PreparaMinuta'))
const ResumoExecutivoPage = lazy(() => import('./pages/contratos/ResumoExecutivo'))
const Assinaturas = lazy(() => import('./pages/contratos/Assinaturas'))
const GestaoContratos = lazy(() => import('./pages/contratos/GestaoContratos'))
const EquipePJ = lazy(() => import('./pages/contratos/EquipePJ'))
const ModelosContrato = lazy(() => import('./pages/contratos/ModelosContrato'))

// Controladoria
const ControladoriaHome = lazy(() => import('./pages/controladoria/ControladoriaHome'))
const Orcamentos = lazy(() => import('./pages/controladoria/Orcamentos'))
const DRE = lazy(() => import('./pages/controladoria/DRE'))
const KPIs = lazy(() => import('./pages/controladoria/KPIs'))
const Cenarios = lazy(() => import('./pages/controladoria/Cenarios'))
const PlanoOrcamentario = lazy(() => import('./pages/controladoria/PlanoOrcamentario'))
const ControleOrcamentario = lazy(() => import('./pages/controladoria/ControleOrcamentario'))
const PainelIndicadores = lazy(() => import('./pages/controladoria/PainelIndicadores'))
const AlertasDesvio = lazy(() => import('./pages/controladoria/AlertasDesvio'))

// Obras
const ObrasHome = lazy(() => import('./pages/obras/ObrasHome'))
const Apontamentos = lazy(() => import('./pages/obras/Apontamentos'))
const RDO = lazy(() => import('./pages/obras/RDO'))
const AdiantamentosObras = lazy(() => import('./pages/obras/Adiantamentos'))
const PrestacaoContas = lazy(() => import('./pages/obras/PrestacaoContas'))
const PlanejamentoEquipe = lazy(() => import('./pages/obras/PlanejamentoEquipe'))

// EGP
const EGPHome = lazy(() => import('./pages/pmo/PMOHome'))
const Portfolio = lazy(() => import('./pages/pmo/Portfolio'))
const PortfolioDetalhe = lazy(() => import('./pages/pmo/PortfolioDetalhe'))
const NovoPortfolio = lazy(() => import('./pages/pmo/NovoPortfolio'))
const EAP = lazy(() => import('./pages/pmo/EAP'))
const TapHub = lazy(() => import('./pages/pmo/TapHub'))
const TapPage = lazy(() => import('./pages/pmo/TapPage'))
const EAPHub = lazy(() => import('./pages/pmo/EAPHub'))
const CronogramaEGP = lazy(() => import('./pages/pmo/Cronograma'))
const CronogramaHub = lazy(() => import('./pages/pmo/CronogramaHub'))
const MedicoesEGP = lazy(() => import('./pages/pmo/Medicoes'))
const MedicoesHub = lazy(() => import('./pages/pmo/MedicoesHub'))
const HistogramaEGP = lazy(() => import('./pages/pmo/Histograma'))
const HistogramaHub = lazy(() => import('./pages/pmo/HistogramaHub'))
const ControleCustos = lazy(() => import('./pages/pmo/ControleCustos'))
const CustosHub = lazy(() => import('./pages/pmo/CustosHub'))
const FluxoOS = lazy(() => import('./pages/pmo/FluxoOS'))
const ReunioesEGP = lazy(() => import('./pages/pmo/Reunioes'))
const StatusReportList = lazy(() => import('./pages/pmo/StatusReportList'))

// Cadastros
const CadastrosHome = lazy(() => import('./pages/cadastros/CadastrosHome'))
const FornecedoresCad = lazy(() => import('./pages/cadastros/FornecedoresCad'))
const ItensCad = lazy(() => import('./pages/cadastros/ItensCad'))
const ClassesFinanceiras = lazy(() => import('./pages/cadastros/ClassesFinanceiras'))
const CentrosCusto = lazy(() => import('./pages/cadastros/CentrosCusto'))
const ObrasCad = lazy(() => import('./pages/cadastros/ObrasCad'))
const ColaboradoresCad = lazy(() => import('./pages/cadastros/ColaboradoresCad'))
const EmpresasCad = lazy(() => import('./pages/cadastros/EmpresasCad'))
const GruposFinanceiros = lazy(() => import('./pages/cadastros/GruposFinanceiros'))
const CategoriasFinanceiras = lazy(() => import('./pages/cadastros/CategoriasFinanceiras'))

// RH
const RHHome = lazy(() => import('./pages/rh/RHHome'))
const MuralAdmin = lazy(() => import('./pages/rh/MuralAdmin'))
const CulturaHome = lazy(() => import('./pages/rh/CulturaHome'))
const Endomarketing = lazy(() => import('./pages/rh/Endomarketing'))
const RHPainel = lazy(() => import('./pages/rh/RHPainel'))
const RHAdmissao = lazy(() => import('./pages/rh/RHAdmissao'))
const RHColaboradores = lazy(() => import('./pages/rh/RHColaboradores'))
const RHMovimentacoes = lazy(() => import('./pages/rh/RHMovimentacoes'))
const RHDesligamento = lazy(() => import('./pages/rh/RHDesligamento'))

// Financeiro
const DashboardFinanceiro = lazy(() => import('./pages/financeiro/DashboardFinanceiro'))
const CPPipeline = lazy(() => import('./pages/financeiro/CPPipeline'))
const ContasReceber = lazy(() => import('./pages/financeiro/ContasReceber'))
const LoteDetalhe = lazy(() => import('./pages/financeiro/LoteDetalhe'))
const Tesouraria = lazy(() => import('./pages/financeiro/Tesouraria'))
const Relatorios = lazy(() => import('./pages/financeiro/Relatorios'))
const Configuracoes = lazy(() => import('./pages/financeiro/Configuracoes'))

// Apontamentos
const ApontamentosHome = lazy(() => import('./pages/apontamentos/ApontamentosHome'))
const ApontamentosCartao = lazy(() => import('./pages/apontamentos/ApontamentosCartao'))

// Fiscal
const NotasFiscais = lazy(() => import('./pages/financeiro/NotasFiscais'))
const FiscalPipeline = lazy(() => import('./pages/fiscal/FiscalPipeline'))

// Estoque
const EstoqueHome = lazy(() => import('./pages/estoque/EstoqueHome'))
const Itens = lazy(() => import('./pages/estoque/Itens'))
const Movimentacoes = lazy(() => import('./pages/estoque/Movimentacoes'))
const Inventario = lazy(() => import('./pages/estoque/Inventario'))
const Patrimonial = lazy(() => import('./pages/estoque/Patrimonial'))
const SolicitacoesEstoque = lazy(() => import('./pages/estoque/Solicitacoes'))

// Logistica
const LogisticaHome = lazy(() => import('./pages/logistica/LogisticaHome'))
const SolicitacoesPipeline = lazy(() => import('./pages/logistica/SolicitacoesPipeline'))
const ExpedicaoPipeline = lazy(() => import('./pages/logistica/ExpedicaoPipeline'))
const TransportesPipeline = lazy(() => import('./pages/logistica/TransportesPipeline'))

// Frotas
const FrotasHome = lazy(() => import('./pages/frotas/FrotasHome'))
const Veiculos = lazy(() => import('./pages/frotas/Veiculos'))
const Ordens = lazy(() => import('./pages/frotas/Ordens'))
const Checklists = lazy(() => import('./pages/frotas/Checklists'))
const Abastecimentos = lazy(() => import('./pages/frotas/Abastecimentos'))
const Telemetria = lazy(() => import('./pages/frotas/Telemetria'))

// Admin
const AdminUsuarios = lazy(() => import('./pages/AdminUsuarios'))
const Desenvolvimento = lazy(() => import('./pages/Desenvolvimento'))

// SuperTEG AI Chat
const SuperTEGChat = lazy(() => import('./components/SuperTEGChat'))

// ── Suspense wrappers with contextual skeletons ─────────────────────────────
function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
}
function LazyDash({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
}
function LazyTable({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<TableSkeleton />}>{children}</Suspense>
}

// ── Theme color sync (must be inside ThemeProvider) ───────────────────────────
function ThemeSync() {
  useThemeColor()
  return null
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <ThemeSync />
      <OfflineBanner />
      <UpdateAvailable />
      <Routes>
        {/* ── Públicas ──────────────────────────────────────── */}
        <Route path="/login"      element={<Login />} />
        <Route path="/nova-senha" element={<ResetPassword />} />
        <Route path="/bem-vindo"  element={<BemVindo />} />

        {/* Aprovação por token: pública (aprovador externo) */}
        <Route path="/aprovacao/:token" element={<Lazy><Aprovacao /></Lazy>} />
        <Route path="/aprovaai"         element={<Lazy><AprovAi /></Lazy>} />

        {/* ── Privadas ──────────────────────────────────────── */}
        <Route element={<PrivateRoute />}>

          {/* Seletor de módulos: tela inicial (sem Layout) */}
          <Route path="/" element={<Lazy><ModuloSelector /></Lazy>} />

          {/* Global: Perfil */}
          <Route path="/perfil" element={<Lazy><Perfil /></Lazy>} />

          {/* Módulo Financeiro */}
          <Route element={<ModuleRoute moduleKey="financeiro" />}>
            <Route element={<FinanceiroLayout />}>
              <Route path="/financeiro"              element={<LazyDash><DashboardFinanceiro /></LazyDash>} />
              <Route path="/financeiro/contas-a-pagar" element={<LazyTable><CPPipeline /></LazyTable>} />
              <Route path="/financeiro/cp"           element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/cr"           element={<Lazy><ContasReceber /></Lazy>} />
              <Route path="/financeiro/aprovacoes"   element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/lotes"              element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/lotes/:loteId"      element={<Lazy><LoteDetalhe /></Lazy>} />
              <Route path="/financeiro/painel-pagamentos"  element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/conciliacao"  element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/tesouraria"    element={<Lazy><Tesouraria /></Lazy>} />
              <Route path="/financeiro/relatorios"   element={<Lazy><Relatorios /></Lazy>} />
              <Route path="/financeiro/configuracoes" element={<Navigate to="/admin/integracoes" replace />} />
            </Route>
          </Route>

          {/* Módulo Apontamentos */}
          <Route element={<ModuleRoute moduleKey="apontamentos" />}>
            <Route element={<ApontamentosLayout />}>
              <Route path="/apontamentos" element={<Lazy><ApontamentosHome /></Lazy>} />
              <Route path="/apontamentos/novo" element={<Navigate to="/apontamentos/realizados" replace />} />
              <Route path="/apontamentos/realizados" element={<Lazy><ApontamentosCartao /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Fiscal */}
          <Route element={<ModuleRoute moduleKey="fiscal" />}>
            <Route element={<FiscalLayout />}>
              <Route path="/fiscal"              element={<Lazy><NotasFiscais /></Lazy>} />
              <Route path="/fiscal/pipeline"     element={<Lazy><FiscalPipeline /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Estoque */}
          <Route element={<ModuleRoute moduleKey="estoque" />}>
            <Route element={<EstoqueLayout />}>
              <Route path="/estoque"               element={<LazyDash><EstoqueHome /></LazyDash>} />
              <Route path="/estoque/itens"         element={<Lazy><Itens /></Lazy>} />
              <Route path="/estoque/movimentacoes" element={<Lazy><Movimentacoes /></Lazy>} />
              <Route path="/estoque/inventario"    element={<Lazy><Inventario /></Lazy>} />
              <Route path="/estoque/patrimonial"   element={<Lazy><Patrimonial /></Lazy>} />
              <Route path="/estoque/solicitacoes" element={<Lazy><SolicitacoesEstoque /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Logística */}
          <Route element={<ModuleRoute moduleKey="logistica" />}>
            <Route element={<LogisticaLayout />}>
              <Route path="/logistica"                   element={<LazyDash><LogisticaHome /></LazyDash>} />
              <Route path="/logistica/solicitacoes"      element={<Lazy><SolicitacoesPipeline /></Lazy>} />
              <Route path="/logistica/expedicao"         element={<Lazy><ExpedicaoPipeline /></Lazy>} />
              <Route path="/logistica/transportes"       element={<Lazy><TransportesPipeline /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Frotas */}
          <Route element={<ModuleRoute moduleKey="frotas" />}>
            <Route element={<FrotasLayout />}>
              <Route path="/frotas"                      element={<LazyDash><FrotasHome /></LazyDash>} />
              <Route path="/frotas/veiculos"             element={<Lazy><Veiculos /></Lazy>} />
              <Route path="/frotas/ordens"               element={<Lazy><Ordens /></Lazy>} />
              <Route path="/frotas/checklists"           element={<Lazy><Checklists /></Lazy>} />
              <Route path="/frotas/abastecimentos"       element={<Lazy><Abastecimentos /></Lazy>} />
              <Route path="/frotas/telemetria"           element={<Lazy><Telemetria /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo RH */}
          <Route element={<ModuleRoute moduleKey="rh" />}>
            <Route element={<RHLayout />}>
              <Route path="/rh"        element={<LazyDash><RHHome /></LazyDash>} />
              <Route path="/rh/mural"  element={<Lazy><MuralAdmin /></Lazy>} />
            </Route>
            <Route element={<CulturaLayout />}>
              <Route path="/rh/cultura"                element={<LazyDash><CulturaHome /></LazyDash>} />
              <Route path="/rh/cultura/mural"          element={<Lazy><MuralAdmin /></Lazy>} />
              <Route path="/rh/cultura/endomarketing"  element={<Lazy><Endomarketing /></Lazy>} />
            </Route>
            <Route element={<HeadcountLayout />}>
              <Route path="/rh/headcount"               element={<LazyDash><RHPainel /></LazyDash>} />
              <Route path="/rh/headcount/admissao"      element={<Lazy><RHAdmissao /></Lazy>} />
              <Route path="/rh/headcount/colaboradores" element={<Lazy><RHColaboradores /></Lazy>} />
              <Route path="/rh/headcount/movimentacoes" element={<Lazy><RHMovimentacoes /></Lazy>} />
              <Route path="/rh/headcount/desligamento"  element={<Lazy><RHDesligamento /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Contratos */}
          <Route element={<ModuleRoute moduleKey="contratos" />}>
            <Route element={<ContratosLayout />}>
              <Route path="/contratos"            element={<LazyDash><DashboardContratos /></LazyDash>} />
              <Route path="/contratos/lista"      element={<Lazy><ListaContratos /></Lazy>} />
              <Route path="/contratos/novo"       element={<Lazy><NovoContrato /></Lazy>} />
              <Route path="/contratos/previsao"   element={<Lazy><ParcelasContratos /></Lazy>} />
              <Route path="/contratos/aditivos"   element={<Lazy><AditivosContratos /></Lazy>} />
              <Route path="/contratos/reajustes"  element={<Lazy><ReajustesContratos /></Lazy>} />
              <Route path="/contratos/solicitacoes"       element={<Lazy><SolicitacoesLista /></Lazy>} />
              <Route path="/contratos/solicitacoes/nova"  element={<Lazy><NovaSolicitacao /></Lazy>} />
              <Route path="/contratos/solicitacoes/:id"   element={<Lazy><SolicitacaoDetalhe /></Lazy>} />
              <Route path="/contratos/solicitacoes/:id/minuta" element={<Lazy><PreparaMinuta /></Lazy>} />
              <Route path="/contratos/solicitacoes/:id/resumo" element={<Lazy><ResumoExecutivoPage /></Lazy>} />
              <Route path="/contratos/assinaturas"  element={<Lazy><Assinaturas /></Lazy>} />
              <Route path="/contratos/gestao"       element={<Lazy><GestaoContratos /></Lazy>} />
              <Route path="/contratos/equipe-pj"    element={<Lazy><EquipePJ /></Lazy>} />
              <Route path="/contratos/modelos"      element={<Lazy><ModelosContrato /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Controladoria */}
          <Route element={<ModuleRoute moduleKey="controladoria" />}>
            <Route element={<ControladoriaLayout />}>
              <Route path="/controladoria"              element={<LazyDash><ControladoriaHome /></LazyDash>} />
              <Route path="/controladoria/orcamentos"   element={<Lazy><Orcamentos /></Lazy>} />
              <Route path="/controladoria/dre"          element={<Lazy><DRE /></Lazy>} />
              <Route path="/controladoria/kpis"         element={<Lazy><KPIs /></Lazy>} />
              <Route path="/controladoria/cenarios"     element={<Lazy><Cenarios /></Lazy>} />
              <Route path="/controladoria/plano-orcamentario" element={<Lazy><PlanoOrcamentario /></Lazy>} />
              <Route path="/controladoria/controle-orcamentario" element={<Lazy><ControleOrcamentario /></Lazy>} />
              <Route path="/controladoria/indicadores" element={<Lazy><PainelIndicadores /></Lazy>} />
              <Route path="/controladoria/alertas"     element={<Lazy><AlertasDesvio /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Obras */}
          <Route element={<ModuleRoute moduleKey="obras" />}>
            <Route element={<ObrasLayout />}>
              <Route path="/obras"                    element={<LazyDash><ObrasHome /></LazyDash>} />
              <Route path="/obras/apontamentos"       element={<Lazy><Apontamentos /></Lazy>} />
              <Route path="/obras/rdo"                element={<Lazy><RDO /></Lazy>} />
              <Route path="/obras/adiantamentos"      element={<Lazy><AdiantamentosObras /></Lazy>} />
              <Route path="/obras/prestacao"          element={<Lazy><PrestacaoContas /></Lazy>} />
              <Route path="/obras/equipe"            element={<Lazy><PlanejamentoEquipe /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo EGP */}
          <Route element={<ModuleRoute moduleKey="egp" />}>
            <Route element={<EGPLayout />}>
              <Route path="/egp"                              element={<LazyDash><EGPHome /></LazyDash>} />
              <Route path="/egp/portfolio"                    element={<Lazy><Portfolio /></Lazy>} />
              <Route path="/egp/portfolio/novo"               element={<Lazy><NovoPortfolio /></Lazy>} />
              <Route path="/egp/portfolio/:id"                element={<Lazy><PortfolioDetalhe /></Lazy>} />
              <Route path="/egp/tap"                          element={<Lazy><TapHub /></Lazy>} />
              <Route path="/egp/tap/:portfolioId"              element={<Lazy><TapPage /></Lazy>} />
              <Route path="/egp/eap"                          element={<Lazy><EAPHub /></Lazy>} />
              <Route path="/egp/eap/:portfolioId"             element={<Lazy><EAP /></Lazy>} />
              <Route path="/egp/cronograma"                   element={<Lazy><CronogramaHub /></Lazy>} />
              <Route path="/egp/cronograma/:portfolioId"      element={<Lazy><CronogramaEGP /></Lazy>} />
              <Route path="/egp/medicoes"                     element={<Lazy><MedicoesHub /></Lazy>} />
              <Route path="/egp/medicoes/:portfolioId"        element={<Lazy><MedicoesEGP /></Lazy>} />
              <Route path="/egp/histograma"                   element={<Lazy><HistogramaHub /></Lazy>} />
              <Route path="/egp/histograma/:portfolioId"      element={<Lazy><HistogramaEGP /></Lazy>} />
              <Route path="/egp/custos"                       element={<Lazy><CustosHub /></Lazy>} />
              <Route path="/egp/custos/:portfolioId"          element={<Lazy><ControleCustos /></Lazy>} />
              <Route path="/egp/fluxo-os"                     element={<Lazy><FluxoOS /></Lazy>} />
              <Route path="/egp/reunioes"                     element={<Lazy><ReunioesEGP /></Lazy>} />
              <Route path="/egp/indicadores"                  element={<Lazy><StatusReportList /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Cadastros */}
          <Route element={<ModuleRoute moduleKey="cadastros" />}>
            <Route element={<CadastrosLayout />}>
              <Route path="/cadastros"                element={<LazyDash><CadastrosHome /></LazyDash>} />
              <Route path="/cadastros/fornecedores"   element={<Lazy><FornecedoresCad /></Lazy>} />
              <Route path="/cadastros/itens"          element={<Lazy><ItensCad /></Lazy>} />
              <Route path="/cadastros/classes"        element={<Lazy><ClassesFinanceiras /></Lazy>} />
              <Route path="/cadastros/centros-custo"  element={<Lazy><CentrosCusto /></Lazy>} />
              <Route path="/cadastros/obras"          element={<Lazy><ObrasCad /></Lazy>} />
              <Route path="/cadastros/colaboradores"  element={<Lazy><ColaboradoresCad /></Lazy>} />
              <Route path="/cadastros/empresas"       element={<Lazy><EmpresasCad /></Lazy>} />
              <Route path="/cadastros/grupos"          element={<Lazy><GruposFinanceiros /></Lazy>} />
              <Route path="/cadastros/categorias"      element={<Lazy><CategoriasFinanceiras /></Lazy>} />
            </Route>
          </Route>

          {/* Módulos stub */}
          <Route path="/ssma"       element={<Lazy><SSMA /></Lazy>} />

          {/* Módulo Compras */}
          <Route element={<ModuleRoute moduleKey="compras" />}>
            <Route element={<Layout />}>
              <Route path="/compras"     element={<LazyDash><Dashboard /></LazyDash>} />
              <Route path="/nova"        element={<Lazy><NovaRequisicao /></Lazy>} />
              <Route path="/requisicoes" element={<Lazy><ListaRequisicoes /></Lazy>} />
              <Route path="/requisicoes/:id" element={<Lazy><RequisicaoDetalhe /></Lazy>} />
              <Route path="/cotacoes"    element={<Lazy><FilaCotacoes /></Lazy>} />
              <Route path="/cotacoes/:id" element={<Lazy><CotacaoForm /></Lazy>} />
              <Route path="/pedidos"     element={<Lazy><Pedidos /></Lazy>} />
            </Route>
          </Route>
        </Route>

        {/* ── Admin ─────────────────────────────────────────── */}
        <Route element={<AdminRoute />}>
          <Route element={<Layout />}>
            <Route path="/admin/usuarios" element={<Lazy><AdminUsuarios /></Lazy>} />
            <Route path="/admin/integracoes" element={<Lazy><Configuracoes /></Lazy>} />
            <Route path="/admin/desenvolvimento" element={<Lazy><Desenvolvimento /></Lazy>} />
          </Route>
        </Route>
      </Routes>
      <PWAInstallPrompt />
      <Suspense fallback={null}><SuperTEGChat /></Suspense>
    </AuthProvider>
    </ThemeProvider>
  )
}
