// Layout (shell + nav lateral) do módulo TI — wrapper sobre o ModuleLayout do TEG+.
// Menu enxuto, no padrão dos demais módulos: topo fixo (Painel, Chamados, Nova
// Solicitação) + grupos COLAPSÁVEIS (cada um é uma barra que abre um painel
// flutuante com os sub-itens), via `navGroups` — mesmo recurso do módulo Painéis.
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, Plus, X,
  Laptop, FileSignature, Settings,
  Boxes, SlidersHorizontal,
} from 'lucide-react'
import ModuleLayout from '../../components/ModuleLayout'
import type { NavItem, NavGroup } from '../../components/ModuleLayout'
import { TiNotificationBell } from './components/TiNotificationBell'
import { NovoChamadoForm } from './NovoChamado'
import { useTiAuth } from './data/auth'
import './ti.css'

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

  // Modal "Nova Solicitação" GLOBAL do módulo (padrão Estoque/Nova Movimentação):
  // o item do menu acrescenta ?nova=1 à rota atual e o formulário abre em modal
  // com fundo embaçado sobre a tela em que o usuário estiver.
  const [searchParams, setSearchParams] = useSearchParams()
  const novaOpen = searchParams.has('nova')
  const closeNova = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('nova')
    setSearchParams(next, { replace: true })
  }

  // Topo fixo da EQUIPE. "Nova Solicitação" abre o MODAL sobre a tela atual
  // (não navega mais para /ti/chamados/novo — a rota segue viva p/ acesso direto).
  const navStaff: NavItem[] = [
    { to: '/ti', icon: LayoutDashboard, label: 'Painel', end: true },
    { to: '/ti/chamados', icon: Inbox, label: 'Chamados', end: true },
    { to: '?nova=1', icon: Plus, label: 'Nova Solicitação', end: false, action: () => setSearchParams({ nova: '1' }) },
  ]

  // Visão do COLABORADOR (não é equipe de TI): padrão do Compras/Estoque —
  // menu SÓ com o botão "Nova Solicitação", que abre o mesmo modal.
  const navColaborador: NavItem[] = [
    { to: '/ti?nova=1', icon: Plus, label: 'Nova Solicitação', end: false, accent: true, action: () => navigate('/ti?nova=1') },
  ]

  return (
    <>
      <ModuleLayout
        moduleKey="ti"
        moduleName="Helpdesk TEG"
        moduleEmoji="🖥️"
        accent="blue"
        nav={isStaff ? navStaff : navColaborador}
        navGroups={isStaff ? NAV_GROUPS : undefined}
        moduleSubtitle="Suporte de T.I."
        bottomNavMaxItems={6}
        truncateBottomLabels
        headerExtra={<div className="flex justify-end"><TiNotificationBell /></div>}
        disableRequisitanteMode
      />

      {/* Modal Nova Solicitação — mesmo padrão do Estoque (Nova Movimentação) */}
      {novaOpen && (
        <div className="ti-scope fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-extrabold text-slate-800">Nova Solicitação</h2>
              <button
                onClick={closeNova}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <NovoChamadoForm plain onCancel={closeNova} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
