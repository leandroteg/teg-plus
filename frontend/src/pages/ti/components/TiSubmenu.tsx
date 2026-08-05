// Submenu do cabeçalho — mesmo padrão do seletor de visão do Painel de T.I.
// (Home.tsx → titleExtra) e do Painel-Compras: dropdown discreto colado ao
// título. Reúne as telas de apoio (Precisam de Atenção, Chamados Recentes,
// Respostas Prontas, Base de Conhecimento) sem ocupar espaço na fita de abas.
//
// Seleciona → navega. Em cada uma dessas telas o dropdown já abre marcando a
// atual, então dá para pular direto de uma para outra.
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

const ITENS = [
  { to: '/ti/chamados', label: 'Chamados' },
  { to: '/ti/mais', label: 'Mais opções' },
]

// Telas que vivem dentro de "Mais opções": estando em qualquer uma delas, o
// submenu já aparece marcando "Mais opções".
const DENTRO_DE_MAIS = ['/ti/atencao', '/ti/recentes', '/ti/respostas', '/ti/base']

export function TiSubmenu() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Rota atual entre as do submenu; as telas de apoio contam como "Mais opções";
  // fora disso, cai em Chamados (o item-âncora).
  const atual = DENTRO_DE_MAIS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ? '/ti/mais'
    : ITENS.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))?.to ?? ITENS[0].to

  return (
    <div className="relative print:hidden">
      <select
        value={atual}
        onChange={(e) => navigate(e.target.value)}
        aria-label="Ir para"
        className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-7 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100"
      >
        {ITENS.map((i) => (
          <option key={i.to} value={i.to}>{i.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
    </div>
  )
}
