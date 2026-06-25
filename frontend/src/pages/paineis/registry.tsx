import { lazy } from 'react'
import type { LazyExoticComponent, ComponentType } from 'react'
import {
  Banknote, BarChart3, FileText, Receipt, HardHat, FolderKanban, Truck, Car,
  KeySquare, Building2, Package, Calculator, ShoppingCart, ClipboardCheck,
  type LucideIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
//  Registro central dos painéis. Fonte única da verdade do módulo "Painéis".
//
//  Cada entrada REAPROVEITA o componente de painel real do módulo (a mesma
//  rota-índice que o módulo já usa, ex.: /financeiro → DashboardFinanceiro).
//  Não recriamos nada — só apontamos para o componente existente via lazy().
//
//  Para adicionar um módulo novo no futuro: 1 linha aqui. O hub monta a
//  navegação e as telas a partir desta lista, filtrada pela permissão do
//  usuário (admin vê todos; demais só os módulos liberados via hasModule).
//
//  `key` precisa ser a MESMA chave usada em hasModule()/ModuleRoute do módulo.
// ─────────────────────────────────────────────────────────────────────────────

export interface PainelDef {
  key: string
  label: string
  desc: string
  emoji: string
  Icon: LucideIcon
  accent: string   // hex — usado em realces inline (borda/ícone), não classe Tailwind
  route: string    // deep-link para o módulo completo
  Painel: LazyExoticComponent<ComponentType>
}

export const PAINEIS: PainelDef[] = [
  // Backoffice
  { key: 'financeiro',    label: 'Financeiro',     desc: 'Contas, fluxo de caixa e conciliação',   emoji: '💰', Icon: Banknote,       accent: '#34D399', route: '/financeiro',    Painel: lazy(() => import('../financeiro/DashboardFinanceiro')) },
  { key: 'controladoria', label: 'Controladoria',  desc: 'Indicadores e relatórios gerenciais',     emoji: '📈', Icon: BarChart3,      accent: '#34D399', route: '/controladoria', Painel: lazy(() => import('../controladoria/ControladoriaHome')) },
  { key: 'contratos',     label: 'Contratos',      desc: 'Gestão de contratos e SLAs',              emoji: '📋', Icon: FileText,       accent: '#34D399', route: '/contratos',     Painel: lazy(() => import('../contratos/DashboardContratos')) },
  { key: 'fiscal',        label: 'Fiscal',         desc: 'Notas fiscais e créditos',                emoji: '🧾', Icon: Receipt,        accent: '#34D399', route: '/fiscal',        Painel: lazy(() => import('../fiscal/FiscalHome')) },
  // Projetos
  { key: 'egp',           label: 'EGP · Projetos', desc: 'Portfólio e gestão de projetos',          emoji: '📊', Icon: FolderKanban,   accent: '#818CF8', route: '/egp',           Painel: lazy(() => import('../pmo/EGPPainel')) },
  { key: 'obras',         label: 'Obras',          desc: 'Acompanhamento de obras ativas',          emoji: '🏗️', Icon: HardHat,        accent: '#818CF8', route: '/obras',         Painel: lazy(() => import('../obras/ObrasHome')) },
  // Suprimentos
  { key: 'compras',       label: 'Compras',        desc: 'Requisições, cotações e pedidos',         emoji: '🛒', Icon: ShoppingCart,   accent: '#2DD4BF', route: '/compras',       Painel: lazy(() => import('../Dashboard')) },
  { key: 'logistica',     label: 'Logística',      desc: 'Transportes e expedição',                 emoji: '🚚', Icon: Truck,          accent: '#2DD4BF', route: '/logistica',     Painel: lazy(() => import('../logistica/LogisticaHome')) },
  { key: 'estoque',       label: 'Estoque',        desc: 'Almoxarifado e inventário',               emoji: '📦', Icon: Package,        accent: '#2DD4BF', route: '/estoque',       Painel: lazy(() => import('../estoque/EstoqueHome')) },
  { key: 'patrimonial',   label: 'Patrimonial',    desc: 'Ativos e depreciação',                    emoji: '🏛️', Icon: Building2,      accent: '#2DD4BF', route: '/patrimonial',   Painel: lazy(() => import('../patrimonial/PatrimonialHome')) },
  { key: 'frotas',        label: 'Frotas',         desc: 'Veículos, OS e telemetria',               emoji: '🚛', Icon: Car,            accent: '#2DD4BF', route: '/frotas',        Painel: lazy(() => import('../frotas/FrotasHome')) },
  { key: 'locacoes',      label: 'Locação Imóveis',desc: 'Imóveis, aditivos e faturas',             emoji: '🏘️', Icon: KeySquare,     accent: '#2DD4BF', route: '/locacoes',      Painel: lazy(() => import('../locacao/LocacaoHome')) },
  // Expansão
  { key: 'orcamentacao',  label: 'Orçamentação',   desc: 'Estimativa de LT por KMZ',                emoji: '📐', Icon: Calculator,     accent: '#FBBF24', route: '/orcamentacao',  Painel: lazy(() => import('../orcamentacao/OrcamentacaoHome')) },
  // Governança
  { key: 'sgi',           label: 'Gestão · SGI',   desc: 'Documentos, NC/melhoria e objetivos',     emoji: '⚖️', Icon: ClipboardCheck, accent: '#C4B5FD', route: '/sgi',           Painel: lazy(() => import('../sgi/SgiPainel')) },
]
