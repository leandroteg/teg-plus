import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PrivateRoute, AdminRoute } from './components/PrivateRoute'
import ModuleRoute from './components/ModuleRoute'
import Layout from './components/Layout'

// Páginas públicas
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import BemVindo from './pages/BemVindo'

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
import AditivosContratos from './pages/contratos/Aditivos'
import ReajustesContratos from './pages/contratos/Reajustes'
import SolicitacoesLista from './pages/contratos/SolicitacoesLista'
import NovaSolicitacao from './pages/contratos/NovaSolicitacao'
import SolicitacaoDetalhe from './pages/contratos/SolicitacaoDetalhe'
import PreparaMinuta from './pages/contratos/PreparaMinuta'
import ResumoExecutivoPage from './pages/contratos/ResumoExecutivo'
import Assinaturas from './pages/contratos/Assinaturas'
import GestaoContratos from './pages/contratos/GestaoContratos'
import EquipePJ from './pages/contratos/EquipePJ'
import ModelosContrato from './pages/contratos/ModelosContrato'

// Módulo Controladoria
import ControladoriaLayout from './components/ControladoriaLayout'
import ControladoriaHome from './pages/controladoria/ControladoriaHome'
import Orcamentos from './pages/controladoria/Orcamentos'
import DRE from './pages/controladoria/DRE'
import KPIs from './pages/controladoria/KPIs'
import Cenarios from './pages/controladoria/Cenarios'
import PlanoOrcamentario from './pages/controladoria/PlanoOrcamentario'
import ControleOrcamentario from './pages/controladoria/ControleOrcamentario'
import PainelIndicadores from './pages/controladoria/PainelIndicadores'
import AlertasDesvio from './pages/controladoria/AlertasDesvio'

// Módulo Obras
import ObrasLayout from './components/ObrasLayout'
import ObrasHome from './pages/obras/ObrasHome'
import Apontamentos from './pages/obras/Apontamentos'
import RDO from './pages/obras/RDO'
import AdiantamentosObras from './pages/obras/Adiantamentos'
import PrestacaoContas from './pages/obras/PrestacaoContas'
import PlanejamentoEquipe from './pages/obras/PlanejamentoEquipe'

// Módulo EGP (Escritório de Gestão de Projetos)
import EGPLayout from './components/EGPLayout'
import EGPHome from './pages/pmo/PMOHome'
import Portfolio from './pages/pmo/Portfolio'
import PortfolioDetalhe from './pages/pmo/PortfolioDetalhe'
import NovoPortfolio from './pages/pmo/NovoPortfolio'
import EAP from './pages/pmo/EAP'
import TapHub from './pages/pmo/TapHub'
import TapPage from './pages/pmo/TapPage'
import EAPHub from './pages/pmo/EAPHub'
import CronogramaEGP from './pages/pmo/Cronograma'
import CronogramaHub from './pages/pmo/CronogramaHub'
import MedicoesEGP from './pages/pmo/Medicoes'
import MedicoesHub from './pages/pmo/MedicoesHub'
import HistogramaEGP from './pages/pmo/Histograma'
import HistogramaHub from './pages/pmo/HistogramaHub'
import ControleCustos from './pages/pmo/ControleCustos'
import CustosHub from './pages/pmo/CustosHub'
import FluxoOS from './pages/pmo/FluxoOS'
import ReunioesEGP from './pages/pmo/Reunioes'
import StatusReportList from './pages/pmo/StatusReportList'

// Módulo Cadastros (Configurações Gerais)
import CadastrosLayout from './components/CadastrosLayout'
import CadastrosHome from './pages/cadastros/CadastrosHome'
import FornecedoresCad from './pages/cadastros/FornecedoresCad'
import ItensCad from './pages/cadastros/ItensCad'
import ClassesFinanceiras from './pages/cadastros/ClassesFinanceiras'
import CentrosCusto from './pages/cadastros/CentrosCusto'
import ObrasCad from './pages/cadastros/ObrasCad'
import ColaboradoresCad from './pages/cadastros/ColaboradoresCad'
import EmpresasCad from './pages/cadastros/EmpresasCad'
import GruposFinanceiros from './pages/cadastros/GruposFinanceiros'
import CategoriasFinanceiras from './pages/cadastros/CategoriasFinanceiras'

// Módulo RH
import RHLayout from './components/RHLayout'
import RHHome from './pages/rh/RHHome'
import MuralAdmin from './pages/rh/MuralAdmin'

