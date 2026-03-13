import {
  LayoutDashboard, PlusCircle, List, ShoppingCart, Truck, User,
  Receipt, DollarSign, FileCheck2, Landmark, BarChart3, Users, Settings,
  Package2, ArrowLeftRight, ClipboardList,
  CheckCircle2,
  Car, Wrench, ClipboardCheck, Fuel, Radio,
  FileText, FilePlus, CalendarDays,
  ImagePlay,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Config compacta para referência centralizada de módulos ──────────────────
export interface ModuleNavItem {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
  adminOnly?: boolean
}

export interface ModuleMeta {
  name: string
  emoji: string
  color: string
  maxWidth?: string
  showAdminLink?: boolean
  navItems: ModuleNavItem[]
}

export const COMPRAS_CONFIG: ModuleMeta = {
  name: 'Compras',
  emoji: '🛒',
  color: 'teal',
  maxWidth: 'max-w-4xl',
  showAdminLink: true,
  navItems: [
    { to: '/compras',     icon: LayoutDashboard, label: 'Painel',      end: true  },
    { to: '/nova',        icon: PlusCircle,      label: 'Nova RC',     end: false },
    { to: '/requisicoes', icon: List,            label: 'Requisições', end: false },
    { to: '/cotacoes',    icon: ShoppingCart,    label: 'Cotações',    end: false },
    { to: '/pedidos',     icon: Truck,           label: 'Pedidos',     end: false },
    { to: '/perfil',      icon: User,            label: 'Perfil',      end: false },
  ],
}

export const FINANCEIRO_CONFIG: ModuleMeta = {
  name: 'Financeiro',
  emoji: '💰',
  color: 'emerald',
  navItems: [
    { to: '/financeiro',              icon: LayoutDashboard, label: 'Painel',          end: true  },
    { to: '/financeiro/cp',           icon: Receipt,         label: 'Contas a Pagar',  end: false },
    { to: '/financeiro/cr',           icon: DollarSign,      label: 'Contas a Receber', end: false },
    { to: '/financeiro/aprovacoes',   icon: FileCheck2,      label: 'Aprovações',      end: false },
    { to: '/financeiro/conciliacao',  icon: Landmark,        label: 'Conciliação',     end: false },
    { to: '/financeiro/relatorios',   icon: BarChart3,       label: 'Relatórios',      end: false },
    { to: '/financeiro/fornecedores', icon: Users,           label: 'Fornecedores',    end: false },
    { to: '/financeiro/configuracoes',icon: Settings,        label: 'Configurações',   end: false },
  ],
}

export const ESTOQUE_CONFIG: ModuleMeta = {
  name: 'Estoque',
  emoji: '📦',
  color: 'blue',
  navItems: [
    { to: '/estoque',               icon: LayoutDashboard, label: 'Painel',          end: true  },
    { to: '/estoque/itens',         icon: Package2,        label: 'Itens',           end: false },
    { to: '/estoque/movimentacoes', icon: ArrowLeftRight,  label: 'Movimentações',   end: false },
    { to: '/estoque/inventario',    icon: ClipboardList,   label: 'Inventário',      end: false },
    { to: '/estoque/patrimonial',   icon: Landmark,        label: 'Patrimonial',     end: false },
  ],
}

export const LOGISTICA_CONFIG: ModuleMeta = {
  name: 'Logística',
  emoji: '🚛',
  color: 'orange',
  navItems: [
    { to: '/logistica',                 icon: LayoutDashboard, label: 'Painel',          end: true  },
    { to: '/logistica/solicitacoes',    icon: ClipboardList,   label: 'Solicitações',    end: false },
    { to: '/logistica/expedicao',       icon: Package2,        label: 'Expedição',       end: false },
    { to: '/logistica/transportes',     icon: Truck,           label: 'Transportes',     end: false },
    { to: '/logistica/recebimentos',    icon: CheckCircle2,    label: 'Recebimentos',    end: false },
  ],
}

export const FROTAS_CONFIG: ModuleMeta = {
  name: 'Frotas',
  emoji: '🚗',
  color: 'rose',
  navItems: [
    { to: '/frotas',              icon: LayoutDashboard, label: 'Painel',          end: true  },
    { to: '/frotas/veiculos',     icon: Car,             label: 'Veículos',        end: false },
    { to: '/frotas/ordens',       icon: Wrench,          label: 'Ordens de Serviço', end: false },
    { to: '/frotas/checklists',   icon: ClipboardCheck,  label: 'Checklists',      end: false },
    { to: '/frotas/abastecimentos', icon: Fuel,          label: 'Abastecimentos',  end: false },
    { to: '/frotas/telemetria',   icon: Radio,           label: 'Telemetria',      end: false },
  ],
}

export const CONTRATOS_CONFIG: ModuleMeta = {
  name: 'Contratos',
  emoji: '📋',
  color: 'indigo',
  navItems: [
    { to: '/contratos',          icon: LayoutDashboard, label: 'Painel',    end: true  },
    { to: '/contratos/lista',    icon: FileText,        label: 'Contratos', end: false },
    { to: '/contratos/modelos',  icon: FilePlus,        label: 'Modelos',   end: false },
    { to: '/contratos/previsao', icon: CalendarDays,    label: 'Parcelas',  end: false },
  ],
}

export const RH_CONFIG: ModuleMeta = {
  name: 'RH',
  emoji: '👥',
  color: 'violet',
  navItems: [
    { to: '/rh',       icon: LayoutDashboard, label: 'Painel',           end: true  },
    { to: '/rh/mural', icon: ImagePlay,       label: 'Mural de Recados', end: false, adminOnly: true },
  ],
}
