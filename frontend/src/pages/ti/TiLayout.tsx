// Layout (shell + nav lateral) do módulo TI — wrapper fino sobre o ModuleLayout
// padrão do TEG+. Cabeçalho, rótulos e ordem espelham o Helpdesk TEG original.
import { LayoutDashboard, Inbox, Columns3, Plus, BookOpen, BarChart3, MessageSquareText, Laptop, FileSignature, Users, Settings } from 'lucide-react'
import ModuleLayout from '../../components/ModuleLayout'
import type { NavItem } from '../../components/ModuleLayout'
import { TiNotificationBell } from './components/TiNotificationBell'
import './ti.css'

// Ordem e rótulos iguais ao Helpdesk TEG original. "Usuários" e "Minha conta"
// ficam no menu do avatar do TEG+ (globais) — não duplicados aqui.
// "Chamados" usa end:true para não permanecer destacado em "Novo chamado"
// (/ti/chamados/novo) — assim só a aba certa fica ativa.
const NAV: NavItem[] = [
  { to: '/ti', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/ti/chamados', icon: Inbox, label: 'Chamados', end: true },
  { to: '/ti/quadro', icon: Columns3, label: 'Quadro', end: false },
  { to: '/ti/chamados/novo', icon: Plus, label: 'Novo chamado', end: false },
  { to: '/ti/base', icon: BookOpen, label: 'Base de conhecimento', end: false },
  { to: '/ti/relatorios', icon: BarChart3, label: 'Relatórios', end: false },
  { to: '/ti/respostas', icon: MessageSquareText, label: 'Respostas prontas', end: false },
  { to: '/ti/ativos', icon: Laptop, label: 'Ativos', end: false },
  { to: '/ti/termos', icon: FileSignature, label: 'Termos de entrega', end: false },
  { to: '/ti/usuarios', icon: Users, label: 'Usuários', end: false },
  { to: '/ti/configuracoes', icon: Settings, label: 'Configurações', end: false, adminOnly: true },
]

export default function TiLayout() {
  return (
    <ModuleLayout
      moduleKey="ti"
      moduleName="Helpdesk TEG"
      moduleEmoji="🖥️"
      accent="blue"
      nav={NAV}
      moduleSubtitle="Suporte de T.I."
      maxWidth="max-w-6xl"
      headerExtra={<TiNotificationBell />}
      disableRequisitanteMode
    />
  )
}