// Módulo Financeiro
import FinanceiroLayout from './components/FinanceiroLayout'
import DashboardFinanceiro from './pages/financeiro/DashboardFinanceiro'
import ContasPagar from './pages/financeiro/ContasPagar'
import CPPipeline from './pages/financeiro/CPPipeline'
import ContasReceber from './pages/financeiro/ContasReceber'
import AprovacoesPagamento from './pages/financeiro/AprovacoesPagamento'
import Conciliacao from './pages/financeiro/Conciliacao'
import LotesPagamento from './pages/financeiro/LotesPagamento'
import LoteDetalhe from './pages/financeiro/LoteDetalhe'
import PainelPagamentos from './pages/financeiro/PainelPagamentos'
import Relatorios from './pages/financeiro/Relatorios'
import Tesouraria from './pages/financeiro/Tesouraria'
import Configuracoes from './pages/financeiro/Configuracoes'

// Módulo Fiscal
import FiscalLayout from './components/FiscalLayout'
import NotasFiscais from './pages/financeiro/NotasFiscais'
import FiscalPipeline from './pages/fiscal/FiscalPipeline'

// SuperTEG AI Chat
import SuperTEGChat from './components/SuperTEGChat'

// Módulo Estoque
import EstoqueLayout from './components/EstoqueLayout'
import EstoqueHome from './pages/estoque/EstoqueHome'
import Itens from './pages/estoque/Itens'
import Movimentacoes from './pages/estoque/Movimentacoes'
import Inventario from './pages/estoque/Inventario'
import Patrimonial from './pages/estoque/Patrimonial'
import SolicitacoesEstoque from './pages/estoque/Solicitacoes'

