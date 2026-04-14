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
import PatrimonialLayout from './components/PatrimonialLayout'
import LocacaoLayout from './components/LocacaoLayout'

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
const MinhasSolicitacoes = lazy(() => import('./pages/MinhasSolicitacoes'))
const MinhasCautelas = lazy(() => import('./pages/MinhasCautelas'))
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
const ContratoDetalhe = lazy(() => import('./pages/contratos/ContratoDetalhe'))
const EquipePJ = lazy(() => import('./pages/contratos/EquipePJ'))
const ModelosContrato = lazy(() => import('./pages/contratos/ModelosContrato'))

// Controladoria
const ControladoriaHome = lazy(() => import('./pages/controladoria/ControladoriaHome'))
const ControleOrcamentarioHub = lazy(() => import('./pages/controladoria/ControleOrcamentarioHub'))
const ControleCustosHub = lazy(() => import('./pages/controladoria/ControleCustosHub'))
const ControleProjetosHub = lazy(() => import('./pages/controladoria/ControleProjetosHub'))
const CenariosHub = lazy(() => import('./pages/controladoria/CenariosHub'))

// Obras
const ObrasHome = lazy(() => import('./pages/obras/ObrasHome'))
const Apontamentos = lazy(() => import('./pages/obras/Apontamentos'))
const RDO = lazy(() => import('./pages/obras/RDO'))
const AdiantamentosObras = lazy(() => import('./pages/obras/Adiantamentos'))
const PrestacaoContas = lazy(() => import('./pages/obras/PrestacaoContas'))
const PlanejamentoEquipe = lazy(() => import('./pages/obras/PlanejamentoEquipe'))

// EGP — Ciclo de Vida (seletor de contrato persistente)
const EGPPainel = lazy(() => import('./pages/pmo/EGPPainel'))
const EGPIniciacao = lazy(() => import('./pages/pmo/EGPIniciacao'))
const EGPPlanejamento = lazy(() => import('./pages/pmo/EGPPlanejamento'))
const EGPExecucao = lazy(() => import('./pages/pmo/EGPExecucao'))
const EGPControle = lazy(() => import('./pages/pmo/EGPControle'))
const EGPEncerramento = lazy(() => import('./pages/pmo/EGPEncerramento'))
const Portfolio = lazy(() => import('./pages/pmo/Portfolio'))
const PortfolioDetalhe = lazy(() => import('./pages/pmo/PortfolioDetalhe'))
const NovoPortfolio = lazy(() => import('./pages/pmo/NovoPortfolio'))

// Cadastros
const CadastrosHome = lazy(() => import('./pages/cadastros/CadastrosHome'))
const FornecedoresCad = lazy(() => import('./pages/cadastros/FornecedoresCad'))
const ItensCad = lazy(() => import('./pages/cadastros/ItensCad'))
const ClassesFinanceiras = lazy(() => import('./pages/cadastros/ClassesFinanceiras'))
const CentrosCusto = lazy(() => import('./pages/cadastros/CentrosCusto'))
const ObrasCad = lazy(() => import('./pages/cadastros/ObrasCad'))
const ProjetosCad = lazy(() => import('./pages/cadastros/ProjetosCad'))
const ColaboradoresCad = lazy(() => import('./pages/cadastros/ColaboradoresCad'))
const EmpresasCad = lazy(() => import('./pages/cadastros/EmpresasCad'))
const GruposFinanceiros = lazy(() => import('./pages/cadastros/GruposFinanceiros'))
const CategoriasFinanceiras = lazy(() => import('./pages/cadastros/CategoriasFinanceiras'))
const Bases = lazy(() => import('./pages/cadastros/Bases'))

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

// Despesas
const DespesasHome = lazy(() => import('./pages/despesas/DespesasHome'))
const ApontamentosCartao = lazy(() => import('./pages/apontamentos/ApontamentosCartao'))
const DespesasAdiantamentos = lazy(() => import('./pages/despesas/DespesasAdiantamentos'))

