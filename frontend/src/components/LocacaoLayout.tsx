import {
  LayoutDashboard, Building2, FileText, Wrench,
  RefreshCw, Handshake, ArrowRightFromLine, Plus,
} from 'lucide-react'
import { useState } from 'react'
import ModuleLayout from './ModuleLayout'
import type { NavItem } from './ModuleLayout'
import NovaSolicitacaoModal from './locacao/NovaSolicitacaoModal'

export default function LocacaoLayout() {
  const [showModal, setShowModal] = useState(false)

  const NAV: NavItem[] = [
    { to: '/locacoes',              icon: LayoutDashboard,     label: 'Painel',                   end: true },
    {
      to: '/locacoes',
      icon: Plus,
      label: '+ Nova Solicitação',
      end: false,
      action: () => setShowModal(true),
      accent: true,
    },
    { to: '/locacoes/entradas',     icon: Building2,           label: 'Entradas'                  },
    { to: '/locacoes/ativos',       icon: Building2,           label: 'Ativos'                    },
    { to: '/locacoes/faturas',      icon: FileText,            label: 'Faturas'                   },
    { to: '/locacoes/servicos',     icon: Wrench,              label: 'Manutenções e Serviços'    },
    { to: '/locacoes/aditivos',     icon: RefreshCw,           label: 'Aditivos & Renovações'     },
    { to: '/locacoes/acordos',      icon: Handshake,           label: 'Acordos'                   },
    { to: '/locacoes/saida',        icon: ArrowRightFromLine,  label: 'Saída'                     },
  ]

  return (
    <>
      <ModuleLayout
        moduleKey="locacoes"
        moduleName="Locação Imóveis"
        moduleEmoji="🏘️"
        accent="indigo"
        nav={NAV}
        bottomNavMaxItems={5}
        truncateBottomLabels
      />
      {showModal && <NovaSolicitacaoModal onClose={() => setShowModal(false)} />}
    </>
  )
}
