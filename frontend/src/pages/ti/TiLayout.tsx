// Layout (shell + nav lateral) do módulo TI — wrapper sobre o ModuleLayout do TEG+.
// Menu enxuto, no padrão dos demais módulos: topo fixo (Painel, Chamados, Nova
// Solicitação) + grupos COLAPSÁVEIS (cada um é uma barra que abre um painel
// flutuante com os sub-itens), via `navGroups` — mesmo recurso do módulo Painéis.
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, Plus,
  Laptop, FileSignature, Settings,
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
    // Relatórios saiu do menu (virou a visão "Relatório" do Painel) e Usuários
    // também (gestão é feita no cadastro central /admin/usuarios; a rota
    // /ti/usuarios segue viva para acesso direto — é lá que se promove Agente).
    items: [
      { to: '/ti/configuracoes', icon: Settings, label: 'Configurações' },
    ],
  },
]

export default function TiLayout() {
  const { isStaff } = useTiAuth()
  const navigate = useNavigate()

  // Visão do COLABORADOR (não é equipe de TI): padrão do Compras/Estoque —
  // menu SÓ com o botão "Nova Solicitação", que abre o formulário em MODAL
  // sobre a home (/ti?nova=1 → fundo embaçado, padrão Nova Movimentação).
  const navColaborador: NavItem[] = [
    { to: '/ti?nova=1', icon: Plus, label: 'Nova Solicitação', end: false, accent: true, action: () => navigate('/ti?nova=1') },
  ]

  return (
    <ModuleLayout
      moduleKey="ti"
      moduleName="Helpdesk TEG"
      moduleEmoji="🖥️"
      accent="blue"
      nav={isStaff ? NAV : navColaborador}
      navGroups={isStaff ? NAV_GROUPS : undefined}
      moduleSubtitle="Suporte de T.I."
      bottomNavMaxItems={6}
      truncateBottomLabels
      headerExtra={<div className="flex justify-end"><TiNotificationBell /></div>}
      disableRequisitanteMode
    />
  )
}