// Fiscal
const FiscalHome = lazy(() => import('./pages/fiscal/FiscalHome'))
const NotasFiscais = lazy(() => import('./pages/financeiro/NotasFiscais'))
const FiscalPipeline = lazy(() => import('./pages/fiscal/FiscalPipeline'))

// Estoque
const EstoqueHome = lazy(() => import('./pages/estoque/EstoqueHome'))
const Itens = lazy(() => import('./pages/estoque/Itens'))
const Movimentacoes = lazy(() => import('./pages/estoque/Movimentacoes'))
const Inventario = lazy(() => import('./pages/estoque/Inventario'))
const Patrimonial = lazy(() => import('./pages/estoque/Patrimonial'))
const SolicitacoesEstoque = lazy(() => import('./pages/estoque/Solicitacoes'))
const CautelaHome = lazy(() => import('./pages/estoque/CautelaHome'))
const NovaCautela = lazy(() => import('./pages/estoque/NovaCautela'))

// Logistica
const LogisticaHome = lazy(() => import('./pages/logistica/LogisticaHome'))
const SolicitacoesPipeline = lazy(() => import('./pages/logistica/SolicitacoesPipeline'))
const ExpedicaoPipeline = lazy(() => import('./pages/logistica/ExpedicaoPipeline'))
const TransportesPipeline = lazy(() => import('./pages/logistica/TransportesPipeline'))
const TelemetriaLogistica = lazy(() => import('./pages/logistica/TelemetriaLogistica'))

// Frotas
const FrotasHome = lazy(() => import('./pages/frotas/FrotasHome'))
const SolicitacoesFrotas = lazy(() => import('./pages/frotas/SolicitacoesFrotas'))
const FrotaHub = lazy(() => import('./pages/frotas/frota/FrotaHub'))
const ManutencaoHub = lazy(() => import('./pages/frotas/manutencao/ManutencaoHub'))
const OperacaoHub = lazy(() => import('./pages/frotas/operacao/OperacaoHub'))

// Locacao
const LocacaoHome = lazy(() => import('./pages/locacao/LocacaoHome'))
const EntradasPipeline = lazy(() => import('./pages/locacao/EntradasPipeline'))
const SaidaPipeline = lazy(() => import('./pages/locacao/SaidaPipeline'))
const LocGestao = lazy(() => import('./pages/locacao/Gestao'))

