// "Mais opções" — tela-índice das ferramentas de apoio ao atendimento.
// A fita de abas ficou só com o essencial do dia a dia (Chamados e Quadro);
// o que é consulta pontual mora aqui, alcançável pelo submenu do cabeçalho.
import { Link } from 'react-router-dom'
import { AlertTriangle, History, MessageSquareText, BookOpen, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from './components/ui'
import { TiTabs } from './components/TiTabs'
import { TiSubmenu } from './components/TiSubmenu'
import { useTiAuth } from './data/auth'

type Accent = 'amber' | 'rose' | 'teal' | 'emerald'

// Classes literais (o JIT do Tailwind não resolve concatenação dinâmica).
const ACCENT: Record<Accent, { icon: string; ring: string }> = {
  amber:   { icon: 'bg-amber-500/10 text-amber-600',     ring: 'hover:border-amber-400/50' },
  rose:    { icon: 'bg-rose-500/10 text-rose-600',       ring: 'hover:border-rose-400/50' },
  teal:    { icon: 'bg-teal-500/10 text-teal-600',       ring: 'hover:border-teal-400/50' },
  emerald: { icon: 'bg-emerald-500/10 text-emerald-600', ring: 'hover:border-emerald-400/50' },
}

const OPCOES: { to: string; label: string; desc: string; icon: LucideIcon; accent: Accent }[] = [
  { to: '/ti/atencao', label: 'Precisam de Atenção', desc: 'Chamados atrasados, sem responsável ou parados há tempo demais.', icon: AlertTriangle, accent: 'amber' },
  { to: '/ti/recentes', label: 'Chamados Recentes', desc: 'O que entrou por último, na ordem de chegada.', icon: History, accent: 'rose' },
  { to: '/ti/respostas', label: 'Respostas Prontas', desc: 'Modelos de resposta para agilizar o atendimento.', icon: MessageSquareText, accent: 'teal' },
  { to: '/ti/base', label: 'Base de Conhecimento', desc: 'Artigos e procedimentos de T.I. para consulta.', icon: BookOpen, accent: 'emerald' },
]

export default function Mais() {
  const { isStaff: staff } = useTiAuth()

  return (
    <div className="ti-scope">
      <PageHeader
        title="Mais opções"
        subtitle="Ferramentas de apoio ao atendimento"
        titleExtra={staff ? <TiSubmenu /> : undefined}
      />
      <TiTabs />

      <div className="grid gap-3 sm:grid-cols-2">
        {OPCOES.map(({ to, label, desc, icon: Icon, accent }) => {
          const a = ACCENT[accent]
          return (
            <Link
              key={to}
              to={to}
              className={`card flex items-center gap-4 p-5 transition-all hover:shadow-md ${a.ring}`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.icon}`}>
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">{label}</p>
                <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-300" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
