// Layout (shell + nav lateral) do módulo TI — wrapper sobre o ModuleLayout do TEG+.
// Menu enxuto, no padrão dos demais módulos: topo fixo (Painel, Chamados, Nova
// Solicitação) + grupos COLAPSÁVEIS (cada um é uma barra que abre um painel
// flutuante com os sub-itens), via `navGroups` — mesmo recurso do módulo Painéis.
import {
  LayoutDashboard, Inbox, Plus,
  Laptop, FileSignature, Users, Settings,
  Boxes, SlidersHorizontal,
} from 'lucide-react'
import ModuleLayout from '../../components/ModuleLayout'
import type { NavItem, NavGroup } from '../../components/ModuleLayout'
import { TiNotificationBell } from './components/TiNotificationBell'
import { useTiAuth } from './data/auth'
import './ti.css'

// Topo fixo (sempre visível). "Chamados" usa end:true para não ficar destacado
// quando estamos em "Nova Solicitação" (/ti/chamados/novo).
const NAV: NavItem[] = [
  { to: '/ti', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/ti/chamados', icon: Inbox, label: 'Chamados', end: true },
  { to: '/ti/chamados/novo', icon: Plus, label: 'Nova Solicitação', end: false },
]

// Grupos colapsáveis — cada um vira uma barra clicável que abre um flyout.
// Quadro/Respostas/Base saíram do menu: agora são ABAS na tela de Chamados
// (fita horizontal TiTabs, padrão do pipeline do Financeiro).
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'ativos',
    label: 'Ativos',
    icon: Boxes,
    items: [
      { to: '/ti/ativos', icon: Laptop, label: 'Ativos' },
      { to: '/ti/termos', icon: FileSignature, label: 'Termos de entrega' },
    ],
  },
  {
    key: 'gestao',
    label: 'Gestão',
    icon: SlidersHorizontal,
    // Relatórios saiu do menu: agora é a visão "Relatório" do Painel (seletor
    // no título, padrão Painel-Compras). A rota /ti/relatorios segue viva.
    items: [
      { to: '/ti/usuarios', icon: Users, label: 'Usuários' },
      { to: '/ti/configuracoes', icon: Settings, label: 'Configurações' },
    ],
  },
]

// Visão do COLABORADOR (não é equipe de TI): menu enxuto — a navegação do fluxo
// (Painel → Meus Chamados → Base de Conhecimento) acontece pela fita TiTabs.
const NAV_COLABORADOR: NavItem[] = [
  { to: '/ti', icon: LayoutDashboard, label: 'Painel', end: true },
  { to: '/ti/chamados', icon: Inbox, label: 'Meus Chamados', end: true },
  { to: '/ti/chamados/novo', icon: Plus, label: 'Nova Solicitação', end: false },
]

export default function TiLayout() {
  const { isStaff } = useTiAuth()
  return (
    <ModuleLayout
      moduleKey="ti"
      moduleName="Helpdesk TEG"
      moduleEmoji="🖥️"
      accent="blue"
      nav={isStaff ? NAV : NAV_COLABORADOR}
      navGroups={isStaff ? NAV_GROUPS : undefined}
      moduleSubtitle="Suporte de T.I."
      maxWidth="max-w-6xl"
      bottomNavMaxItems={6}
      headerExtra={<TiNotificationBell />}
      disableRequisitanteMode
    />
  )
}
