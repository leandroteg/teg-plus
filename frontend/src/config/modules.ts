import {
  LayoutDashboard, PlusCircle, List, ShoppingCart, Truck, User,
  Receipt, DollarSign, FileCheck2, Landmark, BarChart3, Users, Settings,
  Package2, ArrowLeftRight, ClipboardList,
  CheckCircle2, Building2,
  Car, Wrench, ClipboardCheck, Fuel, Radio,
  FileText, FilePlus, CalendarDays,
  ImagePlay,
} from 'lucide-react'
import type { ModuleConfig } from '../components/ModuleLayout'

export const COMPRAS_CONFIG: ModuleConfig = {
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

export const FINANCEIRO_CONFIG: ModuleConfig = {
  name: 'Financeiro',
  emoji: '💰',
  color: 'emerald',
  navItems: [
    { to: '/financeiro',              icon: LayoutDashboard, label: 'Painel',          end: true  },
    { to: '/financeiro/cp',           icon: Receipt,         label: 'Contas a Pagar',  end: false },
    { to: '/financeiro/cr',           icon: DollarSign,      label: 'A Receber',       end: false },
    { to: '/financeiro/aprovacoes',   icon: FileCheck2,      label: 'Aprovações',      end: false },
    { to: '/financeiro/conciliacao',  icon: Landmark,        label: 'Conciliação',     end: false },
    { to: '/financeiro/relatorios',   icon: BarChart3,       label: 'Relatórios',      end: false },
    { to: '/financeiro/fornecedores', icon: Users,           label: 'Fornecedores',    end: false },
    { to: '/financeiro/configuracoes',icon: Settings,        label: 'Configurações',   end: false },
  ],
}

export const ESTOQUE_CONFIG: ModuleConfig = {
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

export const LOGISTICA_CONFIG: ModuleConfig = {
  name: 'Logística',
  emoji: '🚛',
  color: 'orange',
  navItems: [
    { to: '/logistica',                 icon: LayoutDashboard, label: 'Painel',          end: true  },
    { to: '/logistica/solicitacoes',    icon: ClipboardList,   label: 'Solicitações',    end: false },
    { to: '/logistica/expedicao',       icon: Package2,        label: 'Expedição',       end: false },
    { to: '/logistica/transportes',     icon: Truck,           label: 'Transportes',     end: false },
    { to: '/logistica/recebimentos',    icon: CheckCircle2,    label: 'Recebimentos',    end: false },
    { to: '/logistica/transportadoras', icon: Building2,       label: 'Transportadoras', end: false },
  ],
}

export const FROTAS_CONFIG: ModuleConfig = {
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

export const CONTRATOS_CONFIG: ModuleConfig = {
  name: 'Contratos',
  emoji: '📋',
  color: 'indigo',
  navItems: [
    { to: '/contratos',          icon: LayoutDashboard, label: 'Painel',    end: true  },
    { to: '/contratos/lista',    icon: FileText,        label: 'Contratos', end: false },
    { to: '/contratos/novo',     icon: FilePlus,        label: 'Novo',      end: false },
    { to: '/contratos/parcelas', icon: CalendarDays,    label: 'Parcelas',  end: false },
  ],
}

export const RH_CONFIG: ModuleConfig = {
  name: 'RH',
  emoji: '👥',
  color: 'violet',
  navItems: [
    { to: '/rh',       icon: LayoutDashboard, label: 'Painel',           end: true  },
    { to: '/rh/mural', icon: ImagePlay,       label: 'Mural de Recados', end: false, adminOnly: true },
  ],
}