// Módulo Logística
import LogisticaLayout from './components/LogisticaLayout'
import LogisticaHome from './pages/logistica/LogisticaHome'
import SolicitacoesPipeline from './pages/logistica/SolicitacoesPipeline'
import ExpedicaoPipeline from './pages/logistica/ExpedicaoPipeline'
import TransportesPipeline from './pages/logistica/TransportesPipeline'
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
import Desenvolvimento from './pages/Desenvolvimento'

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Routes>
        {/* ── Públicas ──────────────────────────────────────── */}
        <Route path="/login"      element={<Login />} />
        <Route path="/nova-senha" element={<ResetPassword />} />
        <Route path="/bem-vindo"  element={<BemVindo />} />

        {/* Aprovação por token: pública (aprovador externo) */}
        <Route path="/aprovacao/:token" element={<Aprovacao />} />
        <Route path="/aprovaai"         element={<AprovAi />} />

        {/* ── Privadas ──────────────────────────────────────── */}
        <Route element={<PrivateRoute />}>

          {/* Seletor de módulos: tela inicial (sem Layout) */}
          <Route path="/" element={<ModuloSelector />} />

          {/* Global: Perfil (accessible from avatar dropdown in any module) */}
          <Route path="/perfil" element={<Perfil />} />

          {/* Módulo Financeiro */}
          <Route element={<ModuleRoute moduleKey="financeiro" />}>
            <Route element={<FinanceiroLayout />}>
              <Route path="/financeiro"              element={<DashboardFinanceiro />} />
              <Route path="/financeiro/contas-a-pagar" element={<CPPipeline />} />
              <Route path="/financeiro/cp"           element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/cr"           element={<ContasReceber />} />
              <Route path="/financeiro/aprovacoes"   element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/lotes"              element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/lotes/:loteId"      element={<LoteDetalhe />} />
              <Route path="/financeiro/painel-pagamentos"  element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/conciliacao"  element={<Navigate to="/financeiro/contas-a-pagar" replace />} />
              <Route path="/financeiro/tesouraria"    element={<Tesouraria />} />
              <Route path="/financeiro/relatorios"   element={<Relatorios />} />
              <Route path="/financeiro/configuracoes" element={<Navigate to="/admin/integracoes" replace />} />
            </Route>
          </Route>

          {/* Módulo Fiscal */}
          <Route element={<ModuleRoute moduleKey="fiscal" />}>
            <Route element={<FiscalLayout />}>
              <Route path="/fiscal"              element={<NotasFiscais />} />
              <Route path="/fiscal/pipeline"     element={<FiscalPipeline />} />
            </Route>
          </Route>

          {/* Módulo Estoque */}
          <Route element={<ModuleRoute moduleKey="estoque" />}>
            <Route element={<EstoqueLayout />}>
              <Route path="/estoque"               element={<EstoqueHome />} />
              <Route path="/estoque/itens"         element={<Itens />} />
              <Route path="/estoque/movimentacoes" element={<Movimentacoes />} />
              <Route path="/estoque/inventario"    element={<Inventario />} />
              <Route path="/estoque/patrimonial"   element={<Patrimonial />} />
              <Route path="/estoque/solicitacoes" element={<SolicitacoesEstoque />} />
            </Route>
          </Route>

          {/* Módulo Logística */}
          <Route element={<ModuleRoute moduleKey="logistica" />}>
            <Route element={<LogisticaLayout />}>
              <Route path="/logistica"                   element={<LogisticaHome />} />
              <Route path="/logistica/solicitacoes"      element={<SolicitacoesPipeline />} />
              <Route path="/logistica/expedicao"         element={<ExpedicaoPipeline />} />
              <Route path="/logistica/transportes"       element={<TransportesPipeline />} />
              <Route path="/logistica/transportadoras"   element={<TransportadorasLog />} />
            </Route>
          </Route>

          {/* Módulo Frotas */}
          <Route element={<ModuleRoute moduleKey="frotas" />}>
            <Route element={<FrotasLayout />}>
              <Route path="/frotas"                      element={<FrotasHome />} />
              <Route path="/frotas/veiculos"             element={<Veiculos />} />
              <Route path="/frotas/ordens"               element={<Ordens />} />
              <Route path="/frotas/checklists"           element={<Checklists />} />
              <Route path="/frotas/abastecimentos"       element={<Abastecimentos />} />
              <Route path="/frotas/telemetria"           element={<Telemetria />} />
            </Route>
          </Route>

          {/* Módulo RH */}
          <Route element={<ModuleRoute moduleKey="rh" />}>
            <Route element={<RHLayout />}>
              <Route path="/rh"        element={<RHHome />} />
              <Route path="/rh/mural"  element={<MuralAdmin />} />
            </Route>
          </Route>

          {/* Módulo Contratos */}
          <Route element={<ModuleRoute moduleKey="contratos" />}>
            <Route element={<ContratosLayout />}>
              <Route path="/contratos"            element={<DashboardContratos />} />
              <Route path="/contratos/lista"      element={<ListaContratos />} />
              <Route path="/contratos/novo"       element={<NovoContrato />} />
              <Route path="/contratos/previsao"   element={<ParcelasContratos />} />
              <Route path="/contratos/aditivos"   element={<AditivosContratos />} />
              <Route path="/contratos/reajustes"  element={<ReajustesContratos />} />
              <Route path="/contratos/solicitacoes"       element={<SolicitacoesLista />} />
              <Route path="/contratos/solicitacoes/nova"  element={<NovaSolicitacao />} />
              <Route path="/contratos/solicitacoes/:id"   element={<SolicitacaoDetalhe />} />
              <Route path="/contratos/solicitacoes/:id/minuta" element={<PreparaMinuta />} />
              <Route path="/contratos/solicitacoes/:id/resumo" element={<ResumoExecutivoPage />} />
              <Route path="/contratos/assinaturas"  element={<Assinaturas />} />
              <Route path="/contratos/gestao"       element={<GestaoContratos />} />
              <Route path="/contratos/equipe-pj"    element={<EquipePJ />} />
              <Route path="/contratos/modelos"      element={<ModelosContrato />} />
            </Route>
          </Route>

          {/* Módulo Controladoria */}
          <Route element={<ModuleRoute moduleKey="controladoria" />}>
            <Route element={<ControladoriaLayout />}>
              <Route path="/controladoria"              element={<ControladoriaHome />} />
              <Route path="/controladoria/orcamentos"   element={<Orcamentos />} />
              <Route path="/controladoria/dre"          element={<DRE />} />
              <Route path="/controladoria/kpis"         element={<KPIs />} />
              <Route path="/controladoria/cenarios"     element={<Cenarios />} />
              <Route path="/controladoria/plano-orcamentario" element={<PlanoOrcamentario />} />
              <Route path="/controladoria/controle-orcamentario" element={<ControleOrcamentario />} />
              <Route path="/controladoria/indicadores" element={<PainelIndicadores />} />
              <Route path="/controladoria/alertas"     element={<AlertasDesvio />} />
            </Route>
          </Route>

          {/* Módulo Obras */}
          <Route element={<ModuleRoute moduleKey="obras" />}>
            <Route element={<ObrasLayout />}>
              <Route path="/obras"                    element={<ObrasHome />} />
              <Route path="/obras/apontamentos"       element={<Apontamentos />} />
              <Route path="/obras/rdo"                element={<RDO />} />
              <Route path="/obras/adiantamentos"      element={<AdiantamentosObras />} />
              <Route path="/obras/prestacao"          element={<PrestacaoContas />} />
              <Route path="/obras/equipe"            element={<PlanejamentoEquipe />} />
            </Route>
          </Route>

          {/* Módulo EGP (Escritório de Gestão de Projetos) */}
          <Route element={<ModuleRoute moduleKey="egp" />}>
            <Route element={<EGPLayout />}>
              <Route path="/egp"                              element={<EGPHome />} />
              <Route path="/egp/portfolio"                    element={<Portfolio />} />
              <Route path="/egp/portfolio/novo"               element={<NovoPortfolio />} />
              <Route path="/egp/portfolio/:id"                element={<PortfolioDetalhe />} />
              <Route path="/egp/tap"                          element={<TapHub />} />
              <Route path="/egp/tap/:portfolioId"              element={<TapPage />} />
              <Route path="/egp/eap"                          element={<EAPHub />} />
              <Route path="/egp/eap/:portfolioId"             element={<EAP />} />
              <Route path="/egp/cronograma"                   element={<CronogramaHub />} />
              <Route path="/egp/cronograma/:portfolioId"      element={<CronogramaEGP />} />
              <Route path="/egp/medicoes"                     element={<MedicoesHub />} />
              <Route path="/egp/medicoes/:portfolioId"        element={<MedicoesEGP />} />
              <Route path="/egp/histograma"                   element={<HistogramaHub />} />
              <Route path="/egp/histograma/:portfolioId"      element={<HistogramaEGP />} />
              <Route path="/egp/custos"                       element={<CustosHub />} />
              <Route path="/egp/custos/:portfolioId"          element={<ControleCustos />} />
              <Route path="/egp/fluxo-os"                     element={<FluxoOS />} />
              <Route path="/egp/reunioes"                     element={<ReunioesEGP />} />
              <Route path="/egp/indicadores"                  element={<StatusReportList />} />
            </Route>
          </Route>

          {/* Módulo Cadastros (Configurações Gerais) */}
          <Route element={<ModuleRoute moduleKey="cadastros" />}>
            <Route element={<CadastrosLayout />}>
              <Route path="/cadastros"                element={<CadastrosHome />} />
              <Route path="/cadastros/fornecedores"   element={<FornecedoresCad />} />
              <Route path="/cadastros/itens"          element={<ItensCad />} />
              <Route path="/cadastros/classes"        element={<ClassesFinanceiras />} />
              <Route path="/cadastros/centros-custo"  element={<CentrosCusto />} />
              <Route path="/cadastros/obras"          element={<ObrasCad />} />
              <Route path="/cadastros/colaboradores"  element={<ColaboradoresCad />} />
              <Route path="/cadastros/empresas"       element={<EmpresasCad />} />
              <Route path="/cadastros/grupos"          element={<GruposFinanceiros />} />
              <Route path="/cadastros/categorias"      element={<CategoriasFinanceiras />} />
            </Route>
          </Route>

          {/* Módulos stub */}
          <Route path="/ssma"       element={<SSMA />} />

          {/* Módulo Compras */}
          <Route element={<ModuleRoute moduleKey="compras" />}>
            <Route element={<Layout />}>
              <Route path="/compras"     element={<Dashboard />} />
              <Route path="/nova"        element={<NovaRequisicao />} />
              <Route path="/requisicoes" element={<ListaRequisicoes />} />
              <Route path="/requisicoes/:id" element={<RequisicaoDetalhe />} />
              <Route path="/cotacoes"    element={<FilaCotacoes />} />
              <Route path="/cotacoes/:id" element={<CotacaoForm />} />
              <Route path="/pedidos"     element={<Pedidos />} />
            </Route>
          </Route>
        </Route>

        {/* ── Admin ─────────────────────────────────────────── */}
        <Route element={<AdminRoute />}>
          <Route element={<Layout />}>
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
            <Route path="/admin/integracoes" element={<Configuracoes />} />
            <Route path="/admin/desenvolvimento" element={<Desenvolvimento />} />
          </Route>
        </Route>
      </Routes>
      <SuperTEGChat />
    </AuthProvider>
    </ThemeProvider>
  )
}
