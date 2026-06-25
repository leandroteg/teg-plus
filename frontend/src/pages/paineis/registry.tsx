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
//  rota-índice que o módulo já usa, ex.: /financeiro → DashboardFinanceiro) e
//  aponta também a versão MOBILE-native (<Modulo>Mobile, reusa os mesmos hooks).
//  Não recriamos o desktop — só apontamos para o componente existente via lazy().
//
//  Para adicionar um módulo novo no futuro: 1 linha aqui. O hub monta a
//  navegação (agrupada por `pilar`) e as telas a partir desta lista, filtrada
//  pela permissão do usuário (admin vê todos; demais só os liberados).
//
//  `key` precisa ser a MESMA chave usada em hasModule()/ModuleRoute do módulo.
//  `pilar` agrupa o painel no menu lateral (mesmos pilares da tela inicial).
//  `Painel` = desktop (lg+) · `Mobile` = versão mobile-native (<lg).
// ─────────────────────────────────────────────────────────────────────────────

export type Pilar = 'Projetos' | 'Suprimentos' | 'Backoffice' | 'Governança' | 'Expansão'

export interface PainelDef {
  key: string
  label: string
  desc: string
  emoji: string
  Icon: LucideIcon
  accent: string   // hex — usado em realces inline (borda/ícone), não classe Tailwind
  route: string    // deep-link para o módulo completo
  pilar: Pilar
  Painel: LazyExoticComponent<ComponentType>
  Mobile: LazyExoticComponent<ComponentType>
}

export const PAINEIS: PainelDef[] = [
  // Backoffice
  { key: 'financeiro',    label: 'Financeiro',     desc: 'Contas, fluxo de caixa e conciliação',   emoji: '💰', Icon: Banknote,       accent: '#34D399', route: '/financeiro',    pilar: 'Backoffice',  Painel: lazy(() => import('../financeiro/DashboardFinanceiro')),  Mobile: lazy(() => import('../financeiro/DashboardFinanceiroMobile')) },
  { key: 'controladoria', label: 'Controladoria',  desc: 'Indicadores e relatórios gerenciais',     emoji: '📈', Icon: BarChart3,      accent: '#34D399', route: '/controladoria', pilar: 'Backoffice',  Painel: lazy(() => import('../controladoria/ControladoriaHome')),  Mobile: lazy(() => import('../controladoria/ControladoriaHomeMobile')) },
  { key: 'contratos',     label: 'Contratos',      desc: 'Gestão de contratos e SLAs',              emoji: '📋', Icon: FileText,       accent: '#34D399', route: '/contratos',     pilar: 'Backoffice',  Painel: lazy(() => import('../contratos/DashboardContratos')),    Mobile: lazy(() => import('../contratos/DashboardContratosMobile')) },
  { key: 'fiscal',        label: 'Fiscal',         desc: 'Notas fiscais e créditos',                emoji: '🧾', Icon: Receipt,        accent: '#34D399', route: '/fiscal',        pilar: 'Backoffice',  Painel: lazy(() => import('../fiscal/FiscalHome')),               Mobile: lazy(() => import('../fiscal/FiscalHomeMobile')) },
  // Projetos
  { key: 'egp',           label: 'EGP · Projetos', desc: 'Portfólio e gestão de projetos',          emoji: '📊', Icon: FolderKanban,   accent: '#818CF8', route: '/egp',           pilar: 'Projetos',    Painel: lazy(() => import('../pmo/EGPPainel')),                   Mobile: lazy(() => import('../pmo/EGPPainelMobile')) },
  { key: 'obras',         label: 'Obras',          desc: 'Acompanhamento de obras ativas',          emoji: '🏗️', Icon: HardHat,        accent: '#818CF8', route: '/obras',         pilar: 'Projetos',    Painel: lazy(() => import('../obras/ObrasHome')),                 Mobile: lazy(() => import('../obras/ObrasHomeMobile')) },
  // Suprimentos
  { key: 'compras',       label: 'Compras',        desc: 'Requisições, cotações e pedidos',         emoji: '🛒', Icon: ShoppingCart,   accent: '#2DD4BF', route: '/compras',       pilar: 'Suprimentos', Painel: lazy(() => import('../Dashboard')),                       Mobile: lazy(() => import('../DashboardMobile')) },
  { key: 'logistica',     label: 'Logística',      desc: 'Transportes e expedição',                 emoji: '🚚', Icon: Truck,          accent: '#2DD4BF', route: '/logistica',     pilar: 'Suprimentos', Painel: lazy(() => import('../logistica/LogisticaHome')),         Mobile: lazy(() => import('../logistica/LogisticaHomeMobile')) },
  { key: 'estoque',       label: 'Estoque',        desc: 'Almoxarifado e inventário',               emoji: '📦', Icon: Package,        accent: '#2DD4BF', route: '/estoque',       pilar: 'Suprimentos', Painel: lazy(() => import('../estoque/EstoqueHome')),             Mobile: lazy(() => import('../estoque/EstoqueHomeMobile')) },
  { key: 'patrimonial',   label: 'Patrimonial',    desc: 'Ativos e depreciação',                    emoji: '🏛️', Icon: Building2,      accent: '#2DD4BF', route: '/patrimonial',   pilar: 'Suprimentos', Painel: lazy(() => import('../patrimonial/PatrimonialHome')),     Mobile: lazy(() => import('../patrimonial/PatrimonialHomeMobile')) },
  { key: 'frotas',        label: 'Frotas',         desc: 'Veículos, OS e telemetria',               emoji: '🚛', Icon: Car,            accent: '#2DD4BF', route: '/frotas',        pilar: 'Suprimentos', Painel: lazy(() => import('../frotas/FrotasHome')),               Mobile: lazy(() => import('../frotas/FrotasHomeMobile')) },
  { key: 'locacoes',      label: 'Locação Imóveis',desc: 'Imóveis, aditivos e faturas',             emoji: '🏘️', Icon: KeySquare,     accent: '#2DD4BF', route: '/locacoes',      pilar: 'Suprimentos', Painel: lazy(() => import('../locacao/LocacaoHome')),             Mobile: lazy(() => import('../locacao/LocacaoHomeMobile')) },
  // Expansão
  { key: 'orcamentacao',  label: 'Orçamentação',   desc: 'Estimativa de LT por KMZ',                emoji: '📐', Icon: Calculator,     accent: '#FBBF24', route: '/orcamentacao',  pilar: 'Expansão',    Painel: lazy(() => import('../orcamentacao/OrcamentacaoHome')),   Mobile: lazy(() => import('../orcamentacao/OrcamentacaoHomeMobile')) },
  // Governança
  { key: 'sgi',           label: 'Gestão · SGI',   desc: 'Documentos, NC/melhoria e objetivos',     emoji: '⚖️', Icon: ClipboardCheck, accent: '#C4B5FD', route: '/sgi',           pilar: 'Governança',  Painel: lazy(() => import('../sgi/SgiPainel')),                   Mobile: lazy(() => import('../sgi/SgiPainelMobile')) },
]