// Patrimonial (módulo próprio)
const PatrimonialHome = lazy(() => import('./pages/patrimonial/PatrimonialHome'))
const PatrimonialMovimentacoes = lazy(() => import('./pages/patrimonial/Movimentacoes'))
const PatrimonialPatrimonio = lazy(() => import('./pages/patrimonial/Patrimonio'))

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
          <Route path="/minhas-solicitacoes" element={<Lazy><MinhasSolicitacoes /></Lazy>} />
          <Route path="/minhas-cautelas" element={<Lazy><MinhasCautelas /></Lazy>} />

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
              <Route path="/despesas" element={<Lazy><DespesasHome /></Lazy>} />
              <Route path="/despesas/cartoes" element={<Lazy><ApontamentosCartao /></Lazy>} />
              <Route path="/despesas/adiantamentos" element={<Lazy><DespesasAdiantamentos /></Lazy>} />
              <Route path="/apontamentos" element={<Navigate to="/despesas" replace />} />
              <Route path="/apontamentos/novo" element={<Navigate to="/despesas/cartoes?nova=1" replace />} />
              <Route path="/apontamentos/realizados" element={<Navigate to="/despesas/cartoes" replace />} />
            </Route>
          </Route>

          {/* Módulo Fiscal */}
          <Route element={<ModuleRoute moduleKey="fiscal" />}>
            <Route element={<FiscalLayout />}>
              <Route path="/fiscal"              element={<LazyDash><FiscalHome /></LazyDash>} />
              <Route path="/fiscal/notas"        element={<Lazy><NotasFiscais /></Lazy>} />
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
              <Route path="/estoque/cautelas" element={<Lazy><CautelaHome /></Lazy>} />
              <Route path="/estoque/cautelas/nova" element={<Lazy><NovaCautela /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Logística */}
          <Route element={<ModuleRoute moduleKey="logistica" />}>
            <Route element={<LogisticaLayout />}>
              <Route path="/logistica"                   element={<LazyDash><LogisticaHome /></LazyDash>} />
              <Route path="/logistica/solicitacoes"      element={<Lazy><SolicitacoesPipeline /></Lazy>} />
              <Route path="/logistica/expedicao"         element={<Lazy><ExpedicaoPipeline /></Lazy>} />
              <Route path="/logistica/transportes"       element={<Lazy><TransportesPipeline /></Lazy>} />
              <Route path="/logistica/telemetria"        element={<Lazy><TelemetriaLogistica /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Frotas */}
          <Route element={<ModuleRoute moduleKey="frotas" />}>
            <Route element={<FrotasLayout />}>
              <Route path="/frotas"                element={<LazyDash><FrotasHome /></LazyDash>} />
              <Route path="/frotas/solicitacoes"  element={<Lazy><SolicitacoesFrotas /></Lazy>} />
              <Route path="/frotas/frota"         element={<Lazy><FrotaHub /></Lazy>} />
              <Route path="/frotas/manutencao"    element={<Lazy><ManutencaoHub /></Lazy>} />
              <Route path="/frotas/operacao"      element={<Lazy><OperacaoHub /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Locação de Imóveis */}
          <Route element={<ModuleRoute moduleKey="locacoes" />}>
            <Route element={<LocacaoLayout />}>
              <Route path="/locacoes"          element={<LazyDash><LocacaoHome /></LazyDash>} />
              <Route path="/locacoes/entradas" element={<Lazy><EntradasPipeline /></Lazy>} />
              <Route path="/locacoes/gestao"   element={<Lazy><LocGestao /></Lazy>} />
              <Route path="/locacoes/saida"    element={<Lazy><SaidaPipeline /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Patrimonial */}
          <Route element={<ModuleRoute moduleKey="patrimonial" />}>
            <Route element={<PatrimonialLayout />}>
              <Route path="/patrimonial"               element={<LazyDash><PatrimonialHome /></LazyDash>} />
              <Route path="/patrimonial/movimentacoes" element={<Lazy><PatrimonialMovimentacoes /></Lazy>} />
              <Route path="/patrimonial/patrimonio"    element={<Lazy><PatrimonialPatrimonio /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo RH */}
          <Route element={<ModuleRoute moduleKey="rh" />}>
            <Route element={<RHLayout />}>
              <Route path="/rh"        element={<Navigate to="/rh/headcount" replace />} />
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
              <Route path="/contratos/gestao"           element={<Lazy><GestaoContratos /></Lazy>} />
              <Route path="/contratos/detalhe/:id"    element={<Lazy><ContratoDetalhe /></Lazy>} />
              <Route path="/contratos/equipe-pj"      element={<Lazy><EquipePJ /></Lazy>} />
              <Route path="/contratos/modelos"      element={<Lazy><ModelosContrato /></Lazy>} />
            </Route>
          </Route>

          {/* Módulo Controladoria */}
          <Route element={<ModuleRoute moduleKey="controladoria" />}>
            <Route element={<ControladoriaLayout />}>
              <Route path="/controladoria"                          element={<LazyDash><ControladoriaHome /></LazyDash>} />
              <Route path="/controladoria/controle-orcamentario" element={<Lazy><ControleOrcamentarioHub /></Lazy>} />
              <Route path="/controladoria/controle-custos"        element={<Lazy><ControleCustosHub /></Lazy>} />
              <Route path="/controladoria/controle-projetos"      element={<Lazy><ControleProjetosHub /></Lazy>} />
              <Route path="/controladoria/cenarios"               element={<Lazy><CenariosHub /></Lazy>} />
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

          {/* Módulo EGP — Ciclo de Vida */}
          <Route element={<ModuleRoute moduleKey="egp" />}>
            <Route element={<EGPLayout />}>
              {/* Painel */}
              <Route path="/egp"                                  element={<LazyDash><EGPPainel /></LazyDash>} />
              {/* Ciclo de Vida — carregam contrato do seletor persistente */}
              <Route path="/egp/iniciacao"                        element={<Lazy><EGPIniciacao /></Lazy>} />
              <Route path="/egp/iniciacao/:portfolioId"           element={<Lazy><EGPIniciacao /></Lazy>} />
              <Route path="/egp/planejamento"                     element={<Lazy><EGPPlanejamento /></Lazy>} />
              <Route path="/egp/planejamento/:portfolioId"        element={<Lazy><EGPPlanejamento /></Lazy>} />
              <Route path="/egp/execucao"                         element={<Lazy><EGPExecucao /></Lazy>} />
              <Route path="/egp/execucao/:portfolioId"            element={<Lazy><EGPExecucao /></Lazy>} />
              <Route path="/egp/controle"                         element={<Lazy><EGPControle /></Lazy>} />
              <Route path="/egp/controle/:portfolioId"            element={<Lazy><EGPControle /></Lazy>} />
              <Route path="/egp/encerramento"                     element={<Lazy><EGPEncerramento /></Lazy>} />
              <Route path="/egp/encerramento/:portfolioId"        element={<Lazy><EGPEncerramento /></Lazy>} />
              {/* Portfólio (mantido para acesso direto) */}
              <Route path="/egp/portfolio"                        element={<Lazy><Portfolio /></Lazy>} />
              <Route path="/egp/portfolio/novo"                   element={<Lazy><NovoPortfolio /></Lazy>} />
              <Route path="/egp/portfolio/:id"                    element={<Lazy><PortfolioDetalhe /></Lazy>} />
              {/* Legacy redirects — rotas antigas → novas visões */}
              <Route path="/egp/tap"                              element={<Navigate to="/egp/iniciacao" replace />} />
              <Route path="/egp/tap/:portfolioId"                 element={<Navigate to="/egp/iniciacao" replace />} />
              <Route path="/egp/eap"                              element={<Navigate to="/egp/planejamento" replace />} />
              <Route path="/egp/eap/:portfolioId"                 element={<Navigate to="/egp/planejamento" replace />} />
              <Route path="/egp/cronograma"                       element={<Navigate to="/egp/execucao" replace />} />
              <Route path="/egp/cronograma/:portfolioId"          element={<Navigate to="/egp/execucao" replace />} />
              <Route path="/egp/medicoes"                         element={<Navigate to="/egp/controle" replace />} />
              <Route path="/egp/medicoes/:portfolioId"            element={<Navigate to="/egp/controle" replace />} />
              <Route path="/egp/histograma"                       element={<Navigate to="/egp/execucao" replace />} />
              <Route path="/egp/histograma/:portfolioId"          element={<Navigate to="/egp/execucao" replace />} />
              <Route path="/egp/custos"                           element={<Navigate to="/egp/execucao" replace />} />
              <Route path="/egp/custos/:portfolioId"              element={<Navigate to="/egp/execucao" replace />} />
              <Route path="/egp/fluxo-os"                         element={<Navigate to="/egp/execucao" replace />} />
              <Route path="/egp/reunioes"                         element={<Navigate to="/egp/controle" replace />} />
              <Route path="/egp/indicadores"                      element={<Navigate to="/egp/controle" replace />} />
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
              <Route path="/cadastros/projetos"      element={<Lazy><ProjetosCad /></Lazy>} />
              <Route path="/cadastros/colaboradores"  element={<Lazy><ColaboradoresCad /></Lazy>} />
              <Route path="/cadastros/empresas"       element={<Lazy><EmpresasCad /></Lazy>} />
              <Route path="/cadastros/grupos"          element={<Lazy><GruposFinanceiros /></Lazy>} />
              <Route path="/cadastros/categorias"      element={<Lazy><CategoriasFinanceiras /></Lazy>} />
              <Route path="/cadastros/bases"           element={<Lazy><Bases /></Lazy>} />
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
